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

import java.util.List;

/**
 * 群组成员数据访问（{@code sys_group_member}，V4 迁入）。
 *
 * <p>IM 域只用到「是否成员」与「成员都有谁」两个读操作——群成员资格的<b>写</b>属协作空间域
 * （邀请 / 移除成员），不在本类展开。</p>
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
}
