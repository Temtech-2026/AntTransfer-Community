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
package com.anttransfer.auth.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

/**
 * 用户消息提示音设置（{@code sys_user_notify_setting}，一人一行）。
 *
 * <p>为什么单独一张表、而不是并进 {@code sys_user}，见 {@code sql/V21} 的口径注释：
 * 频繁读取的账号事实（鉴权 / 名单 / 会话标题）不该被一份与鉴权无关的播放偏好拖着走。</p>
 *
 * <p><b>{@code customSoundKey} 是不透明存储标识，不是 URL：</b>对外地址由
 * {@code NotificationSoundStoragePort#urlOf} 现拼（与 {@code sys_user.avatar_url} 存 key 同口径）。
 * 该 key 只在「本人读自己的提示音内容」这一条路径上被使用。</p>
 *
 * <p><b>{@code customSoundSize / customSoundDurationMs} 是服务端实测快照：</b>
 * 字节数取实际接收长度，时长由 {@code AudioTypes} 从容器头解析，
 * <b>不采信前端上报</b>——事实不能由被约束方自己申报。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_user_notify_setting")
public class UserNotifySetting extends BaseEntity {

    /** 提示音总开关：关 */
    public static final int SOUND_DISABLED = 0;
    /** 提示音总开关：开 */
    public static final int SOUND_ENABLED = 1;

    /** 音色：内置默认音 */
    public static final String PRESET_DEFAULT = "default";
    /** 音色：内置清脆音 */
    public static final String PRESET_CHIME = "chime";
    /** 音色：内置低沉音 */
    public static final String PRESET_BUBBLE = "bubble";
    /** 音色：用户上传的自定义音频 */
    public static final String PRESET_CUSTOM = "custom";

    /** 设置归属用户 ID（唯一键 {@code uk_user}，一人一行） */
    @TableField("user_id")
    private Long userId;

    /** 新消息提示音总开关：0-关闭 1-开启 */
    @TableField("sound_enabled")
    private Integer soundEnabled;

    /** 提示音音色：default / chime / bubble / custom */
    @TableField("sound_preset")
    private String soundPreset;

    /** 自定义音频原始文件名（仅回显用；未设置自定义音时为 null） */
    @TableField("custom_sound_name")
    private String customSoundName;

    /** 自定义音频存储 key（不透明标识，非对外 URL） */
    @TableField("custom_sound_key")
    private String customSoundKey;

    /** 自定义音频字节数（上传时服务端实测快照） */
    @TableField("custom_sound_size")
    private Long customSoundSize;

    /** 自定义音频时长毫秒（上传时服务端由容器头解析的快照） */
    @TableField("custom_sound_duration_ms")
    private Integer customSoundDurationMs;
}
