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
package com.anttransfer.auth.security;

import com.anttransfer.common.result.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 登录态失败出口矩阵：{@link RestAuthenticationEntryPoint} 与 {@link RestAccessDeniedHandler}。
 *
 * <p>这两个类是「1xxx 段落」唯一对外的翻译层，前端的分支策略完全由它们决定：</p>
 * <ul>
 *     <li>1001 未登录 / 1002 过期（静默刷新重放）/ 1006 无效（跳登录）三者语义不同，
 *         一旦出口把它们揉成一个码，前端的「静默刷新」与「跳登录」就再也分不开；</li>
 *     <li>HTTP 状态必须取自 {@code ErrorCode.getHttpStatus()}，不得在本类里另写一套判断，
 *         否则「枚举改了、出口没跟上」会让契约静默漂移；</li>
 *     <li>1003 无权限是<b>策略 D</b>（就地提示、禁止引导登录）。已认证用户被拒时
 *         绝不能复用 1001 的口径，否则会把人踢回登录页；</li>
 *     <li>请求属性是过滤器写入的<b>不可信输入</b>：未知码 / 类型不符必须降级为 1001，
 *         不能抛异常导致 500。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@DisplayName("登录态失败出口矩阵 · 1001/1002/1006 区分与 1003 越权出口")
class RestAuthFailureHandlerTest {

    private static final String ATTR_AUTH_ERROR_CODE = JwtAuthenticationFilter.ATTR_AUTH_ERROR_CODE;

    private static final String BEARER_PATH = "/v1/files";

    private final ObjectMapper objectMapper = new ObjectMapper();

    private RestAuthenticationEntryPoint entryPoint;

    private RestAccessDeniedHandler accessDeniedHandler;

    @BeforeEach
    void setUp() {
        entryPoint = new RestAuthenticationEntryPoint(objectMapper);
        accessDeniedHandler = new RestAccessDeniedHandler(objectMapper);
    }

    /* ======================== 未认证出口 ======================== */

    @Test
    @DisplayName("根本没有令牌（无请求属性）→ 1001 / 401")
    void noAttribute_shouldReportNotLogin() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", BEARER_PATH);
        MockHttpServletResponse response = new MockHttpServletResponse();

