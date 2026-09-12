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
package com.anttransfer.auth.service;

import com.anttransfer.auth.config.AuthProperties;
import com.anttransfer.auth.model.vo.AuthVos.TokenResponse;
import com.anttransfer.auth.model.entity.SysUser;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.auth.security.JwtTokenProvider;
import com.anttransfer.common.exception.AuthException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link AuthService} 单测：登录锁定阈值 / 状态校验 / 令牌签发。
 */
class AuthServiceTest {

    private UserMapper userMapper;
    private PasswordEncoder passwordEncoder;
    private LoginAttemptService attemptService;
    private TokenSessionService sessionService;
    private AuthService authService;
    private AuthProperties properties;

    @BeforeEach
    void setUp() {
        userMapper = mock(UserMapper.class);
        passwordEncoder = mock(PasswordEncoder.class);
        sessionService = mock(TokenSessionService.class);
        attemptService = mock(LoginAttemptService.class);

        AuthProperties props = new AuthProperties();
        props.setAccessTokenSecret("unit-test-secret-0123456789-abcdefghijklmnop");
        props.setAccessTokenTtl(Duration.ofMinutes(30));
        props.setRefreshTokenTtl(Duration.ofDays(7));
        props.setLoginFailThreshold(5);
        props.setLoginLockDuration(Duration.ofMinutes(15));
        properties = props;

        authService = new AuthService(
                userMapper,
                passwordEncoder,
                new JwtTokenProvider(props),
                sessionService,
                attemptService,
                props);
    }

    private SysUser normalUser(long id, String username) {
        SysUser user = new SysUser();
        user.setId(id);
        user.setUsername(username);
        user.setPasswordHash("$2a$10$hash");
        user.setNickname("n");
        user.setStatus(SysUser.STATUS_NORMAL);
        user.setTokenEpoch(3L);
        return user;
    }

    @Test
    void loginSuccess_shouldIssueTokensAndResetFailureCounter() {
        SysUser user = normalUser(1L, "alice");
        when(userMapper.selectByUsername("alice")).thenReturn(user);
        when(passwordEncoder.matches("pwd", user.getPasswordHash())).thenReturn(true);
        when(attemptService.isLocked("alice")).thenReturn(false);
        when(userMapper.selectRoleCodes(1L)).thenReturn(java.util.List.of("USER"));

        TokenResponse response = authService.login(" alice ", "pwd");

        assertNotNull(response.accessToken());
        assertNotNull(response.refreshToken());
        assertEquals("Bearer", response.tokenType());
        verify(attemptService).reset("alice");
        verify(sessionService).openSession(eq(1L), eq(3L), anyString());
    }

    @Test
    void wrongPassword_shouldRecordFailure() {
        when(userMapper.selectByUsername("bob")).thenReturn(normalUser(2L, "bob"));
        when(passwordEncoder.matches("bad", "$2a$10$hash")).thenReturn(false);
        when(attemptService.isLocked("bob")).thenReturn(false);
        when(attemptService.recordFailure("bob")).thenReturn(false);

        AuthException e = assertThrows(AuthException.class, () -> authService.login("bob", "bad"));
        assertEquals(1007, e.getErrorCode().getCode());
        verify(sessionService, never()).openSession(any(), anyLong(), anyString());
    }

    @Test
    void reachThreshold_shouldThrowAccountLocked() {
        when(userMapper.selectByUsername("bob")).thenReturn(normalUser(2L, "bob"));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);
        when(attemptService.isLocked("bob")).thenReturn(false);
        // 第 5 次失败触发锁定
        when(attemptService.recordFailure("bob")).thenReturn(true);

        AuthException e = assertThrows(AuthException.class, () -> authService.login("bob", "x"));
        assertEquals(1005, e.getErrorCode().getCode());
    }

    @Test
    void alreadyLocked_shouldRejectWithoutTouchingPassword() {
        when(attemptService.isLocked("carol")).thenReturn(true);

        AuthException e = assertThrows(AuthException.class, () -> authService.login("carol", "x"));
        assertEquals(1005, e.getErrorCode().getCode());
        verify(userMapper, never()).selectByUsername("carol");
    }

    @Test
    void disabledUser_shouldThrowAccountDisabledWithoutCounting() {
        SysUser disabled = normalUser(3L, "dave");
        disabled.setStatus(SysUser.STATUS_DISABLED);
        when(userMapper.selectByUsername("dave")).thenReturn(disabled);
        when(passwordEncoder.matches("pwd", "$2a$10$hash")).thenReturn(true);
        when(attemptService.isLocked("dave")).thenReturn(false);

        AuthException e = assertThrows(AuthException.class, () -> authService.login("dave", "pwd"));
        assertEquals(1006, e.getErrorCode().getCode());
        verify(attemptService, never()).recordFailure("dave");
    }

    @Test
    void unknownUser_shouldNotRevealExistenceAndCountFailure() {
        when(userMapper.selectByUsername("ghost")).thenReturn(null);
        when(attemptService.isLocked("ghost")).thenReturn(false);
        when(attemptService.recordFailure("ghost")).thenReturn(false);

        AuthException e = assertThrows(AuthException.class, () -> authService.login("ghost", "x"));
        assertEquals(1007, e.getErrorCode().getCode());
        verify(attemptService, times(1)).recordFailure("ghost");
    }
}
