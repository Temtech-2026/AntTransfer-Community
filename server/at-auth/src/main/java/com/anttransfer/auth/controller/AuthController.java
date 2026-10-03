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
package com.anttransfer.auth.controller;

import com.anttransfer.auth.model.dto.AuthDtos.ChangePasswordRequest;
import com.anttransfer.auth.model.dto.AuthDtos.LoginRequest;
import com.anttransfer.auth.model.dto.AuthDtos.RefreshTokenRequest;
import com.anttransfer.auth.model.vo.AuthVos.TokenResponse;
import com.anttransfer.auth.model.vo.AuthVos.UserSummary;
import com.anttransfer.auth.service.AuthService;
import com.anttransfer.common.ratelimit.RateLimit;
import com.anttransfer.common.result.Result;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证端点（契约 docs/api/README.md §5 / use-case-flows 白名单）。
 *
 * @author AntTransfer CE
 */
// ===================== TODO[AT-DIFF-05] 待整体完工后裁决 =====================
// 差异：外部计划接口名为 /auth/login、/auth/refresh；仓库契约（docs/api/README.md）
// 为 POST /api/v1/auth/token（登录）、POST /api/v1/auth/token/refresh（刷新）。
// 现状按仓库契约实现（前端 requestErrorConfig 与白名单亦指向 /v1/auth/token*）。
// 方案：
//   A) 维持 /v1/auth/token 语义（推荐）：登录/刷新是「令牌资源的动作」而非资源 CRUD，
//      且 error-codes/白名单/前端已全线对齐，改动面为零；
//   B) 若外部计划强制 /auth/login 命名：属破坏性路径变更（API 契约 §9），需同步
//      SecurityConfig 白名单、docs/api/README.md、前端 REFRESH_URL，另加路径兼容映射。
// ======================================================================
// ===================== [已办结] AT-DIFF-04（2026-09-07，不再作为开放 TODO） =====================
// HTTP 层集成测试套件已落地：server/at-bootstrap/src/test/java/com/anttransfer/it/
//   AuthFlowIntegrationTest（Testcontainers 拉起 MySQL+Redis，8 例全绿）：
//   登录双 token(0) / 无 token 401(1001) / SUPER_ADMIN 200 / AUDITOR 无权限 403(1003) /
//   AUDITOR 写接口 403(1003) / 登出后旧 token 401(1001) / refresh 复用打击 401(1006) /
//   错误密码 401(1007)。运行前提：Docker；镜像源异常时设 TESTCONTAINERS_RYUK_DISABLED=true。
// ======================================================================
@RestController
@RequestMapping("/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * 登录：账号密码 → 双令牌（access 30min + refresh 7d）。
     * 免登录白名单端点。
     *
     * <p><b>为什么这里只做 per-IP 限流、不叠加 per-账号维度：</b>账号维度的失败锁定已由
     * {@code LoginAttemptService} 承担（连续失败即锁定，红队 [D-03] 落地）。此处补的是它
     * 覆盖不到的另一半——<b>单来源撞库</b>：同一个 IP 轮换用户名去试，每个账号都碰不到锁定阈值。
     * 若在此再挂一个 per-账号窗口，就会与失败计数形成两套阈值不同的「锁定」语义，
     * 让「为什么被拦」不可解释，故刻意不叠加。</p>
     */
    @PostMapping("/token")
    @RateLimit(windowSeconds = 60, max = 30, key = "login",
            message = "登录尝试过于频繁，请稍后再试")
    public Result<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return Result.ok(authService.login(request.username(), request.password()));
    }

    /**
     * 刷新：refresh token 换发新令牌对（单次有效，轮换 + 复用检测）。
     * 免登录白名单端点。
     *
     * <p>该端点免登录且每次都要打 DB + Redis，是现成的放大面；限流只约束单来源刷量，
     * 不改变「refresh 单次有效 + 复用检测」的既有裁决口径。</p>
     */
    @PostMapping("/token/refresh")
    @RateLimit(windowSeconds = 60, max = 60, key = "refresh",
            message = "令牌刷新过于频繁，请稍后再试")
    public Result<TokenResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return Result.ok(authService.refresh(request.refreshToken()));
    }

    /**
     * 登出：全端吊销（DB token_epoch+1 + 清除 Redis 白名单），旧令牌即刻失效。
     */
    @PostMapping("/logout")
    public Result<Void> logout() {
        authService.logout();
        return Result.ok();
    }

    /**
     * 本人自助改密：原口令再确认 + 强度策略，成功后<b>全端</b>令牌失效（含当前会话）。
     *
     * <p>非白名单端点（须持有合法 access token）。响应 200 只代表口令已换；
     * 前端须随即清除本地令牌并引导重新登录——因为连发起本次请求的令牌也已被 epoch+1 作废。</p>
     *
     * <p>路径用「动作端点」形态 {@code PUT /v1/auth/password}（与 {@code /v1/auth/token} 同一约定：
     * 认证域端点按动作命名，不做资源 CRUD）。与 docs/api/README.md §1 模块表第 22 行
     * 「at-auth 负责本人资料 / 个人中心自助改密」的口径一致，仅把承载前缀定为 {@code /v1/auth}
     * 而非 {@code /v1/users}——改密是凭据动作而非资料资源，归入认证域更内聚。</p>
     */
    @PutMapping("/password")
    public Result<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(request);
        return Result.ok();
    }

    /**
     * 当前登录用户信息（含角色编码）。
     */
    @GetMapping("/me")
    public Result<UserSummary> me() {
        return Result.ok(authService.profile());
    }
}
