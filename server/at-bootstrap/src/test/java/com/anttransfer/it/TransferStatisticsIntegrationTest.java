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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 传输统计端点的集成测试：{@code GET /v1/transfers/statistics}。
 *
 * <p><b>为什么必须是集成测试</b>：统计 SQL 用了 MySQL 专有的 {@code json_extract} /
 * {@code json_unquote} / {@code json_valid} 从审计 {@code detail} 里取字节数，
 * 纯单测（mock mapper）根本碰不到这段 SQL——SQL 写错也只是「统计恒为 0」，
 * 不会报错，属于最阴的一类缺陷。这里用 Testcontainers 拉真 MySQL 8.4，
 * 把「SQL 语法 + JSON 路径 + 口径」一次性钉住。</p>
 *
 * <p>覆盖点：① 只统计自己的流水（他人流水不计入）；② 只统计 FILE_UPLOAD / FILE_DOWNLOAD
 * （登录 / 删除等动作不计入）；③ 秒传命中（{@code transferredBytes=0}）不计传输量；
 * ④ 下载失败前已下发的字节仍算传输量，但只计失败次数；⑤ 老流水缺字节键时归 0 不报错；
 * ⑥ 无任何流水时成功率为 null（不是 0%）；⑦ 未登录仍须 401(1001)。</p>
 *
 * <p>依赖说明：需要 Docker（Testcontainers）；本机无 Docker 时自动跳过
 * （{@code disabledWithoutDocker}）。</p>
 *
 * @author AntTransfer CE
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TransferStatisticsIntegrationTest {

    /** 干扰流水：属于另一个用户，用于验证「只看自己」。 */
    private static final long OTHER_USER_ID = 99991L;

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("anttransfer")
            .withUsername("root")
            .withPassword("123456")
            .withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci");

    @Container
    static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
                    .withExposedPorts(6379);

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
    private TestRestTemplate rest;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private ObjectMapper objectMapper;

    private long adminId;
    private long auditId;

    @BeforeEach
    void seedAuditLog() {
        Long id = jdbc.queryForObject("select id from sys_user where username = 'admin'", Long.class);
        assertTrue(id != null && id > 0, "V2 初始数据应存在 admin 用户");
        adminId = id;
        auditId = 700_000L;

        jdbc.update("delete from sys_operation_log where user_id in (?, ?)", adminId, OTHER_USER_ID);

        // 上传：2 次真实上行（3KB + 2KB），1 次秒传命中（0 字节过网），1 条老流水（无字节键）
        insertAudit(adminId, "FILE_UPLOAD", "FILE", 0,
                "{\"name\":\"a.bin\",\"instant\":false,\"fileId\":1,\"sizeBytes\":3072,\"transferredBytes\":3072}");
        insertAudit(adminId, "FILE_UPLOAD", "FILE", 0,
                "{\"name\":\"b.bin\",\"instant\":false,\"fileId\":2,\"sizeBytes\":2048,\"transferredBytes\":2048}");
        insertAudit(adminId, "FILE_UPLOAD", "FILE", 0,
                "{\"name\":\"dup.bin\",\"instant\":true,\"fileId\":1,\"sizeBytes\":3072,\"transferredBytes\":0}");
        insertAudit(adminId, "FILE_UPLOAD", "FILE", 0, "{\"name\":\"legacy.bin\",\"fileId\":3}");

        // 下载：1 次成功下发 500B；1 次失败但失败前已下发 200B
        insertAudit(adminId, "FILE_DOWNLOAD", "FILE", 0,
                "{\"name\":\"a.bin\",\"sizeBytes\":3072,\"sentBytes\":500}");
        insertAudit(adminId, "FILE_DOWNLOAD", "FILE", 1,
                "{\"name\":\"a.bin\",\"sentBytes\":200,\"reason\":\"物理内容缺失\"}");

        // 干扰项：他人流水（字节极大，一旦误统计立刻暴露）、非传输动作
        insertAudit(OTHER_USER_ID, "FILE_UPLOAD", "FILE", 0, "{\"transferredBytes\":999999}");
        insertAudit(OTHER_USER_ID, "FILE_DOWNLOAD", "FILE", 0, "{\"sentBytes\":999999}");
        insertAudit(adminId, "LOGIN", "AUTH", 0, null);
        insertAudit(adminId, "FILE_DELETE", "FILE", 0, "not-a-json-value");
    }

    @Test
    void statistics_shouldAggregateMyTransferOnly() throws Exception {
        String token = loginToken();

        JsonNode data = getWithToken("/v1/transfers/statistics", token).get("data");

        // 上传成功 4 条（含秒传与老流水），传输量只算真实过网：3072 + 2048 + 0 + 0
        assertEquals(4L, data.get("uploadCount").asLong(), "上传成功条数应含秒传与老流水");
        assertEquals(5120L, data.get("uploadBytes").asLong(), "秒传命中不应计入传输量");
        // 下载成功 1 条；字节含失败前已下发的 200
        assertEquals(1L, data.get("downloadCount").asLong());
        assertEquals(700L, data.get("downloadBytes").asLong(), "失败前已下发的字节属真实流量");
        assertEquals(5L, data.get("successCount").asLong());
        assertEquals(1L, data.get("failCount").asLong());
        assertEquals(83.3, data.get("successRate").asDouble(), 0.0001, "5 成功 / 1 失败 → 83.3%");
    }

    @Test
    void statistics_withoutAnyTransfer_shouldReturnNullRate() throws Exception {
        jdbc.update("delete from sys_operation_log where user_id = ?", adminId);
        String token = loginToken();

        JsonNode data = getWithToken("/v1/transfers/statistics", token).get("data");

        assertEquals(0L, data.get("uploadBytes").asLong());
        assertEquals(0L, data.get("successCount").asLong());
        assertEquals(0L, data.get("failCount").asLong());
        assertNull(data.get("successRate").isNull() ? null : data.get("successRate").asDouble(),
                "无流水时成功率为 null——不能与「全都失败（0%）」混为一谈");
    }

    @Test
    void statistics_withoutToken_should401NotLogin() throws Exception {
        ResponseEntity<String> resp = rest.exchange("/v1/transfers/statistics",
                HttpMethod.GET, new HttpEntity<>(new HttpHeaders()), String.class);

        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
        assertEquals(1001, objectMapper.readTree(resp.getBody()).get("code").asInt());
    }

    /* ============================ helpers ============================ */

    private void insertAudit(long userId, String action, String module, int result, String detail) {
        jdbc.update("""
                insert into sys_operation_log
                    (id, user_id, action, module, result, detail, log_time, tenant_id, deleted)
                values (?, ?, ?, ?, ?, ?, now(), 0, 0)
                """, auditId++, userId, action, module, result, detail);
    }

    private String loginToken() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
        ResponseEntity<String> resp = rest.exchange("/v1/auth/token", HttpMethod.POST,
                new HttpEntity<>("{\"username\":\"admin\",\"password\":\"Admin@123\"}", headers),
                String.class);
        JsonNode body = objectMapper.readTree(resp.getBody());
        assertEquals(0, body.get("code").asInt(), "登录应成功: " + body);
        return body.get("data").get("accessToken").asText();
    }

    private JsonNode getWithToken(String path, String token) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        ResponseEntity<String> resp = rest.exchange(path, HttpMethod.GET, new HttpEntity<>(headers), String.class);
        JsonNode body = objectMapper.readTree(resp.getBody());
        assertEquals(0, body.get("code").asInt(), "请求应成功: " + body);
        return body;
    }
}
