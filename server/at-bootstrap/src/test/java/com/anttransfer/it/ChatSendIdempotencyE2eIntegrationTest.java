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

import com.anttransfer.collaboration.model.dto.ChatSendDTO;
import com.anttransfer.collaboration.service.ChatService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
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

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 会话消息幂等（写扩散）的真库验证，兼作「撞键后回查」写法的机理探针。
 *
 * <p><b>要回答的问题</b>：{@code ChatService#send} 撞键后那段「回查既有消息并返回」的兜底，
 * 在真实 MySQL 默认隔离级别（REPEATABLE READ）下到底走不走得通？如果走不通，
 * 单测为什么发现不了？</p>
 *
 * <p><b>三个用例各管一段证据</b>：</p>
 * <ol>
 *     <li>{@link #repeatableRead_probe_shouldHideRowCommittedAfterSnapshot()}：
 *         <b>不碰业务代码</b>，只用两条真实连接摆出「慢事务先读 → 快事务插入并提交 →
 *         慢事务再读」的时序，断言慢事务的一致性读看不到新行、而当前读看得到。
 *         这是整件事的**根因**，与任何业务写法无关。</li>
 *     <li>{@link #concurrentResend_shouldCollapseToOneMessage()}：把「弱网重发 / 双端同发」
 *         压缩成 16 线程同 {@code clientMsgId} 并发调用，断言**没有任何请求失败**——
 *         这正是 {@code send} 注释所承诺的语义。</li>
 *     <li>{@link #sequentialResend_shouldStayIdempotent()}：对照组。顺序重发一直是好的
 *         （第二次会命中 insert 前的幂等查询），**这正是缺陷长期没被发现的原因**：
 *         手工点两下、写个单线程单测，都只会走到「前置查询命中」这条干净路径。</li>
 * </ol>
 *
 * <p><b>为什么必须用真 MySQL</b>：快照可见性是 InnoDB 的行为，H2 / Mockito 都不模拟它；
 * 单测里那个 {@code DuplicateKeyException} 是 Mockito 演出来的，它无法回答
 * 「撞键之后回查能不能看见对手的行」。</p>
 *
 * <p>需要 Docker；本机无 Docker 时整类自动跳过。数据仅落本次容器实例，随容器销毁。</p>
 *
 * @author AntTransfer CE
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ChatSendIdempotencyE2eIntegrationTest {

    /** 复用 V2 初始 admin 的 BCrypt 密文（口令 Admin@123） */
    private static final String ADMIN_HASH =
            "$2a$10$0jf1qJCfrCZjCiFLVCa47euNdiww0bEWmXuza5h9kLM9quTU8zXqu";
    /** V2 种子管理员 ID（消息发送人） */
    private static final long ADMIN_ID = 1L;
    /** 消息对端账号 ID（本类在容器内自建） */
    private static final long PEER_ID = 31_002L;
    /** 消息对端登录名 */
    private static final String PEER_USERNAME = "it_send_peer";
    /** 并发线程数：远大于「一条逻辑消息只该落 2 行」的期望 */
    private static final int THREADS = 16;
    /** 单聊写扩散的期望行数：发送人一行 + 对端一行 */
    private static final int EXPECTED_ROWS = 2;
    /** 单聊 scope（见 ChatScope） */
    private static final int SCOPE_PRIVATE = 1;
    /** 文本消息类型 */
    private static final int TYPE_TEXT = 1;

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
    private JdbcTemplate jdbc;
    @Autowired
    private DataSource dataSource;

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
                        values (?, ?, ?, '消息对端', 'it', 0, 0, 0, 0)
                        """,
                PEER_ID, PEER_USERNAME, ADMIN_HASH);
    }

    /* ==================== 1. 根因：RR 快照看不见快照之后提交的行 ==================== */

    /**
     * 两条真实连接摆出「撞键者」与「赢家」的时序，断言根因。
     *
     * <p>慢事务（= 撞键者）先做一次普通查询，一致性读快照就此建立；随后快事务（= 赢家）
     * 插入并提交。此刻慢事务：</p>
     * <ul>
     *     <li>普通 {@code select} 用的还是旧快照 → <b>看不到</b>新行（这是「回查返回 null」的根因）；</li>
     *     <li>{@code select ... for share} 是当前读 → <b>看得到</b>（这是修复方向可行的依据）。</li>
     * </ul>
     *
     * <p>借 {@code sys_chat_peer_alias} 当靶子只是因为它的唯一键列最少，验证的是隔离级别本身。</p>
     */
    @Test
    @DisplayName("根因验证：REPEATABLE READ 下，晚于快照提交的行对普通回查不可见，而当前读可见")
    void repeatableRead_probe_shouldHideRowCommittedAfterSnapshot() throws Exception {
        long ownerId = 90_001L;
        try (Connection slow = dataSource.getConnection(); Connection fast = dataSource.getConnection()) {
            slow.setAutoCommit(false);
            fast.setAutoCommit(false);

            assertEquals("REPEATABLE-READ", queryString(slow, "select @@transaction_isolation"),
                    "本用例的结论只在 REPEATABLE READ 下成立，隔离级别变了必须先重审");

            // 慢事务先读一次：一致性读快照在此刻建立（此刻对手尚未提交）
            assertEquals(0, countAlias(slow, ownerId, PEER_ID), "起始状态应为干净");

            // 快事务插入并提交——模拟「并发首次设置」里赢家那一侧
            try (Statement st = fast.createStatement()) {
                st.executeUpdate("insert into sys_chat_peer_alias"
                        + " (id, owner_user_id, peer_user_id, alias, tenant_id, create_by, update_by, deleted)"
                        + " values (" + newId() + ", " + ownerId + ", " + PEER_ID
                        + ", '赢家写的备注', 0, " + ownerId + ", " + ownerId + ", 0)");
            }
            fast.commit();

            assertEquals(0, countAlias(slow, ownerId, PEER_ID),
                    "普通一致性读用的仍是旧快照：看不到快照建立之后提交的那一行——"
                            + "这就是「撞键后回查既有行」返回 null 的根因");

            assertEquals(1, countAliasForShare(slow, ownerId, PEER_ID),
                    "当前读（for share）看得到已提交的行——「撞键后改走当前读」这条修复路可行");

            slow.rollback();
        } finally {
            jdbc.update("delete from sys_chat_peer_alias where owner_user_id = ? and peer_user_id = ?",
                    ownerId, PEER_ID);
        }
    }

    /* ==================== 2. 复现：并发重发同一条消息 ==================== */

    /**
     * 16 线程用<b>同一个</b> {@code clientMsgId} 并发发送单聊消息。
     *
     * <p>设计承诺（见 {@code ChatService#send} 的注释）：「唯一索引拦下第二条，撞键后回查
     * 既有消息并返回，保持幂等」。本用例把「没有任何请求失败 + 恰好落 2 行」钉死。</p>
     */
    @RepeatedTest(3)
    @DisplayName("并发重发：16 线程同 clientMsgId 只落 2 行，撞键必须被收敛而不是报错（连跑 3 轮）")
    void concurrentResend_shouldCollapseToOneMessage() throws Exception {
        String clientMsgId = "it-send-" + UUID.randomUUID();

        Set<String> failures = ConcurrentHashMap.newKeySet();
        runConcurrently(i -> chatService.send(ADMIN_ID, new ChatSendDTO(
                SCOPE_PRIVATE, PEER_ID, TYPE_TEXT, "并发消息-" + i, clientMsgId, null, null, null)), failures);

        assertTrue(failures.isEmpty(),
                "并发重发同一 clientMsgId 不应有任何请求失败（撞键必须被回查收敛）：" + failures);
        assertEquals(EXPECTED_ROWS, messageRowCount(ADMIN_ID, clientMsgId),
                "写扩散：发送人一行 + 对端一行，重发不得新增");
    }

    /* ==================== 3. 对照组：顺序重发一直是好的 ==================== */

    /**
     * 同一条消息顺序重发两次：第二次会命中 {@code insert} 之前的幂等查询。
     *
     * <p>这条路径在单线程单测、手工连点里都成立，因此**缺陷长期不可见**——
     * 本用例的存在意义就是把它与并发用例区分开：红的不是幂等设计，是并发下的兜底。</p>
     */
    @Test
    @DisplayName("对照组：顺序重发命中前置幂等查询，不新增行（缺陷为何长期没被发现）")
    void sequentialResend_shouldStayIdempotent() {
        String clientMsgId = "it-send-seq-" + UUID.randomUUID();

        chatService.send(ADMIN_ID, new ChatSendDTO(
                SCOPE_PRIVATE, PEER_ID, TYPE_TEXT, "第一次", clientMsgId, null, null, null));
        chatService.send(ADMIN_ID, new ChatSendDTO(
                SCOPE_PRIVATE, PEER_ID, TYPE_TEXT, "第二次", clientMsgId, null, null, null));

        assertEquals(EXPECTED_ROWS, messageRowCount(ADMIN_ID, clientMsgId),
                "顺序重发必须在 insert 之前就被幂等查询拦下");
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

    /** 同一发送人 + 同一幂等键的逻辑消息行数（写扩散下单聊应为 2）。 */
    private int messageRowCount(long senderId, String clientMsgId) {
        Integer count = jdbc.queryForObject(
                "select count(*) from sys_notify_message where sender_user_id = ? and client_msg_id = ?",
                Integer.class, senderId, clientMsgId);
        return count == null ? -1 : count;
    }

    private int countAlias(Connection conn, long ownerId, long peerId) throws Exception {
        return queryInt(conn, "select count(*) from sys_chat_peer_alias"
                + " where owner_user_id = " + ownerId + " and peer_user_id = " + peerId);
    }

    /** 当前读：能看见快照之后由他人提交的行。 */
    private int countAliasForShare(Connection conn, long ownerId, long peerId) throws Exception {
        return queryInt(conn, "select count(*) from sys_chat_peer_alias"
                + " where owner_user_id = " + ownerId + " and peer_user_id = " + peerId + " for share");
    }

    private int queryInt(Connection conn, String sql) throws Exception {
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            return rs.next() ? rs.getInt(1) : -1;
        }
    }

    private String queryString(Connection conn, String sql) throws Exception {
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            return rs.next() ? rs.getString(1) : null;
        }
    }

    private static long newId() {
        return Math.abs(UUID.randomUUID().getMostSignificantBits() & Long.MAX_VALUE);
    }
}
