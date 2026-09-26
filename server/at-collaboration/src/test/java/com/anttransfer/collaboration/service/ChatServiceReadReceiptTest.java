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
import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.anttransfer.collaboration.model.vo.ChatReaderVO;
import com.anttransfer.collaboration.model.vo.NotifyMessageVO;
import com.anttransfer.collaboration.repository.ChatReadRow;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.SysGroupMapper;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsPresenceService;
import com.anttransfer.common.notify.ChatScope;
import com.anttransfer.common.notify.MessageType;
import com.anttransfer.common.notify.NotifyType;
import com.anttransfer.common.security.UserLookupPort;
import com.anttransfer.common.security.UserLookupPort.UserContact;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@code ChatService#history} 的已读回执回归证据：「谁读过我发的这条」。
 *
 * <p>这一块最容易错的是<b>镜像行的定位方向</b>：单聊里「我发给 B」那一步在 B 那里落的是
 * {@code (recipient=B, sender=我, chat_target_id=我)}——target 指回发送人自己；
 * 群聊里所有行的 target 都是群 ID。选错方向不会报错，只会得到「永远没有已读」，
 * 故用例把两个方向的 target 都钉住。</p>
 *
 * <p>第二条容易被误用的是 {@code readStatus}：发送人自己那一行落库即置读，
 * 于是「我发的消息」在该字段上恒为已读。用例里特意让「我发的」行 {@code readStatus = 1}，
 * 断言回执<b>只</b>来自镜像行（否则本字段就成了「自己读了自己的消息」的假回执）。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class ChatServiceReadReceiptTest {

    /** 19 位雪花 ID：末位精度是最容易被打回的地方，用例固定取值便于比对 */
    private static final long ME_ID = 2101964960292134914L;
    private static final long PEER_ID = 2101964960292134915L;
    private static final long GROUP_ID = 2101964960292134916L;
    private static final long OTHER_MEMBER_ID = 2101964960292134917L;

    /** 端口已拼好的对端头像地址（含 ?v=，本层只做搬运，故直接按字面量比对） */
    private static final String PEER_AVATAR = "/api/v1/users/2101964960292134915/avatar?v=ab12.png";

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
                wsBroadcaster, wsPresenceService, afterCommitExecutor, properties, notifyMessageService);
        // 共享打桩用 lenient：纯序列化用例不碰 service，严格模式会把它当成无用打桩误报
        lenient().when(properties.getChatHistoryLimit()).thenReturn(50);
    }

    @Test
    @DisplayName("单聊：镜像 target 是我自己（不是对端），读者按消息挂在 readers 上")
    void history_shouldAttachPrivateReaders() {
        when(notifyMessageMapper.selectList(any())).thenReturn(List.of(mine("c-1"), theirs("c-2")));
        when(notifyMessageMapper.selectReadReceipts(eq(ME_ID), eq(ChatScope.PRIVATE), eq(ME_ID), any()))
                .thenReturn(List.of(readRow("c-1", PEER_ID, ME_ID, ChatScope.PRIVATE, PEER_ID)));
        when(userLookupPort.findContacts(any()))
                .thenReturn(Map.of(PEER_ID, new UserContact(PEER_ID, "姚", null, PEER_AVATAR)));

        List<NotifyMessageVO> history = service.history(ME_ID, ChatScope.PRIVATE, PEER_ID, null, 20);

        assertThat(history.get(0).readers())
                .singleElement()
                .satisfies(reader -> {
                    assertThat(reader.userId()).isEqualTo(PEER_ID);
                    assertThat(reader.displayName()).isEqualTo("姚");
                    assertThat(reader.avatarUrl()).isEqualTo(PEER_AVATAR);
                });
        // 别人发的消息不带回执：我的 read_status 只代表我自己读没读，与「谁读了我的」无关
        assertThat(history.get(1).readers()).isEmpty();
        assertThat(history.get(0).readers()).isNotNull();
    }

    @Test
    @DisplayName("单聊：只把「我发的」消息的 clientMsgId 交给回执查询，不查别人的消息")
    void history_shouldQueryReceiptsOnlyForOwnMessages() {
        when(notifyMessageMapper.selectList(any())).thenReturn(List.of(theirs("c-2"), mine("c-1")));
        when(notifyMessageMapper.selectReadReceipts(anyLong(), anyInt(), anyLong(), any()))
                .thenReturn(List.of());

        service.history(ME_ID, ChatScope.PRIVATE, PEER_ID, null, 20);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<String>> captor = ArgumentCaptor.forClass(Collection.class);
        verify(notifyMessageMapper).selectReadReceipts(eq(ME_ID), eq(ChatScope.PRIVATE), eq(ME_ID), captor.capture());
        assertThat(captor.getValue()).containsExactly("c-1");
    }

    @Test
    @DisplayName("群聊：镜像 target 是群 ID，一条消息可以挂多位读者（顺序按行 id）")
    void history_shouldAttachGroupReaders() {
        when(groupMemberMapper.countMember(GROUP_ID, ME_ID)).thenReturn(1);
        when(notifyMessageMapper.selectList(any())).thenReturn(List.of(mine("c-1")));
        when(notifyMessageMapper.selectReadReceipts(eq(ME_ID), eq(ChatScope.GROUP), eq(GROUP_ID), any()))
                .thenReturn(List.of(
                        readRow("c-1", PEER_ID, ME_ID, ChatScope.GROUP, GROUP_ID),
                        readRow("c-1", OTHER_MEMBER_ID, ME_ID, ChatScope.GROUP, GROUP_ID)));
        when(userLookupPort.findContacts(any())).thenReturn(Map.of(
                PEER_ID, new UserContact(PEER_ID, "姚", null, PEER_AVATAR),
                OTHER_MEMBER_ID, new UserContact(OTHER_MEMBER_ID, "Admin", null, null)));

        List<NotifyMessageVO> history = service.history(ME_ID, ChatScope.GROUP, GROUP_ID, null, 20);

        assertThat(history.get(0).readers())
                .extracting(ChatReaderVO::displayName)
                .containsExactly("姚", "Admin");
    }

    @Test
    @DisplayName("读者已不在用户目录：丢弃该条回执（头像画不出名字），其余读者照常返回")
    void history_shouldDropUnresolvableReader() {
        when(groupMemberMapper.countMember(GROUP_ID, ME_ID)).thenReturn(1);
        when(notifyMessageMapper.selectList(any())).thenReturn(List.of(mine("c-1")));
        when(notifyMessageMapper.selectReadReceipts(eq(ME_ID), eq(ChatScope.GROUP), eq(GROUP_ID), any()))
                .thenReturn(List.of(
                        readRow("c-1", PEER_ID, ME_ID, ChatScope.GROUP, GROUP_ID),
                        readRow("c-1", OTHER_MEMBER_ID, ME_ID, ChatScope.GROUP, GROUP_ID)));
        // 目录里只剩一位：另一位账号已注销
        when(userLookupPort.findContacts(any()))
                .thenReturn(Map.of(PEER_ID, new UserContact(PEER_ID, "姚", null, PEER_AVATAR)));

        List<NotifyMessageVO> history = service.history(ME_ID, ChatScope.GROUP, GROUP_ID, null, 20);

        assertThat(history.get(0).readers()).extracting(ChatReaderVO::userId).containsExactly(PEER_ID);
    }

    @Test
    @DisplayName("本页没有任何我发的消息：不打回执查询，readers 归一为空列表而非 null")
    void history_shouldSkipReceiptQueryWhenNothingMine() {
        when(notifyMessageMapper.selectList(any())).thenReturn(List.of(theirs("c-2")));

        List<NotifyMessageVO> history = service.history(ME_ID, ChatScope.PRIVATE, PEER_ID, null, 20);

        verify(notifyMessageMapper, never()).selectReadReceipts(anyLong(), anyInt(), anyLong(), any());
        assertThat(history.get(0).readers()).isNotNull().isEmpty();
    }

    @Test
    @DisplayName("过线形态：readers 里的 userId 序列化为字符串，发送人姓名与头像原样带出")
    void notifyMessageVO_shouldSerializeReaderIdAsString() throws Exception {
        NotifyMessageVO vo = NotifyMessageVO.from(mine("c-1"),
                List.of(new ChatReaderVO(PEER_ID, "姚", PEER_AVATAR)), "我", PEER_AVATAR);

        String json = new ObjectMapper().writeValueAsString(vo);

        assertThat(json).contains("\"readers\":[{\"userId\":\"2101964960292134915\",\"displayName\":\"姚\","
                + "\"avatarUrl\":\"" + PEER_AVATAR + "\"}]");
        // 发送人身份必须真的出现在载荷里：漏了不会报错，只会让收端气泡头像静默退回首字符兜底
        assertThat(json).contains("\"senderDisplayName\":\"我\"");
        assertThat(json).contains("\"senderAvatarUrl\":\"" + PEER_AVATAR + "\"");
    }

    /* ------------------------------------------------------------------ 造数 */

    /** 我发的消息：自己那一行落库即已读（readStatus = 1 是「我自己读了」，不是「对方读了」） */
    private NotifyMessage mine(String clientMsgId) {
        NotifyMessage message = new NotifyMessage();
        message.setId(100L);
        message.setNotifyType(NotifyType.IM_PRIVATE);
        message.setMessageType(MessageType.CHAT_TEXT);
        message.setChatScope(ChatScope.PRIVATE);
        message.setChatTargetId(PEER_ID);
        message.setSenderUserId(ME_ID);
        message.setRecipientUserId(ME_ID);
        message.setClientMsgId(clientMsgId);
        message.setContent("在吗");
        message.setReadStatus(NotifyMessage.READ_READ);
        return message;
    }

    /** 别人发的消息：recipient = 我，sender = 对方 */
    private NotifyMessage theirs(String clientMsgId) {
        NotifyMessage message = new NotifyMessage();
        message.setId(101L);
        message.setNotifyType(NotifyType.IM_PRIVATE);
        message.setMessageType(MessageType.CHAT_TEXT);
        message.setChatScope(ChatScope.PRIVATE);
        message.setChatTargetId(PEER_ID);
        message.setSenderUserId(PEER_ID);
        message.setRecipientUserId(ME_ID);
        message.setClientMsgId(clientMsgId);
        message.setContent("在的");
        message.setReadStatus(NotifyMessage.READ_UNREAD);
        return message;
    }

    private ChatReadRow readRow(String clientMsgId, Long readerId, Long senderId, int scope, Long targetId) {
        ChatReadRow row = new ChatReadRow();
        row.setClientMsgId(clientMsgId);
        row.setReaderUserId(readerId);
        row.setSenderUserId(senderId);
        row.setChatScope(scope);
        row.setChatTargetId(targetId);
        return row;
    }
}
