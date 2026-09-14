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
package com.anttransfer.file.security;

import com.anttransfer.common.permission.RequiresPerm;
import com.anttransfer.common.ratelimit.RateLimit;
import com.anttransfer.file.controller.ShareAccessController;
import com.anttransfer.file.controller.ShareController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 外发分享「创建侧校验 / 访客侧不校验」权限边界契约测试。
 *
 * <p>这里守的是 PRD 里一条不对称的鉴权口径，写反了就会造成安全或体验事故：</p>
 * <ul>
 *     <li><b>创建侧</b>（{@link ShareController}，{@code /v1/shares} 下的 POST / DELETE / GET）：
 *         必须逐个方法标注 {@code @RequiresPerm("file:share")}。漏标一个，就等于把
 *         「谁能发起外发」这条闸门放开——这是外泄类事故的第一道口子。</li>
 *     <li><b>访客侧</b>（{@link ShareAccessController}，{@code verify} / {@code redeem}）：
 *         <b>绝不能</b>带 {@code @RequiresPerm}。访客没有登录态、更没有 {@code file:share}，
 *         一旦误标，外发链接将变成「只有网盘用户能打开」的死链接；其安全性改由「高熵令牌 +
 *         提取码 + {@code @RateLimit} 抗爆破」承担。</li>
 * </ul>
 *
 * <p><b>为何用反射而非 HTTP</b>：注解是唯一事实源，且本模块测试不启动 Web 容器；
 * 运行时「注解确实被切面执行」已由 at-bootstrap 的 {@code AuthFlowIntegrationTest}
 * （无 perm_code 访问 → 403/1003）端到端覆盖。两者互补：这里防「漏标/误标」，
 * 那里证「标了就真拦」。</p>
 *
 * @author AntTransfer CE
 */
class SharePermissionBoundaryTest {

    private static final String SHARE_PERM = "file:share";

    /* ==================== 创建侧：必须全部收口在 file:share ==================== */

    static Stream<Method> creatorEndpoints() {
        return Arrays.stream(ShareController.class.getDeclaredMethods())
                .filter(m -> !m.isSynthetic() && !m.isBridge());
    }

    @Test
    @DisplayName("创建侧端点集合非空（防止反射取不到方法导致后面的断言变成空跑）")
    void creatorController_shouldExposeEndpoints() {
        assertThat(creatorEndpoints().count()).isPositive();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("creatorEndpoints")
    @DisplayName("创建侧每个端点都必须标注 @RequiresPerm(\"file:share\")，一个都不能漏")
    void creatorSide_everyEndpoint_mustRequireSharePerm(Method method) {
        RequiresPerm perm = method.getAnnotation(RequiresPerm.class);

        assertThat(perm)
                .as("ShareController#%s 缺少 @RequiresPerm —— 无权限用户将可直接创建/撤销/枚举外发链接",
                        method.getName())
                .isNotNull();
        assertThat(perm.value()).containsExactly(SHARE_PERM);
        assertThat(perm.any())
                .as("file:share 是单点权限，不应使用 any=true 语义")
                .isFalse();
    }

    @Test
    @DisplayName("创建侧权限点唯一：不得出现 file:share 之外的第二套闸门（避免口径分裂）")
    void creatorSide_shouldUseExactlyOnePermCode() {
        List<String> codes = creatorEndpoints()
                .map(m -> m.getAnnotation(RequiresPerm.class))
                .filter(java.util.Objects::nonNull)
                .flatMap(p -> Arrays.stream(p.value()))
                .distinct()
                .toList();

        assertThat(codes).containsExactly(SHARE_PERM);
    }

    /* ==================== 访客侧：绝不校验 file:share ==================== */

    static Stream<Method> guestEndpoints() {
        return Arrays.stream(ShareAccessController.class.getDeclaredMethods())
                .filter(m -> !m.isSynthetic() && !m.isBridge());
    }

    @Test
    @DisplayName("访客侧端点集合非空（verify / redeem 至少两个）")
    void guestController_shouldExposeEndpoints() {
        assertThat(guestEndpoints().count()).isGreaterThanOrEqualTo(2);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("guestEndpoints")
    @DisplayName("访客侧端点绝不得标注 @RequiresPerm（否则免登录取件链路直接死掉）")
    void guestSide_mustNotRequirePerm(Method method) {
        assertThat(method.getAnnotation(RequiresPerm.class))
                .as("ShareAccessController#%s 误标了 @RequiresPerm —— 访客无登录态，将被 401/403 拦死",
                        method.getName())
                .isNull();
    }

    @Test
    @DisplayName("访客侧类级别也不得声明 @RequiresPerm（类级注解会波及全部端点）")
    void guestController_mustNotDeclareClassLevelPerm() {
        assertThat(ShareAccessController.class.getAnnotation(RequiresPerm.class)).isNull();
    }

    /* ==================== 访客侧替代防线：限流必须存在 ==================== */

    @ParameterizedTest(name = "{0}")
    @MethodSource("guestEndpoints")
    @DisplayName("访客侧每个端点都必须有限流（无 login 态，抗爆破只能靠 @RateLimit）")
    void guestSide_everyEndpoint_mustBeRateLimited(Method method) {
        RateLimit rateLimit = method.getAnnotation(RateLimit.class);

        assertThat(rateLimit)
                .as("ShareAccessController#%s 缺少 @RateLimit —— 免登录端点将被无限爆破",
                        method.getName())
                .isNotNull();
        assertThat(rateLimit.max()).isPositive();
        assertThat(rateLimit.windowSeconds()).isPositive();
        // 未在 yml 白名单里放行的免登录端点同样等于不可用，此处至少保证限流维度已命名
        assertThat(rateLimit.key()).isNotBlank();
    }

    @Test
    @DisplayName("换票（verify）的限流必须比核销（redeem）更严——提取码爆破发生在换票环节")
    void verifyRateLimit_shouldBeStricterThanRedeem() {
        RateLimit verify = methodOf(ShareAccessController.class, "verify").getAnnotation(RateLimit.class);
        RateLimit redeem = methodOf(ShareAccessController.class, "redeem").getAnnotation(RateLimit.class);

        assertThat(verify).isNotNull();
        assertThat(redeem).isNotNull();
        // 同一窗口下的每分钟额度：换票 < 核销
        assertThat(normalizedPerMinute(verify))
                .isLessThan(normalizedPerMinute(redeem));
    }

    /* ============================ 辅助方法 ============================ */

    private static Method methodOf(Class<?> type, String name) {
        return Arrays.stream(type.getDeclaredMethods())
                .filter(m -> m.getName().equals(name))
                .findFirst()
                .orElseThrow(() -> new AssertionError("未找到端点方法：" + name));
    }

    /** 把「窗口秒数 + 窗口内额度」折算为每分钟额度，便于跨窗口比较。 */
    private static double normalizedPerMinute(RateLimit rateLimit) {
        return rateLimit.max() * 60.0 / rateLimit.windowSeconds();
    }
}
