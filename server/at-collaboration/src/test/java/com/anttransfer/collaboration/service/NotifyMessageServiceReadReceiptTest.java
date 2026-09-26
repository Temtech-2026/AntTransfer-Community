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

import com.anttransfer.collaboration.config.NotifyProperties;
import com.anttransfer.collaboration.model.vo.ChatReadReceiptVO;
import com.anttransfer.collaboration.repository.ChatReadRow;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsFrame;
import com.anttransfer.collaboration.ws.WsProtocol;
import com.anttransfer.common.notify.ChatScope;
import com.anttransfer.common.security.UserLookupPort;
import com.anttransfer.common.security.UserLookupPort.UserContact;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * {@code NotifyMessageService#markSessionRead} 的已读回执回归证据：置读后推给谁、推什么。
 *
 * <p>钉住三件事：</p>
 * <ol>
 *     <li><b>会话目标要换算成发送人视角</b>——单聊回读者本人、群聊回群 ID。
 *         照抄快照行里的 {@code chat_target_id} 是错的（那是读者视角，单聊指向发送人自己），
 *         而错了不会报错，只会「头像永远不出现」，故必须有用例。</li>
 *     <li><b>按发送人归并</b>——群聊一次置读跨多位发送人时，一人一帧。</li>
 *     <li><b>读者查不到名字就不推</b>——画不出头像的回执没有意义。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class NotifyMessageServiceReadReceiptTest {

    private static final long READER_ID = 2101964960292134915L;
    private static final long SENDER_ID = 2101964960292134916L;
    private static final long OTHER_SENDER_ID = 2101964960292134917L;
    private static final long GROUP_ID = 2101964960292134918L;

    /** 快照取数上限：复用会话历史页大小（见 NotifyProperties#getChatHistoryLimit） */
    private static final int PAGE_LIMIT = 50;

    @Mock
    private NotifyMessageMapper notifyMessageMapper;
    @Mock
    private WsBroadcaster wsBroadcaster;
    @Mock
    private AfterCommitExecutor afterCommitExecutor;
    @Mock
    private NotifyProperties properties;
    @Mock
    private UserLookupPort userLookupPort;

    private NotifyMessageService service;

    @BeforeEach
    void setUp() {
        service = new NotifyMessageService(notifyMessageMapper, wsBroadcaster, afterCommitExecutor,
                properties, userLookupPort);
        // 共享打桩用 lenient：并非每条用例都会走到推送（如「本来就没有未读」），
        // 严格模式会把「没用上」当成用例缺陷误报
        lenient().when(properties.getChatHistoryLimit()).thenReturn(PAGE_LIMIT);
        // 提交后动作在用例里同步跑：推送才是断言对象，不能留在回调里等事务真正提交
        lenient().doAnswer(invocation -> {
            invocation.<Runnable>getArgument(0).run();
            return null;
        }).when(afterCommitExecutor).run(any());
    }

    @Test
    @DisplayName("单聊：回执推给发送人，target 是读者本人（不是快照行里的 target）")
    void markSessionRead_shouldPushPrivateReceiptToSender() {
        when(notifyMessageMapper.selectSessionUnreadRows(READER_ID, ChatScope.PRIVATE, SENDER_ID, PAGE_LIMIT))
                .thenReturn(List.of(
                        unreadRow("c-1", SENDER_ID, READER_ID, ChatScope.PRIVATE, SENDER_ID),
                        unreadRow("c-2", SENDER_ID, READER_ID, ChatScope.PRIVATE, SENDER_ID)));
        when(notifyMessageMapper.markSessionRead(eq(READER_ID), eq(ChatScope.PRIVATE), eq(SENDER_ID), any()))
                .thenReturn(2);
        when(userLookupPort.findContacts(List.of(READER_ID)))
                .thenReturn(Map.of(READER_ID, new UserContact(READER_ID, "姚", null, null)));

        int affected = service.markSessionRead(READER_ID, ChatScope.PRIVATE, SENDER_ID);

        assertThat(affected).isEqualTo(2);
        ChatReadReceiptVO receipt = captureReceipt(SENDER_ID);
        assertThat(receipt.chatScope()).isEqualTo(ChatScope.PRIVATE);
        // 发送人窗口的会话 target 是「对端 = 读者」；快照行里的 target 是 SENDER_ID（读者视角），照抄就匹配不上
        assertThat(receipt.chatTargetId()).isEqualTo(READER_ID);
        assertThat(receipt.reader().userId()).isEqualTo(READER_ID);
        assertThat(receipt.reader().displayName()).isEqualTo("姚");
        assertThat(receipt.clientMsgIds()).containsExactly("c-1", "c-2");
    }

    @Test
    @DisplayName("群聊：按发送人归并成多帧，target 都是群 ID")
    void markSessionRead_shouldGroupGroupReceiptsBySender() {
        when(notifyMessageMapper.selectSessionUnreadRows(READER_ID, ChatScope.GROUP, GROUP_ID, PAGE_LIMIT))
                .thenReturn(List.of(
                        unreadRow("c-1", SENDER_ID, READER_ID, ChatScope.GROUP, GROUP_ID),
                        unreadRow("c-2", OTHER_SENDER_ID, READER_ID, ChatScope.GROUP, GROUP_ID)));
        when(notifyMessageMapper.markSessionRead(eq(READER_ID), eq(ChatScope.GROUP), eq(GROUP_ID), any()))
                .thenReturn(2);
        when(userLookupPort.findContacts(List.of(READER_ID)))
                .thenReturn(Map.of(READER_ID, new UserContact(READER_ID, "姚", null, null)));

        service.markSessionRead(READER_ID, ChatScope.GROUP, GROUP_ID);

        ChatReadReceiptVO toSender = captureReceipt(SENDER_ID);
        assertThat(toSender.chatTargetId()).isEqualTo(GROUP_ID);
        assertThat(toSender.clientMsgIds()).containsExactly("c-1");

        ChatReadReceiptVO toOtherSender = captureReceipt(OTHER_SENDER_ID);
        assertThat(toOtherSender.chatTargetId()).isEqualTo(GROUP_ID);
        assertThat(toOtherSender.clientMsgIds()).containsExactly("c-2");
    }

    @Test
    @DisplayName("读者已不在用户目录：不推回执（画不出头像），但置读本身照常生效")
    void markSessionRead_shouldSkipReceiptWhenReaderUnknown() {
        when(notifyMessageMapper.selectSessionUnreadRows(READER_ID, ChatScope.PRIVATE, SENDER_ID, PAGE_LIMIT))
                .thenReturn(List.of(unreadRow("c-1", SENDER_ID, READER_ID, ChatScope.PRIVATE, SENDER_ID)));
        when(notifyMessageMapper.markSessionRead(eq(READER_ID), eq(ChatScope.PRIVATE), eq(SENDER_ID), any()))
                .thenReturn(1);
        when(userLookupPort.findContacts(List.of(READER_ID))).thenReturn(Map.of());

        assertThat(service.markSessionRead(READER_ID, ChatScope.PRIVATE, SENDER_ID)).isEqualTo(1);

        verify(wsBroadcaster, never()).push(eq(SENDER_ID), any());
    }

    @Test
    @DisplayName("本来就没有未读：不回执查询的推送，也不推未读快照")
    void markSessionRead_shouldNotPushWhenNothingFlipped() {
        when(notifyMessageMapper.selectSessionUnreadRows(READER_ID, ChatScope.PRIVATE, SENDER_ID, PAGE_LIMIT))
                .thenReturn(List.of());
        when(notifyMessageMapper.markSessionRead(eq(READER_ID), eq(ChatScope.PRIVATE), eq(SENDER_ID), any()))
                .thenReturn(0);

        assertThat(service.markSessionRead(READER_ID, ChatScope.PRIVATE, SENDER_ID)).isZero();

        verifyNoInteractions(userLookupPort);
        verify(wsBroadcaster, never()).push(any(), any());
    }

    @Test
    @DisplayName("防御：快照里若混入「自己发给自己」的行，不给自己推回执")
    void markSessionRead_shouldSkipSelfSentRow() {
        when(notifyMessageMapper.selectSessionUnreadRows(READER_ID, ChatScope.PRIVATE, SENDER_ID, PAGE_LIMIT))
                .thenReturn(List.of(unreadRow("c-1", READER_ID, READER_ID, ChatScope.PRIVATE, SENDER_ID)));
        when(notifyMessageMapper.markSessionRead(eq(READER_ID), eq(ChatScope.PRIVATE), eq(SENDER_ID), any()))
                .thenReturn(1);

        service.markSessionRead(READER_ID, ChatScope.PRIVATE, SENDER_ID);

        // 归并后没有任何「别的发送人」，连读者姓名都不必反查
        verifyNoInteractions(userLookupPort);
        // 置读本身照常生效：读者自己的角标要清（UNREAD）；但不得出现任何 CHAT_READ 回执帧
        ArgumentCaptor<WsFrame> captor = ArgumentCaptor.forClass(WsFrame.class);
        verify(wsBroadcaster).push(eq(READER_ID), captor.capture());
        assertThat(captor.getValue().type()).isEqualTo(WsProtocol.TYPE_UNREAD);
        verify(wsBroadcaster, never()).push(eq(SENDER_ID), any(WsFrame.class));
    }

    /* ------------------------------------------------------------------ 造数 */

    private ChatReadReceiptVO captureReceipt(Long senderId) {
        ArgumentCaptor<WsFrame> captor = ArgumentCaptor.forClass(WsFrame.class);
        verify(wsBroadcaster).push(eq(senderId), captor.capture());
        WsFrame frame = captor.getValue();
        assertThat(frame.type()).isEqualTo(WsProtocol.TYPE_CHAT_READ);
        return (ChatReadReceiptVO) frame.data();
    }

    /** 读取人视角的一行未读消息 */
    private ChatReadRow unreadRow(String clientMsgId, Long senderId, Long readerId, int scope, Long targetId) {
        ChatReadRow row = new ChatReadRow();
        row.setClientMsgId(clientMsgId);
        row.setSenderUserId(senderId);
        row.setReaderUserId(readerId);
        row.setChatScope(scope);
        row.setChatTargetId(targetId);
        return row;
    }
}
