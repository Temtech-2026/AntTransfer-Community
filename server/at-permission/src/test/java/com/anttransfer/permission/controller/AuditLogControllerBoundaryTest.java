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
import com.anttransfer.permission.constant.SystemAdminConstants;
import com.anttransfer.permission.model.dto.AuditLogQueryDTO;
import com.anttransfer.permission.service.AuditLogQueryService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 审计面边界：只读、单权限点、导出硬化。
 *
 * <p>审计的三条红线在这里落地为可执行断言：</p>
 * <ol>
 *     <li><b>append-only</b>：审计记录只能写不能改，因此端点层<b>不允许存在任何写方法</b>
 *         （含清空 / 删除）。少一个断言，将来「顺手加个删除接口」就没人拦；</li>
 *     <li><b>单一权限点</b>：检索与导出共用 {@code audit:log:read}。若拆成两个，
 *         「能看不能导」这种无安全收益的组合会成立，只是把授权矩阵变复杂；</li>
 *     <li><b>三权分立</b>：{@code audit:log:read} 不得进入超管必备权限集，
 *         否则「管理员必然能看审计」会直接击穿审计员独立这条基线。</li>
 * </ol>
 *
 * <p>导出还额外承担一个 Web 风险面：CSV 里可能含用户可控内容，若被浏览器按 HTML 嗅探
 * 渲染即成为存储型 XSS。故断言 {@code X-Content-Type-Options: nosniff} 与附件下载头。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("审计面边界 · 只读 / 单权限点 / 导出硬化")
class AuditLogControllerBoundaryTest {

    private static final String BASE_PATH = "/v1/audit";

    private static final String CSV_FILENAME_PATTERN = "attachment; filename=\"audit-log-\\d{14}\\.csv\"";

    @Mock
    private AuditLogQueryService auditLogQueryService;

    @InjectMocks
    private AuditLogController controller;

    /* ======================== 只读面 ======================== */

    @Test
    @DisplayName("审计面不得出现任何写端点（append-only 的端点层保证）")
    void mustNotExposeAnyWriteEndpoint() {
        List<String> writeEndpoints = Arrays.stream(AuditLogController.class.getDeclaredMethods())
                .filter(AuditLogControllerBoundaryTest::isWriteMapping)
                .map(Method::getName)
                .toList();

        assertThat(writeEndpoints)
                .as("审计记录 append-only：新增删除 / 清空接口会让审计可被篡改")
                .isEmpty();
    }

    @Test
    @DisplayName("审计面端点只读：GET + 单一前缀 /v1/audit")
    void endpoints_mustBeReadOnlyAndUnderAuditPrefix() {
        assertThat(AuditLogController.class.getAnnotation(RequestMapping.class).value())
                .containsExactly(BASE_PATH);
        assertThat(controller())
                .as("审计端点数异常：新增端点须同步确认权限点与只读口径")
                .containsExactlyInAnyOrder("page", "export");
    }

    /* ======================== 权限点 ======================== */

    @Test
    @DisplayName("检索与导出共用同一个权限点 audit:log:read（any=false）")
    void bothEndpoints_mustShareAuditReadPerm() {
        assertThat(permOf("page").value())
                .containsExactly(SystemAdminConstants.PERM_AUDIT_LOG_READ);
        assertThat(permOf("export").value())
                .containsExactly(SystemAdminConstants.PERM_AUDIT_LOG_READ);

        assertThat(permOf("page").any()).as("单权限点不得声明 any=true").isFalse();
        assertThat(permOf("export").any()).as("单权限点不得声明 any=true").isFalse();
    }

    @Test
    @DisplayName("类级不得挂权限点：审计面权限只在端点上声明，避免波及后续新增端点")
    void classLevel_mustNotDeclarePerm() {
        assertThat(AuditLogController.class.getAnnotation(RequiresPerm.class))
                .as("类级声明会让新增端点「自动继承」一个可能不合适的权限点")
                .isNull();
    }

    @Test
    @DisplayName("三权分立：audit:log:read 不得进入超管必备权限集")
    void auditRead_mustStayOutOfSuperAdminRequiredPerms() {
        assertThat(SystemAdminConstants.SUPER_ADMIN_REQUIRED_PERMS)
                .as("审计读权限一旦成为超管必备项，「管理员必然能审审计」即击穿审计员独立基线")
                .doesNotContain(SystemAdminConstants.PERM_AUDIT_LOG_READ);
    }

    /* ======================== 导出硬化 ======================== */

    @Test
    @DisplayName("导出：附件下载 + nosniff + CSV 类型 + BOM，且取数固定走第 1 页与上界")
    void export_mustBeHardenedAgainstSniffingAndTruncation() {
        when(auditLogQueryService.exportLogs(any(AuditLogQueryDTO.class))).thenReturn(List.of());

        ResponseEntity<byte[]> response = controller.export(
                null, null, null, null, null, null, null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                .as("必须走附件下载，避免浏览器就地渲染 CSV")
                .matches(CSV_FILENAME_PATTERN);
        assertThat(response.getHeaders().getFirst("X-Content-Type-Options"))
                .as("缺 nosniff 时含 HTML 的 detail 字段可能被嗅探渲染成页面（存储型 XSS）")
                .isEqualTo("nosniff");
        assertThat(response.getHeaders().getContentType().toString())
                .contains("text/csv")
                .contains("UTF-8");

        byte[] body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(new byte[]{body[0], body[1], body[2]})
                .as("CSV 必须带 UTF-8 BOM，否则 Excel 打开中文乱码")
                .containsExactly((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);

        ArgumentCaptor<AuditLogQueryDTO> captor = ArgumentCaptor.forClass(AuditLogQueryDTO.class);
        verify(auditLogQueryService).exportLogs(captor.capture());
        assertThat(captor.getValue().current())
                .as("导出须从第 1 页起取，否则调用方翻页会让归档缺前半段")
                .isEqualTo(1L);
        assertThat(captor.getValue().pageSize())
                .as("导出上界须为 EXPORT_MAX_ROWS，否则空条件导出会把整张审计表读进内存")
                .isEqualTo(AuditLogQueryService.EXPORT_MAX_ROWS);
    }

    /* ======================== 反射辅助 ======================== */

    private static RequiresPerm permOf(String methodName) {
        Method method = Arrays.stream(AuditLogController.class.getDeclaredMethods())
                .filter(m -> m.getName().equals(methodName))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("审计端点不存在：" + methodName));
        RequiresPerm perm = method.getAnnotation(RequiresPerm.class);
        assertThat(perm).as("端点 %s 必须声明 @RequiresPerm", methodName).isNotNull();
        return perm;
    }

    private static Set<String> controller() {
        return Arrays.stream(AuditLogController.class.getDeclaredMethods())
                .filter(m -> !m.isSynthetic() && !m.isBridge())
                .filter(m -> m.isAnnotationPresent(org.springframework.web.bind.annotation.GetMapping.class)
                        || isWriteMapping(m))
                .map(Method::getName)
                .collect(Collectors.toSet());
    }

    private static boolean isWriteMapping(Method method) {
        if (method.isAnnotationPresent(PostMapping.class)
                || method.isAnnotationPresent(PutMapping.class)
                || method.isAnnotationPresent(DeleteMapping.class)
                || method.isAnnotationPresent(PatchMapping.class)) {
            return true;
        }
        RequestMapping mapping = method.getAnnotation(RequestMapping.class);
        if (mapping == null) {
            return false;
        }
        return Arrays.stream(mapping.method()).anyMatch(m -> m != RequestMethod.GET && m != RequestMethod.HEAD);
    }
}
