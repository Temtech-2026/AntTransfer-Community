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
package com.anttransfer.auth.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.util.AntPathMatcher;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 免登录白名单的合并契约：<b>内置项不可被配置删减，配置只能追加</b>。
 *
 * <p>守住的是线上真实出过的事故：{@code application-dev.yml} 为放行 Swagger 写了
 * {@code anttransfer.auth.permit-all}，而 Spring Boot 的 profile 配置文档优先级高于主文档、
 * 且 List 属性<b>整体替换而非逐项合并</b>——主配置里的 5 条被静默丢弃。后果不是「Swagger
 * 多放行了几条」，而是：</p>
 * <ul>
 *     <li>{@code /ws/notify} 不在白名单 → 握手被 {@code anyRequest().authenticated()}
 *         拦成 401(1001)，浏览器侧无法设置 Authorization 头，前端<b>永远停在
 *         「正在建立实时连接」</b>，且看不出是配置问题；</li>
 *     <li>文件取件两个端点（content / thumbnail）失效 → 原生下载与缩略图一律 401；</li>
 *     <li>外发分享访客侧三个端点（verify / redeem / content）失效 → 访客页直接不可用
 *         （链接打得开、提取码也验得过，但一到下载就是 401）。</li>
 * </ul>
 *
 * <p>这就是这几条被上移到 {@link SecurityConfig#BUILT_IN_PERMIT_ALL} 的原因：
 * 它们与运行环境无关，任何 profile 都必须放行，因此不能放在会被 profile 覆盖的配置里。</p>
 *
 * @author AntTransfer CE
 */
@DisplayName("免登录白名单 · 内置项不可被配置覆盖")
class SecurityConfigTest {

    /**
     * 产品固有的匿名入口。
     *
     * <p>绝大多数靠「令牌 / 票据」在服务层自证，而不是靠登录态；
     * 唯一例外是头像直出端点（{@code /v1/users/{id}/avatar}）——它是<b>按设计公开</b>的读取路径
     * （内容只有图片字节 + 用户 ID 不可枚举 + 端点自身限流），放行依据写在
     * {@code SecurityConfig.BUILT_IN_PERMIT_ALL} 的对应注释里。</p>
     *
     * <p>（此处刻意不写成带星号通配的路径字面量：{@code *} 紧跟 {@code /} 会提前闭合本段
     * javadoc，编译器随后把正文当成代码，报一串「非法字符」——同一个坑第一批已在
     * at-auth 的 {@code UserAvatarController} 上踩过一次。）</p>
     */
    private static final List<String> PRODUCT_ANONYMOUS_ENTRIES = List.of(
            "/v1/shares/*/verify",
            "/v1/shares/redeem",
            "/v1/shares/*/content",
            "/v1/files/*/content",
            "/v1/files/*/thumbnail",
            // 会话附件取件：判定全部前移到登录态换票端点，此处凭短时票据读字节。
            // 漏放行不会报错，只会表现为「卡片点得动但一直转圈 / 直接 401」，
            // 故与另外两个取件端点一起被这条契约测试钉住。
            "/v1/chat-attachments/*/content",
            // 头像直出：漏放行的表现最隐蔽——顶栏与列表里的头像全部静默回落到
            // 「展示名首字符」兜底图，接口不报错、控制台无异常，看起来就像「这个用户没上传头像」。
            //
            // ⚠️ ID 段必须是数字正则而非星号：本人自助换头像的写路径是 POST /v1/users/me/avatar，
            // 在星号通配下会被这条匿名放行顺带吃掉（Security 的路径放行不看 HTTP 方法），
            // 于是「谁能改头像」这件事被静默放宽成匿名可调。见下方
            // builtInWhitelist_shouldNotPermitSelfAvatarUpload 的单向断言。
            "/v1/users/{userId:[0-9]+}/avatar",
            "/ws/notify");

    @Test
    @DisplayName("内置白名单覆盖认证入口与全部产品固有匿名入口")
    void builtInWhitelist_shouldCoverAuthenticationAndProductAnonymousEntries() {
        List<String> whitelist = SecurityConfig.resolvePermitAll(new AuthProperties());

        assertThat(whitelist)
                .contains("/v1/auth/token", "/v1/auth/token/refresh", "/error")
                .containsAll(PRODUCT_ANONYMOUS_ENTRIES);
    }

    @Test
    @DisplayName("配置项为空 / 缺失 / 只含别的路径时，内置项一个都不少")
    void configuredList_mustNeverRemoveBuiltInEntries() {
        AuthProperties empty = new AuthProperties();

        // 仅放行 Swagger —— 正是 dev profile 的实际形态
        AuthProperties onlySwagger = new AuthProperties();
        onlySwagger.setPermitAll(List.of("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html"));

        // YAML 写 `permit-all:` 而没给值时，绑定结果就是 null
        AuthProperties nullList = new AuthProperties();
        nullList.setPermitAll(null);

        for (AuthProperties properties : List.of(empty, onlySwagger, nullList)) {
            assertThat(SecurityConfig.resolvePermitAll(properties))
                    .as("配置只能追加，永远删不掉内置匿名入口")
                    .containsAll(PRODUCT_ANONYMOUS_ENTRIES);
        }
    }

    @Test
    @DisplayName("配置项只做追加，且内置项排在前面（顺序稳定，便于排查）")
    void configuredList_shouldBeAppendedAfterBuiltIns() {
        AuthProperties properties = new AuthProperties();
        properties.setPermitAll(List.of("/v3/api-docs/**"));

        List<String> whitelist = SecurityConfig.resolvePermitAll(properties);

        assertThat(whitelist).endsWith("/v3/api-docs/**");
        assertThat(whitelist.indexOf("/ws/notify"))
                .as("WebSocket 握手路径必须来自内置项，而不是等到配置补")
                .isLessThan(whitelist.indexOf("/v3/api-docs/**"));
    }

    @Test
    @DisplayName("WebSocket 握手路径必须内置：浏览器无法为 WS 设置 Authorization 头")
    void wsHandshakePath_mustRemainPermitted() {
        // 一旦它掉出白名单，握手会在 Security 层就被拒（401/1001），
        // 前端只能看到「正在建立实时连接」，没有任何可诊断信息。
        assertThat(SecurityConfig.resolvePermitAll(new AuthProperties()))
                .contains("/ws/notify");
    }

    /**
     * 本人换头像的<b>写路径</b>不得被匿名放行——这是「谁能改头像」的边界，漏了等于人人可改。
     *
     * <p>本用例按<b>真实匹配语义</b>断言，而不是比较字符串字面量：星号通配与数字正则
     * 在肉眼上只差几个字符，但它们对 {@code /v1/users/me/avatar} 的判定完全不同。
     * 同时做正向断言（数字 ID 的读路径仍匹配）——只做反向断言的话，
     * 把整条白名单删空也能让测试变绿。</p>
     */
    @Test
    @DisplayName("头像写路径不得匿名可达：/v1/users/me/avatar 不匹配任何白名单条目")
    void builtInWhitelist_shouldNotPermitSelfAvatarUpload() {
        AntPathMatcher matcher = new AntPathMatcher();
        List<String> whitelist = SecurityConfig.resolvePermitAll(new AuthProperties());

        assertThat(whitelist.stream().anyMatch(p -> matcher.match(p, "/v1/users/me/avatar")))
                .as("写路径被放行 = 任何人无需登录即可覆盖头像，必须由 access token 把关")
                .isFalse();
        assertThat(whitelist.stream().anyMatch(p -> matcher.match(p, "/v1/users/123/avatar")))
                .as("读路径必须仍然匿名可读，否则全部头像静默回落为「展示名首字符」兜底图")
                .isTrue();
    }
}
