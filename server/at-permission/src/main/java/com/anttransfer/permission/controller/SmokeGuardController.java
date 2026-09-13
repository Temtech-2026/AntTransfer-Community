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
package com.anttransfer.permission.controller;

import com.anttransfer.common.permission.RequiresPerm;
import com.anttransfer.common.result.Result;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * RBAC 自测冒烟端点（仅自测 / 联调用，生产必关）。
 *
 * <p>启用条件：{@code anttransfer.smoke.enabled=true}（见 application-dev.yml）。
 * 提供两个受 {@code @RequiresPerm} 保护的端点，用于端到端验证：
 * 登录拿令牌 → 访问受保护接口；无权限 403；审计员等写接口 403。</p>
 *
 * @author AntTransfer CE
 */
@ConditionalOnProperty(prefix = "anttransfer.smoke", name = "enabled", havingValue = "true")
@RestController
@RequestMapping("/v1/smoke/perm")
public class SmokeGuardController {

    /**
     * 读类接口：需 {@code file:download}。普通业务角色可访问；AUDITOR 无此权限 → 403。
     */
    @GetMapping("/read")
    @RequiresPerm("file:download")
    public Result<Map<String, String>> read() {
        return Result.ok(Map.of("action", "read", "perm", "file:download"));
    }

    /**
     * 写类接口：需 {@code file:destroy}。仅管理角色可访问；AUDITOR / 普通 USER → 403。
     * 用于验证「审计员调用写接口返回 403」。
     */
    @PostMapping("/write")
    @RequiresPerm("file:destroy")
    public Result<Map<String, String>> write() {
        return Result.ok(Map.of("action", "write", "perm", "file:destroy"));
    }
}
