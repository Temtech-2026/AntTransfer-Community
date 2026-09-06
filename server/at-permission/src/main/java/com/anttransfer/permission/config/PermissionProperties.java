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
package com.anttransfer.permission.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 权限判定配置（前缀 {@code anttransfer.permission}）。
 *
 * <p>{@code role-deny}：<b>显式 Deny</b>（Deny 优先）——按角色配置的黑名单权限点，
 * 即使该权限点已由其他角色授予 / 角色本身已授权，命中仍拒绝。
 * 典型用途：三权分立红线（如审计员永不可写、超管不授予「日志清除」类高危操作）。
 * CE 数据模型暂未建「拒绝授权」表，此配置为既定的显式 Deny 落地载体；
 * 后续如新增拒绝授权表，本配置作为初始化/覆盖来源，判定语义不变（deny → allow）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "anttransfer.permission")
public class PermissionProperties {

    /**
     * 角色 → 显式拒绝权限点集合。
     */
    private Map<String, List<String>> roleDeny = new LinkedHashMap<>();

    /** 读取某角色的显式 Deny 列表（缺省空） */
    public List<String> deniedOf(String roleCode) {
        return roleDeny.getOrDefault(roleCode, new ArrayList<>());
    }
}
