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
package com.anttransfer.bootstrap.diagnostics;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * dev 启动自检：打印「本次实际连上了哪个库」。
 *
 * <p>本地开发常见坑：dev 容器没起来时，后端仍连着宿主机自装的 MySQL 并把 Flyway 跑完，
 * 于是「迁移成功」但数据落在<strong>本机库</strong>、容器库仍为空。为此 dev 容器 MySQL
 * 的宿主机端口刻意用 {@value #DEV_CONTAINER_MYSQL_PORT}（见 docker-compose.dev.yml），
 * 与本机自装 MySQL 的 3306 错开——容器没起来必然是连接失败，而非静默连上本机库。</p>
 *
 * <p>本类仅 dev 生效，只做诊断：JDBC 异常一律就地降级为日志，不影响启动。</p>
 *
 * @author AntTransfer CE
 */
@Component
@Profile("dev")
public class DatabaseEndpointLogger implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseEndpointLogger.class);

    /** dev 容器 MySQL 在宿主机上的约定端口（同 docker-compose.dev.yml / .env.example）。 */
    private static final int DEV_CONTAINER_MYSQL_PORT = 3307;

    /** JDBC URL 未写端口时 MySQL 的默认端口。 */
    private static final int MYSQL_DEFAULT_PORT = 3306;

    /** 视为「宿主机本机」的主机名。 */
    private static final Set<String> LOCAL_HOSTS =
            Set.of("localhost", "127.0.0.1", "::1", "0:0:0:0:0:0:0:1", "host.docker.internal");

    private final DataSource dataSource;

    private final Environment environment;

    public DatabaseEndpointLogger(DataSource dataSource, Environment environment) {
        this.dataSource = dataSource;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        String jdbcUrl = environment.getProperty("spring.datasource.url", "(未配置)");
        try (Connection connection = dataSource.getConnection()) {
            String serverVersion = queryScalar(connection, "SELECT VERSION()");
            String currentDatabase = queryScalar(connection, "SELECT DATABASE()");
            List<String> applied = queryAppliedMigrations(connection);
            log.info("""
                            
                            ================= [dev] 数据库连接自检：请确认为目标库 =================
                              JDBC URL : {}
                              服务端   : {} · 当前库 : {}
                              Flyway   : {}
                            =======================================================================""",
                    jdbcUrl, serverVersion, currentDatabase,
                    applied.isEmpty() ? "无 flyway_schema_history（未迁移或 FLYWAY_ENABLED=false）"
                            : "已应用 " + applied.size() + " 个版本 " + applied);
            warnIfLocalNonContainerEndpoint(jdbcUrl, currentDatabase);
        } catch (SQLException e) {
            log.error("""
                            
                            [dev] 数据库连接自检失败：目标库不可达（这不是 Flyway 的问题）。
                              JDBC URL : {}
                              · 想用 dev 容器库：docker compose -f docker-compose.dev.yml up -d（映射端口 {}）
                              · 想用本机 MySQL：显式指定 DB_URL=jdbc:mysql://localhost:3306/anttransfer?...
                              原因：{}""",
                    jdbcUrl, DEV_CONTAINER_MYSQL_PORT, e.getMessage());
        }
    }

    /** 本机地址 + 非约定端口 => 数据落在本机自装 MySQL 里，告警点明。 */
    private void warnIfLocalNonContainerEndpoint(String jdbcUrl, String currentDatabase) {
        Endpoint endpoint = parseEndpoint(jdbcUrl);
        if (endpoint == null || !LOCAL_HOSTS.contains(endpoint.host().toLowerCase(Locale.ROOT))) {
            return;
        }
        int port = endpoint.port() > 0 ? endpoint.port() : MYSQL_DEFAULT_PORT;
        if (port == DEV_CONTAINER_MYSQL_PORT) {
            return;
        }
        log.warn("""
                        
                        ⚠️  当前连接的是【本机自装 MySQL {}:{}】，而非 dev 容器库（约定端口 {}）。
                            本次 Flyway 迁移写入本机库 `{}`，容器库不受影响——两者是两套独立数据。
                            想用容器库：docker compose -f docker-compose.dev.yml up -d，DB_URL 端口回到 {}。""",
                endpoint.host(), port, DEV_CONTAINER_MYSQL_PORT, currentDatabase, DEV_CONTAINER_MYSQL_PORT);
    }

    /** 解析 jdbc:mysql://host:port/db 中的 host 与 port；解析不出端口时返回 -1。 */
    private static Endpoint parseEndpoint(String jdbcUrl) {
        if (jdbcUrl == null || jdbcUrl.isBlank()) {
            return null;
        }
        int schemeEnd = jdbcUrl.indexOf("://");
        if (schemeEnd < 0) {
            return null;
        }
        String authority = jdbcUrl.substring(schemeEnd + 3);
        int slash = authority.indexOf('/');
        if (slash >= 0) {
            authority = authority.substring(0, slash);
        }
        int colon = authority.lastIndexOf(':');
        if (colon < 0) {
            return new Endpoint(authority, -1);
        }
        String host = authority.substring(0, colon);
        if (host.startsWith("[") && host.endsWith("]")) {
            host = host.substring(1, host.length() - 1);
        }
        try {
            return new Endpoint(host, Integer.parseInt(authority.substring(colon + 1)));
        } catch (NumberFormatException e) {
            return new Endpoint(authority, -1);
        }
    }

    /** 已应用迁移版本列表（形如 V1、V2、V0(baseline)、V4(失败)）；历史表不存在时返回空列表。 */
    private static List<String> queryAppliedMigrations(Connection connection) {
        List<String> versions = new ArrayList<>();
        String sql = "SELECT version, success, type FROM flyway_schema_history ORDER BY installed_rank";
        try (Statement statement = connection.createStatement();
                ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                String version = rs.getString("version");
                String type = rs.getString("type");
                boolean success = rs.getBoolean("success");
                String label = "BASELINE".equalsIgnoreCase(type) ? "V0(baseline)" : "V" + version;
                versions.add(success ? label : label + "(失败)");
            }
        } catch (SQLException e) {
            return List.of();
        }
        return versions;
    }

    /** 执行单值查询；失败返回 "?"（诊断用途，不抛异常）。 */
    private static String queryScalar(Connection connection, String sql) {
        try (Statement statement = connection.createStatement();
                ResultSet rs = statement.executeQuery(sql)) {
            return rs.next() ? String.valueOf(rs.getObject(1)) : "?";
        } catch (SQLException e) {
            return "?";
        }
    }

    /** JDBC 地址的 host / port 解析结果。 */
    private record Endpoint(String host, int port) {
    }
}
