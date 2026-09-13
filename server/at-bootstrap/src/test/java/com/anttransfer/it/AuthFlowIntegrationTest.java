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
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 认证 / 授权 / RBAC 全链路集成测试（Testcontainers 拉起独立 MySQL + Redis）。
 *
 * <p>覆盖验收路径（对应 AT-DIFF-04 与实机冒烟）：
 * ① 登录成功返回双 Token；② 未登录访问受保护接口 → 401(1001)；
 * ③ 登录无权限（AUDITOR 访问 file 系接口）→ 403(1003)；④ 有权限（SUPER_ADMIN）→ 200；
 * ⑤ 审计员调用写接口 → 403(1003)；⑥ 登出后旧 access token 立即失效 → 401(1001)；
 * ⑦ refresh 轮换：旧 refresh 复用 → 401(1006)（重放打击）；⑧ 错误密码登录 → 401(1007)。</p>
 *
 * <p>依赖说明：需要 Docker（Testcontainers）；本机无 Docker 时自动跳过（disabledWithoutDocker）。
 * 安全断言不落到真实业务表：审计员等测试账号仅在本次容器化实例内插入，随容器销毁。</p>
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AuthFlowIntegrationTest {

    /** 复用 V2 初始 admin 的 BCrypt 密文（口令 Admin@123） */
    private static final String ADMIN_HASH =
            "$2a$10$0jf1qJCfrCZjCiFLVCa47euNdiww0bEWmXuza5h9kLM9quTU8zXqu";

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
        // 自拼 URL 显式带上 allowPublicKeyRetrieval（MySQL 8 caching_sha2_password 需要）
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

    @BeforeEach
    void seedAuditorOnce() {
        Integer exists = jdbc.queryForObject(
                "select count(*) from sys_user where username = 'auditor'", Integer.class);
        if (exists == null || exists == 0) {
            jdbc.update("""
                    insert into sys_user
                        (id, username, password_hash, nickname, remark, tenant_id, status, token_epoch, deleted)
                    values (20001, 'auditor', ?, '集成测试审计员', 'it', 0, 0, 0, 0)
                    """, ADMIN_HASH);
            jdbc.update("insert into sys_user_role (id, user_id, role_id) values (20001, 20001, 2)");
        }
    }

    /* ============================ 1. 登录返回双 Token ============================ */

    @Test
    @Order(1)
    void login_shouldReturnDualTokens() throws Exception {
        JsonNode body = postJson("/v1/auth/token",
                "{\"username\":\"admin\",\"password\":\"Admin@123\"}");

        assertEquals(0, body.get("code").asInt());
        assertTrue(body.get("data").get("accessToken").asText().length() > 20);
        assertTrue(body.get("data").get("refreshToken").asText().length() > 20);
        assertEquals("Bearer", body.get("data").get("tokenType").asText());
    }

    /* ============================ 2. 未登录 401 ============================ */

    @Test
    @Order(2)
    void protectedApi_withoutToken_should401NotLogin() {
        ResponseEntity<String> resp = rest.exchange("/v1/permission/my",
                HttpMethod.GET, new HttpEntity<>(new HttpHeaders()), String.class);

        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
        assertEquals(1001, bodyCode(resp));
    }

    /* ============================ 3. 有权限 200 ============================ */

    @Test
    @Order(3)
    void superAdmin_shouldAccessPermProtectedApi() throws Exception {
        String token = loginToken("admin", "Admin@123");

        assertEquals(0, bodyCode(getWithToken("/v1/smoke/perm/read", token)));
        assertEquals(0, bodyCode(postWithToken("/v1/smoke/perm/write", token)));
    }

    /* ============================ 4. 无权限 403（AUDITOR 无 file 权限） ============================ */

    @Test
    @Order(4)
    void auditor_withoutPerm_should403NoAuth() {
        String token = loginToken("auditor", "Admin@123");

        ResponseEntity<String> read = getWithToken("/v1/smoke/perm/read", token);
        assertEquals(HttpStatus.FORBIDDEN, read.getStatusCode());
        assertEquals(1003, bodyCode(read));
    }

    /* ============================ 5. 审计员调写接口 403 ============================ */

    @Test
    @Order(5)
    void auditor_writeApi_should403NoAuth() {
        String token = loginToken("auditor", "Admin@123");

        ResponseEntity<String> write = postWithToken("/v1/smoke/perm/write", token);
        assertEquals(HttpStatus.FORBIDDEN, write.getStatusCode());
        assertEquals(1003, bodyCode(write));
    }

    /* ============================ 6. 登出后旧 token 失效 ============================ */

    @Test
    @Order(6)
    void logout_shouldRevokeOldAccessTokenImmediately() {
        String token = loginToken("admin", "Admin@123");

        assertEquals(0, bodyCode(postWithToken("/v1/auth/logout", token)));

        ResponseEntity<String> after = getWithToken("/v1/smoke/perm/read", token);
        assertEquals(HttpStatus.UNAUTHORIZED, after.getStatusCode());
        assertEquals(1001, bodyCode(after));
    }

    /* ============================ 7. refresh 轮换 + 复用打击 ============================ */

    @Test
    @Order(7)
    void reuseOldRefreshToken_shouldRevokeSession() throws Exception {
        JsonNode login = postJson("/v1/auth/token",
                "{\"username\":\"auditor\",\"password\":\"Admin@123\"}");
        String oldRefresh = login.get("data").get("refreshToken").asText();

        // 第一次换发成功（轮换）
        JsonNode refreshed = postJson("/v1/auth/token/refresh",
                "{\"refreshToken\":\"" + oldRefresh + "\"}");
        assertEquals(0, refreshed.get("code").asInt());
        assertNotNull(refreshed.get("data").get("accessToken"));

        // 旧 refresh 再使用 → 重放打击：全端吊销 + 1003
        ResponseEntity<String> replay = postJsonRaw("/v1/auth/token/refresh",
                "{\"refreshToken\":\"" + oldRefresh + "\"}");
        assertEquals(HttpStatus.UNAUTHORIZED, replay.getStatusCode());
        assertEquals(1006, bodyCode(replay));
    }

    /* ============================ 8. 错误密码 ============================ */

    @Test
    @Order(8)
    void login_wrongPassword_should401BadCredentials() {
        ResponseEntity<String> resp = postJsonRaw("/v1/auth/token",
                "{\"username\":\"admin\",\"password\":\"wrong-password\"}");

        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
        assertEquals(1007, bodyCode(resp));
    }

    /* ============================ helpers ============================ */

    private String loginToken(String username, String password) {
        try {
            JsonNode body = postJson("/v1/auth/token",
                    "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}");
            assertEquals(0, body.get("code").asInt(), "登录应成功: " + body);
            return body.get("data").get("accessToken").asText();
        } catch (Exception e) {
            throw new IllegalStateException("登录失败 " + username, e);
        }
    }

    private JsonNode postJson(String path, String body) throws Exception {
        return read(postJsonRaw(path, body));
    }

    private ResponseEntity<String> postJsonRaw(String path, String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(path, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
    }

    private ResponseEntity<String> getWithToken(String path, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return rest.exchange(path, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    private ResponseEntity<String> postWithToken(String path, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return rest.exchange(path, HttpMethod.POST, new HttpEntity<>(headers), String.class);
    }

    private JsonNode read(ResponseEntity<String> resp) throws Exception {
        return objectMapper.readTree(resp.getBody());
    }

    private int bodyCode(ResponseEntity<String> resp) {
        try {
            return objectMapper.readTree(resp.getBody()).get("code").asInt();
        } catch (Exception e) {
            throw new IllegalStateException("非 Result 响应: " + resp.getBody(), e);
        }
    }
}
