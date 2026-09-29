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
package com.anttransfer.collaboration.model.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.anttransfer.common.entity.BaseEntity;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 项目 / 群组成员关系实体（表 {@code sys_group_member}，V4 迁入）。
 *
 * <p><b>本实体承载两类用途：</b>
 * <ol>
 *   <li><b>授权依据</b>：群聊发送 / 拉取前的成员资格校验（{@code ChatService#assertGroupMember}）
 *       ——非成员直接以 {@code ErrorCode.CHAT_NOT_GROUP_MEMBER(1012)} 拒收，不落库、不推送，
 *       避免「非成员把消息写进别人的群会话」。
 *       <b>发送与历史拉取都只认本表</b>，故成员行的增删即「谁能读这个群」的最终定义；</li>
 *   <li><b>群管理面</b>：{@code ChatGroupService} 的邀请 / 移除 / 退群 / 解散都作用在本表
 *       （插入、复活、置删），群配置面板的成员名单也读本表。</li>
 * </ol></p>
 *
 * <p>唯一键 {@code uk_group_user(group_id, user_id)} 是并发下的最终防线：应用层先查后写，
 * 极端并发下重复入群由数据库唯一键兜底抛错，不会产生重复成员行。</p>
 *
 * <p><b>注意该唯一键不含 {@code deleted}：</b>逻辑删除行仍占位，因此「移除后重新邀请」
 * 绝不能直接 {@code insert}（必撞唯一键），只能原地复活
 * （见 {@code GroupMemberMapper#markRestored}）。</p>
 *
 * <p>成员角色（{@code memberRole}）CE 阶段不参与发言判定——只读成员（3）在 CE 仍可发言，
 * 若 EE 需要「只读成员禁言」，应在此处追加判定（属需求变更，须先过 D-6 范围评审）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_group_member")
public class GroupMember extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /** 成员角色：普通成员 */
    public static final int ROLE_MEMBER = 1;

    /** 成员角色：管理员 */
    public static final int ROLE_ADMIN = 2;

    /** 成员角色：只读 */
    public static final int ROLE_READONLY = 3;

    /** 消息免打扰：关闭（默认，所有消息都提醒） */
    public static final int MUTE_OFF = 0;

    /** 消息免打扰：开启（仅按 mention 偏好决定是否提醒） */
    public static final int MUTE_ON = 1;

    /** 提醒开关：关闭 */
    public static final int NOTIFY_OFF = 0;

    /** 提醒开关：开启（默认） */
    public static final int NOTIFY_ON = 1;

    /** 项目 / 群组 ID（逻辑关联 sys_group） */
    private Long groupId;

    /** 成员用户 ID（逻辑关联 sys_user） */
    private Long userId;

    /** 成员角色：1-成员 2-管理员 3-只读 */
    private Integer memberRole;

    /** 加入时间（DB 默认 CURRENT_TIMESTAMP，入群时由应用显式赋值） */
    @TableField(value = "join_time")
    private LocalDateTime joinTime;

    /**
     * 消息免打扰：0-关闭 1-开启（见 {@code V20} 口径）。
     *
     * <p>本列是 (我, 这个群) 这条成员关系的私有属性——群主无法替成员关闭提醒。
     * 关闭时所有消息都提醒；开启时是否提醒由 {@link #notifyOnMention} /
     * {@link #notifyOnMentionAll} 逐档决定。</p>
     */
    @TableField(value = "mute_status")
    private Integer muteStatus;

    /** 有人 {@code @} 我时是否提醒：0-不提醒 1-提醒（仅在 {@link #muteStatus}=1 时参与裁决）。 */
    @TableField(value = "notify_on_mention")
    private Integer notifyOnMention;

    /** 群主 {@code @} 所有人时是否提醒：0-不提醒 1-提醒（仅在 {@link #muteStatus}=1 时参与裁决）。 */
    @TableField(value = "notify_on_mention_all")
    private Integer notifyOnMentionAll;

    /** 是否已开启消息免打扰（{@code null} 视为关闭——存量行 / 未设置即保持原行为）。 */
    public boolean isMuted() {
        return muteStatus != null && muteStatus == MUTE_ON;
    }

    /** 「有人 @ 我」提醒开关（{@code null} 视为开启，与 V20 默认值一致）。 */
    public boolean isNotifyOnMentionEnabled() {
        return notifyOnMention == null || notifyOnMention == NOTIFY_ON;
    }

    /** 「@所有人」提醒开关（{@code null} 视为开启，与 V20 默认值一致）。 */
    public boolean isNotifyOnMentionAllEnabled() {
        return notifyOnMentionAll == null || notifyOnMentionAll == NOTIFY_ON;
    }
}
