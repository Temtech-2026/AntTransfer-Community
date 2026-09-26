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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.anttransfer.collaboration.model.dto.ChatGroupMemberAddDTO;
import com.anttransfer.collaboration.model.dto.ChatGroupUpdateDTO;
import com.anttransfer.collaboration.model.entity.GroupMember;
import com.anttransfer.collaboration.model.entity.SysGroup;
import com.anttransfer.collaboration.model.vo.ChatGroupDetailVO;
import com.anttransfer.collaboration.model.vo.ChatGroupMemberVO;
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
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 群组管理单测（详情 / 改群名 / 邀请 / 移除 / 退群 / 解散）。
 *
 * <p>断言重点不在 SQL，而在几个最容易写错、错了又最难复盘的不变式：</p>
 * <ol>
 *   <li><b>两条授权线各管一段</b>：群内身份不足是 1038（管理动作）/ 1041（仅群主），
 *       与权限点的 1003 分开；拒绝时一个字都不写库；</li>
 *   <li><b>已解散群按「不存在」处理</b>（1037），否则解散后仍能被改名 / 邀请；</li>
 *   <li><b>移除后重邀走复活</b>：唯一键 {@code uk_group_user} 不含 {@code deleted}，
 *       直接 insert 必撞唯一键；只逻辑删除不复活则表现为「邀请成功却发不出消息」；</li>
 *   <li><b>邀请幂等</b>：全员已在群时不产生任何写库动作，也不报「重复邀请」；</li>
 *   <li><b>上限按「现有 + 新增」判</b>，而不是只判入参规模；</li>
 *   <li><b>解散先清成员、再停群行</b>：反过来的中间态能让并发消息写进已解散的群。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class ChatGroupManageServiceTest {

    private static final Long OWNER = 900000000000000001L;
    private static final Long MEMBER = 900000000000000003L;
    private static final Long OUTSIDER = 900000000000000004L;
    private static final Long GROUP_ID = 900000000000000100L;

    private static final LocalDateTime JOIN_TIME = LocalDateTime.of(2026, 9, 26, 10, 0);

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
    }

    @Test
    @DisplayName("群详情：群主能力全开且不可退群，普通成员不可管理但可退群")
    void detail_shouldExposeAbilityByGroupRole() {
        GroupMember ownerRow = member(OWNER, GroupMember.ROLE_ADMIN);
        GroupMember memberRow = member(MEMBER, GroupMember.ROLE_MEMBER);
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, OWNER)).thenReturn(ownerRow);
        when(groupMemberMapper.selectMember(GROUP_ID, MEMBER)).thenReturn(memberRow);
        stubMembers(ownerRow, memberRow);

        ChatGroupDetailVO asOwner = service.detail(OWNER, GROUP_ID);

        assertThat(asOwner.id()).isEqualTo(GROUP_ID);
        assertThat(asOwner.name()).isEqualTo("产品讨论组");
        assertThat(asOwner.ownerUserId()).isEqualTo(OWNER);
        assertThat(asOwner.memberCount()).isEqualTo(2);
        assertThat(asOwner.memberLimit()).isEqualTo(SysGroup.MAX_MEMBERS);
        assertThat(asOwner.ability().canRename()).isTrue();
        assertThat(asOwner.ability().canInvite()).isTrue();
        assertThat(asOwner.ability().canRemoveMember()).isTrue();
        assertThat(asOwner.ability().canDissolve()).isTrue();
        // 群主退群会造出无主群，服务端直接不给这条路（前端据此隐藏按钮）
        assertThat(asOwner.ability().canQuit()).isFalse();
        // 群主标记来自 sys_group.owner_user_id，只有第一行被打标
        assertThat(asOwner.members()).extracting(ChatGroupMemberVO::userId)
                .containsExactly(OWNER, MEMBER);
        assertThat(asOwner.members()).extracting(ChatGroupMemberVO::owner)
                .containsExactly(true, false);

        ChatGroupDetailVO asMember = service.detail(MEMBER, GROUP_ID);

        assertThat(asMember.ability().canRename()).isFalse();
        assertThat(asMember.ability().canInvite()).isFalse();
        assertThat(asMember.ability().canRemoveMember()).isFalse();
        assertThat(asMember.ability().canDissolve()).isFalse();
        assertThat(asMember.ability().canQuit()).isTrue();
    }

    @Test
    @DisplayName("群详情：非成员被 1012 拒绝，且看不到成员名单")
    void detail_shouldRejectNonMember() {
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, OUTSIDER)).thenReturn(null);

        assertThatThrownBy(() -> service.detail(OUTSIDER, GROUP_ID))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_NOT_GROUP_MEMBER);

        verify(groupMemberMapper, never()).selectMembers(any());
    }

    @Test
    @DisplayName("群已解散（status=0）时按「不存在」处理，返回 1037 且不碰成员表")
    void detail_shouldTreatDissolvedGroupAsMissing() {
        SysGroup dissolved = activeGroup();
        dissolved.setStatus(SysGroup.STATUS_DISABLED);
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(dissolved);

        assertThatThrownBy(() -> service.detail(OWNER, GROUP_ID))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_NOT_FOUND);

        verifyNoInteractions(groupMemberMapper);
    }

    @Test
    @DisplayName("改群名：群主改名成功，返回体已是新名（前端无需再发一次 GET）")
    void rename_shouldUpdateNameForOwner() {
        GroupMember ownerRow = member(OWNER, GroupMember.ROLE_ADMIN);
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, OWNER)).thenReturn(ownerRow);
        stubMembers(ownerRow);

        ChatGroupDetailVO detail = service.rename(OWNER, GROUP_ID,
                new ChatGroupUpdateDTO("  新名字  "));

        ArgumentCaptor<SysGroup> patch = ArgumentCaptor.forClass(SysGroup.class);
        verify(sysGroupMapper).updateById(patch.capture());
        assertThat(patch.getValue().getId()).isEqualTo(GROUP_ID);
        // 落库的必须是裁切后的值（首尾空白在前端表现为「名字莫名多空格」）
        assertThat(patch.getValue().getName()).isEqualTo("新名字");
        assertThat(detail.name()).isEqualTo("新名字");
    }

    @Test
    @DisplayName("改群名：普通成员 1038、非成员 1012，两种都一个字不写库")
    void rename_shouldRejectInsufficientIdentity() {
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, MEMBER))
                .thenReturn(member(MEMBER, GroupMember.ROLE_MEMBER));
        when(groupMemberMapper.selectMember(GROUP_ID, OUTSIDER)).thenReturn(null);

        assertThatThrownBy(() -> service.rename(MEMBER, GROUP_ID, new ChatGroupUpdateDTO("新名字")))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_ADMIN_REQUIRED);

        // 身份判定的顺序是先「是不是成员」再「是不是管理者」：非成员不该拿到角色维度的提示
        assertThatThrownBy(() -> service.rename(OUTSIDER, GROUP_ID,
                new ChatGroupUpdateDTO("新名字")))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_NOT_GROUP_MEMBER);

        verify(sysGroupMapper, never()).updateById(any(SysGroup.class));
    }

    @Test
    @DisplayName("邀请成员：曾被移除的走复活、从未入群的走新增")
    void invite_shouldRestoreRemovedMemberAndInsertNewOne() {
        GroupMember ownerRow = member(OWNER, GroupMember.ROLE_ADMIN);
        GroupMember removedRow = member(MEMBER, GroupMember.ROLE_MEMBER);
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, OWNER)).thenReturn(ownerRow);
        stubMembers(ownerRow);
        when(userLookupPort.existsActiveUser(MEMBER)).thenReturn(true);
        when(userLookupPort.existsActiveUser(OUTSIDER)).thenReturn(true);
        // MEMBER 曾被移除：旧行还在（deleted=1，唯一键仍占位），只能复活
        when(groupMemberMapper.selectMemberIncludingDeleted(GROUP_ID, MEMBER)).thenReturn(removedRow);
        when(groupMemberMapper.selectMemberIncludingDeleted(GROUP_ID, OUTSIDER)).thenReturn(null);

        service.invite(OWNER, GROUP_ID, new ChatGroupMemberAddDTO(List.of(MEMBER, OUTSIDER)));

        verify(groupMemberMapper).markRestored(eq(MEMBER), eq(GroupMember.ROLE_MEMBER),
                any(LocalDateTime.class), eq(OWNER));
        // 复活路径下不得再插一行：那会直接撞 uk_group_user
        ArgumentCaptor<GroupMember> inserted = ArgumentCaptor.forClass(GroupMember.class);
        verify(groupMemberMapper).insert(inserted.capture());
        assertThat(inserted.getValue().getUserId()).isEqualTo(OUTSIDER);
        assertThat(inserted.getValue().getGroupId()).isEqualTo(GROUP_ID);
        assertThat(inserted.getValue().getMemberRole()).isEqualTo(GroupMember.ROLE_MEMBER);
        assertThat(inserted.getValue().getJoinTime()).isNotNull();
    }

    @Test
    @DisplayName("邀请成员：全员已在群时幂等返回，不写库也不报「重复邀请」")
    void invite_shouldBeIdempotentWhenEveryoneAlreadyInGroup() {
        GroupMember ownerRow = member(OWNER, GroupMember.ROLE_ADMIN);
        GroupMember memberRow = member(MEMBER, GroupMember.ROLE_MEMBER);
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, OWNER)).thenReturn(ownerRow);
        stubMembers(ownerRow, memberRow);

        service.invite(OWNER, GROUP_ID, new ChatGroupMemberAddDTO(List.of(MEMBER)));

        verify(groupMemberMapper, never()).insert(any(GroupMember.class));
        verify(groupMemberMapper, never()).markRestored(any(), anyInt(), any(), any());
        // 已全员在群，连账号可用性都不必再查（省掉 N 次用户反查）
        verify(userLookupPort, never()).existsActiveUser(any());
    }

    @Test
    @DisplayName("邀请成员：按「现有 + 新增」判上限，超限整体拒绝")
    void invite_shouldRejectWhenExceedingLimit() {
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, OWNER))
                .thenReturn(member(OWNER, GroupMember.ROLE_ADMIN));
        stubMembers(member(OWNER, GroupMember.ROLE_ADMIN));

        // 现有 1 人 + 上限 500 人 = 501：只判入参规模会放过这一批
        List<Long> invitees = new ArrayList<>();
        for (int i = 0; i < SysGroup.MAX_MEMBERS; i++) {
            invitees.add(MEMBER + i);
        }

        assertThatThrownBy(() -> service.invite(OWNER, GROUP_ID,
                new ChatGroupMemberAddDTO(invitees)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_MEMBER_LIMIT);

        verify(groupMemberMapper, never()).insert(any(GroupMember.class));
        verify(userLookupPort, never()).existsActiveUser(any());
    }

    @Test
    @DisplayName("邀请成员：普通成员 1038（邀请是管理动作，不是人人可拉人）")
    void invite_shouldRejectPlainMember() {
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, MEMBER))
                .thenReturn(member(MEMBER, GroupMember.ROLE_MEMBER));

        assertThatThrownBy(() -> service.invite(MEMBER, GROUP_ID,
                new ChatGroupMemberAddDTO(List.of(OUTSIDER))))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_ADMIN_REQUIRED);

        verify(groupMemberMapper, never()).insert(any(GroupMember.class));
    }

    @Test
    @DisplayName("移除成员：群主移除普通成员成功，只停用成员行、不动历史消息")
    void removeMember_shouldSucceedForOwner() {
        GroupMember ownerRow = member(OWNER, GroupMember.ROLE_ADMIN);
        GroupMember targetRow = member(MEMBER, GroupMember.ROLE_MEMBER);
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, OWNER)).thenReturn(ownerRow);
        when(groupMemberMapper.selectMember(GROUP_ID, MEMBER)).thenReturn(targetRow);
        stubMembers(ownerRow, targetRow);

        service.removeMember(OWNER, GROUP_ID, MEMBER);

        verify(groupMemberMapper).markDeleted(MEMBER, OWNER);
    }

    @Test
    @DisplayName("移除成员：管理员也不行（1041），目标不在群 1040，群主不可被移除 1039")
    void removeMember_shouldRejectIllegalTargets() {
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        // 群里有一位管理员（member_role=2），但移除是「仅群主」的动作
        when(groupMemberMapper.selectMember(GROUP_ID, MEMBER))
                .thenReturn(member(MEMBER, GroupMember.ROLE_ADMIN));
        when(groupMemberMapper.selectMember(GROUP_ID, OWNER))
                .thenReturn(member(OWNER, GroupMember.ROLE_ADMIN));

        assertThatThrownBy(() -> service.removeMember(MEMBER, GROUP_ID, OUTSIDER))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_OWNER_REQUIRED);

        // 群主移除一个不在群里的人：目标维度的 1040，与「我不是成员」的 1012 方向相反
        when(groupMemberMapper.selectMember(GROUP_ID, OUTSIDER)).thenReturn(null);
        assertThatThrownBy(() -> service.removeMember(OWNER, GROUP_ID, OUTSIDER))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_MEMBER_NOT_FOUND);

        // 群主「移除自己」等价于群主退群：那条路会造出没有所有者的群
        assertThatThrownBy(() -> service.removeMember(OWNER, GROUP_ID, OWNER))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_OWNER_CANNOT_QUIT);

        verify(groupMemberMapper, never()).markDeleted(any(), any());
    }

    @Test
    @DisplayName("退出群聊：普通成员成功；群主 1039（须先解散）")
    void quit_shouldSucceedForMemberAndRejectOwner() {
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, MEMBER))
                .thenReturn(member(MEMBER, GroupMember.ROLE_MEMBER));
        when(groupMemberMapper.selectMember(GROUP_ID, OWNER))
                .thenReturn(member(OWNER, GroupMember.ROLE_ADMIN));

        service.quit(MEMBER, GROUP_ID);
        verify(groupMemberMapper).markDeleted(MEMBER, MEMBER);

        assertThatThrownBy(() -> service.quit(OWNER, GROUP_ID))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_OWNER_CANNOT_QUIT);

        // 群主那一行绝不能被动过：verify(exactly once) 由上面的 markDeleted 保证
        verify(groupMemberMapper, never()).markDeleted(eq(OWNER), any());
    }

    @Test
    @DisplayName("解散群聊：群主成功（先清全员再停群行）；非群主 1041 且不动任何数据")
    void dissolve_shouldClearMembersBeforeDisablingGroup() {
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, OWNER))
                .thenReturn(member(OWNER, GroupMember.ROLE_ADMIN));
        when(groupMemberMapper.selectMember(GROUP_ID, MEMBER))
                .thenReturn(member(MEMBER, GroupMember.ROLE_MEMBER));

        assertThatThrownBy(() -> service.dissolve(MEMBER, GROUP_ID))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_OWNER_REQUIRED);
        verify(groupMemberMapper, never()).markAllDeleted(any(), any());
        verify(sysGroupMapper, never()).updateById(any(SysGroup.class));

        service.dissolve(OWNER, GROUP_ID);

        // 顺序断言：先清成员（否则中间态「群已停用、成员仍在」会被并发发送利用），
        // 再停群行；两者必须在同一事务里
        InOrder ordered = inOrder(groupMemberMapper, sysGroupMapper);
        ordered.verify(groupMemberMapper).markAllDeleted(GROUP_ID, OWNER);

        ArgumentCaptor<SysGroup> patch = ArgumentCaptor.forClass(SysGroup.class);
        ordered.verify(sysGroupMapper).updateById(patch.capture());
        assertThat(patch.getValue().getStatus()).isEqualTo(SysGroup.STATUS_DISABLED);
        assertThat(patch.getValue().getId()).isEqualTo(GROUP_ID);
    }

    /* ------------------------------------------------------------------ 测试夹具 */

    private static SysGroup activeGroup() {
        SysGroup group = new SysGroup();
        group.setId(GROUP_ID);
        group.setName("产品讨论组");
        group.setGroupType(SysGroup.TYPE_CHAT);
        group.setOwnerUserId(OWNER);
        group.setStatus(SysGroup.STATUS_ACTIVE);
        return group;
    }

    /** 造一行成员；行 id 直接用 userId，便于对移除 / 复活的目标行做断言。 */
    private static GroupMember member(Long userId, int role) {
        GroupMember row = new GroupMember();
        row.setId(userId);
        row.setGroupId(GROUP_ID);
        row.setUserId(userId);
        row.setMemberRole(role);
        row.setJoinTime(JOIN_TIME);
        return row;
    }

    /** 打桩「详情组装」所需的成员名单；展示名反查留空（Mockito 对 Map 返回空集合）。 */
    private void stubMembers(GroupMember... rows) {
        when(groupMemberMapper.selectMembers(GROUP_ID)).thenReturn(List.of(rows));
    }
}
