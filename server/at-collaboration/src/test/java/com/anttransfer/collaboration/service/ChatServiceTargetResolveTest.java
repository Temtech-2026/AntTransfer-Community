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
import com.anttransfer.collaboration.model.vo.ChatTargetVO;
import com.anttransfer.collaboration.repository.ChatPeerAliasMapper;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.SysGroupMapper;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsPresenceService;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.UserLookupPort;
import com.anttransfer.common.security.UserLookupPort.UserContact;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * {@code ChatService#resolvePrivateTarget} 的回归证据：非管理员「发起会话」的解析入口。
 *
 * <p>覆盖三件事：账号命中、账号未命中时回落用户 ID、解析不到可用用户时的错误码。
 * 另有一条专测 {@code targetId} 的过线形态——雪花 ID 必须在 JSON 里是字符串，
 * 否则前端舍入后再回传，后端只会看到「目标用户不存在」。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class ChatServiceTargetResolveTest {

    /** 19 位雪花 ID：末位精度是这一层最容易被打回的地方，用例固定取值便于比对 */
    private static final long YAO_ID = 2101964960292134914L;

    /** 端口已拼好的头像地址（含 ?v=，本层只做搬运，故直接按字面量比对） */
    private static final String YAO_AVATAR = "/api/v1/users/2101964960292134914/avatar?v=cd34.png";

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
    }

    @Test
    @DisplayName("解析：按登录账号命中可用用户，且不再按 ID 回查")
    void resolvePrivateTarget_shouldResolveByUsername() {
        when(userLookupPort.findActiveByUsername("yao"))
                .thenReturn(Optional.of(new UserContact(YAO_ID, "姚", "yao@example.com", YAO_AVATAR)));

        ChatTargetVO target = service.resolvePrivateTarget(" yao ");

        assertThat(target.targetId()).isEqualTo(YAO_ID);
        assertThat(target.displayName()).isEqualTo("姚");
        // 头像必须原样透传（前缀与 ?v= 由 UserLookupPort 实现拼好，本层只搬运不加工）
        assertThat(target.avatarUrl()).isEqualTo(YAO_AVATAR);
        verify(userLookupPort, never()).existsActiveUser(anyLong());
    }

    @Test
    @DisplayName("解析：账号未命中时回落按用户 ID 反查（管理面拿到的雪花 ID 仍可发起）")
    void resolvePrivateTarget_shouldFallbackToUserId() {
        String snowflake = String.valueOf(YAO_ID);
        when(userLookupPort.findActiveByUsername(snowflake)).thenReturn(Optional.empty());
        when(userLookupPort.existsActiveUser(YAO_ID)).thenReturn(true);
        when(userLookupPort.findContacts(List.of(YAO_ID)))
                .thenReturn(Map.of(YAO_ID, new UserContact(YAO_ID, "姚", null, null)));

        ChatTargetVO target = service.resolvePrivateTarget(snowflake);

        assertThat(target.targetId()).isEqualTo(YAO_ID);
        assertThat(target.displayName()).isEqualTo("姚");
    }

    @Test
    @DisplayName("解析：账号与 ID 都查不到可用用户 → 1013（不区分「不存在」与「不可用」）")
    void resolvePrivateTarget_shouldRejectUnknownQuery() {
        when(userLookupPort.findActiveByUsername("nobody")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resolvePrivateTarget("nobody"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_TARGET_INVALID.getCode());
        verify(userLookupPort, never()).existsActiveUser(anyLong());
    }

    @Test
    @DisplayName("解析：账号存在但不可用（禁用 / 已删除）同样落 1013")
    void resolvePrivateTarget_shouldRejectInactiveAccount() {
        String snowflake = String.valueOf(YAO_ID);
        when(userLookupPort.findActiveByUsername(snowflake)).thenReturn(Optional.empty());
        when(userLookupPort.existsActiveUser(YAO_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.resolvePrivateTarget(snowflake))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.CHAT_TARGET_INVALID.getCode());
    }

    @Test
    @DisplayName("解析：入参为空 → 2002，不打用户查询")
    void resolvePrivateTarget_shouldRejectBlankQuery() {
        assertThatThrownBy(() -> service.resolvePrivateTarget("   "))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.PARAM_MISSING.getCode());
        verifyNoInteractions(userLookupPort);
    }

    @Test
    @DisplayName("过线形态：targetId 序列化为字符串，避免 JS 端舍入 19 位雪花 ID")
    void chatTargetVO_shouldSerializeTargetIdAsString() throws Exception {
        String json = new ObjectMapper()
                .writeValueAsString(new ChatTargetVO(YAO_ID, "姚", YAO_AVATAR));

        assertThat(json).isEqualTo("{\"targetId\":\"2101964960292134914\",\"displayName\":\"姚\","
                + "\"avatarUrl\":\"/api/v1/users/2101964960292134914/avatar?v=cd34.png\"}");
    }
}
