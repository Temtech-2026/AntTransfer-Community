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
package com.anttransfer.file.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 外发链接实体：映射 {@code sys_share_link}，面向无账号外部协作者的限时 / 限次 / 限提取码下载通道。
 *
 * <p><b>状态机（与 V1 表注释对齐，迁移一律 CAS）</b>：</p>
 * <pre>
 *   0 生效 ──撤销──▶ 1 已撤销（终态，不可恢复）
 *   0 生效 ──过期 / 达下载上限──▶ 2 已失效（终态，可重新创建新链接）
 * </pre>
 *
 * <p><b>安全约定</b>：</p>
 * <ul>
 *     <li>{@code token} 为高熵不透明令牌（{@code SecureRandom} 32 字节 → Base64URL，43 字符），
 *         对外唯一标识且不可猜测；数据库 {@code uk_token} 兜底防碰撞；</li>
 *     <li>{@code extractCodeHash} 为 BCrypt 散列（自带盐），<b>任何接口均不回显提取码</b>；</li>
 *     <li>{@code downloadedCount} 只允许通过 Mapper 的原子 SQL 自增（防并发超发，P-8）。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_share_link")
public class ShareLink extends BaseEntity {

    /** 状态：0-生效 */
    public static final int STATUS_ACTIVE = 0;
    /** 状态：1-已撤销（创建者主动撤销，终态） */
    public static final int STATUS_REVOKED = 1;
    /** 状态：2-已失效（过期 / 达下载上限，终态） */
    public static final int STATUS_EXPIRED = 2;

    /** 外发链接不透明令牌（高熵随机，对外唯一标识） */
    @TableField("token")
    private String token;

    /** 被分享文件 ID（逻辑关联 sys_file） */
    @TableField("file_id")
    private Long fileId;

    /** 创建者用户 ID（撤销 / 审计归属，同时是数据范围校验依据） */
    @TableField("owner_user_id")
    private Long ownerUserId;

    /** 提取码散列（BCrypt，含盐；不落明文、不回显） */
    @TableField("extract_code_hash")
    private String extractCodeHash;

    /** 链接到期时间（默认创建后 7 天，上限受管理员配置约束） */
    @TableField("expire_at")
    private LocalDateTime expireAt;

    /** 下载次数上限（默认 10 次） */
    @TableField("download_limit")
    private Integer downloadLimit;

    /** 已下载次数（并发原子扣减，禁止读改写） */
    @TableField("downloaded_count")
    private Integer downloadedCount;

    /** 状态：0-生效 1-已撤销 2-已失效 */
    @TableField("status")
    private Integer status;

    /** 撤销 / 失效时间（终态迁移时写入） */
    @TableField("revoke_at")
    private LocalDateTime revokeAt;
}
