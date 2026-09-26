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
