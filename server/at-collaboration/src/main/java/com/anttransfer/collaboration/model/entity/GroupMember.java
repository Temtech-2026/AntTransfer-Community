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
 * <p>本实体在通知与 IM 域的<b>唯一</b>用途：群聊发送 / 拉取前的成员资格校验
 * （见 {@code ChatService#assertGroupMember}）——非成员直接以
 * {@code ErrorCode.CHAT_NOT_GROUP_MEMBER(1012)} 拒收，不落库、不推送，
 * 避免「非成员把消息写进别人的群会话」。</p>
 *
 * <p>唯一键 {@code uk_group_user(group_id, user_id)} 是并发下的最终防线：应用层先查后写，
 * 极端并发下重复入群由数据库唯一键兜底抛错，不会产生重复成员行。</p>
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

    /** 项目 / 群组 ID（逻辑关联 sys_group） */
    private Long groupId;

    /** 成员用户 ID（逻辑关联 sys_user） */
    private Long userId;

    /** 成员角色：1-成员 2-管理员 3-只读 */
    private Integer memberRole;

    /** 加入时间（DB 默认 CURRENT_TIMESTAMP，入群时由应用显式赋值） */
    @TableField(value = "join_time")
    private LocalDateTime joinTime;
}