        entryPoint.commence(request, response, new BadCredentialsException("未携带凭证"));

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(body(response).path("code").asInt()).isEqualTo(ErrorCode.NOT_LOGIN.getCode());
    }

    @ParameterizedTest(name = "{0} → 原样透出，不与其它码合并")
    @EnumSource(value = ErrorCode.class, names = {"NOT_LOGIN", "TOKEN_EXPIRED", "TOKEN_INVALID"})
    void credentialFailure_shouldSurfaceExactCodeAndStatus(ErrorCode errorCode) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", BEARER_PATH);
        request.setAttribute(ATTR_AUTH_ERROR_CODE, errorCode.getCode());
        MockHttpServletResponse response = new MockHttpServletResponse();

        entryPoint.commence(request, response, new BadCredentialsException("凭证不可用"));

        assertThat(response.getStatus())
                .as("HTTP 状态须取自 ErrorCode，不得在本类另写判断")
                .isEqualTo(errorCode.getHttpStatus());
        JsonNode body = body(response);
        assertThat(body.path("code").asInt()).isEqualTo(errorCode.getCode());
        assertThat(body.path("message").asText()).isEqualTo(errorCode.getMessage());
    }

    /**
     * 非法码包含两类：未登记的（9999 / -1 / 200 / 500）与「已登记但不是失败态」的
     * {@code 0 = SUCCESS}。后者最危险——{@code find(0)} 会正常命中，若不排除，
     * 认证失败会返回 HTTP 200 + {@code code=0}「成功」。
     */
    @ParameterizedTest(name = "请求属性为非法码 {0} → 一律降级 1001，不 500、不透出成功")
    @ValueSource(ints = {9999, -1, 0, 200, 500})
    void illegalAttributeCode_shouldFallBackToNotLogin(int forgedCode) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", BEARER_PATH);
        request.setAttribute(ATTR_AUTH_ERROR_CODE, forgedCode);
        MockHttpServletResponse response = new MockHttpServletResponse();

        entryPoint.commence(request, response, new BadCredentialsException("属性被篡改"));

        assertThat(response.getStatus()).isEqualTo(ErrorCode.NOT_LOGIN.getHttpStatus());
        assertThat(body(response).path("code").asInt()).isEqualTo(ErrorCode.NOT_LOGIN.getCode());
    }

    @Test
    @DisplayName("请求属性类型不符（字符串）→ 同样降级 1001")
    void nonIntegerAttribute_shouldFallBackToNotLogin() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", BEARER_PATH);
        request.setAttribute(ATTR_AUTH_ERROR_CODE, "1002");
        MockHttpServletResponse response = new MockHttpServletResponse();

        entryPoint.commence(request, response, new BadCredentialsException("属性类型异常"));

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(body(response).path("code").asInt()).isEqualTo(ErrorCode.NOT_LOGIN.getCode());
    }

    /* ======================== 越权出口 ======================== */

    @Test
    @DisplayName("已认证但无权限 → 固定 1003 / 403（策略 D，不引导登录）")
    void accessDenied_shouldAlwaysBeNoAuth() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", BEARER_PATH);
        MockHttpServletResponse response = new MockHttpServletResponse();

        accessDeniedHandler.handle(request, response, new AccessDeniedException("缺少 file:destroy"));

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(body(response).path("code").asInt()).isEqualTo(ErrorCode.NO_AUTH.getCode());
    }

    @Test
    @DisplayName("越权出口不受请求属性影响：伪造 1001 也不能把自己降级成「未登录」")
    void accessDenied_shouldIgnoreForgeableRequestAttribute() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", BEARER_PATH);
        request.setAttribute(ATTR_AUTH_ERROR_CODE, ErrorCode.NOT_LOGIN.getCode());
        MockHttpServletResponse response = new MockHttpServletResponse();

        accessDeniedHandler.handle(request, response, new AccessDeniedException("越权"));

        assertThat(response.getStatus())
                .as("已认证用户被拒不得返回 401，否则前端会把人踢回登录页")
                .isEqualTo(403);
        assertThat(body(response).path("code").asInt()).isEqualTo(ErrorCode.NO_AUTH.getCode());
    }

    @Test
    @DisplayName("1003 文案不得引导登录（前端红线：策略 D 就地提示）")
    void accessDenied_message_mustNotGuideToLogin() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", BEARER_PATH);
        MockHttpServletResponse response = new MockHttpServletResponse();

        accessDeniedHandler.handle(request, response, new AccessDeniedException("越权"));

        assertThat(body(response).path("message").asText())
                .as("1003 是策略 D，任何「请重新登录」类文案都会触发前端的错误分支")
                .doesNotContain("登录");
    }

    /* ======================== 响应形状 ======================== */

    @Test
    @DisplayName("两个出口的响应形状一致：JSON + UTF-8、data 为 null（不泄漏内部细节）")
    void bothHandlers_shouldEmitUniformJsonShape() throws Exception {
        MockHttpServletRequest deniedRequest = new MockHttpServletRequest("DELETE", BEARER_PATH);
        MockHttpServletResponse deniedResponse = new MockHttpServletResponse();
        accessDeniedHandler.handle(deniedRequest, deniedResponse, new AccessDeniedException("越权"));

        MockHttpServletRequest unauthRequest = new MockHttpServletRequest("GET", BEARER_PATH);
        MockHttpServletResponse unauthResponse = new MockHttpServletResponse();
        entryPoint.commence(unauthRequest, unauthResponse, new BadCredentialsException("未携带凭证"));

        for (MockHttpServletResponse response : new MockHttpServletResponse[]{deniedResponse, unauthResponse}) {
            assertThat(response.getContentType()).startsWith("application/json");
            assertThat(response.getCharacterEncoding()).isEqualTo("UTF-8");
            assertThat(body(response).path("data").isNull())
                    .as("失败响应不得携带 data，避免把异常细节透给调用方")
                    .isTrue();
            assertThat(body(response).path("code").asInt()).isNotZero();
        }
    }

    private JsonNode body(MockHttpServletResponse response) throws Exception {
        return objectMapper.readTree(response.getContentAsByteArray());
    }
}
