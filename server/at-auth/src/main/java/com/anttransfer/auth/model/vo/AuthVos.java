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
package com.anttransfer.auth.model.vo;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

import java.util.List;

/**
 * 认证接口出参视图对象（VO，仅承载 Controller 出站响应）。
 *
 * @author AntTransfer CE
 */
public final class AuthVos {

    private AuthVos() {
    }

    /**
     * 登录用户摘要（不含敏感字段）。
     *
     * <p><b>ID 以字符串过线：</b>19 位雪花 ID 超出 JS {@code Number.MAX_SAFE_INTEGER}，
     * 以 JSON number 下发会被 {@code JSON.parse} 静默取整。{@code currentUser.id} 在前端参与
     * 「是否本人发送」「消息归属」等判断，也可能被回传后端做已读 / 资料操作，丢精度即表现为
     * 「操作对不上人」。漏标注由 {@code PlatformIdJsonContractTest} 拦截。</p>
     */
    public record UserSummary(
            @JsonSerialize(using = ToStringSerializer.class)
            Long id,
            String username,
            String nickname,
            String avatarUrl,
            List<String> roles) {
    }

    /** 令牌对响应（access + refresh） */
    public record TokenResponse(String accessToken, String refreshToken, String tokenType,
                                long expiresIn, UserSummary user) {
    }

    /**
     * 本人消息提示音设置（{@code GET/PUT /api/v1/users/me/notify-setting}）。
     *
     * <p><b>为什么把上限也下发：</b>{@code maxSoundBytes / maxSoundDurationMillis}
     * 是服务端强制的准入事实，前端据它做「选好文件立刻提示超限」的即时反馈。
     * 下发而不是让前端各写一份常数，是为了让「前端拦得住」与「后端真的拒」永远同一口径——
     * 一旦两处数字分叉，用户就会遇到「本地提示没问题、上传却被拒」这类无法自解的故障。</p>
     *
     * <p><b>{@code customSoundUrl} 为空即代表没有自定义音频</b>（而非「有但地址取不到」）：
     * 地址由 {@code NotificationSoundStoragePort#urlOf} 由库里的 key 现拼，
     * key 为空时它返回 {@code null}。</p>
     *
     * <p>不含任何存储 key / 落盘路径——那些是取音频的凭据，只应存在于服务端。</p>
     */
    public record NotifySettingVO(
            boolean soundEnabled,
            String soundPreset,
            String customSoundName,
            Long customSoundSize,
            Integer customSoundDurationMs,
            String customSoundUrl,
            long maxSoundBytes,
            long maxSoundDurationMillis) {
    }
}
