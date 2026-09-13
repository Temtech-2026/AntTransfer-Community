/*
 * Copyright (c) 2026 AntTransfer Community Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.anttransfer.it;

import com.anttransfer.common.constant.RedisKeyConstants;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.file.model.dto.RedeemTicketRequest;
import com.anttransfer.file.model.dto.VerifyShareRequest;
import com.anttransfer.file.service.ShareAccessService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 外发分享「并发扣减不超发」集成测试（Testcontainers 独立 MySQL + Redis，真实 SQL 语义）。
 *
 * <p><b>为什么用服务层直调而非 HTTP</b>：接口层的 {@code @RateLimit}（换票 10 次 / 分）会先挡住
 * 并发流量，测不到底层的原子扣减；此处绕过限流，直接压 {@code ShareAccessService}，
 * 让 12 个并发核销真实争抢同一行的行锁，验证需求 #3「Redis DECR + DB 原子扣减，绝不超发」。</p>
 *
 * <p><b>断言要点</b>：额度 3、并发 12 → 恰好 3 成功、9 失败（4004）；
 * {@code downloaded_count} 恒为 3（不多不少）；链接收敛为终态 {@code status=2}；
 * Redis 镜像归零，与 DB 最终一致。</p>
 *
 * <p>需要 Docker；本机无 Docker 时自动跳过（disabledWithoutDocker）。数据仅落本次容器实例。</p>
 *
 * @author AntTransfer CE
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ShareQuotaConcurrencyIntegrationTest {

    /** 提取码明文（测试自算 BCrypt 散列落库） */
    private static final String CODE = "Abc123456";
    /** 下载额度 */
    private static final int QUOTA = 3;
    /** 并发访客数（远大于额度，制造超卖压力） */
    private static final int VISITORS = 12;
    /** 链接过期错误码 */
    private static final int CODE_EXPIRED_OR_LIMIT = 4004;
    /** 提取码锁定错误码 */
    private static final int CODE_LOCKED = 4011;
    /** 提取码错误码 */
    private static final int CODE_WRONG_EXTRACT = 4010;

    private static final long FILE_ID = 9_900_000_000_000_001L;
    private static final long OWNER_USER_ID = 1L;

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("anttransfer")
            .withUsername("root")
            .withPassword("123456")
            .withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci");

    @Container
    static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    @DynamicPropertySource
    static void dataSourceProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () ->
                "jdbc:mysql://" + MYSQL.getHost() + ":" + MYSQL.getMappedPort(3306)
                        + "/anttransfer?useUnicode=true&characterEncoding=utf-8"
                        + "&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai");
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    }

    @Autowired
    private ShareAccessService shareAccessService;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private StringRedisTemplate redis;

    /* ==================== 1. 并发核销绝不超发 ==================== */

    @Test
    void concurrentRedeem_shouldNeverExceedQuota() throws Exception {
        String token = newToken();
        long shareId = insertLink(token, QUOTA);
        // 与创建链路一致：初始化 Redis 配额镜像（前置闸）
        redis.opsForValue().set(RedisKeyConstants.shareCountKey(token), String.valueOf(QUOTA),
                Duration.ofHours(1));

        // ① 12 个访客先各自换票（换票只做非扣减预检，不应消费额度）
        List<String> tickets = new ArrayList<>();
        for (int i = 0; i < VISITORS; i++) {
            tickets.add(verify(token, "10.1.0." + i).getTicket());
        }
        assertEquals(VISITORS, tickets.size(), "换票不应消费下载额度");
        assertEquals(0, currentCount(shareId), "换票阶段 downloaded_count 必须仍为 0");

        // ② 12 个票据同时核销，争抢同一行
        AtomicInteger success = new AtomicInteger();
        Set<Integer> failureCodes = ConcurrentHashMap.newKeySet();
        ExecutorService pool = Executors.newFixedThreadPool(VISITORS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Void>> futures = new ArrayList<>();
        for (String ticket : tickets) {
            futures.add(pool.submit((Callable<Void>) () -> {
                start.await();
                RedeemTicketRequest req = new RedeemTicketRequest();
                req.setTicket(ticket);
                try {
                    shareAccessService.redeem(req, "10.1.0.9", "it-agent");
                    success.incrementAndGet();
                } catch (BusinessException e) {
                    failureCodes.add(e.getCode());
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<Void> f : futures) {
            f.get(30, TimeUnit.SECONDS);
        }
        pool.shutdown();
        assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));

        // ③ 恰好 QUOTA 成功、其余全部 4004
        assertEquals(QUOTA, success.get(), "成功次数必须恰好等于额度（不超发、不少发）");
        assertEquals(VISITORS - QUOTA, VISITORS - success.get());
        assertEquals(Set.of(CODE_EXPIRED_OR_LIMIT), failureCodes, "失败的都应是「已过期 / 次数耗尽」4004");

        // ④ DB 权威计数与终态
        assertEquals(QUOTA, currentCount(shareId), "downloaded_count 不得被写超");
        assertEquals(2, currentStatus(shareId), "用尽额度后应原子收敛为终态 status=2");

        // ⑤ Redis 镜像与 DB 最终一致（归零）
        assertEquals("0", redis.opsForValue().get(RedisKeyConstants.shareCountKey(token)),
                "镜像应归零，与 DB 保持一致");
    }

    /* ==================== 2. 提取码连错 5 次锁定 30 分钟 ==================== */

    @Test
    void wrongExtractCode_fiveTimes_shouldLockLink() {
        String token = newToken();
        insertLink(token, QUOTA);

        for (int i = 1; i <= 4; i++) {
            assertEquals(CODE_WRONG_EXTRACT, verifyCode(token, "Wrong-" + i),
                    "第 " + i + " 次错误应返回 4010（尚未达阈值）");
        }
        // 第 5 次达阈值 → 锁定
        assertEquals(CODE_LOCKED, verifyCode(token, "Wrong-5"), "第 5 次错误应触发锁定 4011");
        // 锁定后即便提取码正确也拒绝
        assertEquals(CODE_LOCKED, verifyCode(token, CODE), "锁定期内正确提取码也必须 4011");
        // 额度未被这些失败尝试消费
        assertEquals(0, currentCount(shareIdOf(token)));
    }

    /* ==================== helpers ==================== */

    private com.anttransfer.file.model.vo.ShareTicketVO verify(String token, String ip) {
        VerifyShareRequest req = new VerifyShareRequest();
        req.setExtractCode(CODE);
        req.setAccessType("download");
        com.anttransfer.file.model.vo.ShareTicketVO vo = shareAccessService.verify(token, req, ip, "it-agent");
        assertNotNull(vo.getTicket());
        return vo;
    }

    /** 返回错误码；成功返回 0 */
    private int verifyCode(String token, String code) {
        VerifyShareRequest req = new VerifyShareRequest();
        req.setExtractCode(code);
        req.setAccessType("download");
        try {
            shareAccessService.verify(token, req, "10.2.0.1", "it-agent");
            return 0;
        } catch (BusinessException e) {
            return e.getCode();
        }
    }

    private String newToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    private long insertLink(String token, int limit) {
        ensureFile();
        long id = Math.abs(UUID.randomUUID().getMostSignificantBits() & Long.MAX_VALUE);
        jdbc.update("""
                        insert into sys_share_link
                            (id, token, file_id, owner_user_id, extract_code_hash, expire_at,
                             download_limit, downloaded_count, status, tenant_id, create_by, deleted)
                        values (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 0)
                        """,
                id, token, FILE_ID, OWNER_USER_ID,
                new BCryptPasswordEncoder().encode(CODE),
                LocalDateTime.now().plusDays(1), limit, OWNER_USER_ID);
        return id;
    }

    private void ensureFile() {
        Integer exists = jdbc.queryForObject("select count(*) from sys_file where id = ?", Integer.class, FILE_ID);
        if (exists != null && exists > 0) {
            return;
        }
        jdbc.update("""
                        insert into sys_file
                            (id, sha256, size_bytes, original_name, content_type,
                             upload_user_id, status, tenant_id, create_by, deleted)
                        values (?, ?, 1024, 'concurrency-it.bin', 'application/octet-stream', ?, 0, 0, ?, 0)
                        """,
                FILE_ID, "a".repeat(64), OWNER_USER_ID, OWNER_USER_ID);
    }

    private long shareIdOf(String token) {
        Long id = jdbc.queryForObject("select id from sys_share_link where token = ?", Long.class, token);
        assertNotNull(id);
        return id;
    }

    private int currentCount(long shareId) {
        Integer count = jdbc.queryForObject(
                "select downloaded_count from sys_share_link where id = ?", Integer.class, shareId);
        return count == null ? -1 : count;
    }

    private int currentStatus(long shareId) {
        Integer status = jdbc.queryForObject(
                "select status from sys_share_link where id = ?", Integer.class, shareId);
        return status == null ? -1 : status;
    }
}
