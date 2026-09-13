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
import com.anttransfer.permission.repository.RbacAccessMapper;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * {@link AccessControlService} 单测：资源归属（防水平越权）+ 部门数据范围。
 */
class AccessControlServiceTest {

    private final RbacAccessMapper mapper = mock(RbacAccessMapper.class);
    private final PermissionService permissionService = mock(PermissionService.class);
    private final AccessControlService service =
            new AccessControlService(permissionService, mapper);

    private AccessSnapshot snapshot(long userId, int dataScope) {
        return new AccessSnapshot(userId, List.of("ROLE"), List.of(), List.of(), dataScope);
    }

    @Test
    void ownResource_shouldAlwaysPass() {
        service.assertResourceVisibleTo(snapshot(10L, AccessControlService.SCOPE_SELF), 10L, null);
        assertDoesNotThrow(() ->
                service.assertResourceVisibleTo(snapshot(10L, AccessControlService.SCOPE_SELF), 10L, null));
    }

    @Test
    void scopeAll_shouldSeeOthersResource() {
        service.assertResourceVisibleTo(snapshot(1L, AccessControlService.SCOPE_ALL), 2L, null);
        assertDoesNotThrow(() ->
                service.assertResourceVisibleTo(snapshot(1L, AccessControlService.SCOPE_ALL), 2L, 99L));
    }

    @Test
    void scopeSelf_cannotSeeOthersResource() {
        AuthException e = assertThrows(AuthException.class,
                () -> service.assertResourceVisibleTo(snapshot(10L, AccessControlService.SCOPE_SELF), 11L, null));
        assertEquals(1003, e.getErrorCode().getCode());
    }

    @Test
    void scopeDept_shouldSeeOwnDeptAndChildren() {
        // 用户 10 属部门 34（ancestors=/0/12/）
        when(mapper.selectUserDeptId(10L)).thenReturn(34L);
        when(mapper.selectDeptAncestors(34L)).thenReturn("/0/12/");

        // 同部门资源
        assertDoesNotThrow(() ->
                service.assertResourceVisibleTo(snapshot(10L, AccessControlService.SCOPE_DEPT), 11L, 34L));
        // 子部门资源（50.ancestors=/0/12/34/）
        when(mapper.selectDeptAncestors(50L)).thenReturn("/0/12/34/");
        assertDoesNotThrow(() ->
                service.assertResourceVisibleTo(snapshot(10L, AccessControlService.SCOPE_DEPT), 11L, 50L));
        // 更深子孙（60.ancestors=/0/12/34/50/）
        when(mapper.selectDeptAncestors(60L)).thenReturn("/0/12/34/50/");
        assertDoesNotThrow(() ->
                service.assertResourceVisibleTo(snapshot(10L, AccessControlService.SCOPE_DEPT), 11L, 60L));
    }

    @Test
    void scopeDept_cannotSeeSiblingOrUnassignedResource() {
        when(mapper.selectUserDeptId(10L)).thenReturn(34L);
        when(mapper.selectDeptAncestors(34L)).thenReturn("/0/12/");

        // 兄弟部门（99 不在 34 子树）
        when(mapper.selectDeptAncestors(99L)).thenReturn("/0/99/");
        assertThrows(AuthException.class,
                () -> service.assertResourceVisibleTo(snapshot(10L, AccessControlService.SCOPE_DEPT), 11L, 99L));

        // 资源无归属部门：部门管理员不可见
        assertThrows(AuthException.class,
                () -> service.assertResourceVisibleTo(snapshot(10L, AccessControlService.SCOPE_DEPT), 11L, null));
    }

    @Test
    void deptAdminWithoutDept_shouldDenyOthersResource() {
        when(mapper.selectUserDeptId(10L)).thenReturn(null);

        assertThrows(AuthException.class,
                () -> service.assertResourceVisibleTo(snapshot(10L, AccessControlService.SCOPE_DEPT), 11L, 50L));
    }
}
