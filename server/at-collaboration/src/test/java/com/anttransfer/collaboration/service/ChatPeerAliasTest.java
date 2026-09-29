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
import com.anttransfer.collaboration.model.entity.ChatPeerAlias;
import com.anttransfer.collaboration.model.vo.ChatPeerVO;
import com.anttransfer.collaboration.repository.ChatPeerAliasMapper;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.repository.SysGroupMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsPresenceService;
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
import org.springframework.dao.DuplicateKeyException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * {@code ChatService} 会话对端备注（{@code setPeerAlias / clearPeerAlias}）的回归证据。
 *
 * <p>备注是<b>单方面私有的覆盖名</b>：只影响设备注的人自己看到的会话名与发送人名，
 * 不改任何账号属性。用例钉住四件事：</p>
 * <ol>
 *     <li><b>写入落成一行私有记录</b>，且首尾空格被 trim（否则「张伟 」与「张伟」在界面上
 *         看起来一样、比对起来不同）；</li>
 *     <li><b>取消过的那行是被「复活」而不是插新行</b>——唯一键 {@code uk_owner_peer} 不含
 *         {@code deleted}，插新行必撞键，表现就是「取消一次之后再也设不上备注」；</li>
 *     <li><b>并发首次设置撞键时收敛</b>，不把 {@code DuplicateKeyException} 抛给用户
 *         （连点保存 / 弱网重发都会走到这条路径）；</li>
 *     <li><b>边界拒绝且不落库</b>：给自己设备注、对端不可用、备注为空白。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class ChatPeerAliasTest {

    /** 登录人（备注归属者） */
    private static final long ME_ID = 2101883116959719401L;

    /** 单聊对端 */
    private static final long PEER_ID = 2101883116959719426L;

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
                wsBroadcaster, wsPresenceService, afterCommitExecutor, properties,
                notifyMessageService);
    }

    /* ======================== 设置 / 修改 ======================== */

    @Test
    @DisplayName("首次设置：落一行「我给他起的名字」，首尾空格被 trim")
    void setPeerAlias_shouldInsertTrimmedAlias() {
        when(userLookupPort.existsActiveUser(PEER_ID)).thenReturn(true);
        when(chatPeerAliasMapper.selectAny(ME_ID, PEER_ID)).thenReturn(null);

        ChatPeerVO vo = service.setPeerAlias(ME_ID, PEER_ID, "  财务-张伟  ");

        ArgumentCaptor<ChatPeerAlias> inserted = ArgumentCaptor.forClass(ChatPeerAlias.class);
        verify(chatPeerAliasMapper).insert(inserted.capture());
        // 归属者取自登录态而不是入参：调用方无法替别人设备注
        assertThat(inserted.getValue().getOwnerUserId()).isEqualTo(ME_ID);
        assertThat(inserted.getValue().getPeerUserId()).isEqualTo(PEER_ID);
        assertThat(inserted.getValue().getAlias()).isEqualTo("财务-张伟");
        assertThat(vo.alias()).isEqualTo("财务-张伟");
    }

    @Test
    @DisplayName("改备注：就地更新那一行（复活），不再插第二行")
    void setPeerAlias_shouldReviveExistingRowInsteadOfInserting() {
        when(userLookupPort.existsActiveUser(PEER_ID)).thenReturn(true);
        // 这一行可能是「取消过」的（deleted=1）：唯一键不含 deleted，插新行必撞键
        when(chatPeerAliasMapper.selectAny(ME_ID, PEER_ID))
                .thenReturn(aliasRow(7L, "旧备注"));

        service.setPeerAlias(ME_ID, PEER_ID, "新备注");

        verify(chatPeerAliasMapper).revive(7L, "新备注", ME_ID);
        verify(chatPeerAliasMapper, never()).insert(any(ChatPeerAlias.class));
    }

    @Test
    @DisplayName("并发首次设置撞唯一键：按 (我, 他) 当前读更新收敛，不把重复键抛给用户")
    void setPeerAlias_shouldFallBackToUpdateWhenInsertRaces() {
        when(userLookupPort.existsActiveUser(PEER_ID)).thenReturn(true);
        // 首次查为空之后对手才提交，于是本事务快照里始终「没有这一行」（REPEATABLE READ）——
        // 收敛必须靠不依赖快照的条件 UPDATE，而不是再 selectAny 一次（真库里那样做会失效）
        when(chatPeerAliasMapper.selectAny(ME_ID, PEER_ID)).thenReturn(null);
        when(chatPeerAliasMapper.insert(any(ChatPeerAlias.class)))
                .thenThrow(new DuplicateKeyException("uk_owner_peer"));
        when(chatPeerAliasMapper.reviveByOwnerPeer(ME_ID, PEER_ID, "财务-张伟", ME_ID)).thenReturn(1);

        ChatPeerVO vo = service.setPeerAlias(ME_ID, PEER_ID, "财务-张伟");

        verify(chatPeerAliasMapper).reviveByOwnerPeer(ME_ID, PEER_ID, "财务-张伟", ME_ID);
        assertThat(vo.alias()).isEqualTo("财务-张伟");
    }

    @Test
    @DisplayName("撞键时那一行确实不存在：原样抛出，不假装成功")
    void setPeerAlias_shouldRethrowWhenRacedRowVanishes() {
        when(userLookupPort.existsActiveUser(PEER_ID)).thenReturn(true);
        when(chatPeerAliasMapper.selectAny(ME_ID, PEER_ID)).thenReturn(null);
        when(chatPeerAliasMapper.insert(any(ChatPeerAlias.class)))
                .thenThrow(new DuplicateKeyException("uk_owner_peer"));
        // 条件更新影响 0 行说明那一行真的不存在（对手回滚了）：静默成功会让用户以为备注生效了
        when(chatPeerAliasMapper.reviveByOwnerPeer(ME_ID, PEER_ID, "财务-张伟", ME_ID)).thenReturn(0);

        assertThatThrownBy(() -> service.setPeerAlias(ME_ID, PEER_ID, "财务-张伟"))
                .isInstanceOf(DuplicateKeyException.class);
    }

    /* ======================== 边界 ======================== */

    @Test
    @DisplayName("给自己设备注：1013 拒绝，且不落库")
    void setPeerAlias_shouldRejectSelf() {
        assertThatThrownBy(() -> service.setPeerAlias(ME_ID, ME_ID, "我自己"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_TARGET_INVALID.getCode());

        verifyNoInteractions(chatPeerAliasMapper);
    }

    @Test
    @DisplayName("对端不存在 / 已停用：1013 拒绝，且不落库")
    void setPeerAlias_shouldRejectUnavailablePeer() {
        when(userLookupPort.existsActiveUser(PEER_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.setPeerAlias(ME_ID, PEER_ID, "财务-张伟"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_TARGET_INVALID.getCode());

        verify(chatPeerAliasMapper, never()).insert(any(ChatPeerAlias.class));
        verify(chatPeerAliasMapper, never()).revive(any(), any(), any());
    }

    @Test
    @DisplayName("备注为空白：2001 拒绝，且不查对端、不落库")
    void setPeerAlias_shouldRejectBlankAlias() {
        // 请求体的 @NotBlank 已拦一次；服务层再拦一次，防绕过（例如内部调用）
        assertThatThrownBy(() -> service.setPeerAlias(ME_ID, PEER_ID, "   "))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.PARAM_ERROR.getCode());

        verifyNoInteractions(userLookupPort, chatPeerAliasMapper);
    }

    /* ======================== 取消 ======================== */

    @Test
    @DisplayName("取消备注：逻辑删除该行，并回报「现在没有备注」")
    void clearPeerAlias_shouldSoftDeleteAndReportNull() {
        ChatPeerVO vo = service.clearPeerAlias(ME_ID, PEER_ID);

        verify(chatPeerAliasMapper).delete(any());
        assertThat(vo.alias()).isNull();
        assertThat(vo.peerId()).isEqualTo(PEER_ID);
    }

    @Test
    @DisplayName("取消备注：本来就没设备注也成功（幂等，不校验对端存在性）")
    void clearPeerAlias_shouldBeIdempotentWhenNothingWasSet() {
        // delete 影响 0 行是正常结果：期望终态（没有备注）已经达成，不该报错
        ChatPeerVO vo = service.clearPeerAlias(ME_ID, PEER_ID);

        verify(chatPeerAliasMapper).delete(any());
        verifyNoInteractions(userLookupPort);
        assertThat(vo.alias()).isNull();
    }

    /* ======================== 夹具 ======================== */

    private static ChatPeerAlias aliasRow(long id, String alias) {
        ChatPeerAlias row = new ChatPeerAlias();
        row.setId(id);
        row.setOwnerUserId(ME_ID);
        row.setPeerUserId(PEER_ID);
        row.setAlias(alias);
        return row;
    }
}
