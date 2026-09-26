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
package com.anttransfer.collaboration.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.anttransfer.collaboration.model.dto.ChatGroupCreateDTO;
import com.anttransfer.collaboration.model.entity.GroupMember;
import com.anttransfer.collaboration.model.entity.SysGroup;
import com.anttransfer.collaboration.model.vo.ChatGroupVO;
import com.anttransfer.collaboration.repository.ChatGroupRow;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.SysGroupMapper;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.UserLookupPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 建群单测。
 *
 * <p>这一层的断言重点不是「SQL 对不对」（那是集成测试的事），而是四件在建群语义上
 * 最容易出错、且出错后最难现场复盘的事：</p>
 * <ol>
 *   <li><b>群主一定在群里</b>——创建者由服务端自动入群为管理员，前端传什么都改变不了；</li>
 *   <li><b>成员集先去重再校验</b>——同一人重复勾选、把自己也勾上，都不该变成多行成员；</li>
 *   <li><b>校验失败时一行都不落库</b>——半个群（有群无成员）比建群失败更难排查，
 *       因为它「看起来成功了」，直到第一次发消息才炸；</li>
 *   <li><b>上限卡在建群而不是发送</b>——超限的群一旦建出来，故障会延后到发送时暴露。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class ChatGroupServiceTest {

    private static final Long CREATOR_ID = 900000000000000001L;
    private static final Long MEMBER_A = 900000000000000002L;
    private static final Long MEMBER_B = 900000000000000003L;
    private static final Long GROUP_ID = 900000000000000100L;

    @Mock
    private SysGroupMapper sysGroupMapper;
    @Mock
    private GroupMemberMapper groupMemberMapper;
    @Mock
    private UserLookupPort userLookupPort;

    private ChatGroupService service;

    @BeforeEach
    void setUp() {
        service = new ChatGroupService(sysGroupMapper, groupMemberMapper, userLookupPort);
        // 真实 MyBatis-Plus 会在 insert 后把雪花 ID 回填到实体上。mock 里必须手动补上，
        // 否则「建群后拿到 id 直接进会话」这条核心链路的断言会因 id 为 null 而失去意义。
        // lenient：校验失败的用例根本走不到 insert，严格模式会把这条打桩误报为无用打桩。
        lenient().when(sysGroupMapper.insert(any(SysGroup.class))).thenAnswer(invocation -> {
            invocation.getArgument(0, SysGroup.class).setId(GROUP_ID);
            return 1;
        });
    }

    @Test
    @DisplayName("建群：群主自动入群为管理员，受邀成员为普通成员，群名首尾空白被裁掉")
    void create_shouldPersistGroupWithOwnerAsAdmin() {
        when(userLookupPort.existsActiveUser(MEMBER_A)).thenReturn(true);
        when(userLookupPort.existsActiveUser(MEMBER_B)).thenReturn(true);

        ChatGroupVO group = service.create(CREATOR_ID, new ChatGroupCreateDTO("  产品讨论组  ", List.of(MEMBER_A, MEMBER_B)));

        assertThat(group.id()).isEqualTo(GROUP_ID);
        assertThat(group.name()).isEqualTo("产品讨论组");
        assertThat(group.ownerUserId()).isEqualTo(CREATOR_ID);
        assertThat(group.memberCount()).isEqualTo(3);

        ArgumentCaptor<SysGroup> savedGroup = ArgumentCaptor.forClass(SysGroup.class);
        verify(sysGroupMapper).insert(savedGroup.capture());
        assertThat(savedGroup.getValue().getName()).isEqualTo("产品讨论组");
        assertThat(savedGroup.getValue().getGroupType()).isEqualTo(SysGroup.TYPE_CHAT);
        assertThat(savedGroup.getValue().getOwnerUserId()).isEqualTo(CREATOR_ID);
        assertThat(savedGroup.getValue().getStatus()).isEqualTo(SysGroup.STATUS_ACTIVE);

        ArgumentCaptor<GroupMember> savedMembers = ArgumentCaptor.forClass(GroupMember.class);
        verify(groupMemberMapper, times(3)).insert(savedMembers.capture());
        List<GroupMember> members = savedMembers.getAllValues();
        // 群主必须落在第一行且是管理员：前端「我是群主」的判断与后续成员管理都依赖这一行
        assertThat(members.get(0).getUserId()).isEqualTo(CREATOR_ID);
        assertThat(members.get(0).getMemberRole()).isEqualTo(GroupMember.ROLE_ADMIN);
        assertThat(members).extracting(GroupMember::getUserId)
                .containsExactly(CREATOR_ID, MEMBER_A, MEMBER_B);
        assertThat(members).extracting(GroupMember::getMemberRole)
                .containsExactly(GroupMember.ROLE_ADMIN, GroupMember.ROLE_MEMBER, GroupMember.ROLE_MEMBER);
        assertThat(members).extracting(GroupMember::getGroupId).containsOnly(GROUP_ID);
        // 同一批入群共用同一时间戳，否则审计里会把「同时被拉进来的两人」显示成先后加入
        assertThat(members.stream().map(GroupMember::getJoinTime).distinct()).hasSize(1);
    }

    @Test
    @DisplayName("建群：受邀列表里的自己与重复项被剔除，不会变成多行成员")
    void create_shouldDeduplicateInviteesAndDropCreator() {
        when(userLookupPort.existsActiveUser(MEMBER_A)).thenReturn(true);

        // 模拟前端原样回传：把自己也勾上、同一个人出现两次、夹带一个空值
        ChatGroupVO group = service.create(CREATOR_ID,
                new ChatGroupCreateDTO("讨论组", Arrays.asList(CREATOR_ID, MEMBER_A, MEMBER_A, null)));

        assertThat(group.memberCount()).isEqualTo(2);
        ArgumentCaptor<GroupMember> savedMembers = ArgumentCaptor.forClass(GroupMember.class);
        verify(groupMemberMapper, times(2)).insert(savedMembers.capture());
        assertThat(savedMembers.getAllValues()).extracting(GroupMember::getUserId)
                .containsExactly(CREATOR_ID, MEMBER_A);
        // 去重后只剩一个受邀人，校验也只应发生一次（不是对原始列表逐个校验）
        verify(userLookupPort).existsActiveUser(MEMBER_A);
    }

    @Test
    @DisplayName("建群：只有自己一个人时拒绝，且不落任何一行")
    void create_shouldRejectWhenNoInviteeBesidesCreator() {
        assertThatThrownBy(() -> service.create(CREATOR_ID,
                new ChatGroupCreateDTO("讨论组", List.of(CREATOR_ID))))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_MEMBER_REQUIRED);

        verifyNoInteractions(sysGroupMapper, groupMemberMapper, userLookupPort);
    }

    @Test
    @DisplayName("建群：群名为空白时拒绝（否则前端会显示一个没有名字的群）")
    void create_shouldRejectBlankName() {
        assertThatThrownBy(() -> service.create(CREATOR_ID,
                new ChatGroupCreateDTO("   ", List.of(MEMBER_A))))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PARAM_MISSING);

        verifyNoInteractions(sysGroupMapper, groupMemberMapper, userLookupPort);
    }

    @Test
    @DisplayName("建群：受邀成员不可用时整体拒绝，不留「半个群」")
    void create_shouldRejectUnavailableInvitee() {
        when(userLookupPort.existsActiveUser(MEMBER_A)).thenReturn(false);

        assertThatThrownBy(() -> service.create(CREATOR_ID,
                new ChatGroupCreateDTO("讨论组", List.of(MEMBER_A))))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_MEMBER_INVALID);

        // 关键：群行也不能落库。先落群再校验成员会留下一个「没有成员的群」，
        // 它的会话连群主自己都发不进去（1012），比建群失败更难排查
        verify(sysGroupMapper, never()).insert(any(SysGroup.class));
        verify(groupMemberMapper, never()).insert(any(GroupMember.class));
    }

    @Test
    @DisplayName("建群：受邀人数 + 群主超出上限时拒绝（上限是群总人数，不是受邀人数）")
    void create_shouldRejectWhenMembersExceedLimit() {
        List<Long> invitees = new ArrayList<>();
        for (int i = 0; i < SysGroup.MAX_MEMBERS; i++) {
            invitees.add(MEMBER_A + i);
        }

        assertThatThrownBy(() -> service.create(CREATOR_ID,
                new ChatGroupCreateDTO("讨论组", invitees)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_MEMBER_LIMIT);

        verifyNoInteractions(sysGroupMapper, groupMemberMapper, userLookupPort);
    }

    @Test
    @DisplayName("建群：恰好占满上限（群主 + 上限减一）是允许的")
    void create_shouldAllowExactlyAtLimit() {
        List<Long> invitees = new ArrayList<>();
        for (int i = 0; i < SysGroup.MAX_MEMBERS - 1; i++) {
            invitees.add(MEMBER_A + i);
        }
        when(userLookupPort.existsActiveUser(any())).thenReturn(true);

        ChatGroupVO group = service.create(CREATOR_ID, new ChatGroupCreateDTO("大群", invitees));

        assertThat(group.memberCount()).isEqualTo(SysGroup.MAX_MEMBERS);
        verify(groupMemberMapper, times(SysGroup.MAX_MEMBERS)).insert(any(GroupMember.class));
    }

    @Test
    @DisplayName("我加入的群：投影转视图，成员数为空时回落 0 而不是 null")
    void listMine_shouldMapRowsToViews() {
        ChatGroupRow withCount = new ChatGroupRow();
        withCount.setId(GROUP_ID);
        withCount.setName("产品讨论组");
        withCount.setOwnerUserId(CREATOR_ID);
        withCount.setMemberCount(3L);
        // count() 恒返回数字，但投影字段是包装类型；留一条空值路径防止 NPE 以 500 的形式外泄
        ChatGroupRow withoutCount = new ChatGroupRow();
        withoutCount.setId(GROUP_ID + 1);
        withoutCount.setName("空群");
        when(sysGroupMapper.selectMyGroups(CREATOR_ID)).thenReturn(List.of(withCount, withoutCount));

        List<ChatGroupVO> groups = service.listMine(CREATOR_ID);

        assertThat(groups).hasSize(2);
        assertThat(groups.get(0).id()).isEqualTo(GROUP_ID);
        assertThat(groups.get(0).name()).isEqualTo("产品讨论组");
        assertThat(groups.get(0).ownerUserId()).isEqualTo(CREATOR_ID);
        assertThat(groups.get(0).memberCount()).isEqualTo(3);
        assertThat(groups.get(1).memberCount()).isZero();
    }
}
