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
package com.anttransfer.common.security;

/**
 * 客户端真实 IP 解析（纯字符串工具，刻意不依赖 servlet）。
 *
 * <p><b>为什么只收字符串：</b>需要它的是网关限流（key 维度）与各域审计（{@code ip} 列），
 * 而 at-common 的依赖面被压到「mybatis-plus 注解 + slf4j + lombok」，不能引入 web 层能力。</p>
 *
 * <p><b>为什么必须校验字面量：</b>{@code X-Forwarded-For} 由客户端完全可控。若原样取用，
 * 攻击者只要发 {@code X-Forwarded-For: 1.1.1.1, evil}… 就能（a）伪造审计里的来源 IP 逃避追责；
 * （b）把任意字符串注入 Redis 限流 key（键空间污染 / 内存放大）；（c）用大量不同伪造 IP
 * 绕过 per-IP 限流。故本类只放行「像 IP 字面量」的值，其余一律降级回 {@code remoteAddr}。</p>
 *
 * @author AntTransfer CE
 */
public final class ClientIpResolver {

    /** 反代链头部（nginx 默认追加）。 */
    public static final String HEADER_X_FORWARDED_FOR = "X-Forwarded-For";

    /** 单跳反代常用头部。 */
    public static final String HEADER_X_REAL_IP = "X-Real-IP";

    /** IP 字面量长度上限（IPv6 含 zone 最长 45+ 余量）。 */
    public static final int MAX_LITERAL_LENGTH = 64;

    /** 无法解析时的占位值（限流 key / 审计列均不使用 null）。 */
    public static final String UNKNOWN = "unknown";

    private ClientIpResolver() {
    }

    /**
     * 解析真实客户端 IP：{@code X-Forwarded-For} 首跳 → {@code X-Real-IP} → {@code remoteAddr}。
     *
     * @param forwardedFor {@code X-Forwarded-For} 原始值（可为空）
     * @param realIp       {@code X-Real-IP} 原始值（可为空）
     * @param remoteAddr   直连地址（可为空）
     * @return 合法 IP 字面量；三者均不可信时返回 {@link #UNKNOWN}
     */
    public static String resolve(String forwardedFor, String realIp, String remoteAddr) {
        String candidate = firstHop(forwardedFor);
        if (candidate == null) {
            candidate = normalize(realIp);
        }
        if (candidate == null) {
            candidate = normalize(remoteAddr);
        }
        return candidate == null ? UNKNOWN : candidate;
    }

    /**
     * 取反向代理链首跳（最左侧即最初客户端），并校验为合法字面量。
     *
     * @param forwardedFor {@code X-Forwarded-For} 原始值
     * @return 合法字面量或 {@code null}
     */
    public static String firstHop(String forwardedFor) {
        if (forwardedFor == null || forwardedFor.isBlank()) {
            return null;
        }
        String value = forwardedFor.trim();
        int comma = value.indexOf(',');
        return normalize(comma >= 0 ? value.substring(0, comma) : value);
    }

    /**
     * 校验并规范化单个 IP 字面量。
     *
     * <p>放行字符仅 {@code 0-9 a-f A-F . : %}（IPv6 zone 用 {@code %}），且必须至少含一个数字
     * 与一个 {@code .} 或 {@code :}——主机名、{@code unknown}、注入串一律拒绝。</p>
     *
     * @param literal 待校验值
     * @return 规范化字面量；不合法返回 {@code null}
     */
    public static String normalize(String literal) {
        if (literal == null) {
            return null;
        }
        String value = literal.trim();
        if (value.isEmpty() || value.length() > MAX_LITERAL_LENGTH) {
            return null;
        }
        if (value.startsWith("[") && value.endsWith("]")) {
            value = value.substring(1, value.length() - 1);
        } else {
            value = stripPort(value);
        }
        if (value.isEmpty() || value.length() > MAX_LITERAL_LENGTH) {
            return null;
        }
        boolean hasDigit = false;
        boolean hasSeparator = false;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c >= '0' && c <= '9') {
                hasDigit = true;
            } else if (c == '.' || c == ':') {
                hasSeparator = true;
            } else if (!((c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') || c == '%')) {
                return null;
            }
        }
        return hasDigit && hasSeparator ? value : null;
    }

    /** IPv4:port 去端口；IPv6 含多个冒号，原样保留。 */
    private static String stripPort(String value) {
        int colon = value.indexOf(':');
        if (colon <= 0 || colon != value.lastIndexOf(':')) {
            return value;
        }
        String host = value.substring(0, colon);
        String port = value.substring(colon + 1);
        if (host.indexOf('.') < 0 || port.isEmpty()) {
            return value;
        }
        for (int i = 0; i < port.length(); i++) {
            if (port.charAt(i) < '0' || port.charAt(i) > '9') {
                return value;
            }
        }
        return host;
    }
}
