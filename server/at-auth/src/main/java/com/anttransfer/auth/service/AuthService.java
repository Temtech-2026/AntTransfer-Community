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
import com.anttransfer.auth.model.dto.AuthDtos.ChangePasswordRequest;
import com.anttransfer.auth.model.vo.AuthVos.TokenResponse;
import com.anttransfer.auth.model.vo.AuthVos.UserSummary;
import com.anttransfer.auth.model.entity.SysUser;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.auth.security.JwtTokenProvider;
import com.anttransfer.auth.security.PasswordPolicy;
import com.anttransfer.auth.security.SecurityUtils;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
    private final AuthAuditLogger auditLogger;

    public AuthService(UserMapper userMapper,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider tokenProvider,
                       TokenSessionService sessionService,
                       LoginAttemptService attemptService,
                       AuthProperties properties,
                       AuthAuditLogger auditLogger) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.sessionService = sessionService;
        this.attemptService = attemptService;
        this.properties = properties;
        this.auditLogger = auditLogger;
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
     * 本人自助改密：原口令再确认 → 强度策略 → 落新散列 → <b>全端吊销</b> → 审计。
     *
     * <p><b>为什么必须全端吊销（含发起这次请求的当前会话）：</b>改密的语义是「旧凭据从此不可信」。
     * 若把当前端排除在外，那么「口令疑似泄露 → 用户改密自救」这条路径就是假的——
     * 攻击者手里的 access token 仍能用满 30 min，refresh 也还能换新。因此这里一律 epoch+1，
     * 响应成功后由前端清空本地令牌并引导重新登录。</p>
     *
     * <p><b>为什么走 {@code revokeAllInCurrentTransaction} 而不是 {@code revokeAll}：</b>
     * 口令更新与会话吊销必须原子——若分两个事务，可能出现「口令已换、会话未吊销」的中间态
     * （反之「会话已吊销、口令未换」会让用户无端被踢且旧口令仍可用）。两者并入同一事务，
     * Redis 镜像在提交后清理（见 {@link TokenSessionService}）。</p>
     *
     * <p><b>不做失败计数：</b>这是已登录态下的身份再确认，不是爆破入口（要走到这里先得有合法令牌），
     * 计数反而会给出「用别人的令牌试口令」的可观测通道。</p>
     *
     * @throws AuthException    未登录 / 账号已被停用或锁定（1001 / 1005 / 1004）
     * @throws BusinessException 原口令不符（1029）或新口令不合规（1030）
     */
    @Transactional(rollbackFor = Exception.class)
    public void changePassword(ChangePasswordRequest request) {
        Long userId = SecurityUtils.getLoginUser().getId();
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            // 令牌有效但账号行已消失（并发删除）：按未登录处理，让前端回登录页
            throw new AuthException(ErrorCode.NOT_LOGIN);
        }
        if (user.getStatus() != null && user.getStatus() == SysUser.STATUS_DISABLED) {
            throw new AuthException(ErrorCode.ACCOUNT_DISABLED);
        }
        if (user.getStatus() != null && user.getStatus() == SysUser.STATUS_LOCKED) {
            throw new AuthException(ErrorCode.ACCOUNT_LOCKED);
        }
        // 1. 身份再确认：原口令不符直接拒绝（不改任何状态，也不计数）
        if (!passwordEncoder.matches(request.oldPassword(), user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.OLD_PASSWORD_MISMATCH);
        }
        // 2. 强度策略（含「不得与原口令相同」）
        PasswordPolicy.assertCompliant(request.newPassword(), request.oldPassword());

        // 3. 落新散列
        String newHash = passwordEncoder.encode(request.newPassword());
        int affected = userMapper.updatePassword(userId, newHash, userId);
        if (affected == 0) {
            // 与 3 之间的并发删除：抛出以回滚（本次没有改动任何行，回滚是空操作）
            throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        }

        // 4. 全端吊销：与口令更新同事务，提交后清 Redis 镜像
        sessionService.revokeAllInCurrentTransaction(userId);

        // 5. 审计（成功行入本事务；失败绝不抛异常影响改密结果）
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("username", user.getUsername());
        detail.put("revokedSessions", true);
        auditLogger.success(OperationLog.ACTION_PASSWORD_CHANGE, OperationLog.TARGET_USER, userId, detail);
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
