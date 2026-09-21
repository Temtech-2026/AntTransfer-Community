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
package com.anttransfer.file.model.vo;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 外发链接视图对象（创建 / 查询 / 我的分享列表）。
 *
 * <p><b>刻意不包含 {@code extractCode} 字段</b>：提取码 BCrypt 加盐后入库，
 * 服务端无法也<b>不得</b>回显明文（仅创建者本人知道自己设置的提取码）。</p>
 *
 * <p>被分享文件 ID 为 19 位雪花 ID，须以字符串过线（理由见 {@link FileNodeVO}）。</p>
 *
 * @author AntTransfer CE
 */
@Data
@Builder
public class ShareLinkVO {

    /** 外发链接令牌（拼装分享 URL 用） */
    private String token;

    /** 被分享文件 ID */
    @JsonSerialize(using = ToStringSerializer.class)
    private Long fileId;

    /** 被分享文件原始名（便于列表展示，避免前端二次查询） */
    private String fileName;

    /** 到期时间 */
    private LocalDateTime expireAt;

    /** 下载次数上限 */
    private Integer downloadLimit;

    /** 已下载次数 */
    private Integer downloadedCount;

    /** 剩余可下载次数（服务端计算，避免前端减法口径不一致） */
    private Integer remainingCount;

    /** 状态：0-生效 1-已撤销 2-已失效 */
    private Integer status;

    /** 撤销 / 失效时间 */
    private LocalDateTime revokeAt;

    /** 是否必须提取码（当前恒为 true，字段保留以兼容后续「无码链接」配置） */
    private Boolean extractCodeRequired;

    /** 创建时间 */
    private LocalDateTime createTime;
}
