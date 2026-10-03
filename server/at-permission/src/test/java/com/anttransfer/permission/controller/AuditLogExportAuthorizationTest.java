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

import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.permission.RequiresPerm;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.permission.aspect.RequiresPermAspect;
import com.anttransfer.permission.config.PermissionProperties;
import com.anttransfer.permission.constant.SystemAdminConstants;
import com.anttransfer.permission.model.PermissionModels.RoleGrant;
import com.anttransfer.permission.model.dto.AuditLogQueryDTO;
import com.anttransfer.permission.repository.RbacAccessMapper;
import com.anttransfer.permission.security.AuthzTestSupport;
import com.anttransfer.permission.service.AuditLogQueryService;
import com.anttransfer.permission.service.PermissionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 审计日志 CSV 导出的鉴权载体（R-18 / 越权用例 TC-V-03）。
 *
 * <p><b>为什么导出单独成文：</b>「列表能看」被当成「导出也能看」是越权里最常见的错配——
 * 列表页通常有人盯着，导出则是批量搬运，一旦漏鉴权就是整张表的离线副本。
 * {@code AuditLogControllerBoundaryTest} 已钉住「导出与检索共用同一权限点」这一<b>声明</b>，
 * 但声明不等于拦截：注解漏挂切面、切面顺序反了（先取数再校验），声明断言全都照样通过。</p>
 *
 * <p>故这里把<b>切面、真实 {@link PermissionService}、真实控制器</b>串成一条链路：
 * {@code ProceedingJoinPoint#proceed()} 绑定到真实的 {@code export} 方法，
 * 于是「拒绝时业务方法未被调用」与「拒绝时审计数据一条未读」都是真的断言，
 * 而不是对 mock 的自我确认。</p>
 *
 * <p>另附 1001 / 1003 的差分断言：两者都会让请求失败，但前端处置完全相反——
 * 1003 是策略 D（就地提示，禁止引导登录），只有 1001/1006 才跳登录。
 * 导出的失败形态若被归到认证，等于把「你没这个权限」误导成「你重新登录试试」。</p>
 *
 * @author AntTransfer CE
 */
@DisplayName("审计日志导出鉴权 · TC-V-03")
class AuditLogExportAuthorizationTest {

    private static final long AUDITOR_ID = 9L;
    private static final long NORMAL_USER_ID = 11L;

    private final AuditLogQueryService auditLogQueryService = mock(AuditLogQueryService.class);
    private final RbacAccessMapper rbacAccessMapper = mock(RbacAccessMapper.class);

    private final AuditLogController controller = new AuditLogController(auditLogQueryService);

    /** Redis 未启动形态（opsForValue 返回 null → 走 DB 回源），与 PermissionServiceTest 口径一致。 */
    private final PermissionService permissionService = new PermissionService(
            rbacAccessMapper, new PermissionProperties(),
            mock(StringRedisTemplate.class), new ObjectMapper());

    private final RequiresPermAspect aspect = new RequiresPermAspect(permissionService);

    private final ProceedingJoinPoint exportInvocation = mock(ProceedingJoinPoint.class);

    @BeforeEach
    void bindProceedToRealExportMethod() throws Throwable {
        lenient().doAnswer(invocation -> controller.export(null, null, null, null, null, null, null, null))
                .when(exportInvocation).proceed();
    }

    @AfterEach
    void clearSecurityContext() {
        // SecurityContextHolder 是 ThreadLocal：不清会让后续用例继承本条的身份
        AuthzTestSupport.clear();
    }

    /* ======================== 载体本身是否指向真端点 ======================== */

    @Test
    @DisplayName("被测方法确为 GET /logs/export：断言不能跑到别的同名方法上")
    void guardedMethod_mustBeTheExportedEndpoint() {
        GetMapping mapping = exportMethod().getAnnotation(GetMapping.class);

        assertThat(mapping).as("导出端点必须是 GET 映射，否则本类的鉴权断言跑在错误目标上").isNotNull();
        assertThat(mapping.value()).containsExactly("/logs/export");
        assertThat(exportPerm().value())
                .containsExactly(SystemAdminConstants.PERM_AUDIT_LOG_READ);
        assertThat(exportPerm().any()).as("单权限点不得声明 any=true").isFalse();
    }

    /* ======================== 拒绝路径 ======================== */

    @Test
    @DisplayName("TC-V-03 普通用户导出 → 403(1003)，且数据一条未读、字节一个未产")
    void export_withoutAuditReadPerm_mustBeRejectedBeforeReadingAnyData() throws Throwable {
        when(rbacAccessMapper.selectRoles(NORMAL_USER_ID)).thenReturn(List.of(new RoleGrant("USER", 1)));
        when(rbacAccessMapper.selectPermCodes(NORMAL_USER_ID))
                .thenReturn(List.of("file:upload", "file:download"));
        AuthzTestSupport.loginAs(NORMAL_USER_ID);

        assertThatThrownBy(() -> aspect.aroundMethod(exportInvocation, exportPerm()))
                .as("导出是最常漏鉴权的入口：能看列表 ≠ 能批量搬走整张表")
                .isInstanceOfSatisfying(AuthException.class, e -> {
                    assertThat(e.getErrorCode().getCode()).isEqualTo(1003);
                    assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NO_AUTH);
                });

        verify(exportInvocation, never()).proceed();
        verifyNoInteractions(auditLogQueryService);
    }

    @Test
    @DisplayName("未登录导出 → 1001（认证问题），与无权限 1003 严格区分")
    void export_anonymous_mustFailAsNotLoginInsteadOfNoAuth() throws Throwable {
        assertThatThrownBy(() -> aspect.aroundMethod(exportInvocation, exportPerm()))
                .as("归到 1003 会让前端「就地提示」而非引导登录；归到 1001 才是正确处置")
                .isInstanceOfSatisfying(AuthException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_LOGIN));

        verify(exportInvocation, never()).proceed();
        verifyNoInteractions(auditLogQueryService);
        verifyNoInteractions(rbacAccessMapper);
    }

    /* ======================== 放行路径（反向对照） ======================== */

    @Test
    @DisplayName("审计员导出 → 放行并真的产出 CSV，取数固定走第 1 页与行数上界")
    void export_withAuditReadPerm_shouldReachRealControllerAndStreamCsv() throws Throwable {
        when(rbacAccessMapper.selectRoles(AUDITOR_ID)).thenReturn(List.of(new RoleGrant("AUDITOR", 3)));
        when(rbacAccessMapper.selectPermCodes(AUDITOR_ID))
                .thenReturn(List.of(SystemAdminConstants.PERM_AUDIT_LOG_READ));
        when(auditLogQueryService.exportLogs(any(AuditLogQueryDTO.class))).thenReturn(List.of());
        AuthzTestSupport.loginAs(AUDITOR_ID);

        Object result = aspect.aroundMethod(exportInvocation, exportPerm());

        // 没有这条反向对照，「一律拒绝」的实现也能让上面的拒绝用例全绿
        assertThat(result).isInstanceOf(ResponseEntity.class);
        assertThat(((ResponseEntity<?>) result).getStatusCode()).isEqualTo(HttpStatus.OK);

        ArgumentCaptor<AuditLogQueryDTO> captor = ArgumentCaptor.forClass(AuditLogQueryDTO.class);
        verify(auditLogQueryService).exportLogs(captor.capture());
        assertThat(captor.getValue().pageSize())
                .as("导出上界一旦放宽，空条件导出会把整张审计表读进内存")
                .isEqualTo(AuditLogQueryService.EXPORT_MAX_ROWS);
    }

    /* ======================== 反射辅助 ======================== */

    private static Method exportMethod() {
        return Arrays.stream(AuditLogController.class.getDeclaredMethods())
                .filter(method -> "export".equals(method.getName()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("导出端点不存在：export"));
    }

    private static RequiresPerm exportPerm() {
        RequiresPerm perm = exportMethod().getAnnotation(RequiresPerm.class);
        assertThat(perm).as("导出端点必须声明 @RequiresPerm").isNotNull();
        return perm;
    }
}
