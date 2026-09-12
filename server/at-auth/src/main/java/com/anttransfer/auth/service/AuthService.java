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
import com.anttransfer.auth.model.vo.AuthVos.UserSummary;
import com.anttransfer.auth.model.entity.SysUser;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.auth.security.JwtTokenProvider;
import com.anttransfer.auth.security.SecurityUtils;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 认证编排：登录 / 刷新 / 登出 / 我的信息。
 *
 * <p>安全要点：</p>
 * <ul>
 *     <li>失败信息统一收敛：账号不存在与密码错误都返回 {@code 1007}，不暴露账号是否存在；</li>
 *     <li>校验失败逐次 Redis 计数，达阈值（默认 5 次）锁定 15 min（{@link LoginAttemptService}）；</li>
 *     <li>密码散列采用 BCrypt（cost=10），与 V2 初始 admin 密文一致；</li>
 *     <li>refresh 轮换失败（旧令牌被复用）视为疑似被盗，触发全端吊销并要求重新登录。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@Service
public class AuthService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final TokenSessionService sessionService;
    private final LoginAttemptService attemptService;
    private final AuthProperties properties;

    public AuthService(UserMapper userMapper,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider tokenProvider,
                       TokenSessionService sessionService,
                       LoginAttemptService attemptService,
                       AuthProperties properties) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.sessionService = sessionService;
        this.attemptService = attemptService;
        this.properties = properties;
    }

    /**
     * 账号密码登录，签发双令牌。
     */
    public TokenResponse login(String usernameRaw, String rawPassword) {
        String username = usernameRaw == null ? "" : usernameRaw.trim();

        // 1. 防爆破：先判锁定，命中直接拒绝（不消费密码校验成本）
        if (attemptService.isLocked(username)) {
            throw new AuthException(ErrorCode.ACCOUNT_LOCKED, lockedMessage());
        }

        SysUser user = userMapper.selectByUsername(username);

        // 2. 账号不存在 / 密码错误 → 同一提示，并计数失败
        if (user == null || !passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            if (attemptService.recordFailure(username)) {
                throw new AuthException(ErrorCode.ACCOUNT_LOCKED, lockedMessage());
            }
            throw new AuthException(ErrorCode.BAD_CREDENTIALS);
        }

        // 3. 账号状态检查（服务端强校验，不依赖计数）
        if (user.getStatus() != null && user.getStatus() == SysUser.STATUS_DISABLED) {
            throw new AuthException(ErrorCode.ACCOUNT_DISABLED);
        }
        if (user.getStatus() != null && user.getStatus() == SysUser.STATUS_LOCKED) {
            throw new AuthException(ErrorCode.ACCOUNT_LOCKED);
        }

        // 4. 登录成功：清零失败计数，回写最近登录时间
        attemptService.reset(username);
        SysUser update = new SysUser();
        update.setId(user.getId());
        update.setLastLoginTime(LocalDateTime.now());
        userMapper.updateById(update);

        // 5. 签发双令牌（单会话：新登录顶替旧 refresh 白名单，旧端至多存活 access 剩余时长）
        return issueTokenPair(user);
    }

    /**
     * refresh token 换发新令牌对（refresh 轮换，单次有效）。
     */
    public TokenResponse refresh(String refreshToken) {
        Long userId = tokenProvider.parseRefreshUserId(refreshToken);
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new AuthException(ErrorCode.TOKEN_INVALID);
        }
        if (user.getStatus() != null && user.getStatus() == SysUser.STATUS_DISABLED) {
            // 账号已停用：refresh 一并吊销，回到登录
            sessionService.revokeAll(userId);
            throw new AuthException(ErrorCode.ACCOUNT_DISABLED);
        }
        if (user.getStatus() != null && user.getStatus() == SysUser.STATUS_LOCKED) {
            sessionService.revokeAll(userId);
            throw new AuthException(ErrorCode.ACCOUNT_LOCKED);
        }

        String newRaw = tokenProvider.createRefreshToken(userId);
        boolean rotated = sessionService.rotateRefresh(
                userId,
                tokenProvider.fingerprint(refreshToken),
                tokenProvider.fingerprint(newRaw));
        if (!rotated) {
            // 旧 refresh 已被使用过 / 已失效 ⇒ 疑似重放：全端吊销，强制重新登录（PRD US-07）
            sessionService.revokeAll(userId);
            throw new AuthException(ErrorCode.TOKEN_INVALID, "刷新令牌已失效或疑似被盗用，请重新登录");
        }
        return issueTokenPair(user);
    }

    /**
     * 登出：全端吊销（token_epoch+1，access/refresh 即刻全部失效）。
     */
    public void logout() {
        Long userId = SecurityUtils.getLoginUser().getId();
        sessionService.revokeAll(userId);
    }

    /**
     * 当前登录用户摘要（含角色，用于「我的信息」）。
     */
    public UserSummary profile() {
        Long userId = SecurityUtils.getLoginUser().getId();
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new AuthException(ErrorCode.NOT_LOGIN);
        }
        List<String> roles = userMapper.selectRoleCodes(userId);
        return new UserSummary(user.getId(), user.getUsername(), user.getNickname(),
                user.getAvatarUrl(), roles);
    }

    /* ============================ 私有方法 ============================ */

    /** 依据最新用户行签发令牌对并建立会话（登录与刷新共用） */
    private TokenResponse issueTokenPair(SysUser user) {
        long epoch = user.getTokenEpoch() == null ? 0L : user.getTokenEpoch();
        String refreshRaw = tokenProvider.createRefreshToken(user.getId());
        sessionService.openSession(user.getId(), epoch, tokenProvider.fingerprint(refreshRaw));

        String accessToken = tokenProvider.createAccessToken(user.getId(), user.getUsername(), epoch);
        List<String> roles = userMapper.selectRoleCodes(user.getId());

        return new TokenResponse(
                accessToken,
                refreshRaw,
                "Bearer",
                properties.getAccessTokenTtl().toSeconds(),
                new UserSummary(user.getId(), user.getUsername(), user.getNickname(),
                        user.getAvatarUrl(), roles));
    }

    private String lockedMessage() {
        return "登录失败次数过多，账号已临时锁定，请 " + attemptService.lockMinutes() + " 分钟后重试";
    }
}
