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
package com.anttransfer.gateway.ratelimit;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.ratelimit.RateLimit;
import com.anttransfer.common.result.ErrorCode;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 限流切面的行为契约测试。
 *
 * <p><b>重点是「限流键落在谁头上」而不是「计数对不对」。</b>计数逻辑是三行 Lua，
 * 而键的取值口径错了会以两种完全相反的方式静默失效：</p>
 * <ul>
 *   <li>反代后取 {@code getRemoteAddr()} → 全站共用代理 IP 一个桶，正常用户互相挤爆；</li>
 *   <li>直接取 {@code X-Forwarded-For} → 每次伪造新 IP 即绕过，且把任意字符串写进 Redis 键。</li>
 * </ul>
 * <p>两种情况都不会让任何测试变红——请求要么全被限、要么完全不限，服务端日志都看不出异常。
 * 故用真实 {@code MockHttpServletRequest} 驱动这些分支。</p>
 *
 * <p><b>已知限制（本测试不掩盖）：</b>{@code ClientIpResolver} 只校验 IP <b>字面量格式</b>，
 * 不校验来源可信。X-Forwarded-For 首跳仍是客户端可伪造的（这是链路层问题，纯应用层无法根治）：
 * 攻击者声明 {@code X-Forwarded-For: 1.1.1.1, ...} 即可切到别的桶。真正的收口是让 nginx
 * <b>覆写</b>而非追加该头，并只信任最右侧一跳——属部署侧约束，不在本切面职责内。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class RateLimitAspectTest {

    private static final String PROXY_ADDR = "10.0.0.1";
    private static final String REAL_CLIENT_IP = "1.1.1.1";

    @Mock
    private StringRedisTemplate redis;

    private RateLimitAspect aspect;

    @BeforeEach
    void setUp() {
        aspect = new RateLimitAspect(redis);
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    @DisplayName("窗口内计数超限：抛 RATE_LIMITED，注解上的 message 原样生效")
    void rejectsWhenCountExceedsMax() throws Throwable {
        givenRequest(PROXY_ADDR, null);
        givenRedisCount(6L); // 注解 max = 5

        assertThatThrownBy(() -> aspect.aroundMethod(joinPoint(), loginRateLimit()))
                .isInstanceOf(BusinessException.class)
                .hasMessage("登录过于频繁")
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.RATE_LIMITED.getCode());
    }

    @Test
    @DisplayName("窗口内未超限：放行到业务方法")
    void proceedsWhenWithinLimit() throws Throwable {
        givenRequest(PROXY_ADDR, null);
        givenRedisCount(5L);
        ProceedingJoinPoint joinPoint = proceedingJoinPoint();

        assertThat(aspect.aroundMethod(joinPoint, loginRateLimit())).isEqualTo("ok");
    }

    @Test
    @DisplayName("反代场景：限流键用 X-Forwarded-For 首跳，不用代理地址")
    void keysOnForwardedForFirstHopInsteadOfProxyAddress() throws Throwable {
        givenRequest(PROXY_ADDR, REAL_CLIENT_IP + ", 203.0.113.7");
        givenRedisCount(1L);

        aspect.aroundMethod(proceedingJoinPoint(), loginRateLimit());

        assertThat(capturedKey())
                .contains(REAL_CLIENT_IP)
                .as("若键里出现代理地址，全站会共用一个计数桶")
                .doesNotContain(PROXY_ADDR);
    }

    @Test
    @DisplayName("伪造的 X-Forwarded-For 非 IP 字面量：降级回 remoteAddr，不污染 Redis 键空间")
    void fallsBackToRemoteAddrWhenForwardedForIsNotAnIpLiteral() throws Throwable {
        givenRequest(PROXY_ADDR, "not-an-ip; DEL at:rl:*");
        givenRedisCount(1L);

        aspect.aroundMethod(proceedingJoinPoint(), loginRateLimit());

        assertThat(capturedKey())
                .contains(PROXY_ADDR)
                .as("非 IP 字面量必须被挡在键外，否则可注入任意键名")
                .doesNotContain("not-an-ip");
    }

    @Test
    @DisplayName("Redis 不可用：降级为放行，不拖垮业务")
    void degradesToAllowWhenRedisFails() throws Throwable {
        givenRequest(PROXY_ADDR, null);
        when(redis.execute(any(), anyList(), any())).thenThrow(new RuntimeException("redis down"));
        ProceedingJoinPoint joinPoint = proceedingJoinPoint();

        assertThat(aspect.aroundMethod(joinPoint, loginRateLimit())).isEqualTo("ok");
    }

    /* ==================== TC-AUTH-03 横向撞库：限流维度必须是 IP ==================== */

    @Test
    @DisplayName("TC-AUTH-03 同一 IP 打不同账号：共用一个桶（横向撞库因此会被拦住）")
    void sameIpDifferentAccounts_shareOneBucket() throws Throwable {
        givenRequest(PROXY_ADDR, REAL_CLIENT_IP);
        givenRedisCount(1L);

        // 两次调用模拟「同一个 IP，换两个不同的账号名登录」。
        // 账号不参与键：正因如此，攻击者用一个 IP 连打 10 万个账号时，计数是累加的，
        // 而不是每账号各拿一个全新配额（那正是 per-账号锁定挡不住的横向撞库）。
        aspect.aroundMethod(proceedingJoinPoint(), loginRateLimit());
        aspect.aroundMethod(proceedingJoinPoint(), loginRateLimit());

        List<String> keys = capturedKeys(2);
        assertThat(keys.get(0))
                .as("同 IP 不同账号必须落在同一个桶，否则横向撞库每个账号都拿到全新配额")
                .isEqualTo(keys.get(1));
        assertThat(keys.get(0)).contains(REAL_CLIENT_IP);
    }

    @Test
    @DisplayName("TC-AUTH-03 不同 IP：各自独立成桶（防一个正常用户拖垮另一个）")
    void differentIps_getSeparateBuckets() throws Throwable {
        givenRedisCount(1L);

        givenRequest(PROXY_ADDR, "1.1.1.1");
        aspect.aroundMethod(proceedingJoinPoint(), loginRateLimit());
        givenRequest(PROXY_ADDR, "2.2.2.2");
        aspect.aroundMethod(proceedingJoinPoint(), loginRateLimit());

        List<String> keys = capturedKeys(2);
        assertThat(keys.get(0))
                .as("不同来源 IP 必须分桶，否则限流会变成「先到先占」的全局配额")
                .isNotEqualTo(keys.get(1))
                .contains("1.1.1.1");
        assertThat(keys.get(1)).contains("2.2.2.2");
    }

    // ------------------------------------------------------------------ 夹具

    /** 注解实例的载体——{@link RateLimit} 不能直接 new，只能从被标注的方法上取。 */
    static class LimitedEndpoint {

        @RateLimit(windowSeconds = 60, max = 5, key = "login", message = "登录过于频繁")
        public String login() {
            return "ok";
        }
    }

    private RateLimit loginRateLimit() throws NoSuchMethodException {
        return LimitedEndpoint.class.getMethod("login").getAnnotation(RateLimit.class);
    }

    private ProceedingJoinPoint joinPoint() throws Throwable {
        ProceedingJoinPoint joinPoint = mock(ProceedingJoinPoint.class);
        MethodSignature signature = mock(MethodSignature.class);
        when(joinPoint.getSignature()).thenReturn(signature);
        when(signature.getDeclaringType()).thenReturn(LimitedEndpoint.class);
        when(signature.getName()).thenReturn("login");
        return joinPoint;
    }

    /**
     * 同上，但额外允许真正进入业务方法。
     *
     * <p>独立成方法而非在 {@link #joinPoint()} 里统一打桩：被限流拦截的用例根本不会调用
     * {@code proceed()}，统一打桩会触发 Mockito 的 UnnecessaryStubbing——那条告警恰好是
     * 「测试没走到你以为的那条路径」的哨兵，不该用 lenient 压掉。</p>
     */
    private ProceedingJoinPoint proceedingJoinPoint() throws Throwable {
        ProceedingJoinPoint joinPoint = joinPoint();
        when(joinPoint.proceed()).thenReturn("ok");
        return joinPoint;
    }

    private void givenRequest(String remoteAddr, String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddr);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    private void givenRedisCount(long count) {
        when(redis.execute(any(), anyList(), any())).thenReturn(count);
    }

    /** 取出切面真正拿去计数的 Redis 键（键的错误口径是本测试的主要防线）。 */
    @SuppressWarnings("unchecked")
    private String capturedKey() {
        ArgumentCaptor<List<String>> captor = ArgumentCaptor.forClass(List.class);
        verify(redis).execute(any(), captor.capture(), any());
        return captor.getValue().get(0);
    }

    /** 多次调用场景下取出全部限流键，用于比较「是不是同一个桶」。 */
    @SuppressWarnings("unchecked")
    private List<String> capturedKeys(int times) {
        ArgumentCaptor<List<String>> captor = ArgumentCaptor.forClass(List.class);
        verify(redis, times(times)).execute(any(), captor.capture(), any());
        return captor.getAllValues().stream().map(keys -> keys.get(0)).toList();
    }
}
