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
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 会话文件附件授权（映射 {@code sys_chat_attachment}，见 sql/V12__chat_attachment.sql）。
 *
 * <p><b>本行是什么：</b>一条「发送方把某个文件条目授权给某个同事取件」的凭证，
 * 同时承载发送方设定的三轴用途限制（{@link #usageMode} 档位 / {@link #expireAt} 有效期 /
 * {@link #downloadLimit} 次数）。聊天消息正文只携带 {@code #att:{id}} 尾注，
 * 判定全部落在这里，因此接收方取件时<b>不需要</b>对发送方的文件拥有任何文件域权限。</p>
 *
 * <p><b>为什么落 at-file 而不是 at-collaboration：</b>同 {@code sys_share_link} 的
 * AT-DIFF-06 裁决——每一条判定都强依赖条目归属、物理文件与存储抽象取流，
 * 落本域才能让「授权校验 → 用途判定 → 次数扣减 → 取流 → 审计」在同一模块内闭环。
 * 详见 V12 脚本头部的完整论证。</p>
 *
 * <p><b>为什么 {@code deleted} 恒为 0：</b>撤销是 {@link #STATUS_REVOKED} 状态位，
 * 不是逻辑删除——接收方需要看到「已被发送方撤销」这一事实（而不是卡片凭空消失），
 * 发送方也需要这条行继续留在审计链路里。因此本表从不置 {@code deleted=1}。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_chat_attachment")
public class ChatAttachment extends BaseEntity {

    /** 状态：生效（唯一可释放取件额度的状态） */
    public static final int STATUS_ACTIVE = 0;

    /** 状态：已撤销（发送方的绝对否决，不可恢复） */
    public static final int STATUS_REVOKED = 1;

    /** 状态：已失效（有效期届满或下载次数达上限，终态） */
    public static final int STATUS_EXPIRED = 2;

    /** 用途档位：仅预览——只允许内联预览，拒绝下载，且不计入 {@link #downloadCount} */
    public static final int USAGE_PREVIEW_ONLY = 1;

    /** 用途档位：可下载——允许预览与下载，下载计入 {@link #downloadCount} */
    public static final int USAGE_DOWNLOADABLE = 2;

    /** 用途档位：可转发转存——在可下载之上，额外允许接收方保存为自己的条目 */
    public static final int USAGE_RESAVABLE = 3;

    /** 用途档位取值下界（含），用于入参校验 */
    public static final int USAGE_MODE_MIN = USAGE_PREVIEW_ONLY;

    /** 用途档位取值上界（含），用于入参校验 */
    public static final int USAGE_MODE_MAX = USAGE_RESAVABLE;

    /** 文件条目 ID（逻辑关联 {@code sys_file_node.id}）——发送时的那个引用，非物理文件 */
    @TableField("node_id")
    private Long nodeId;

    /** 物理文件 ID（逻辑关联 {@code sys_file.id}）——冗余自条目，取流时省一次联表 */
    @TableField("file_id")
    private Long fileId;

    /** 发送方（授权人）用户 ID */
    @TableField("sender_user_id")
    private Long senderUserId;

    /**
     * 接收方用户 ID——本期仅单聊，即单聊对端。
     *
     * <p>群聊附件需查 {@code sys_group_member}（归 at-collaboration），会引入新的跨模块
     * SPI 契约，故本期不支持，见 {@code docs/development/AT-DIFF-todos.md} 的登记。</p>
     */
    @TableField("receiver_user_id")
    private Long receiverUserId;

    /** 发送时文件名快照——源条目后续改名 / 删除都不影响已发出的卡片显示 */
    @TableField("file_name")
    private String fileName;

    /** 发送时文件大小快照（字节） */
    @TableField("size_bytes")
    private Long sizeBytes;

    /** 用途档位：1-仅预览 2-可下载 3-可转发转存（累进单选） */
    @TableField("usage_mode")
    private Integer usageMode;

    /** 授权过期时间（{@code null}=不限期） */
    @TableField("expire_at")
    private LocalDateTime expireAt;

    /** 下载次数上限（0=不限） */
    @TableField("download_limit")
    private Integer downloadLimit;

    /** 已下载次数（仅由 DB 原子累加，禁止应用层读改写） */
    @TableField("download_count")
    private Integer downloadCount;

    /** 状态：{@link #STATUS_ACTIVE} / {@link #STATUS_REVOKED} / {@link #STATUS_EXPIRED} */
    @TableField("status")
    private Integer status;

    /** 发送方消息幂等键（重发不重复建授权；{@code null} 不参与唯一判定） */
    @TableField("client_msg_key")
    private String clientMsgKey;

    /** 是否处于「可释放额度」的状态（唯一放行态） */
    public boolean active() {
        return status != null && status == STATUS_ACTIVE;
    }

    /** 是否允许下载（档位 ≥ 可下载） */
    public boolean downloadable() {
        return usageMode != null && usageMode >= USAGE_DOWNLOADABLE;
    }

    /** 是否允许接收方转存到自己的文件（档位 = 可转发转存） */
    public boolean resavable() {
        return usageMode != null && usageMode >= USAGE_RESAVABLE;
    }

    /** 是否为不限次下载（{@code downloadLimit == 0}） */
    public boolean unlimitedDownloads() {
        return downloadLimit == null || downloadLimit <= 0;
    }

    /** 是否已过期（{@code expireAt} 为空视为不限期） */
    public boolean expiredAt(LocalDateTime now) {
        return expireAt != null && !expireAt.isAfter(now);
    }
}
