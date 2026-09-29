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

import com.anttransfer.collaboration.service.ChatService;
import com.anttransfer.common.constant.RedisKeyConstants;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 会话对端备注的端到端验证：真实 MySQL 唯一键 + 真实网关限流。
 *
 * <p>单元测试（{@code ChatPeerAliasTest}）把 Mapper 全打桩，只能证明「代码打算怎么走」，
 * 证明不了三件只有真实 MySQL / 真实 Redis / 真实 HTTP 栈才回答得了的事：</p>
 * <ol>
 *     <li>{@code uk_owner_peer} 真的在库里——单测里的撞键是 Mockito 演的 {@code DuplicateKeyException}，
 *         DDL 里漏建唯一键它照样绿。本类绕过应用层直插第二行，让 InnoDB 自己说话。</li>
 *     <li>并发首设备注真的只落一行——{@code selectAny} 忽略逻辑删除 + 撞键回查改走更新这套设计
 *         唯一要防的事，也是「取消后复活」成立的前提（唯一键不含 {@code deleted}）。</li>
 *     <li>{@code @RateLimit} 真的在 Redis 上计数并吐 429——注解参数（窗口 / 上限 / 业务 key）
 *         写错在切面单测里看不出来，只有真发 31 次才回答「第 31 次是不是 429」。</li>
 * </ol>
 *
 * <p><b>为什么并发用例走服务层直调、限流用例走 HTTP</b>：与
 * {@code ShareQuotaConcurrencyIntegrationTest} 同一取舍——{@code @RateLimit}（30 次 / 分）
 * 会先挡住并发流量，用 HTTP 压并发就测不到底层唯一键收敛；反之限流本身只有走完整 HTTP 栈
 * 才验得了「HTTP 429 + 4290」。两者分路，各测自己那一层。</p>
 *
 * <p>需要 Docker；本机无 Docker 时整类自动跳过。数据仅落本次容器实例，随容器销毁。</p>
 *
 * @author AntTransfer CE
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ChatPeerAliasE2eIntegrationTest {

    /** 复用 V2 初始 admin 的 BCrypt 密文（口令 Admin@123） */
    private static final String ADMIN_HASH =
            "$2a$10$0jf1qJCfrCZjCiFLVCa47euNdiww0bEWmXuza5h9kLM9quTU8zXqu";
    /** V2 种子管理员 ID（备注的 owner） */
    private static final long ADMIN_ID = 1L;
    /** 被备注账号 ID（本类在容器内自建） */
    private static final long PEER_ID = 31_001L;
    /** 被备注账号登录名 */
    private static final String PEER_USERNAME = "it_alias_peer";
    /** 并发线程数（远大于「一人对一人只该有一行」的期望行数） */
    private static final int THREADS = 16;
    /** 与 ChatController#setPeerAlias 上 @RateLimit 的 max 对齐 */
    private static final int RATE_LIMIT_MAX = 30;
    /** ErrorCode.RATE_LIMITED */
    private static final int CODE_RATE_LIMITED = 4290;
    /** 限流键：at:rl:ChatController#setPeerAlias:chat-peer-alias:{IP} */
    private static final String RATE_LIMIT_PATTERN =
            RedisKeyConstants.RATE_LIMIT_PREFIX + "ChatController#setPeerAlias:chat-peer-alias:*";

    /** 惰性缓存：整类只登录一次，避免耗掉 /v1/auth/token 自身的限流额度 */
    private static String cachedToken;

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
    private ChatService chatService;
    @Autowired
    private TestRestTemplate rest;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private StringRedisTemplate redis;
    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void ensurePeerAccount() {
        Integer exists = jdbc.queryForObject(
                "select count(*) from sys_user where id = ?", Integer.class, PEER_ID);
        if (exists != null && exists > 0) {
            return;
        }
        jdbc.update("""
                        insert into sys_user
                            (id, username, password_hash, nickname, remark, tenant_id, status, token_epoch, deleted)
                        values (?, ?, ?, '被备注的同事', 'it', 0, 0, 0, 0)
                        """,
                PEER_ID, PEER_USERNAME, ADMIN_HASH);
    }

    /* ==================== 1. 真实唯一键：绕过应用层也会被 InnoDB 拦下 ==================== */

    /**
     * 直接 JDBC 插两行同一 {@code (owner, peer)}：第二行必须由 MySQL 拒绝。
     *
     * <p>这是「唯一键真的建了」的唯一可信证据——单测里那个 {@code DuplicateKeyException}
     * 是 Mockito 演的，DDL 漏建唯一键它也会绿。</p>
     */
    @Test
    @DisplayName("真实唯一键：直插第二行被 uk_owner_peer 拒绝，绕过应用层也无从插入")
    void uniqueIndex_shouldRejectSecondRow() {
        clearAliasRows();

        insertAliasRowRaw(newId(), "直插-A");

        assertThrows(DataIntegrityViolationException.class,
                () -> insertAliasRowRaw(newId(), "直插-B"),
                "同一 (owner, peer) 插入第二行必须被 MySQL 唯一键拒绝（uk_owner_peer 不含 deleted）");

        assertEquals(1, aliasRowCount(), "(我, 他) 只能存在一行");
    }

    /* ==================== 2. 并发首次设置：撞键收敛为一行 ==================== */

    /**
     * 16 线程同时给同一 {@code (我, 他)} 首次设备注。
     *
     * <p>{@code selectAny} 在并发下会集体返回 null（都以为「还没设备注」），于是同时 insert，
     * 唯一键只放行一个。设计承诺是「撞键者回查后改走更新，一次重试即收敛」——
     * 本用例把「没有一个请求失败、库里恰好一行」钉死。</p>
     */
    @RepeatedTest(5)
    @DisplayName("并发首设备注：16 线程抢同一 (我, 他) 只落一行，撞键被收敛成更新而不是报错（连跑 5 轮）")
    void concurrentFirstSet_shouldCollapseToOneRow() throws Exception {
        clearAliasRows();

        Map<Integer, String> submitted = new LinkedHashMap<>();
        Set<String> failures = ConcurrentHashMap.newKeySet();
        for (int i = 0; i < THREADS; i++) {
            submitted.put(i, "并发备注-" + i);
        }
        runConcurrently(i -> chatService.setPeerAlias(ADMIN_ID, PEER_ID, submitted.get(i)), failures);

        assertTrue(failures.isEmpty(),
                "并发设置同一对端不应有任何请求失败（撞键必须被回查更新收敛）：" + failures);
        assertEquals(1, aliasRowCount(), "(我, 他) 只能落入一行");
        assertEquals(0, deletedOfPeerRow(), "收敛后的行必须是「生效」状态");
        assertTrue(submitted.containsValue(aliasOfPeerRow()),
                "最终别名应是某一次提交的原值，而不是被截断 / 拼接的中间态：" + aliasOfPeerRow());
    }

    /* ==================== 3. 取消后并发复活：复用同一行 ==================== */

    /**
     * 先取消备注（{@code deleted=1}，行仍在），再 16 线程并发重新设置。
     *
     * <p>这是「唯一键不含 {@code deleted}」这一裁决的专属回归：既然取消是逻辑删除、
     * 重建又必须复用那一行，那并发重建就只能全部走 UPDATE；一旦有人走了 insert，
     * 就会撞上那条 {@code deleted=1} 的旧行——本用例断言行主键不变。</p>
     */
    @RepeatedTest(5)
    @DisplayName("取消后并发复活：行主键不变（复用同一行），不产生第二行（连跑 5 轮）")
    void clearThenConcurrentSet_shouldReviveSameRow() throws Exception {
        clearAliasRows();
        chatService.setPeerAlias(ADMIN_ID, PEER_ID, "初始备注");
        long originalId = peerRowId();
        assertEquals(1, aliasRowCount());

        chatService.clearPeerAlias(ADMIN_ID, PEER_ID);
        assertEquals(1, aliasRowCount(), "取消备注是逻辑删除，行仍在（复活语义的前提）");
        assertEquals(1, deletedOfPeerRow(), "取消备注后该行应为 deleted=1");

        Map<Integer, String> submitted = new LinkedHashMap<>();
        Set<String> failures = ConcurrentHashMap.newKeySet();
        for (int i = 0; i < THREADS; i++) {
            submitted.put(i, "复活备注-" + i);
        }
        runConcurrently(i -> chatService.setPeerAlias(ADMIN_ID, PEER_ID, submitted.get(i)), failures);

        assertTrue(failures.isEmpty(), "并发复活不应有任何请求失败：" + failures);
        assertEquals(originalId, peerRowId(), "复活必须复用原行，主键不得改变（否则就是插了新行）");
        assertEquals(1, aliasRowCount(), "(我, 他) 仍然只有一行");
        assertEquals(0, deletedOfPeerRow(), "复活后该行应回到 deleted=0");
        assertTrue(submitted.containsValue(aliasOfPeerRow()));
    }

    /* ==================== 4. 网关限流：真实 Redis 计数 + HTTP 429 ==================== */

    /**
     * 连发 {@code RATE_LIMIT_MAX} 次设置备注（窗口配额内），第 31 次必须 429。
     *
     * <p>前 30 次除状态码外还断言回吐的 {@code alias}——限流切面在业务之前计数，
     * 若切面把参数吃掉了，业务就会「限流没挡住、备注也没设上」，只断 429 会漏掉这一半。</p>
     */
    @Test
    @DisplayName("网关限流：窗口内 30 次通过，第 31 次 HTTP 429 + 4290，计数落在 Redis")
    void httpSetAlias_shouldReturn429AfterWindowQuota() throws Exception {
        clearAliasRows();
        resetRateLimitWindow();
        String token = loginToken();
        String path = "/v1/chat/contacts/" + PEER_ID + "/alias";

        for (int i = 1; i <= RATE_LIMIT_MAX; i++) {
            ResponseEntity<String> resp = putAlias(path, "限流备注-" + i, token);
            assertEquals(HttpStatus.OK, resp.getStatusCode(),
                    "第 " + i + " 次仍在窗口配额内，不应被限流：" + resp.getBody());
            JsonNode body = objectMapper.readTree(resp.getBody());
            assertEquals(0, body.get("code").asInt(), "第 " + i + " 次业务应成功：" + resp.getBody());
            assertEquals("限流备注-" + i, body.get("data").get("alias").asText(),
                    "被限流放行的请求仍应真正写入备注");
        }

        ResponseEntity<String> blocked = putAlias(path, "第31次", token);
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, blocked.getStatusCode(),
                "超出窗口配额必须返回 HTTP 429，而不是 200：" + blocked.getBody());
        assertEquals(CODE_RATE_LIMITED,
                objectMapper.readTree(blocked.getBody()).get("code").asInt(),
                "超限错误码应为 4290（前端策略 G：退避重试）");
        assertEquals("限流备注-30", aliasOfPeerRow(), "被拒绝的那次不得写入备注");

        Set<String> keys = redis.keys(RATE_LIMIT_PATTERN);
        assertNotNull(keys);
        assertEquals(1, keys.size(), "限流键应按端点 + 业务 key + 维度（IP）唯一：" + keys);
        String counter = redis.opsForValue().get(keys.iterator().next());
        assertTrue(counter != null && Integer.parseInt(counter) >= RATE_LIMIT_MAX + 1,
                "Redis 计数必须真实累加（跨实例生效，不是进程内计数）：" + counter);
    }

    /* ==================== 5. HTTP 层取消备注是幂等的 ==================== */

    @Test
    @DisplayName("取消备注走 HTTP：重复调用都成功（DELETE 不限流、终态已达成）")
    void httpClearAlias_shouldBeIdempotent() throws Exception {
        String token = loginToken();
        String path = "/v1/chat/contacts/" + PEER_ID + "/alias";
        chatService.setPeerAlias(ADMIN_ID, PEER_ID, "待取消");

        assertEquals(0, bodyCode(deleteAlias(path, token)), "首次取消应成功");
        assertEquals(0, bodyCode(deleteAlias(path, token)), "重复取消同样成功（幂等）");
        assertEquals(0, activeAliasRowCount(), "取消后不应再有生效行（对端恢复真实昵称）");
        assertEquals(1, aliasRowCount(), "取消是逻辑删除：物理行仍在，复活语义正是依赖它");
        assertEquals(1, deletedOfPeerRow(), "取消后该行应为 deleted=1");
    }

    /* ==================== helpers ==================== */

    /** 起跑线对齐的并发执行器：{@code THREADS} 个线程同时进入任务体。 */
    private void runConcurrently(java.util.function.IntConsumer task, Set<String> failures) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            int seq = i;
            futures.add(pool.submit(() -> {
                try {
                    start.await();
                    task.accept(seq);
                } catch (Exception e) {
                    failures.add(e.getClass().getSimpleName() + ": " + e.getMessage());
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) {
            f.get(60, TimeUnit.SECONDS);
        }
        pool.shutdown();
        assertTrue(pool.awaitTermination(20, TimeUnit.SECONDS));
    }

    private String loginToken() throws Exception {
        if (cachedToken != null) {
            return cachedToken;
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> resp = rest.exchange("/v1/auth/token", HttpMethod.POST,
                new HttpEntity<>("{\"username\":\"admin\",\"password\":\"Admin@123\"}", headers),
                String.class);
        assertEquals(HttpStatus.OK, resp.getStatusCode(), "admin 登录应成功：" + resp.getBody());
        cachedToken = objectMapper.readTree(resp.getBody()).get("data").get("accessToken").asText();
        return cachedToken;
    }

    private ResponseEntity<String> putAlias(String path, String alias, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(path, HttpMethod.PUT,
                new HttpEntity<>("{\"alias\":\"" + alias + "\"}", headers), String.class);
    }

    private ResponseEntity<String> deleteAlias(String path, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return rest.exchange(path, HttpMethod.DELETE, new HttpEntity<>(headers), String.class);
    }

    private int bodyCode(ResponseEntity<String> resp) throws Exception {
        return objectMapper.readTree(resp.getBody()).get("code").asInt();
    }

    /** 清空限流窗口（键里含 IP 维度，故按前缀扫；清不到也无害，本类只有限流用例发 PUT）。 */
    private void resetRateLimitWindow() {
        Set<String> keys = redis.keys(RATE_LIMIT_PATTERN);
        if (keys != null && !keys.isEmpty()) {
            redis.delete(keys);
        }
    }

    private void clearAliasRows() {
        jdbc.update("delete from sys_chat_peer_alias where owner_user_id = ? and peer_user_id = ?",
                ADMIN_ID, PEER_ID);
    }

    private void insertAliasRowRaw(long id, String alias) {
        jdbc.update("""
                        insert into sys_chat_peer_alias
                            (id, owner_user_id, peer_user_id, alias, tenant_id, create_by, update_by, deleted)
                        values (?, ?, ?, ?, 0, ?, ?, 0)
                        """,
                id, ADMIN_ID, PEER_ID, alias, ADMIN_ID, ADMIN_ID);
    }

    /** 物理行数（不含 deleted 条件）：用来证明「只有一行」与「取消后行仍在」。 */
    private int aliasRowCount() {
        Integer count = jdbc.queryForObject(
                "select count(*) from sys_chat_peer_alias where owner_user_id = ? and peer_user_id = ?",
                Integer.class, ADMIN_ID, PEER_ID);
        return count == null ? -1 : count;
    }

    /** 生效行数（deleted=0）：界面能看到的备注只由它决定。 */
    private int activeAliasRowCount() {
        Integer count = jdbc.queryForObject(
                "select count(*) from sys_chat_peer_alias"
                        + " where owner_user_id = ? and peer_user_id = ? and deleted = 0",
                Integer.class, ADMIN_ID, PEER_ID);
        return count == null ? -1 : count;
    }

    private long peerRowId() {
        Long id = jdbc.queryForObject(
                "select id from sys_chat_peer_alias where owner_user_id = ? and peer_user_id = ?",
                Long.class, ADMIN_ID, PEER_ID);
        assertNotNull(id);
        return id;
    }

    private String aliasOfPeerRow() {
        return jdbc.queryForObject(
                "select alias from sys_chat_peer_alias where owner_user_id = ? and peer_user_id = ?",
                String.class, ADMIN_ID, PEER_ID);
    }

    private int deletedOfPeerRow() {
        Integer deleted = jdbc.queryForObject(
                "select deleted from sys_chat_peer_alias where owner_user_id = ? and peer_user_id = ?",
                Integer.class, ADMIN_ID, PEER_ID);
        return deleted == null ? -1 : deleted;
    }

    private static long newId() {
        return Math.abs(UUID.randomUUID().getMostSignificantBits() & Long.MAX_VALUE);
    }
}
