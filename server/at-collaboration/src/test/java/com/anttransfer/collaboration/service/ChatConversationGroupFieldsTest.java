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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.anttransfer.collaboration.MybatisPlusTestSupport;
import com.anttransfer.collaboration.config.NotifyProperties;
import com.anttransfer.collaboration.model.entity.GroupMember;
import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.anttransfer.collaboration.model.entity.SysGroup;
import com.anttransfer.collaboration.model.vo.ConversationVO;
import com.anttransfer.collaboration.repository.ChatGroupRow;
import com.anttransfer.collaboration.repository.ChatPeerAliasMapper;
import com.anttransfer.collaboration.repository.ConversationSummary;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.repository.SysGroupMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsPresenceService;
import com.anttransfer.common.notify.ChatScope;
import com.anttransfer.common.notify.MessageType;
import com.anttransfer.common.security.UserLookupPort;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 会话列表「群人数 + 我的提醒偏好」回显口径的单测（{@code ChatService#conversations}）。
 *
 * <p>本用例的核心价值在<b>一条容易被忽略、错了又极难复盘的分流断言</b>：
 * 群 ID 与用户 ID 是两套互不相干的序列，数值上完全可能相等。
 * 若组装时只按 {@code chatTargetId} 去「我加入的群」快照里取值、不先看 {@code chatScope}，
 * 那么「我和用户 42 的单聊」会套上「群 42」的人数与免打扰偏好——
 * 表现为单聊标题旁莫名显示群人数，且这条单聊的新消息会按另一个群的设置决定是否出声。
 * 因此用例刻意让两者共用同一个数值 ID。</p>
 *
 * <p>同时钉住「已退群 / 被移除不跳会话」：查不到我的成员行时只是人数与偏好为
 * {@code null}，会话本身仍在列表里（历史消息还在）。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class ChatConversationGroupFieldsTest {

    private static final long ME_ID = 2101964960292136001L;
    /** 刻意复用：既是「我加入的群」的 ID，也是「我和用户 42 的单聊」的对端用户 ID。 */
    private static final long SAME_ID = 2101964960292136099L;

    private static final long PRIVATE_MSG_ID = 2101964960292136011L;
    private static final long GROUP_MSG_ID = 2101964960292136012L;
    private static final long GROUP_ONLY_ID = 2101964960292136013L;

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

    @BeforeAll
    static void initMybatisPlus() {
        // 会话列表在存在单聊时会对 ChatPeerAlias 构造 Lambda 条件，纯单测下需显式初始化 TableInfo 缓存
        MybatisPlusTestSupport.initTableInfo();
    }

    @BeforeEach
    void setUp() {
        service = new ChatService(notifyMessageMapper, groupMemberMapper, sysGroupMapper,
                chatPeerAliasMapper, userLookupPort,
                wsBroadcaster, wsPresenceService, afterCommitExecutor, properties, notifyMessageService);
        when(properties.getChatConversationLimit()).thenReturn(50);
        // 备注查询对本次断言无影响，返回空集合即可；群聊用例不查备注，故用 lenient 避免严格打桩误报
        lenient().when(chatPeerAliasMapper.selectList(any())).thenReturn(List.of());
    }

    @Test
    @DisplayName("群聊回显人数与我的偏好；单聊恒为 null——即使它的对端 ID 恰好等于某个群 ID")
    void conversations_shouldExposeGroupFieldsOnlyForGroupScope() {
        long groupId = SAME_ID;
        when(notifyMessageMapper.selectConversationSummaries(ME_ID, 20))
                .thenReturn(List.of(summary(ChatScope.PRIVATE, SAME_ID, PRIVATE_MSG_ID),
                        summary(ChatScope.GROUP, groupId, GROUP_MSG_ID)));
        when(notifyMessageMapper.selectByIds(List.of(PRIVATE_MSG_ID, GROUP_MSG_ID)))
                .thenReturn(List.of(message(PRIVATE_MSG_ID, ChatScope.PRIVATE, SAME_ID),
                        message(GROUP_MSG_ID, ChatScope.GROUP, groupId)));
        when(userLookupPort.findContacts(java.util.Set.of(SAME_ID)))
                .thenReturn(Map.of(SAME_ID, new UserLookupPort.UserContact(SAME_ID, "张三", null, null)));
        SysGroup group = new SysGroup();
        group.setId(groupId);
        group.setName("产品讨论组");
        when(sysGroupMapper.selectByIds(java.util.Set.of(groupId))).thenReturn(List.of(group));
        when(sysGroupMapper.selectMyGroups(ME_ID)).thenReturn(List.of(myGroup(groupId, 5L, 1, 0, 1)));

        List<ConversationVO> conversations = service.conversations(ME_ID, 20);

        ConversationVO privateChat = byScope(conversations, ChatScope.PRIVATE);
        ConversationVO groupChat = byScope(conversations, ChatScope.GROUP);

        // 群聊：人数与偏好都来自「我」的成员行快照
        assertThat(groupChat.memberCount()).isEqualTo(5L);
        assertThat(groupChat.notifyPreference().muteStatus()).isEqualTo(GroupMember.MUTE_ON);
        assertThat(groupChat.notifyPreference().notifyOnMention()).isEqualTo(GroupMember.NOTIFY_OFF);
        assertThat(groupChat.notifyPreference().notifyOnMentionAll()).isEqualTo(GroupMember.NOTIFY_ON);

        // 单聊：即便对端用户 ID == 群 ID，也绝不能借到群的人数与免打扰设置
        assertThat(privateChat.memberCount()).isNull();
        assertThat(privateChat.notifyPreference()).isNull();
        assertThat(privateChat.targetName()).isEqualTo("张三");
    }

    @Test
    @DisplayName("已退群 / 被移除：人数与偏好为 null，但会话不因此消失（历史消息还在）")
    void conversations_shouldKeepSessionWhenMembershipGone() {
        when(notifyMessageMapper.selectConversationSummaries(ME_ID, 20))
                .thenReturn(List.of(summary(ChatScope.GROUP, GROUP_ONLY_ID, GROUP_MSG_ID)));
        when(notifyMessageMapper.selectByIds(List.of(GROUP_MSG_ID)))
                .thenReturn(List.of(message(GROUP_MSG_ID, ChatScope.GROUP, GROUP_ONLY_ID)));
        when(sysGroupMapper.selectByIds(java.util.Set.of(GROUP_ONLY_ID))).thenReturn(List.of());
        // 我读不到成员关系（已被移除 / 已退群）：selectMyGroups 不含该群
        when(sysGroupMapper.selectMyGroups(ME_ID)).thenReturn(List.of());

        List<ConversationVO> conversations = service.conversations(ME_ID, 20);

        assertThat(conversations).hasSize(1);
        assertThat(conversations.get(0).memberCount()).isNull();
        assertThat(conversations.get(0).notifyPreference()).isNull();
    }

    /* ------------------------------------------------------------------ 测试夹具 */

    private static ConversationVO byScope(List<ConversationVO> conversations, int scope) {
        return conversations.stream()
                .filter(conversation -> conversation.chatScope() == scope)
                .findFirst()
                .orElseThrow(() -> new AssertionError("会话列表中缺少 scope=" + scope + " 的会话"));
    }

    private static ConversationSummary summary(int scope, long targetId, long lastMessageId) {
        ConversationSummary summary = new ConversationSummary();
        summary.setChatScope(scope);
        summary.setChatTargetId(targetId);
        summary.setLastMessageId(lastMessageId);
        summary.setUnreadCount(1L);
        summary.setMentionUnreadCount(0L);
        return summary;
    }

    private static NotifyMessage message(long id, int scope, long targetId) {
        NotifyMessage message = new NotifyMessage();
        message.setId(id);
        message.setChatScope(scope);
        message.setChatTargetId(targetId);
        message.setSenderUserId(SAME_ID);
        message.setContent("在吗");
        message.setMessageType(MessageType.CHAT_TEXT);
        message.setCreateTime(LocalDateTime.of(2026, 9, 30, 10, 0));
        return message;
    }

    private static ChatGroupRow myGroup(long groupId, Long memberCount,
                                        int muteStatus, int notifyOnMention, int notifyOnMentionAll) {
        ChatGroupRow row = new ChatGroupRow();
        row.setId(groupId);
        row.setMemberCount(memberCount);
        row.setMuteStatus(muteStatus);
        row.setNotifyOnMention(notifyOnMention);
        row.setNotifyOnMentionAll(notifyOnMentionAll);
        return row;
    }
}
