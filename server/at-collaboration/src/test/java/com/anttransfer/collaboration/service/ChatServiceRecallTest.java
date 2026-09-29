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
import com.anttransfer.collaboration.model.dto.ChatSendDTO;
import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.anttransfer.collaboration.model.vo.ChatRecallVO;
import com.anttransfer.collaboration.repository.ChatPeerAliasMapper;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.repository.SysGroupMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsFrame;
import com.anttransfer.collaboration.ws.WsPresenceService;
import com.anttransfer.collaboration.ws.WsProtocol;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.notify.ChatScope;
import com.anttransfer.common.notify.MessageType;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.UserLookupPort;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@code ChatService} 的撤回与引用口径回归证据。
 *
 * <p><b>撤回这一块最容易错的是作用域：</b>写扩散下一条消息落 N 行、各行 id 不同，
 * 按 id 撤只会撤掉自己那一行，对方那一行原样留着（表现为「我撤了，他还能看到」）。
 * 故用例把「定位维度是 {@code (sender, clientMsgId)} 而不是行 id」
 * 与「逐行按接收人视角下发 chatTargetId」两件事都钉住。</p>
 *
 * <p><b>引用这一块最容易错的是快照时机：</b>若把被引用消息的内容留到读的时候回查，
 * 原消息一旦被撤回（正文清空），引用块会在几秒后集体变空白。故用例断言
 * <b>写入时</b>就把 {@code quoteContent / quoteSenderUserId} 抄进每一行。</p>
 *
 * <p><b>抄下来的快照还必须「已经是给人看的文本」：</b>文件消息的正文末尾挂着
 * {@code #file:} / {@code #att:} 机器尾注，而快照那一行既没有类型可供渲染端判断、
 * 也解析不成卡片，只能当字符串画出来——尾注一旦漏进去就是永久可见的。
 * 故用例把「按被引用消息的类型剥掉尾注」与「剥在截断之前」两件事一并钉住
 * （口径见 {@code ChatFileCardText}）。</p>
 *
 * <p>此外还有两条边界值得单独钉：时间窗判定用的是<b>服务端时钟</b>且窗口本身是
 * 「超过 2 分钟才算超窗」（1 分 59 秒必须还能撤），以及快照截断按<b>码点</b>而不是
 * {@code char}（否则 emoji 会被切成孤立代理，写 utf8mb4 列时变成乱码）。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class ChatServiceRecallTest {

    /** 19 位雪花 ID：与既有会话用例同源，便于比对精度问题 */
    private static final long ME_ID = 2101964960292134914L;
    private static final long PEER_ID = 2101964960292134915L;
    private static final long GROUP_ID = 2101964960292134916L;
    private static final long OTHER_MEMBER_ID = 2101964960292134917L;

    private static final String MSG_KEY = "c-1";
    private static final String QUOTED_KEY = "c-0";

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
        // 撤回推送注册在「提交后」执行：测试里必须让它立即跑，否则断言不到推送内容
        lenient().doAnswer(invocation -> {
            invocation.getArgument(0, Runnable.class).run();
            return null;
        }).when(afterCommitExecutor).run(any());
        // 正文长度上限来自配置：mock 下默认 0，不打桩则「任何消息都超长」，失焦到无关校验上
        lenient().when(properties.getContentMaxLength()).thenReturn(1000);
    }

    /* ======================== 撤回 ======================== */

    @Test
    @DisplayName("撤回：按 (发送人, 幂等键) 一次翻转全部落库行，并按接收人视角逐行下发撤回帧")
    void recall_shouldFlipAllRowsAndPushPerRecipientPerspective() {
        // 单聊的两行：我自己那行 targetId=对端；对端那行 targetId=我（互指）
        when(notifyMessageMapper.selectOwnMessageRows(ME_ID, MSG_KEY))
                .thenReturn(List.of(row(ME_ID, ME_ID, PEER_ID), row(PEER_ID, ME_ID, ME_ID)));
        when(notifyMessageMapper.recallOwnMessageRows(eq(ME_ID), eq(MSG_KEY), any())).thenReturn(2);

        service.recall(ME_ID, MSG_KEY);

        verify(notifyMessageMapper).recallOwnMessageRows(eq(ME_ID), eq(MSG_KEY), any());

        ArgumentCaptor<WsFrame> frames = ArgumentCaptor.forClass(WsFrame.class);
        verify(wsBroadcaster).push(eq(ME_ID), frames.capture());
        verify(wsBroadcaster).push(eq(PEER_ID), frames.capture());

        List<WsFrame> pushed = frames.getAllValues();
        assertThat(pushed).hasSize(2).allSatisfy(frame -> {
            assertThat(frame.type()).isEqualTo(WsProtocol.TYPE_CHAT_RECALL);
            ChatRecallVO payload = (ChatRecallVO) frame.data();
            assertThat(payload.clientMsgId()).isEqualTo(MSG_KEY);
            assertThat(payload.senderUserId()).isEqualTo(ME_ID);
        });
        // 关键口径：chatTargetId 是该接收人视角的会话目标，不是发送人的 targetId
        assertThat(pushed.stream()
                .filter(f -> f.data() instanceof ChatRecallVO v && v.chatTargetId() == ME_ID))
                .isNotEmpty();
        assertThat(pushed.stream()
                .map(f -> ((ChatRecallVO) f.data()).chatTargetId()))
                .containsExactlyInAnyOrder(PEER_ID, ME_ID);
    }

    @Test
    @DisplayName("撤回：群聊下每一行的 chatTargetId 都是群 ID，且推给全部成员")
    void recall_shouldPushGroupTargetToEveryMember() {
        when(notifyMessageMapper.selectOwnMessageRows(ME_ID, MSG_KEY))
                .thenReturn(List.of(row(ME_ID, ME_ID, GROUP_ID), row(PEER_ID, ME_ID, GROUP_ID),
                        row(OTHER_MEMBER_ID, ME_ID, GROUP_ID)));
        when(notifyMessageMapper.recallOwnMessageRows(eq(ME_ID), eq(MSG_KEY), any())).thenReturn(3);

        service.recall(ME_ID, MSG_KEY);

        ArgumentCaptor<WsFrame> frames = ArgumentCaptor.forClass(WsFrame.class);
        verify(wsBroadcaster, times(3)).push(anyLong(), frames.capture());
        assertThat(frames.getAllValues())
                .allSatisfy(frame -> assertThat(((ChatRecallVO) frame.data()).chatTargetId())
                        .isEqualTo(GROUP_ID));
    }

    @Test
    @DisplayName("撤回：超过 2 分钟拒绝（1034），且不写库、不推送")
    void recall_shouldRejectExpiredWindow() {
        NotifyMessage expired = row(ME_ID, ME_ID, PEER_ID);
        expired.setCreateTime(LocalDateTime.now().minusMinutes(2).minusSeconds(30));
        when(notifyMessageMapper.selectOwnMessageRows(ME_ID, MSG_KEY)).thenReturn(List.of(expired));

        assertThatThrownBy(() -> service.recall(ME_ID, MSG_KEY))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_RECALL_EXPIRED.getCode());

        verify(notifyMessageMapper, never()).recallOwnMessageRows(any(), any(), any());
        verify(wsBroadcaster, never()).push(any(), any());
    }

    @Test
    @DisplayName("撤回：窗口内（1 分 59 秒前发出）仍然可撤——窗口是「超过 2 分钟才拒绝」")
    void recall_shouldAllowMessageInsideWindow() {
        NotifyMessage inside = row(ME_ID, ME_ID, PEER_ID);
        inside.setCreateTime(LocalDateTime.now().minusMinutes(2).plusSeconds(5));
        when(notifyMessageMapper.selectOwnMessageRows(ME_ID, MSG_KEY)).thenReturn(List.of(inside));
        when(notifyMessageMapper.recallOwnMessageRows(eq(ME_ID), eq(MSG_KEY), any())).thenReturn(1);

        assertThatCode(() -> service.recall(ME_ID, MSG_KEY)).doesNotThrowAnyException();

        verify(notifyMessageMapper).recallOwnMessageRows(eq(ME_ID), eq(MSG_KEY), any());
    }

    @Test
    @DisplayName("撤回：消息不存在或不是本人发送（按 (发送人, 幂等键) 查不到）→ 1035，不写库")
    void recall_shouldRejectUnknownOrForeignMessage() {
        when(notifyMessageMapper.selectOwnMessageRows(ME_ID, MSG_KEY)).thenReturn(List.of());

        assertThatThrownBy(() -> service.recall(ME_ID, MSG_KEY))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_RECALL_NOT_FOUND.getCode());

        verify(notifyMessageMapper, never()).recallOwnMessageRows(any(), any(), any());
    }

    @Test
    @DisplayName("撤回：已是撤回态时按幂等成功返回，且不因「时间窗已过」误报 1034")
    void recall_shouldBeIdempotentWhenAlreadyRecalled() {
        // 多端并发撤回的第二种到达顺序：行已是撤回态，且此刻早已超出时间窗
        NotifyMessage recalled = row(ME_ID, ME_ID, PEER_ID);
        recalled.setRecallStatus(NotifyMessage.RECALL_DONE);
        recalled.setCreateTime(LocalDateTime.now().minusHours(3));
        when(notifyMessageMapper.selectOwnMessageRows(ME_ID, MSG_KEY)).thenReturn(List.of(recalled));

        assertThatCode(() -> service.recall(ME_ID, MSG_KEY)).doesNotThrowAnyException();

        verify(notifyMessageMapper, never()).recallOwnMessageRows(any(), any(), any());
        verify(wsBroadcaster, never()).push(any(), any());
    }

    @Test
    @DisplayName("撤回：并发下被另一端抢先翻转（受影响行数为 0）不报错、不重复推送")
    void recall_shouldNotFailWhenAnotherEndWonTheRace() {
        when(notifyMessageMapper.selectOwnMessageRows(ME_ID, MSG_KEY))
                .thenReturn(List.of(row(ME_ID, ME_ID, PEER_ID)));
        when(notifyMessageMapper.recallOwnMessageRows(eq(ME_ID), eq(MSG_KEY), any())).thenReturn(0);

        assertThatCode(() -> service.recall(ME_ID, MSG_KEY)).doesNotThrowAnyException();

        verify(wsBroadcaster, never()).push(any(), any());
    }

    @Test
    @DisplayName("撤回：幂等键为空时按参数缺失拒绝（2002），不查库")
    void recall_shouldRejectBlankKey() {
        assertThatThrownBy(() -> service.recall(ME_ID, "  "))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.PARAM_MISSING.getCode());

        verify(notifyMessageMapper, never()).selectOwnMessageRows(any(), any());
    }

    /* ======================== 引用 ======================== */

    @Test
    @DisplayName("引用：发送时把「谁说的 + 正文快照」抄进每一行，而不是留到读的时候回查")
    void send_shouldSnapshotQuotedMessageIntoEveryRow() {
        givenPrivateSend();
        when(notifyMessageMapper.selectQuotableMessage(ME_ID, QUOTED_KEY))
                .thenReturn(quoted(PEER_ID, PEER_ID, "原话在这里", NotifyMessage.RECALL_NONE));

        service.send(ME_ID, sendDTO(MSG_KEY, QUOTED_KEY));

        ArgumentCaptor<NotifyMessage> rows = ArgumentCaptor.forClass(NotifyMessage.class);
        verify(notifyMessageMapper, times(2)).insert(rows.capture());
        assertThat(rows.getAllValues()).allSatisfy(row -> {
            assertThat(row.getQuoteClientMsgId()).isEqualTo(QUOTED_KEY);
            assertThat(row.getQuoteSenderUserId()).isEqualTo(PEER_ID);
            assertThat(row.getQuoteContent()).isEqualTo("原话在这里");
        });
    }

    @Test
    @DisplayName("引用：不带引用键的普通消息不写任何快照列")
    void send_shouldLeaveQuoteColumnsEmptyForPlainMessage() {
        givenPrivateSend();

        service.send(ME_ID, sendDTO(MSG_KEY, null));

        ArgumentCaptor<NotifyMessage> rows = ArgumentCaptor.forClass(NotifyMessage.class);
        verify(notifyMessageMapper, times(2)).insert(rows.capture());
        assertThat(rows.getAllValues()).allSatisfy(row -> {
            assertThat(row.getQuoteClientMsgId()).isNull();
            assertThat(row.getQuoteSenderUserId()).isNull();
            assertThat(row.getQuoteContent()).isNull();
        });
        verify(notifyMessageMapper, never()).selectQuotableMessage(any(), any());
    }

    @Test
    @DisplayName("引用：跨会话引用拒绝（1036），且一行都不落库")
    void send_shouldRejectQuoteFromAnotherSession() {
        givenPrivateSend();
        // 被引用消息属于另一个群会话：引用它会把这个会话的内容搬进当前会话
        when(notifyMessageMapper.selectQuotableMessage(ME_ID, QUOTED_KEY))
                .thenReturn(quoted(PEER_ID, GROUP_ID, "别的会话里的话", NotifyMessage.RECALL_NONE));

        assertThatThrownBy(() -> service.send(ME_ID, sendDTO(MSG_KEY, QUOTED_KEY)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_QUOTE_TARGET_INVALID.getCode());

        verify(notifyMessageMapper, never()).insert(any(NotifyMessage.class));
    }

    @Test
    @DisplayName("引用：引用一条已撤回的消息拒绝（1036）——正文已清空，引用块只会是空白")
    void send_shouldRejectQuoteOfRecalledMessage() {
        givenPrivateSend();
        when(notifyMessageMapper.selectQuotableMessage(ME_ID, QUOTED_KEY))
                .thenReturn(quoted(PEER_ID, PEER_ID, "", NotifyMessage.RECALL_DONE));

        assertThatThrownBy(() -> service.send(ME_ID, sendDTO(MSG_KEY, QUOTED_KEY)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_QUOTE_TARGET_INVALID.getCode());

        verify(notifyMessageMapper, never()).insert(any(NotifyMessage.class));
    }

    @Test
    @DisplayName("引用：查不到被引用消息（不在我视角内）拒绝（1036）")
    void send_shouldRejectUnknownQuoteTarget() {
        givenPrivateSend();
        when(notifyMessageMapper.selectQuotableMessage(ME_ID, QUOTED_KEY)).thenReturn(null);

        assertThatThrownBy(() -> service.send(ME_ID, sendDTO(MSG_KEY, QUOTED_KEY)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_QUOTE_TARGET_INVALID.getCode());

        verify(notifyMessageMapper, never()).insert(any(NotifyMessage.class));
    }

    @Test
    @DisplayName("引用：超长正文按码点截断到 200，不切出孤立代理（emoji 不会被截成乱码）")
    void send_shouldTruncateQuoteSnapshotByCodePoint() {
        givenPrivateSend();
        String longContent = "😀".repeat(260);
        when(notifyMessageMapper.selectQuotableMessage(ME_ID, QUOTED_KEY))
                .thenReturn(quoted(PEER_ID, PEER_ID, longContent, NotifyMessage.RECALL_NONE));

        service.send(ME_ID, sendDTO(MSG_KEY, QUOTED_KEY));

        ArgumentCaptor<NotifyMessage> rows = ArgumentCaptor.forClass(NotifyMessage.class);
        verify(notifyMessageMapper, times(2)).insert(rows.capture());
        String snapshot = rows.getAllValues().get(0).getQuoteContent();
        assertThat(snapshot.codePointCount(0, snapshot.length())).isEqualTo(200);
        // 孤立代理的特征：末位是高代理（0xD800~0xDBFF），说明 emoji 被从中间切开
        assertThat(Character.isHighSurrogate(snapshot.charAt(snapshot.length() - 1))).isFalse();
    }

    @Test
    @DisplayName("引用：被引用的是文件消息时，快照只留「名字（尺寸）」，机器可读尾注不进引用块")
    void send_shouldStripFileCardMarkersFromQuoteSnapshot() {
        givenPrivateSend();
        when(notifyMessageMapper.selectQuotableMessage(ME_ID, QUOTED_KEY))
                .thenReturn(quoted(PEER_ID, PEER_ID, MessageType.FILE_TRANSFER,
                        "季度报告.pdf（2.4 MB）\n#file:2102453724332388354\n#att:2104826682342342657",
                        NotifyMessage.RECALL_NONE));

        service.send(ME_ID, sendDTO(MSG_KEY, QUOTED_KEY));

        ArgumentCaptor<NotifyMessage> rows = ArgumentCaptor.forClass(NotifyMessage.class);
        verify(notifyMessageMapper, times(2)).insert(rows.capture());
        // 引用块直接把 quote_content 画成文本，那一行拿不到被引用消息的类型、也解析不了卡片，
        // 尾注一旦漏进快照就是永久可见的（历史行不会因为前端改版而自己变干净）
        assertThat(rows.getAllValues()).allSatisfy(row ->
                assertThat(row.getQuoteContent()).isEqualTo("季度报告.pdf（2.4 MB）"));
    }

    @Test
    @DisplayName("引用：先剥尾注再截断——尾注既不吃 200 码点配额，也不会被截成半截 ID")
    void send_shouldStripMarkersBeforeTruncatingQuoteSnapshot() {
        givenPrivateSend();
        String name = "n".repeat(180) + ".pdf";
        String card = name + "（1 KB）\n#file:2102453724332388354\n#att:2104826682342342657";
        when(notifyMessageMapper.selectQuotableMessage(ME_ID, QUOTED_KEY))
                .thenReturn(quoted(PEER_ID, PEER_ID, MessageType.FILE_TRANSFER, card,
                        NotifyMessage.RECALL_NONE));

        service.send(ME_ID, sendDTO(MSG_KEY, QUOTED_KEY));

        ArgumentCaptor<NotifyMessage> rows = ArgumentCaptor.forClass(NotifyMessage.class);
        verify(notifyMessageMapper, times(2)).insert(rows.capture());
        // 「名字（尺寸）」共 190 码点：先剥就完整留下；若不剥，两条尾注会把正文挤出 200 的配额，
        // 用户看到的引用块会以半截雪花 ID 结尾
        assertThat(rows.getAllValues()).allSatisfy(row ->
                assertThat(row.getQuoteContent()).isEqualTo(name + "（1 KB）"));
    }

    /* ======================== 夹具 ======================== */

    /** 单聊发送的公共打桩：幂等回查为空（首发）+ 对端可用。 */
    private void givenPrivateSend() {
        when(notifyMessageMapper.selectOne(any(Wrapper.class))).thenReturn(null);
        lenient().when(userLookupPort.existsActiveUser(PEER_ID)).thenReturn(true);
    }

    private static ChatSendDTO sendDTO(String clientMsgId, String quoteClientMsgId) {
        return new ChatSendDTO(ChatScope.PRIVATE, PEER_ID, MessageType.CHAT_TEXT,
                "收到，请看上面那条", clientMsgId, quoteClientMsgId, null, null);
    }

    private static NotifyMessage row(long recipientId, long senderId, long targetId) {
        NotifyMessage row = new NotifyMessage();
        row.setRecipientUserId(recipientId);
        row.setSenderUserId(senderId);
        row.setChatScope(ChatScope.PRIVATE);
        row.setChatTargetId(targetId);
        row.setClientMsgId(MSG_KEY);
        row.setMessageType(MessageType.CHAT_TEXT);
        row.setContent("发了就后悔的话");
        row.setRecallStatus(NotifyMessage.RECALL_NONE);
        row.setCreateTime(LocalDateTime.now());
        return row;
    }

    private static NotifyMessage quoted(long senderId, long targetId, String content, int recallStatus) {
        return quoted(senderId, targetId, MessageType.CHAT_TEXT, content, recallStatus);
    }

    private static NotifyMessage quoted(long senderId, long targetId, int messageType,
                                        String content, int recallStatus) {
        NotifyMessage quoted = new NotifyMessage();
        quoted.setClientMsgId(QUOTED_KEY);
        quoted.setSenderUserId(senderId);
        quoted.setChatScope(ChatScope.PRIVATE);
        quoted.setChatTargetId(targetId);
        quoted.setMessageType(messageType);
        quoted.setContent(content);
        quoted.setRecallStatus(recallStatus);
        return quoted;
    }
}
