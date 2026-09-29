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
import com.anttransfer.auth.extension.IdentityProviderChain;
import com.anttransfer.auth.extension.LocalIdentityProvider;
import com.anttransfer.auth.model.LoginUser;
import com.anttransfer.auth.model.dto.AuthDtos.ChangePasswordRequest;
import com.anttransfer.auth.model.vo.AuthVos.TokenResponse;
import com.anttransfer.auth.model.entity.SysUser;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.auth.security.JwtTokenProvider;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.security.AuthenticatedUser;
import com.anttransfer.common.spi.identity.AuthenticationRequest;
import com.anttransfer.common.spi.identity.IdentityProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * {@link AuthService} 单测：登录锁定阈值 / 状态校验 / 令牌签发 / 本人自助改密。
 */
class AuthServiceTest {

    private UserMapper userMapper;
    private PasswordEncoder passwordEncoder;
    private LoginAttemptService attemptService;
    private TokenSessionService sessionService;
    private AuthAuditLogger auditLogger;
    private AuthService authService;
    private AuthProperties properties;

    @BeforeEach
    void setUp() {
        userMapper = mock(UserMapper.class);
        passwordEncoder = mock(PasswordEncoder.class);
        sessionService = mock(TokenSessionService.class);
        attemptService = mock(LoginAttemptService.class);
        auditLogger = mock(AuthAuditLogger.class);

        AuthProperties props = new AuthProperties();
        props.setAccessTokenSecret("unit-test-secret-0123456789-abcdefghijklmnop");
        props.setAccessTokenTtl(Duration.ofMinutes(30));
        props.setRefreshTokenTtl(Duration.ofDays(7));
        props.setLoginFailThreshold(5);
        props.setLoginLockDuration(Duration.ofMinutes(15));
        properties = props;

        // 装配真实的 CE 身份源链（本地账号 + BCrypt），使编排测试同时覆盖 SPI 接缝：
        // 身份源只负责「证明是不是本人」，失败计数 / 锁定 / 令牌签发仍由 AuthService 负责
        IdentityProviderChain chain = new IdentityProviderChain(
                List.of(new LocalIdentityProvider(userMapper, passwordEncoder)));

        authService = new AuthService(
                userMapper,
                passwordEncoder,
                new JwtTokenProvider(props),
                sessionService,
                attemptService,
                props,
                auditLogger,
                chain);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    /** 把当前线程伪装成已通过 JwtAuthenticationFilter 的登录态（改密依赖 SecurityUtils 取 userId）。 */
    private void loginAs(Long userId, String username) {
        LoginUser principal = new LoginUser();
        principal.setId(userId);
        principal.setUsername(username);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
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
        when(userMapper.selectById(1L)).thenReturn(user);
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
        assertEquals(1004, e.getErrorCode().getCode());
    }

    @Test
    void alreadyLocked_shouldRejectWithoutTouchingPassword() {
        when(attemptService.isLocked("carol")).thenReturn(true);

        AuthException e = assertThrows(AuthException.class, () -> authService.login("carol", "x"));
        assertEquals(1004, e.getErrorCode().getCode());
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
        assertEquals(1005, e.getErrorCode().getCode());
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

    @Test
    void customIdentityProvider_shouldAuthenticateAndLoadAuthoritativeLocalRow() {
        // EE 场景：企业身份源认领 alice@corp.example，CE 本地口令链路完全不参与
        SysUser user = normalUser(7L, "sso-user");
        when(attemptService.isLocked("alice@corp.example")).thenReturn(false);
        when(userMapper.selectById(7L)).thenReturn(user);
        when(userMapper.selectRoleCodes(7L)).thenReturn(List.of("USER"));

        IdentityProvider enterprise = new IdentityProvider() {
            @Override
            public String providerId() {
                return "test-enterprise";
            }

            @Override
            public boolean supports(AuthenticationRequest request) {
                return request.username().endsWith("@corp.example");
            }

            @Override
            public AuthenticatedUser authenticate(AuthenticationRequest request) {
                LoginUser principal = new LoginUser();
                principal.setId(7L);
                principal.setUsername("sso-user");
                return principal;
            }
        };
        AuthService ssoService = new AuthService(userMapper, passwordEncoder, new JwtTokenProvider(properties),
                sessionService, attemptService, properties, auditLogger,
                new IdentityProviderChain(List.of(enterprise)));

        TokenResponse response = ssoService.login("alice@corp.example", "whatever");

        assertNotNull(response.accessToken());
        // 换身份源不得触碰本地口令校验，也不得回落到本地账号查询
        verify(passwordEncoder, never()).matches(anyString(), anyString());
        verify(userMapper, never()).selectByUsername(anyString());
        // 但令牌与角色仍取本地权威行
        verify(sessionService).openSession(eq(7L), eq(3L), anyString());
    }

    @Test
    void changePassword_success_shouldRotateHashRevokeAllSessionsAndAudit() {
        loginAs(1L, "alice");
        SysUser user = normalUser(1L, "alice");
        when(userMapper.selectById(1L)).thenReturn(user);
        when(passwordEncoder.matches("OldPass123", user.getPasswordHash())).thenReturn(true);
        when(passwordEncoder.encode("NewPass456")).thenReturn("$2a$10$new");
        when(userMapper.updatePassword(eq(1L), eq("$2a$10$new"), eq(1L))).thenReturn(1);

        authService.changePassword(new ChangePasswordRequest("OldPass123", "NewPass456"));

        verify(userMapper).updatePassword(1L, "$2a$10$new", 1L);
        // 改密必须全端吊销（含发起请求的当前会话），否则「口令泄露后自救」是假的
        verify(sessionService).revokeAllInCurrentTransaction(1L);
        verify(auditLogger).success(eq(OperationLog.ACTION_PASSWORD_CHANGE),
                eq(OperationLog.TARGET_USER), eq(1L), anyMap());
    }

    @Test
    void changePassword_wrongOldPassword_shouldThrow1029AndChangeNothing() {
        loginAs(1L, "alice");
        SysUser user = normalUser(1L, "alice");
        when(userMapper.selectById(1L)).thenReturn(user);
        when(passwordEncoder.matches("bad-old", user.getPasswordHash())).thenReturn(false);

        BusinessException e = assertThrows(BusinessException.class,
                () -> authService.changePassword(new ChangePasswordRequest("bad-old", "NewPass456")));

        assertEquals(1029, e.getCode());
        verify(userMapper, never()).updatePassword(anyLong(), anyString(), anyLong());
        verify(sessionService, never()).revokeAllInCurrentTransaction(anyLong());
        verifyNoInteractions(auditLogger);
    }

    @Test
    void changePassword_weakOrReusedPassword_shouldThrow1030AndNotRevoke() {
        loginAs(1L, "alice");
        SysUser user = normalUser(1L, "alice");
        when(userMapper.selectById(1L)).thenReturn(user);
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        // 长度不足
        BusinessException tooShort = assertThrows(BusinessException.class,
                () -> authService.changePassword(new ChangePasswordRequest("OldPass123", "Ab1")));
        assertEquals(1030, tooShort.getCode());
        // 缺数字
        BusinessException noDigit = assertThrows(BusinessException.class,
                () -> authService.changePassword(new ChangePasswordRequest("OldPass123", "OnlyLetters")));
        assertEquals(1030, noDigit.getCode());
        // 与原口令相同
        BusinessException sameAsOld = assertThrows(BusinessException.class,
                () -> authService.changePassword(new ChangePasswordRequest("OldPass123", "OldPass123")));
        assertEquals(1030, sameAsOld.getCode());

        // 三次违规都不得留下任何副作用（不落库、不吊销、不记成功审计）
        verify(userMapper, never()).updatePassword(anyLong(), anyString(), anyLong());
        verify(sessionService, never()).revokeAllInCurrentTransaction(anyLong());
        verifyNoInteractions(auditLogger);
    }

    @Test
    void changePassword_disabledAccount_shouldThrow1005BeforeVerifyingOldPassword() {
        loginAs(3L, "dave");
        SysUser disabled = normalUser(3L, "dave");
        disabled.setStatus(SysUser.STATUS_DISABLED);
        when(userMapper.selectById(3L)).thenReturn(disabled);

        AuthException e = assertThrows(AuthException.class,
                () -> authService.changePassword(new ChangePasswordRequest("OldPass123", "NewPass456")));

        assertEquals(1005, e.getErrorCode().getCode());
        verify(passwordEncoder, never()).matches(anyString(), anyString());
        verify(sessionService, never()).revokeAllInCurrentTransaction(anyLong());
    }
}
