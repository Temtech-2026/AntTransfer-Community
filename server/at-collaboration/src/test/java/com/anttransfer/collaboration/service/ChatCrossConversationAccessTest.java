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

import com.anttransfer.collaboration.MybatisPlusTestSupport;
import com.anttransfer.collaboration.config.NotifyProperties;
import com.anttransfer.collaboration.model.dto.ChatSendDTO;
import com.anttransfer.collaboration.model.entity.NotifyMessage;
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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 越权用例 TC-H-05 / TC-H-06「读写他人协作会话」的可执行载体。
 *
 * <p>群会话的 ID 是公开可猜的（入群邀请、历史消息、前端路由里到处都有），因此成员关系是
 * <b>唯一</b>的访问边界。这里钉死两个方向：</p>
 * <ul>
 *   <li><b>读</b>（{@code history}）：非成员必须 1012，而且<b>一次查询都不发生</b>。
 *       若实现先按 {@code (recipient, scope, target)} 查出消息、再判断成员身份，异常虽然一样，
 *       但「查过」这件事本身已经让用例失去意义——将来任何一处提前 return 就会变成实际泄露；
 *       故断言 {@code selectList} 从未被调用，把「先判权限、后取数」的顺序固定下来。</li>
 *   <li><b>写</b>（{@code send}）：非成员必须 1012，且<b>一行都不落库、一帧都不推送</b>。
 *       写扩散的落库是按接收人逐行插入的，一旦在校验之后才发现不该发，脏数据就已经进了
 *       别人的未读列表；推送同理，撤回推送无法抹掉已到达客户端的帧。</li>
 * </ul>
 *
 * <p>反向也要守：单聊不该去查群成员表——否则「群成员表里没有这条记录」会被误判成越权，
 * 把正常单聊打成 1012。故单聊用例反向断言「未触碰群成员表」。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class ChatCrossConversationAccessTest {

    private static final long ME_ID = 2101964960292134914L;
    private static final long OUTSIDER_ID = 2101964960292134915L;
    private static final long GROUP_ID = 2101964960292134916L;
    private static final long PEER_ID = 2101964960292134917L;
    private static final String CONTENT = "在吗";
    private static final String CLIENT_MSG_ID = "c-0001";

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
        MybatisPlusTestSupport.initTableInfo();
        service = new ChatService(notifyMessageMapper, groupMemberMapper, sysGroupMapper,
                chatPeerAliasMapper, userLookupPort,
                wsBroadcaster, wsPresenceService, afterCommitExecutor, properties, notifyMessageService);
        // 正文上限与分页上限来自配置：mock 下默认 0，不打桩会把失焦在「内容超长 / 分页为 0」上
        lenient().when(properties.getContentMaxLength()).thenReturn(1000);
        lenient().when(properties.getChatHistoryLimit()).thenReturn(50);
    }

    private ChatSendDTO groupSend() {
        return new ChatSendDTO(ChatScope.GROUP, GROUP_ID, MessageType.CHAT_TEXT,
                CONTENT, CLIENT_MSG_ID, null, null, null);
    }

    /* ============================ 读：拉取群历史 ============================ */

    @Test
    @DisplayName("TC-H-05 非群成员拉群历史：1012，且一条消息都不去查（先判权限、后取数）")
    void history_groupWithoutMembership_isRejectedBeforeQuerying() {
        when(groupMemberMapper.countMember(GROUP_ID, OUTSIDER_ID)).thenReturn(0);

        assertThatThrownBy(() -> service.history(OUTSIDER_ID, ChatScope.GROUP, GROUP_ID, null, 20))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_NOT_GROUP_MEMBER);

        // 若实现改成「查出来再过滤」，这里立刻变红：越权读通道的载体就是这次查询
        verify(notifyMessageMapper, never()).selectList(any());
    }

    @Test
    @DisplayName("TC-H-05 群成员拉历史：放行（防「一律 1012」的假通过）")
    void history_groupWithMembership_isAllowed() {
        when(groupMemberMapper.countMember(GROUP_ID, ME_ID)).thenReturn(1);
        when(notifyMessageMapper.selectList(any())).thenReturn(java.util.List.of());

        assertThat(service.history(ME_ID, ChatScope.GROUP, GROUP_ID, null, 20)).isEmpty();
        verify(notifyMessageMapper).selectList(any());
    }

    @Test
    @DisplayName("TC-H-05 单聊拉历史：不查群成员表（否则正常单聊会被误判成越权 1012）")
    void history_privateScope_neverConsultsGroupMembership() {
        when(notifyMessageMapper.selectList(any())).thenReturn(java.util.List.of());

        assertThat(service.history(ME_ID, ChatScope.PRIVATE, PEER_ID, null, 20)).isEmpty();
        verifyNoInteractions(groupMemberMapper);
    }

    /* ============================ 写：向群发消息 ============================ */

    @Test
    @DisplayName("TC-H-06 非群成员向群发消息：1012，且一行不落库、一帧不推送")
    void send_toGroupWithoutMembership_persistsAndPushesNothing() {
        when(groupMemberMapper.countMember(GROUP_ID, OUTSIDER_ID)).thenReturn(0);

        assertThatThrownBy(() -> service.send(OUTSIDER_ID, groupSend()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_NOT_GROUP_MEMBER);

        // 写扩散是逐接收人 insert：校验若晚于落库，脏数据已经进了别人的未读列表
        verify(notifyMessageMapper, never()).insert(any(NotifyMessage.class));
        verify(wsBroadcaster, never()).push(anyLong(), any());
    }

    @Test
    @DisplayName("TC-H-06 单聊发给不可用账号：1071，不落库（含已禁用 / 已注销）")
    void send_privateToUnavailableUser_isRejectedWithoutPersisting() {
        when(userLookupPort.existsActiveUser(PEER_ID)).thenReturn(false);

        ChatSendDTO dto = new ChatSendDTO(ChatScope.PRIVATE, PEER_ID, MessageType.CHAT_TEXT,
                CONTENT, CLIENT_MSG_ID, null, null, null);

        assertThatThrownBy(() -> service.send(ME_ID, dto))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CHAT_TARGET_INVALID);

        verify(notifyMessageMapper, never()).insert(any(NotifyMessage.class));
    }
}
