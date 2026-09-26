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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.anttransfer.collaboration.config.NotifyProperties;
import com.anttransfer.collaboration.model.vo.ChatPresenceStatus;
import com.anttransfer.collaboration.model.vo.ChatPresenceVO;
import com.anttransfer.collaboration.model.vo.ChatTypingVO;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.SysGroupMapper;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsFrame;
import com.anttransfer.collaboration.ws.WsPresenceService;
import com.anttransfer.collaboration.ws.WsProtocol;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.notify.ChatScope;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.UserLookupPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 会话「瞬时通道」单测：输入状态（{@code TYPING}）与在线状态订阅（{@code PRESENCE} 的入口）。
 *
 * <p>两者都不是消息，因此这里的断言重点不是「存了什么」，而是三件事：
 * <b>出帧口径</b>（载荷里的 {@code chatTargetId} 必须是接收人视角）、
 * <b>投递对象</b>（输入状态只推对端，不推输入者自己的其他连接）、
 * 以及<b>校验边界</b>（群聊明确拒绝、目标必须可用、不给自己发），
 * 并确认在线状态的热路径（每 30s 一次）不碰 DB。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class ChatServiceTypingTest {

    private static final Long SENDER_ID = 900000000000000001L;
    private static final Long PEER_ID = 900000000000000009L;
    private static final Long GROUP_ID = 900000000000000100L;

    @Mock
    private NotifyMessageMapper notifyMessageMapper;
    @Mock
    private GroupMemberMapper groupMemberMapper;
    @Mock
    private SysGroupMapper sysGroupMapper;
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
        service = new ChatService(notifyMessageMapper, groupMemberMapper, sysGroupMapper, userLookupPort,
                wsBroadcaster, wsPresenceService, afterCommitExecutor, properties,
                notifyMessageService);
    }

    @Test
    @DisplayName("输入状态：载荷的 chatTargetId 是「接收人视角」＝输入者本人，且只推给对端")
    void notifyTyping_shouldPushToPeerWithReceiverPerspective() {
        when(userLookupPort.existsActiveUser(PEER_ID)).thenReturn(true);

        service.notifyTyping(SENDER_ID, ChatScope.PRIVATE, PEER_ID, true);

        ArgumentCaptor<WsFrame> frames = ArgumentCaptor.forClass(WsFrame.class);
        verify(wsBroadcaster).push(eq(PEER_ID), frames.capture());
        WsFrame frame = frames.getValue();
        assertThat(frame.type()).isEqualTo(WsProtocol.TYPE_TYPING);
        ChatTypingVO payload = (ChatTypingVO) frame.data();
        // 关键口径：对端看到的是「和我聊的那个人在输入」，故指向 SENDER_ID 而不是 PEER_ID
        assertThat(payload.chatTargetId()).isEqualTo(SENDER_ID);
        assertThat(payload.chatScope()).isEqualTo(ChatScope.PRIVATE);
        assertThat(payload.typing()).isTrue();
    }

    @Test
    @DisplayName("停止输入：同样转发（typing=false），接收端据此立刻收起提示而不必等空闲兜底")
    void notifyTyping_shouldForwardStopSignal() {
        when(userLookupPort.existsActiveUser(PEER_ID)).thenReturn(true);

        service.notifyTyping(SENDER_ID, ChatScope.PRIVATE, PEER_ID, false);

        ArgumentCaptor<WsFrame> frames = ArgumentCaptor.forClass(WsFrame.class);
        verify(wsBroadcaster).push(eq(PEER_ID), frames.capture());
        assertThat(((ChatTypingVO) frames.getValue().data()).typing()).isFalse();
    }

    @Test
    @DisplayName("群聊：明确拒绝（2001），不推送——群聊需要成员聚合与「谁在输入」的展示口径，属独立设计")
    void notifyTyping_shouldRejectGroupScope() {
        assertThatThrownBy(() -> service.notifyTyping(SENDER_ID, ChatScope.GROUP, GROUP_ID, true))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.PARAM_ERROR.getCode());
        verify(wsBroadcaster, never()).push(any(), any());
    }

    @Test
    @DisplayName("目标不可用（不存在 / 已禁用）：1013 且不推送，避免给幽灵账号发瞬时信号")
    void notifyTyping_shouldRejectUnavailableTarget() {
        when(userLookupPort.existsActiveUser(PEER_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.notifyTyping(SENDER_ID, ChatScope.PRIVATE, PEER_ID, true))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_TARGET_INVALID.getCode());
        verify(wsBroadcaster, never()).push(any(), any());
    }

    @Test
    @DisplayName("目标是自己：1013，且不查用户目录")
    void notifyTyping_shouldRejectSelfTarget() {
        assertThatThrownBy(() -> service.notifyTyping(SENDER_ID, ChatScope.PRIVATE, SENDER_ID, true))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_TARGET_INVALID.getCode());
        verifyNoInteractions(userLookupPort);
    }

    @Test
    @DisplayName("目标为空：2002，且不推送")
    void notifyTyping_shouldRejectMissingTarget() {
        assertThatThrownBy(() -> service.notifyTyping(SENDER_ID, ChatScope.PRIVATE, null, true))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.PARAM_MISSING.getCode());
        verify(wsBroadcaster, never()).push(any(), any());
    }

    @Test
    @DisplayName("在线状态订阅：单聊委托给状态服务并原样返回三态")
    void watchPresence_shouldDelegateToPresenceService() {
        ChatPresenceVO expected = new ChatPresenceVO(PEER_ID, ChatPresenceStatus.UNSTABLE, 123L);
        when(wsPresenceService.watch(SENDER_ID, PEER_ID)).thenReturn(expected);

        assertThat(service.watchPresence(SENDER_ID, ChatScope.PRIVATE, PEER_ID)).isSameAs(expected);
    }

    @Test
    @DisplayName("在线状态订阅不碰 DB：这是会话打开期间每 30s 一次的热路径")
    void watchPresence_shouldNotTouchUserDirectory() {
        when(wsPresenceService.watch(SENDER_ID, PEER_ID))
                .thenReturn(new ChatPresenceVO(PEER_ID, ChatPresenceStatus.OFFLINE, null));

        service.watchPresence(SENDER_ID, ChatScope.PRIVATE, PEER_ID);

        verifyNoInteractions(userLookupPort);
    }

    @Test
    @DisplayName("在线状态订阅：群聊（无单一对端）与自订阅都明确拒绝，不返回含糊的空状态")
    void watchPresence_shouldRejectGroupAndSelf() {
        assertThatThrownBy(() -> service.watchPresence(SENDER_ID, ChatScope.GROUP, GROUP_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.PARAM_ERROR.getCode());

        assertThatThrownBy(() -> service.watchPresence(SENDER_ID, ChatScope.PRIVATE, SENDER_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_TARGET_INVALID.getCode());

        verify(wsPresenceService, never()).watch(anyLong(), anyLong());
    }
}
