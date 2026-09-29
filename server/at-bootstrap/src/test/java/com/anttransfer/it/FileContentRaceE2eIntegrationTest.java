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

import com.anttransfer.file.model.dto.CreateChatAttachmentRequest;
import com.anttransfer.file.service.ChatAttachmentService;
import com.anttransfer.file.service.FileNodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.RepeatedTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.IntConsumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 内容寻址与附件授权的并发收敛验证——对应 {@code docs/development/AT-DIFF-todos.md} 的 RACE-01 第 2~4 处。
 *
 * <p><b>三处缺陷同形</b>：显式事务 + {@code insert} 之前已有一条一致性读 + 撞唯一键后靠
 * 「回查既有行」收敛（{@code sys_file.uk_sha256_size} / {@code sys_chat_attachment.uk_sender_client_msg}）。
 * 而 MySQL 默认 REPEATABLE READ 下，回查沿用的仍是 {@code insert} 之前建立的旧快照，
 * 读不到对手在那之后才提交的行——于是本该被收敛的并发，退化成一次直接抛给用户的失败。</p>
 *
 * <p><b>修复后的可观察行为</b>：当前读（{@code for share}）回查使并发双方都成功收敛。
 * 本类断言两件事——<b>没有任何一方失败</b>，且<b>终态唯一</b>（物理文件一行、授权一行），
 * 而不是只断言「抛出了重复键」（后者会把缺陷当成预期行为固化下来）。</p>
 *
 * <p>同理的会话消息写扩散见 {@link ChatSendIdempotencyE2eIntegrationTest}（RACE-01 第 1 处）。
 * 需要 Docker；本机无 Docker 时整类自动跳过。数据仅落本次容器实例，随容器销毁。</p>
 *
 * @author AntTransfer CE
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class FileContentRaceE2eIntegrationTest {

    /** 复用 V2 初始 admin 的 BCrypt 密文（口令 Admin@123） */
    private static final String ADMIN_HASH =
            "$2a$10$0jf1qJCfrCZjCiFLVCa47euNdiww0bEWmXuza5h9kLM9quTU8zXqu";
    /** V2 种子管理员 ID：文件归属人 / 附件发送方 */
    private static final long OWNER_ID = 1L;
    /** 附件接收方账号 ID（本类在容器内自建） */
    private static final long PEER_ID = 31_003L;
    /** 附件接收方登录名 */
    private static final String PEER_USERNAME = "it_race_peer";
    /** 并发线程数：同一份内容被同时上传 / 同一幂等键被同时重发 */
    private static final int THREADS = 8;
    /** 内容长度：同一 sha256 下必须一致才属于同一物理文件 */
    private static final long SIZE_BYTES = 1024L;
    /** 敏感级别：低（与 FileNodeService#resolveLevel 的入参口径一致） */
    private static final int LEVEL_LOW = 1;

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
    private FileNodeService fileNodeService;
    @Autowired
    private ChatAttachmentService chatAttachmentService;
    @Autowired
    private JdbcTemplate jdbc;

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
                        values (?, ?, ?, '附件接收方', 'it', 0, 0, 0, 0)
                        """,
                PEER_ID, PEER_USERNAME, ADMIN_HASH);
    }

    /* ==================== RACE-01 第 3 处：秒传登记 ==================== */

    /**
     * 8 个线程登记<b>同一份内容</b>（同 sha256 + 同 size）：唯一键只允许一行物理文件，
     * 其余 7 方必须被收敛成「复用 + 计数」，而不是撞键即失败。
     */
    @RepeatedTest(2)
    @DisplayName("秒传登记：并发同一份内容只落 1 行物理文件，且没有任何一方失败（连跑 2 轮）")
    void concurrentRegisterStoredContent_shouldCollapseToOneFileObject() throws Exception {
        String sha256 = newSha256();

        Set<String> failures = ConcurrentHashMap.newKeySet();
        runConcurrently(i -> fileNodeService.registerStoredContent(
                OWNER_ID, "并发秒传-" + i + ".bin", null, LEVEL_LOW, "application/octet-stream",
                sha256, SIZE_BYTES, storagePath(sha256)), failures);

        assertTrue(failures.isEmpty(),
                "并发秒传登记不应有任何一方失败（撞键必须被回查收敛）：" + failures);
        assertEquals(1, fileObjectCount(sha256), "同一份内容只允许一行物理文件（uk_sha256_size）");
        assertEquals(THREADS, fileObjectRefCount(sha256),
                "引用计数应如实累加：赢家置 1，其余每一方各 +1");
        assertEquals(THREADS, nodeCount(sha256), "每个登记方各得一个属于自己的文件条目");
    }

    /* ==================== RACE-01 第 4 处：内容引用 ==================== */

    /**
     * 8 个线程对<b>同一份内容</b>取引用：与秒传登记共用同一条 {@code uk_sha256_size} 收敛路径，
     * 但撞键后直接返回物理文件，不建条目。
     */
    @RepeatedTest(2)
    @DisplayName("内容引用：并发同一份内容只落 1 行物理文件，且没有任何一方失败（连跑 2 轮）")
    void concurrentAcquireContentReference_shouldCollapseToOneFileObject() throws Exception {
        String sha256 = newSha256();

        Set<String> failures = ConcurrentHashMap.newKeySet();
        runConcurrently(i -> fileNodeService.acquireContentReference(
                OWNER_ID, "并发引用-" + i + ".bin", "application/octet-stream",
                sha256, SIZE_BYTES, storagePath(sha256)), failures);

        assertTrue(failures.isEmpty(),
                "并发取引用不应有任何一方失败（撞键必须被回查收敛）：" + failures);
        assertEquals(1, fileObjectCount(sha256), "同一份内容只允许一行物理文件（uk_sha256_size）");
        assertEquals(THREADS, fileObjectRefCount(sha256), "引用计数应如实累加");
    }

    /* ==================== RACE-01 第 2 处：会话附件授权 ==================== */

    /**
     * 8 个线程用<b>同一个</b> {@code clientMsgKey} 建会话附件授权（连点 / 弱网重发的真实形状）：
     * {@code uk_sender_client_msg} 只允许一行授权，其余各方必须被收敛成「返回既有授权」。
     */
    @RepeatedTest(2)
    @DisplayName("会话附件授权：并发同 clientMsgKey 只落 1 行授权，且没有任何一方失败（连跑 2 轮）")
    void concurrentCreateAttachment_shouldCollapseToOneAuthorization() throws Exception {
        long nodeId = seedOwnedNode();
        String clientMsgKey = "it-att-" + UUID.randomUUID();

        Set<String> failures = ConcurrentHashMap.newKeySet();
        runConcurrently(i -> chatAttachmentService.create(
                OWNER_ID, attachmentRequest(nodeId, clientMsgKey)), failures);

        assertTrue(failures.isEmpty(),
                "并发同 clientMsgKey 建授权不应有任何一方失败：" + failures);
        assertEquals(1, attachmentCount(clientMsgKey), "同一幂等键只允许一行授权（uk_sender_client_msg）");
    }

    /* ==================== helpers ==================== */

    /**
     * 用真实 service 播种一个「发送方持有且物理文件可用」的条目，供附件授权用例使用。
     *
     * <p>刻意不手搓 {@code sys_file} / {@code sys_file_node} 行：手搓容易漏掉
     * {@code status=0}、{@code ref_count} 这类「校验看得见、DDL 看不见」的前置条件，
     * 让用例通过在一份不真实的初始状态上。</p>
     */
    private long seedOwnedNode() {
        String sha256 = newSha256();
        fileNodeService.registerStoredContent(OWNER_ID, "授权素材.bin", null, LEVEL_LOW,
                "application/octet-stream", sha256, SIZE_BYTES, storagePath(sha256));
        Long nodeId = jdbc.queryForObject(
                "select id from sys_file_node where owner_user_id = ? and sha256 = ?",
                Long.class, OWNER_ID, sha256);
        assertNotNull(nodeId, "前置数据播种失败：未找到刚登记的条目");
        return nodeId;
    }

    /** 每次调用都新建请求对象：并发共享同一个可变 DTO 会引入与业务无关的数据竞争。 */
    private CreateChatAttachmentRequest attachmentRequest(long nodeId, String clientMsgKey) {
        CreateChatAttachmentRequest request = new CreateChatAttachmentRequest();
        request.setNodeId(nodeId);
        request.setReceiverUserId(PEER_ID);
        request.setClientMsgKey(clientMsgKey);
        return request;
    }

    /** 起跑线对齐的并发执行器：{@code THREADS} 个线程同时进入任务体。 */
    private void runConcurrently(IntConsumer task, Set<String> failures) throws Exception {
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

    /** 每轮用全新的 64 位小写 hex：既满足 sha256 列宽，也让用例之间互不污染。 */
    private static String newSha256() {
        return (UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "")).substring(0, 64);
    }

    /** 内容寻址的存储相对路径（用例不落盘，只为满足非空约束）。 */
    private static String storagePath(String sha256) {
        return "it/race/" + sha256 + ".bin";
    }

    private int fileObjectCount(String sha256) {
        Integer count = jdbc.queryForObject(
                "select count(*) from sys_file where sha256 = ? and size_bytes = ?",
                Integer.class, sha256, SIZE_BYTES);
        return count == null ? -1 : count;
    }

    private int fileObjectRefCount(String sha256) {
        Integer count = jdbc.queryForObject(
                "select ref_count from sys_file where sha256 = ? and size_bytes = ?",
                Integer.class, sha256, SIZE_BYTES);
        return count == null ? -1 : count;
    }

    private int nodeCount(String sha256) {
        Integer count = jdbc.queryForObject(
                "select count(*) from sys_file_node where sha256 = ?", Integer.class, sha256);
        return count == null ? -1 : count;
    }

    private int attachmentCount(String clientMsgKey) {
        Integer count = jdbc.queryForObject(
                "select count(*) from sys_chat_attachment where sender_user_id = ? and client_msg_key = ?",
                Integer.class, OWNER_ID, clientMsgKey);
        return count == null ? -1 : count;
    }
}
