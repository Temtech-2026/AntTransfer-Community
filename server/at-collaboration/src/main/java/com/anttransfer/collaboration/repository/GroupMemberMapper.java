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
package com.anttransfer.collaboration.repository;

import com.anttransfer.collaboration.model.entity.GroupMember;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 群组成员数据访问（{@code sys_group_member}，V4 迁入）。
 *
 * <p><b>两类用途：</b>发送 / 拉取前的「是否成员」「成员都有谁」读操作，以及群组管理面的
 * 「邀请 / 移除 / 退群 / 解散」写操作（{@code ChatGroupService} 调用）。</p>
 *
 * <p><b>为什么写操作要「复活」而不是「删旧插新」：</b>唯一键 {@code uk_group_user(group_id, user_id)}
 * 是纯唯一键，<b>不含 {@code deleted}</b>——逻辑删除行仍占位。于是「移除成员」后再邀请同一人，
 * 直接 {@code insert} 必撞唯一键；而只做逻辑删除不复活，则会让重新入群静默失效
 * （行在，但 {@code deleted=1}，成员资格校验读不到，表现为「邀请成功却发不出消息」）。
 * 故邀请语义必须分三路：已在群 → 幂等跳过；曾入群（{@code deleted=1}）→ 复活；
 * 从未入群 → 新增。与 {@code UserRoleMapper} 的角色替换同一套取舍。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface GroupMemberMapper extends BaseMapper<GroupMember> {

    /**
     * 是否群成员（群聊发送前的前置校验）。
     *
     * @return &gt;0 表示是成员
     */
    @Select("""
            select count(1)
            from sys_group_member
            where group_id = #{groupId}
              and user_id = #{userId}
              and deleted = 0
            """)
    int countMember(@Param("groupId") Long groupId, @Param("userId") Long userId);

    /**
     * 群成员用户 ID 列表——群聊「写扩散」需要给每个成员各落一行。
     *
     * <p>注意：本方法<b>不做分页 / 不分批</b>。群规模在 CE 有硬上限（创建群时的成员上界），
     * 因此一次取全量是安全的；若 EE 放开万人群，此处必须改为分批（每批 500）落库，
     * 否则单次 INSERT 参数包会超限——届时同时应改为读扩散 + 会话已读游标。</p>
     */
    @Select("""
            select user_id
            from sys_group_member
            where group_id = #{groupId}
              and deleted = 0
            order by id
            """)
    List<Long> selectMemberUserIds(@Param("groupId") Long groupId);

    /**
     * 群成员名单（含角色与入群时间），供群详情面板展示。
     *
     * <p><b>只取展示与判定所需列</b>：展示名不在本表（{@code sys_user} 属 at-auth 表族，
     * 由 {@code UserLookupPort} 反查），此处给的是「谁、什么角色、什么时候进来的」。</p>
     *
     * <p>按 {@code id} 升序：与入群顺序（进而自增 ID 顺序）一致，
     * 群主恒为第一行——面板上「群主在最前」不需要额外排序规则。</p>
     */
    @Select("""
            select id, group_id, user_id, member_role, join_time,
                   mute_status, notify_on_mention, notify_on_mention_all
            from sys_group_member
            where group_id = #{groupId}
              and deleted = 0
            order by id
            """)
    List<GroupMember> selectMembers(@Param("groupId") Long groupId);

    /**
     * 我在该群的成员行（用于取群内角色），非成员返回 {@code null}。
     *
     * <p>与 {@link #countMember} 的分工：后者是发送 / 拉取热路径上的存在性判断（只回计数，
     * 不必映射实体）；本方法用在群管理面，需要 {@code member_role} 才能判定「管理员」。</p>
     */
    @Select("""
            select id, group_id, user_id, member_role, join_time,
                   mute_status, notify_on_mention, notify_on_mention_all
            from sys_group_member
            where group_id = #{groupId}
              and user_id = #{userId}
              and deleted = 0
            """)
    GroupMember selectMember(@Param("groupId") Long groupId, @Param("userId") Long userId);

    /**
     * 该用户的成员行<b>含已逻辑删除的</b>，供「移除后重邀」判断该复活还是新增。
     *
     * <p>唯一键保证至多一行，故不需要集合返回值。</p>
     */
    @Select("""
            select id, group_id, user_id, member_role, join_time, deleted
            from sys_group_member
            where group_id = #{groupId}
              and user_id = #{userId}
            """)
    GroupMember selectMemberIncludingDeleted(@Param("groupId") Long groupId,
                                            @Param("userId") Long userId);

    /**
     * 复活被移除过的成员行（绕过逻辑删除过滤，原地把 {@code deleted} 置回 0）。
     *
     * <p>{@code join_time} 一并刷新为本次入群时间：审计上「他是什么时候重新进群的」应看本次，
     * 而不是上一次。{@code member_role} 显式回落为普通成员——不能沿用他上一次的角色，
     * 否则「移除管理员后再拉回来」会静默恢复其管理身份。</p>
     *
     * <p><b>提醒偏好一并无条件回落默认值</b>（免打扰关 + 两类提及提醒开）：偏好是
     * 「他对这个群」的当下选择，被移除期间这份选择已经失去载体；若复活时沿用旧值，
     * 他会在毫不知情的情况下带着上一轮设定的免打扰回到群里，表现为「刚进群就收不到提醒」。
     * 与 {@code member_role} 同一取舍：重新入群即回到新成员状态。</p>
     */
    @Update("""
            update sys_group_member
            set deleted = 0,
                member_role = #{memberRole},
                mute_status = 0,
                notify_on_mention = 1,
                notify_on_mention_all = 1,
                join_time = #{joinTime},
                update_by = #{operatorId},
                update_time = now()
            where id = #{id}
            """)
    int markRestored(@Param("id") Long id,
                     @Param("memberRole") int memberRole,
                     @Param("joinTime") LocalDateTime joinTime,
                     @Param("operatorId") Long operatorId);

    /**
     * 停用成员行（移除成员 / 退群），绕过逻辑删除过滤以支持对已删行的幂等操作。
     *
     * <p>刻意不用 {@code deleteById}：批量语义（解散群）下逐行删除会退化成 N 次往返，
     * 而这里三处调用（移除 / 退群 / 解散）都只需要「按行或按群置 1」这一个动作。</p>
     */
    @Update("""
            update sys_group_member
            set deleted = 1,
                update_by = #{operatorId},
                update_time = now()
            where id = #{id}
            """)
    int markDeleted(@Param("id") Long id, @Param("operatorId") Long operatorId);

    /**
     * 解散群：一次停用该群全部生效成员行。
     *
     * <p><b>为什么解散要连带清空成员关系：</b>发送与历史拉取都以 {@code sys_group_member}
     * 为唯一授权依据（非成员一律 1012）。只把 {@code sys_group.status} 置 0 而保留成员行，
     * 等于「解散了但谁都还能继续收发」；而保留成员行、另加「群状态」判定则需要改发送热路径。
     * 清空成员关系一次到位：解散即终止一切读写，且复用既有校验，不新增旁路。</p>
     */
    @Update("""
            update sys_group_member
            set deleted = 1,
                update_by = #{operatorId},
                update_time = now()
            where group_id = #{groupId}
              and deleted = 0
            """)
    int markAllDeleted(@Param("groupId") Long groupId, @Param("operatorId") Long operatorId);

    /**
     * 更新「我在这个群」的提醒偏好（免打扰 + 两类提及提醒），整体覆盖式写入。
     *
     * <p><b>为什么是覆盖三列而不是按需更新其中一列：</b>三个开关共同决定一条消息是否提醒，
     * 分开更新会让两个并发请求（一个开免打扰、一个关 @ 提醒）互相覆盖对方的意图，
     * 最终状态取决于提交顺序。整体覆盖下，客户端每次提交的是「我看到并确认过的完整状态」，
     * 语义是一次替换而非增量——与三档开关的 UI 天然对应。</p>
     *
     * <p><b>归属由 WHERE 写死</b>：{@code group_id + user_id + deleted = 0} 同时回答了
     * 「这个人还在这个群里吗」——非成员 / 已退群的行 {@code deleted = 1}，受影响行数 0，
     * 由服务层转 {@code 1012}，不存在「改到别人偏好」或「改已退群群偏好」的入参面。</p>
     *
     * @return 受影响行数（1=成功，0=非成员 / 已退群）
     */
    @Update("""
            update sys_group_member
            set mute_status = #{muteStatus},
                notify_on_mention = #{notifyOnMention},
                notify_on_mention_all = #{notifyOnMentionAll},
                update_by = #{operatorId},
                update_time = now()
            where group_id = #{groupId}
              and user_id = #{userId}
              and deleted = 0
            """)
    int updateNotifyPreference(@Param("groupId") Long groupId,
                               @Param("userId") Long userId,
                               @Param("muteStatus") int muteStatus,
                               @Param("notifyOnMention") int notifyOnMention,
                               @Param("notifyOnMentionAll") int notifyOnMentionAll,
                               @Param("operatorId") Long operatorId);
}
