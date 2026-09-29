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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.anttransfer.collaboration.model.dto.ChatGroupNotifyPreferenceDTO;
import com.anttransfer.collaboration.model.entity.GroupMember;
import com.anttransfer.collaboration.model.entity.SysGroup;
import com.anttransfer.collaboration.model.vo.ChatGroupDetailVO;
import com.anttransfer.collaboration.model.vo.ChatGroupNotifyPreferenceVO;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.SysGroupMapper;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.UserLookupPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 群聊「我的消息提醒偏好」单测（免打扰 + {@code @我} + {@code @所有人}）。
 *
 * <p>断言重点不在 SQL，而在四件最容易出错、错了又最难现场复盘的事：</p>
 * <ol>
 *   <li><b>归一化不吐 {@code null}</b>——存量成员行可能三个列都是 {@code null}，
 *       对外契约必须恒为 {@code 0/1}，否则前端要为每个开关各写一次判空，
 *       而漏判的后果是「开关显示为关、实际按开启提醒」这种静默错位；</li>
 *   <li><b>三档整体覆盖写入</b>——写得少一档就会把用户没碰过的那个开关静默重置；</li>
 *   <li><b>归属由 WHERE 兜底</b>——受影响行数为 0 必须转 1012，
 *       不能因为「查过一次成员」就假定写一定成功（并发退群的窗口）；</li>
 *   <li><b>已解散群按不存在处理</b>（1037），且不碰成员表。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class ChatGroupNotifyPreferenceTest {

    private static final Long OWNER = 900000000000000001L;
    private static final Long MEMBER = 900000000000000003L;
    private static final Long OUTSIDER = 900000000000000004L;
    private static final Long GROUP_ID = 900000000000000100L;

    private static final LocalDateTime JOIN_TIME = LocalDateTime.of(2026, 9, 30, 10, 0);

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
    @DisplayName("读取：存量成员行三个列均为 null 时，回落「免打扰关 + 两类提及提醒开」")
    void notifyPreference_shouldFallBackToDefaultsWhenColumnsNull() {
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, MEMBER)).thenReturn(member(MEMBER, GroupMember.ROLE_MEMBER));

        ChatGroupNotifyPreferenceVO preference = service.notifyPreference(MEMBER, GROUP_ID);

        assertThat(preference.muteStatus()).isEqualTo(GroupMember.MUTE_OFF);
        assertThat(preference.notifyOnMention()).isEqualTo(GroupMember.NOTIFY_ON);
        assertThat(preference.notifyOnMentionAll()).isEqualTo(GroupMember.NOTIFY_ON);
    }

    @Test
    @DisplayName("读取：按成员行上的三列原样投影（免打扰开、@我关、@所有人开）")
    void notifyPreference_shouldReflectStoredFlags() {
        GroupMember row = member(MEMBER, GroupMember.ROLE_MEMBER);
        row.setMuteStatus(GroupMember.MUTE_ON);
        row.setNotifyOnMention(GroupMember.NOTIFY_OFF);
        row.setNotifyOnMentionAll(GroupMember.NOTIFY_ON);
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, MEMBER)).thenReturn(row);

        ChatGroupNotifyPreferenceVO preference = service.notifyPreference(MEMBER, GROUP_ID);

        assertThat(preference.muteStatus()).isEqualTo(GroupMember.MUTE_ON);
        assertThat(preference.notifyOnMention()).isEqualTo(GroupMember.NOTIFY_OFF);
        assertThat(preference.notifyOnMentionAll()).isEqualTo(GroupMember.NOTIFY_ON);
    }

    @Test
    @DisplayName("读取：非成员 1012——偏好是成员关系的私有属性，不存在「读他人设置」的入参面")
    void notifyPreference_shouldRejectNonMember() {
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, OUTSIDER)).thenReturn(null);

        assertThatThrownBy(() -> service.notifyPreference(OUTSIDER, GROUP_ID))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_NOT_GROUP_MEMBER);
    }

    @Test
    @DisplayName("写入：三个开关整体覆盖落库，并原样回显本次提交的完整状态")
    void updateNotifyPreference_shouldPersistWholeState() {
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.updateNotifyPreference(GROUP_ID, MEMBER, 1, 0, 1, MEMBER)).thenReturn(1);

        ChatGroupNotifyPreferenceVO preference = service.updateNotifyPreference(MEMBER, GROUP_ID,
                new ChatGroupNotifyPreferenceDTO(true, false, true));

        // 覆盖式：三列必须一次写全。少写一列 = 静默重置用户没碰过的开关
        verify(groupMemberMapper).updateNotifyPreference(GROUP_ID, MEMBER, 1, 0, 1, MEMBER);
        assertThat(preference.muteStatus()).isEqualTo(GroupMember.MUTE_ON);
        assertThat(preference.notifyOnMention()).isEqualTo(GroupMember.NOTIFY_OFF);
        assertThat(preference.notifyOnMentionAll()).isEqualTo(GroupMember.NOTIFY_ON);
    }

    @Test
    @DisplayName("写入：受影响行数为 0（非成员 / 已退群）转 1012，不假装成功")
    void updateNotifyPreference_shouldRejectWhenNoRowAffected() {
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.updateNotifyPreference(
                eq(GROUP_ID), eq(OUTSIDER), anyInt(), anyInt(), anyInt(), eq(OUTSIDER))).thenReturn(0);

        assertThatThrownBy(() -> service.updateNotifyPreference(OUTSIDER, GROUP_ID,
                new ChatGroupNotifyPreferenceDTO(true, true, true)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_NOT_GROUP_MEMBER);
    }

    @Test
    @DisplayName("写入：已解散群按不存在处理（1037），且不碰成员表——否则解散后仍能改偏好")
    void updateNotifyPreference_shouldTreatDissolvedGroupAsMissing() {
        SysGroup dissolved = activeGroup();
        dissolved.setStatus(SysGroup.STATUS_DISABLED);
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(dissolved);

        assertThatThrownBy(() -> service.updateNotifyPreference(MEMBER, GROUP_ID,
                new ChatGroupNotifyPreferenceDTO(true, true, true)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_GROUP_NOT_FOUND);

        verify(groupMemberMapper, never()).updateNotifyPreference(
                any(), any(), anyInt(), anyInt(), anyInt(), any());
    }

    @Test
    @DisplayName("群详情：带上我的提醒偏好，且 canMentionAll 只对群主为真")
    void detail_shouldExposeMyPreferenceAndOwnerOnlyMentionAll() {
        GroupMember ownerRow = member(OWNER, GroupMember.ROLE_ADMIN);
        ownerRow.setMuteStatus(GroupMember.MUTE_ON);
        ownerRow.setNotifyOnMention(GroupMember.NOTIFY_OFF);
        ownerRow.setNotifyOnMentionAll(GroupMember.NOTIFY_ON);
        GroupMember memberRow = member(MEMBER, GroupMember.ROLE_MEMBER);
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(activeGroup());
        when(groupMemberMapper.selectMember(GROUP_ID, OWNER)).thenReturn(ownerRow);
        when(groupMemberMapper.selectMember(GROUP_ID, MEMBER)).thenReturn(memberRow);
        when(groupMemberMapper.selectMembers(GROUP_ID)).thenReturn(List.of(ownerRow, memberRow));

        ChatGroupDetailVO asOwner = service.detail(OWNER, GROUP_ID);
        ChatGroupDetailVO asMember = service.detail(MEMBER, GROUP_ID);

        // 群主视角：面板直接绑定这份偏好，无需再单独请求
        assertThat(asOwner.ability().canMentionAll()).isTrue();
        assertThat(asOwner.notifyPreference().muteStatus()).isEqualTo(GroupMember.MUTE_ON);
        assertThat(asOwner.notifyPreference().notifyOnMention()).isEqualTo(GroupMember.NOTIFY_OFF);
        assertThat(asOwner.notifyPreference().notifyOnMentionAll()).isEqualTo(GroupMember.NOTIFY_ON);
        // 普通成员：@所有人 是「面向全群的打扰权」，CE 只认群主一档
        assertThat(asMember.ability().canMentionAll()).isFalse();
        // 每个人看到的是自己的偏好：成员行三列为 null → 归一为默认值
        assertThat(asMember.notifyPreference().muteStatus()).isEqualTo(GroupMember.MUTE_OFF);
        assertThat(asMember.notifyPreference().notifyOnMention()).isEqualTo(GroupMember.NOTIFY_ON);
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

    private static GroupMember member(Long userId, int role) {
        GroupMember row = new GroupMember();
        row.setId(userId);
        row.setGroupId(GROUP_ID);
        row.setUserId(userId);
        row.setMemberRole(role);
        row.setJoinTime(JOIN_TIME);
        return row;
    }
}
