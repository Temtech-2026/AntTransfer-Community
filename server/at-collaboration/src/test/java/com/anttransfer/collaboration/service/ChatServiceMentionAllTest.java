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
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.anttransfer.collaboration.config.NotifyProperties;
import com.anttransfer.collaboration.model.dto.ChatSendDTO;
import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.anttransfer.collaboration.model.entity.SysGroup;
import com.anttransfer.collaboration.repository.ChatPeerAliasMapper;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.repository.SysGroupMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsPresenceService;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.notify.ChatScope;
import com.anttransfer.common.notify.MessageType;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.UserLookupPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * {@code @所有人} 与「提及档位」落库口径的单测（{@code ChatService#send}）。
 *
 * <p>钉住四件事——每一件错了都只在真机上表现为「有人没收到提醒」或「不该响的时候响了」，
 * 事后从库里看却是自洽的：</p>
 * <ol>
 *   <li><b>资格</b>：只有群主能 {@code @所有人}，其余身份 1042 且<b>一行都不落库</b>。
 *       静默降级比直接失败更糟——普通成员会看到消息照常发出，默认「全群都被提醒到了」；</li>
 *   <li><b>档位</b>：{@code @所有人} 记 2、逐人点名记 1、其余 0，且 {@code mentioned}
 *       恒等于「档位 &gt; 0」——两者一旦各算各的，按 {@code mentioned} 建的提及未读计数
 *       就会与气泡高亮对不上；</li>
 *   <li><b>自己那一行恒为 0</b>：否则群主每发一条 {@code @所有人}，
 *       自己的会话列表就多一个「有人 @ 我」的假角标；</li>
 *   <li><b>单聊忽略本字段</b>：不报错、不查群表——单聊的对方本就是唯一读者，
 *       为一个没有语义的字段让消息发失败是纯粹的契约洁癖伤人。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class ChatServiceMentionAllTest {

    private static final long SENDER_ID = 2101964960292135001L;
    private static final long MEMBER_A_ID = 2101964960292135002L;
    private static final long MEMBER_B_ID = 2101964960292135003L;
    private static final long GROUP_ID = 2101964960292135004L;

    private static final String CLIENT_MSG_ID = "c-mention-1";
    private static final String CONTENT = "明天九点开会";

    @Mock
    private NotifyMessageMapper notifyMessageMapper;
    @Mock
    private GroupMemberMapper groupMemberMapper;
    @Mock
    private SysGroupMapper sysGroupMapper;
    @Mock
    private ChatPeerAliasMapper chatPeerAliasMapper;
    @Mock
    private UserLookupPort userLookupPort;
    @Mock
    private WsBroadcaster wsBroadcaster;
    @Mock
    private WsPresenceService wsPresenceService;
    @Mock
    private AfterCommitExecutor afterCommitExecutor;
    @Mock
    private NotifyProperties properties;
    @Mock
    private NotifyMessageService notifyMessageService;

    private ChatService service;

    @BeforeEach
    void setUp() {
        service = new ChatService(notifyMessageMapper, groupMemberMapper, sysGroupMapper,
                chatPeerAliasMapper, userLookupPort,
                wsBroadcaster, wsPresenceService, afterCommitExecutor, properties, notifyMessageService);
        // 正文长度上限来自配置：mock 下默认 0，不打桩则「任何消息都超长」，失焦到无关校验上
        when(properties.getContentMaxLength()).thenReturn(1000);
    }

    @Test
    @DisplayName("群主 @所有人：其余成员那一行档位为 2，发送人自己仍为 0（不给发送人造假角标）")
    void send_mentionAllByOwner_shouldMarkOtherRecipientsWithTypeAll() {
        stubGroupMembership(GROUP_ID, SENDER_ID, List.of(SENDER_ID, MEMBER_A_ID, MEMBER_B_ID));
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(groupOwnedBy(SENDER_ID));

        service.send(SENDER_ID, groupSend(true, null));

        Map<Long, NotifyMessage> rows = captureRows();
        assertThat(rows).containsOnlyKeys(SENDER_ID, MEMBER_A_ID, MEMBER_B_ID);
        assertThat(rows.get(MEMBER_A_ID).mentionTypeOrDefault()).isEqualTo(NotifyMessage.MENTION_TYPE_ALL);
        assertThat(rows.get(MEMBER_B_ID).mentionTypeOrDefault()).isEqualTo(NotifyMessage.MENTION_TYPE_ALL);
        // 布尔是档位的投影：两条必须同源，否则提及未读计数与气泡高亮会对不上
        assertThat(rows.get(MEMBER_A_ID).isRecipientMentioned()).isTrue();
        assertThat(rows.get(MEMBER_B_ID).isRecipientMentioned()).isTrue();
        // 发送人不是自己的读者：@所有人 也必须把他排除，否则他自己的会话列表立刻出现假角标
        assertThat(rows.get(SENDER_ID).mentionTypeOrDefault()).isEqualTo(NotifyMessage.MENTION_TYPE_NONE);
        assertThat(rows.get(SENDER_ID).isRecipientMentioned()).isFalse();
    }

    @Test
    @DisplayName("非群主 @所有人：1042（403）且一行都不落库——静默降级比明确失败更糟")
    void send_mentionAllByNonOwner_shouldBeRejectedWithoutPersisting() {
        stubGroupMembership(GROUP_ID, SENDER_ID, List.of(SENDER_ID, MEMBER_A_ID));
        // 群主是别人：@所有人 是面向全群的打扰权，CE 只认群主一档
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(groupOwnedBy(MEMBER_A_ID));

        assertThatThrownBy(() -> service.send(SENDER_ID, groupSend(true, null)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_MENTION_ALL_OWNER_REQUIRED);

        verify(notifyMessageMapper, never()).insert(any(NotifyMessage.class));
    }

    @Test
    @DisplayName("@所有人 与逐人点名叠加：以范围更大的档位 2 为准（否则关掉「@我」提醒的成员会漏提醒）")
    void send_mentionAllWithPerUserMention_shouldPreferTypeAll() {
        stubGroupMembership(GROUP_ID, SENDER_ID, List.of(SENDER_ID, MEMBER_A_ID, MEMBER_B_ID));
        when(sysGroupMapper.selectById(GROUP_ID)).thenReturn(groupOwnedBy(SENDER_ID));

        service.send(SENDER_ID, groupSend(true, List.of(MEMBER_B_ID)));

        Map<Long, NotifyMessage> rows = captureRows();
        assertThat(rows.get(MEMBER_A_ID).mentionTypeOrDefault()).isEqualTo(NotifyMessage.MENTION_TYPE_ALL);
        assertThat(rows.get(MEMBER_B_ID).mentionTypeOrDefault()).isEqualTo(NotifyMessage.MENTION_TYPE_ALL);
    }

    @Test
    @DisplayName("单聊带 mentionAll：静默忽略、不查群表、不报错——复用同一套 UI 状态的客户端不该发不出消息")
    void send_mentionAllInPrivateChat_shouldBeIgnored() {
        when(userLookupPort.existsActiveUser(MEMBER_A_ID)).thenReturn(true);

        service.send(SENDER_ID, new ChatSendDTO(ChatScope.PRIVATE, MEMBER_A_ID, MessageType.CHAT_TEXT,
                CONTENT, CLIENT_MSG_ID, null, null, true));

        Map<Long, NotifyMessage> rows = captureRows();
        assertThat(rows).containsOnlyKeys(SENDER_ID, MEMBER_A_ID);
        assertThat(rows.get(MEMBER_A_ID).mentionTypeOrDefault()).isEqualTo(NotifyMessage.MENTION_TYPE_NONE);
        // 单聊没有「群主」这一概念：不应为了一个无意义的字段去读群表
        verify(sysGroupMapper, never()).selectById(any());
    }

    @Test
    @DisplayName("回归：只逐人点名时档位为 1，未被点名者为 0，且不查群表（mentionAll 缺省不等于 false）")
    void send_perUserMention_shouldMarkTypeOneAndSkipGroupLookup() {
        stubGroupMembership(GROUP_ID, SENDER_ID, List.of(SENDER_ID, MEMBER_A_ID, MEMBER_B_ID));

        service.send(SENDER_ID, groupSend(null, List.of(MEMBER_A_ID)));

        Map<Long, NotifyMessage> rows = captureRows();
        assertThat(rows.get(MEMBER_A_ID).mentionTypeOrDefault()).isEqualTo(NotifyMessage.MENTION_TYPE_ME);
        assertThat(rows.get(MEMBER_A_ID).isRecipientMentioned()).isTrue();
        assertThat(rows.get(MEMBER_B_ID).mentionTypeOrDefault()).isEqualTo(NotifyMessage.MENTION_TYPE_NONE);
        assertThat(rows.get(MEMBER_B_ID).isRecipientMentioned()).isFalse();
        verify(sysGroupMapper, never()).selectById(any());
    }

    /* ------------------------------------------------------------------ 打桩与断言辅助 */

    private void stubGroupMembership(long groupId, long senderId, List<Long> members) {
        when(groupMemberMapper.countMember(groupId, senderId)).thenReturn(1);
        when(groupMemberMapper.selectMemberUserIds(groupId)).thenReturn(members);
    }

    private ChatSendDTO groupSend(Boolean mentionAll, List<Long> mentionUserIds) {
        return new ChatSendDTO(ChatScope.GROUP, GROUP_ID, MessageType.CHAT_TEXT,
                CONTENT, CLIENT_MSG_ID, null, mentionUserIds, mentionAll);
    }

    /** 捕获本次发送落库的全部行，按接收人归档（发送人自己的行也在其中）。 */
    private Map<Long, NotifyMessage> captureRows() {
        ArgumentCaptor<NotifyMessage> captor = ArgumentCaptor.forClass(NotifyMessage.class);
        verify(notifyMessageMapper, atLeastOnce()).insert(captor.capture());
        // 同一接收人落两行会直接在这里抛重复键：写扩散「一接收人一行」是硬约束，
        // 由后续的 containsOnlyKeys 一并钉住
        return captor.getAllValues().stream()
                .collect(Collectors.toMap(NotifyMessage::getRecipientUserId, row -> row));
    }

    private static SysGroup groupOwnedBy(long ownerId) {
        SysGroup group = new SysGroup();
        group.setId(GROUP_ID);
        group.setName("产品讨论组");
        group.setGroupType(SysGroup.TYPE_CHAT);
        group.setOwnerUserId(ownerId);
        group.setStatus(SysGroup.STATUS_ACTIVE);
        return group;
    }
}
