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

import com.anttransfer.collaboration.model.entity.SysGroup;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 项目 / 群组数据访问（{@code sys_group}，V1 建表）。
 *
 * <p>继承 {@code BaseMapper} 拿到建群所需的 {@code insert}，以及会话列表查群名所需的
 * {@code selectByIds}（批量主键查询，走主键，逻辑删除由 {@code @TableLogic} 自动追加）。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface SysGroupMapper extends BaseMapper<SysGroup> {

    /**
     * 我加入的群（供聊天弹窗选择会话目标 / 建群后回显）。
     *
     * <p><b>为什么用 JOIN 而不是「先查成员关系再按 ID 查群」：</b>后者在群较多时
     * 要么退化成 N 次查询（每个群查一次成员数），要么需要把 ID 集合拼进 IN 子句；
     * 这里一次 JOIN + 聚合即可同时得到群名、群主与成员数。</p>
     *
     * <p><b>{@code me} 与 {@code m} 是两次不同目的的连接，不要合并：</b>
     * {@code me} 是「我是不是成员」（过滤条件，且靠唯一键保证至多一行，
     * 不会把结果行数放大），{@code m} 是「这个群有多少人」（聚合来源）。
     * 少了 {@code me} 就是越权列出所有群，少了 {@code m} 成员数恒为 1。</p>
     *
     * <p><b>顺带取我的提醒偏好</b>（{@code me} 那一行上的免打扰与两类提及开关）：
     * 会话列表要为群聊回显人数，同时前端在收到实时消息时要用同一份偏好决定是否出声。
     * 两者都挂在 {@code me} 上，一次 JOIN 即可，不额外查询；
     * 这也是「偏好搭成员关系行」这一存储取舍的直接收益（见 {@code V20} 口径）。</p>
     *
     * <p><b>不按 {@code group_type} 过滤：</b>群聊（2）与项目（1）都靠
     * {@code sys_group_member} 定义可见范围，会话发送侧也只校验成员资格。
     * 多一个类型条件会造成「同一条群聊消息，在项目里能发、在群里却选不到入口」的分裂。
     * CE 当前只有群聊一个创建入口，项目类型不会被建出来。</p>
     *
     * <p><b>只列生效群</b>（{@code status = 1}）：已解散的群不该再出现在会话目标选择器里；
     * 但既有的历史会话仍会出现在会话列表中（那里按消息聚合，不看群状态），
     * 否则「群解散 = 聊天记录凭空消失」，用户会当成数据丢失。</p>
     *
     * <p>按 {@code g.id} 倒序（雪花 ID 趋势递增）等价于「最近建的群在前」——
     * 与用户刚建完群就想在列表里看到它的直觉一致，且无需额外排序字段。</p>
     *
     * @param userId 查询者（取自登录态，不从入参取——否则可列出别人的群）
     * @return 我加入的生效群（含群名 / 群主 / 成员数）；没加入任何群时返回空列表
     */
    @Select("""
            select g.id                      as id,
                   g.name                    as name,
                   g.owner_user_id           as ownerUserId,
                   count(m.id)               as memberCount,
                   me.mute_status            as muteStatus,
                   me.notify_on_mention      as notifyOnMention,
                   me.notify_on_mention_all  as notifyOnMentionAll
            from sys_group g
                     join sys_group_member me
                          on me.group_id = g.id and me.user_id = #{userId} and me.deleted = 0
                     left join sys_group_member m
                               on m.group_id = g.id and m.deleted = 0
            where g.deleted = 0
              and g.status = 1
            group by g.id, g.name, g.owner_user_id,
                     me.mute_status, me.notify_on_mention, me.notify_on_mention_all
            order by g.id desc
            """)
    List<ChatGroupRow> selectMyGroups(@Param("userId") Long userId);
}
