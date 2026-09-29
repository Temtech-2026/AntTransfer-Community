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
package com.anttransfer.auth.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 认证接口入参传输对象（DTO，仅承载 Controller 入站请求）。
 *
 * <p>出参视图对象统一放 {@code com.anttransfer.auth.model.vo}（见 AuthVos）。</p>
 *
 * @author AntTransfer CE
 */
public final class AuthDtos {

    private AuthDtos() {
    }

    /** 登录请求：本地账号密码 */
    public record LoginRequest(
            @NotBlank(message = "账号不能为空")
            @Size(max = 64, message = "账号长度超出限制")
            String username,

            @NotBlank(message = "密码不能为空")
            @Size(max = 128, message = "密码长度超出限制")
            String password) {
    }

    /** 刷新令牌请求（refresh token 轮换换发新令牌对） */
    public record RefreshTokenRequest(
            @NotBlank(message = "refreshToken 不能为空")
            String refreshToken) {
    }

    /**
     * 自助改密请求：先校验原口令（身份再确认），再落新口令。
     *
     * <p>这里只做「形状」约束（非空 + 上限），<b>强度策略不在此处</b>——长度 / 字符组合 /
     * 与原口令的差异统一由 {@code PasswordPolicy} 判定并返回 {@code 1030}，
     * 避免同一个策略散落在注解与服务两处、两边口径漂移。
     * 上限 64 是硬安全边界：BCrypt 对超过 72 字节的输入会静默截断，
     * 不设上限等于让「超长口令」在散列层面失真。</p>
     */
    public record ChangePasswordRequest(
            @NotBlank(message = "原密码不能为空")
            @Size(max = 128, message = "原密码长度超出限制")
            String oldPassword,

            @NotBlank(message = "新密码不能为空")
            @Size(max = 64, message = "新密码长度超出限制")
            String newPassword) {
    }

    /**
     * 本人提示音设置更新请求（{@code PUT /api/v1/users/me/notify-setting}）。
     *
     * <p>两条刻意的取舍：</p>
     * <ul>
     *     <li><b>{@code soundEnabled} 用包装类型 + {@code @NotNull}</b>：若用原始 {@code boolean}，
     *     请求体里漏掉该字段会被静默当成 {@code false}——用户只是想换个音色，却把提示音整体关了。
     *     「漏传」必须报错，不能被解释为一个合法的关闭意图。</li>
     *     <li><b>{@code custom} 必须能作为入参出现（但只是「保持现状」的意思）</b>：
     *     本接口是「<b>整体覆盖</b>三个字段」的语义，前端每次提交都必须带上用户当前音色。
     *     存量用户的音色恰恰可能就是 {@code custom}（由上传动作落定、GET 接口回显），
     *     若这里只放行内置三选一，那么<b>「只想关掉提示音」的用户会 400</b>——
     *     而他又不能用「传 default」绕过：那会把他的自定义音色悄悄改掉，
     *     界面上表现为「我只是关个声音，铃声却被换了」。
     *     真正的「悬空状态」（音色是 custom 但没有音频）由服务端在
     *     {@code SelfNotifySettingService#updateMine} 拒绝并回落，<b>不靠入参校验来防</b>：
     *     校验管的是「值的形状」，悬空管的是「与库中音频列的共存关系」，
     *     后者只有服务端在拿到该用户真实数据后才判得了。</li>
     * </ul>
     */
    public record UpdateNotifySettingRequest(
            @NotNull(message = "请显式指定提示音开关状态")
            Boolean soundEnabled,

            @NotBlank(message = "请指定提示音音色")
            @Pattern(regexp = "default|chime|bubble|custom",
                    message = "音色仅支持 default / chime / bubble / custom")
            String soundPreset) {
    }
}
