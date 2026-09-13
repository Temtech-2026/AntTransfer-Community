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
package com.anttransfer.collaboration.ws;

import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.security.AccessTokenVerifier;
import com.anttransfer.common.security.AuthenticatedUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URI;
import java.util.Map;

/**
 * 握手鉴权拦截器——在 HTTP Upgrade 阶段完成 JWT 校验，未通过则不升级为长连接。
 *
 * <p><b>令牌来源（按优先级）：</b></p>
 * <ol>
 *     <li>查询串 {@code ?token=<accessToken>}——<b>浏览器唯一可行方式</b>：
 *         {@code WebSocket} 构造器不允许自定义请求头，无法像 fetch 那样带
 *         {@code Authorization}；</li>
 *     <li>请求头 {@code Authorization: Bearer <accessToken>}——非浏览器客户端
 *         （脚本 / 桌面端）的标准方式，与 HTTP 接口一致。</li>
 * </ol>
 *
 * <p><b>安全取舍（有意为之）：</b>令牌出现在 URL 会进入网关访问日志与浏览器历史。
 * 这是 WebSocket 浏览器的固有限制（除非改用 {@code Sec-WebSocket-Protocol} 子协议承载，
 * 但该方案对代理不友好）。缓解措施：① 仅接受 <b>access</b> token（短时效），不接受 refresh；
 * ② 服务端不记录完整 URL（本类日志只记 userId）；③ 部署侧应关闭握手路径的 query 级日志。
 * 若合规要求更严，EE 可改为「一次性握手票据」：先 HTTP 换取 5min 单次 ticket，
 * 再用 ticket 握手（复用 {@code at:share:ticket} 同款 GETDEL 模式）。</p>
 *
 * <p><b>拒绝方式：</b>返回 {@code false} + 401。握手失败不做 302 跳转——客户端拿到的是
 * 明确的鉴权失败（浏览器表现为 {@code onerror}/{@code onclose}），前端据此走「刷新令牌后重连」。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class WsHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(WsHandshakeInterceptor.class);

    private final AccessTokenVerifier accessTokenVerifier;

    public WsHandshakeInterceptor(AccessTokenVerifier accessTokenVerifier) {
        this.accessTokenVerifier = accessTokenVerifier;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        String token = extractToken(request);
        try {
            AuthenticatedUser user = accessTokenVerifier.verify(token);
            attributes.put(WsProtocol.ATTR_USER_ID, user.getId());
            attributes.put(WsProtocol.ATTR_USERNAME, user.getUsername());
            log.debug("WS 握手鉴权通过：userId={}, remote={}", user.getId(),
                    request.getRemoteAddress());
            return true;
        } catch (AuthException e) {
            // 不记录令牌本身（避免把凭证写进日志）；错误码足以定位
            log.info("WS 握手鉴权失败，拒绝升级：code={}, remote={}",
                    e.getErrorCode() == null ? "unknown" : e.getErrorCode().getCode(),
                    request.getRemoteAddress());
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // 握手后无需处理：会话属性已写入，交由 WsNotifyHandler 注册
        if (exception != null) {
            log.warn("WS 握手异常：uri={}, cause={}", request.getURI(), exception.getMessage());
        }
    }

    /**
     * 从查询串或请求头提取原始令牌（已剥离 {@code Bearer } 前缀）。
     */
    private String extractToken(ServerHttpRequest request) {
        String header = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(WsProtocol.BEARER_PREFIX)) {
            return header.substring(WsProtocol.BEARER_PREFIX.length()).trim();
        }
        URI uri = request.getURI();
        if (uri == null || uri.getQuery() == null) {
            return null;
        }
        for (String param : uri.getQuery().split("&")) {
            int idx = param.indexOf('=');
            if (idx > 0 && WsProtocol.TOKEN_PARAM.equals(param.substring(0, idx))) {
                return param.substring(idx + 1);
            }
        }
        return null;
    }
}
