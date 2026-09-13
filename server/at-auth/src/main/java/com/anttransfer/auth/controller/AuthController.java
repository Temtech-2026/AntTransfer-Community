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

import com.anttransfer.auth.model.dto.AuthDtos.LoginRequest;
import com.anttransfer.auth.model.dto.AuthDtos.RefreshTokenRequest;
import com.anttransfer.auth.model.vo.AuthVos.TokenResponse;
import com.anttransfer.auth.model.vo.AuthVos.UserSummary;
import com.anttransfer.auth.service.AuthService;
import com.anttransfer.common.result.Result;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
     */
    @PostMapping("/token")
    public Result<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return Result.ok(authService.login(request.username(), request.password()));
    }

    /**
     * 刷新：refresh token 换发新令牌对（单次有效，轮换 + 复用检测）。
     * 免登录白名单端点。
     */
    @PostMapping("/token/refresh")
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
     * 当前登录用户信息（含角色编码）。
     */
    @GetMapping("/me")
    public Result<UserSummary> me() {
        return Result.ok(authService.profile());
    }
}
