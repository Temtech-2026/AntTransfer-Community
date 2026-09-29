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
package com.anttransfer.auth.extension;

import com.anttransfer.auth.model.entity.SysUser;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.AuthenticatedUser;
import com.anttransfer.common.spi.identity.AuthenticationRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * CE 默认身份提供方：只证明「是不是本人」，不做失败计数（那属于登录编排）。
 */
class LocalIdentityProviderTest {

    private UserMapper userMapper;
    private PasswordEncoder passwordEncoder;
    private LocalIdentityProvider provider;

    @BeforeEach
    void setUp() {
        userMapper = mock(UserMapper.class);
        passwordEncoder = mock(PasswordEncoder.class);
        provider = new LocalIdentityProvider(userMapper, passwordEncoder);
    }

    private SysUser user(long id, String username, int status) {
        SysUser user = new SysUser();
        user.setId(id);
        user.setUsername(username);
        user.setNickname("nick");
        user.setPasswordHash("$2a$10$hash");
        user.setStatus(status);
        user.setTokenEpoch(0L);
        return user;
    }

    @Test
    void supports_shouldRejectBlankUsername() {
        assertFalse(provider.supports(new AuthenticationRequest("", "pwd")));
        assertFalse(provider.supports(new AuthenticationRequest(null, "pwd")));
        assertTrue(provider.supports(new AuthenticationRequest("alice", "pwd")));
    }

    @Test
    void validCredentials_shouldReturnPrincipal() {
        SysUser user = user(1L, "alice", SysUser.STATUS_NORMAL);
        when(userMapper.selectByUsername("alice")).thenReturn(user);
        when(passwordEncoder.matches("pwd", user.getPasswordHash())).thenReturn(true);

        AuthenticatedUser principal = provider.authenticate(new AuthenticationRequest("alice", "pwd"));

        assertEquals(1L, principal.getId());
        assertEquals("alice", principal.getUsername());
    }

    @Test
    void unknownUserAndWrongPassword_shouldBeIndistinguishable() {
        when(userMapper.selectByUsername("ghost")).thenReturn(null);
        when(userMapper.selectByUsername("alice")).thenReturn(user(1L, "alice", SysUser.STATUS_NORMAL));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        AuthException unknown = assertThrows(AuthException.class,
                () -> provider.authenticate(new AuthenticationRequest("ghost", "x")));
        AuthException wrong = assertThrows(AuthException.class,
                () -> provider.authenticate(new AuthenticationRequest("alice", "x")));

        assertEquals(ErrorCode.BAD_CREDENTIALS, unknown.getErrorCode());
        assertEquals(ErrorCode.BAD_CREDENTIALS, wrong.getErrorCode());
        assertEquals(unknown.getMessage(), wrong.getMessage());
    }

    @Test
    void disabledAccount_shouldThrow1005AfterPasswordVerified() {
        SysUser disabled = user(3L, "dave", SysUser.STATUS_DISABLED);
        when(userMapper.selectByUsername("dave")).thenReturn(disabled);
        when(passwordEncoder.matches("pwd", disabled.getPasswordHash())).thenReturn(true);

        AuthException e = assertThrows(AuthException.class,
                () -> provider.authenticate(new AuthenticationRequest("dave", "pwd")));

        assertEquals(1005, e.getErrorCode().getCode());
    }

    @Test
    void lockedAccount_shouldThrow1004AndNotBeMaskedAsBadCredentials() {
        SysUser locked = user(4L, "erin", SysUser.STATUS_LOCKED);
        when(userMapper.selectByUsername("erin")).thenReturn(locked);
        when(passwordEncoder.matches("pwd", locked.getPasswordHash())).thenReturn(true);

        AuthException e = assertThrows(AuthException.class,
                () -> provider.authenticate(new AuthenticationRequest("erin", "pwd")));

        // 锁定表示「身份已确认但被拒」，编排层据此不重复计数
        assertEquals(1004, e.getErrorCode().getCode());
    }

    @Test
    void wrongPasswordOnDisabledAccount_shouldNotRevealAccountStatus() {
        SysUser disabled = user(3L, "dave", SysUser.STATUS_DISABLED);
        when(userMapper.selectByUsername("dave")).thenReturn(disabled);
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        AuthException e = assertThrows(AuthException.class,
                () -> provider.authenticate(new AuthenticationRequest("dave", "x")));

        // 口令未通过时不得泄漏账号已停用
        assertEquals(1007, e.getErrorCode().getCode());
        verify(passwordEncoder, never()).encode(anyString());
    }
}
