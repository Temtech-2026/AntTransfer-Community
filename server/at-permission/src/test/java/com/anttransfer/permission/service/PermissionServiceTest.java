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
package com.anttransfer.permission.service;

import com.anttransfer.common.exception.AuthException;
import com.anttransfer.permission.config.PermissionProperties;
import com.anttransfer.permission.repository.RbacAccessMapper;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import com.anttransfer.permission.model.PermissionModels.RoleGrant;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * {@link PermissionService} 单测：多角色并集 + 显式 Deny 优先 + 数据范围取最大。
 */
class PermissionServiceTest {

    private PermissionService newService(RbacAccessMapper mapper, PermissionProperties properties) {
        // Redis 未启动场景：mock 的 opsForValue 返回 null → 走 DB 回源路径（P-8 自愈语义）
        return new PermissionService(
                mapper, properties, mock(StringRedisTemplate.class), new ObjectMapper());
    }

    @Test
    void resolve_shouldUnionMultiRolePermsAndTakeMaxDataScope() {
        RbacAccessMapper mapper = mock(RbacAccessMapper.class);
        when(mapper.selectRoles(1L)).thenReturn(List.of(
                new RoleGrant("USER", 1),
                new RoleGrant("DEPT_ADMIN", 2)));
        when(mapper.selectPermCodes(1L)).thenReturn(List.of(
                "file:upload", "file:download", "file:destroy"));

        AccessSnapshot snapshot = newService(mapper, new PermissionProperties()).resolve(1L);

        // 多角色取并集；数据范围取最大（2 > 1）
        assertEquals(2, snapshot.roles().size());
        assertTrue(snapshot.permCodes().containsAll(List.of(
                "file:upload", "file:download", "file:destroy")));
        assertEquals(2, snapshot.dataScope());
    }

    @Test
    void explicitDeny_shouldWinEvenIfGrantedByOtherRole() {
        RbacAccessMapper mapper = mock(RbacAccessMapper.class);
        when(mapper.selectRoles(1L)).thenReturn(List.of(
                new RoleGrant("USER", 1),
                new RoleGrant("AUDITOR", 3)));
        when(mapper.selectPermCodes(1L)).thenReturn(List.of("file:upload", "audit:log:read"));

        PermissionProperties properties = new PermissionProperties();
        properties.setRoleDeny(Map.of("AUDITOR", List.of("file:upload")));
        PermissionService service = newService(mapper, properties);
        AccessSnapshot snapshot = service.resolve(1L);

        // Deny 优先：AUDITOR 角色显式拒绝 file:upload，即使 USER 已授予
        AuthException denied = assertThrows(AuthException.class,
                () -> service.requirePerm(List.of("file:upload"), false, "", snapshot));
        assertEquals(1004, denied.getErrorCode().getCode());
        // 未拒绝项正常放行
        service.requirePerm(List.of("audit:log:read"), false, "", snapshot);
    }

    @Test
    void auditor_shouldBeDeniedOnWritePerms_butAllowedAuditRead() {
        // 模拟 V2 内置角色：AUDITOR 仅 audit:log:read
        RbacAccessMapper mapper = mock(RbacAccessMapper.class);
        when(mapper.selectRoles(9L)).thenReturn(List.of(new RoleGrant("AUDITOR", 3)));
        when(mapper.selectPermCodes(9L)).thenReturn(List.of("audit:log:read"));
        PermissionProperties properties = new PermissionProperties();
        properties.setRoleDeny(Map.of("AUDITOR",
                List.of("file:upload", "file:edit", "file:share", "file:destroy")));
        PermissionService service = newService(mapper, properties);
        AccessSnapshot snapshot = service.resolve(9L);

        service.requirePerm(List.of("audit:log:read"), false, "", snapshot);
        assertThrows(AuthException.class,
                () -> service.requirePerm(List.of("file:upload"), false, "", snapshot));
        assertThrows(AuthException.class,
                () -> service.requirePerm(List.of("file:destroy"), false, "", snapshot));
    }

    @Test
    void superAdmin_shouldNotBeGrantedLogClearPerm() {
        // 「日志清除」类权限点 CE 从不签发（V2 无该枚举）——并集中必然不存在
        RbacAccessMapper mapper = mock(RbacAccessMapper.class);
        when(mapper.selectRoles(1L)).thenReturn(List.of(new RoleGrant("SUPER_ADMIN", 3)));
        when(mapper.selectPermCodes(1L)).thenReturn(List.of(
                "file:upload", "file:destroy", "audit:log:read"));

        PermissionService service = newService(mapper, new PermissionProperties());
        AccessSnapshot snapshot = service.resolve(1L);

        assertFalse(snapshot.permCodes().contains("audit:log:clear"));
        assertThrows(AuthException.class,
                () -> service.requirePerm(List.of("audit:log:clear"), false, "", snapshot));
    }

    @Test
    void anySemantics_shouldAllowWhenAnyGranted() {
        RbacAccessMapper mapper = mock(RbacAccessMapper.class);
        when(mapper.selectRoles(1L)).thenReturn(List.of(new RoleGrant("USER", 1)));
        when(mapper.selectPermCodes(1L)).thenReturn(List.of("file:preview"));
        PermissionService service = newService(mapper, new PermissionProperties());
        AccessSnapshot snapshot = service.resolve(1L);

        service.requirePerm(List.of("file:preview", "file:download"), true, "", snapshot);
        // 全需命中则拒绝
        assertThrows(AuthException.class,
                () -> service.requirePerm(List.of("file:preview", "file:download"), false, "", snapshot));
    }
}
