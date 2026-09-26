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

import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.common.audit.repository.OperationLogMapper;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.security.UserLookupPort;
import com.anttransfer.common.security.UserLookupPort.UserContact;
import com.anttransfer.permission.MybatisPlusTestSupport;
import com.anttransfer.permission.model.dto.AuditLogQueryDTO;
import com.anttransfer.permission.model.vo.AuditLogVO;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * {@link AuditLogQueryService} 行为测试。
 *
 * <p>覆盖四条红线：操作人展示名反查、系统动作（无操作人）不触发反查、
 * 时间区间倒挂早失败、分页与导出各自的规模上界。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class AuditLogQueryServiceTest {

    @Mock
    private OperationLogMapper operationLogMapper;
    @Mock
    private UserLookupPort userLookupPort;

    private AuditLogQueryService service;

    @BeforeEach
    void setUp() {
        MybatisPlusTestSupport.initTableInfo();
        service = new AuditLogQueryService(operationLogMapper, userLookupPort);
    }

    @Test
    @DisplayName("列表：操作人展示名经 SPI 批量反查后填入")
    void pageLogs_shouldResolveOperatorDisplayName() {
        OperationLog log = log(7L, 10L, OperationLog.ACTION_USER_CREATE, OperationLog.TARGET_USER, 99L);
        pageWith(List.of(log), 1L);
        when(userLookupPort.findContacts(Set.of(10L)))
                .thenReturn(Map.of(10L, new UserContact(10L, "张三", "zhangsan@example.com", null)));

        PageResult<AuditLogVO> result = service.pageLogs(query(1L, 20L));

        assertThat(result.getTotal()).isEqualTo(1L);
        assertThat(result.getPages()).isEqualTo(1L);
        assertThat(result.getRecords()).singleElement().satisfies(vo -> {
            assertThat(vo.id()).isEqualTo(7L);
            assertThat(vo.userId()).isEqualTo(10L);
            assertThat(vo.operatorName()).isEqualTo("张三");
            assertThat(vo.action()).isEqualTo(OperationLog.ACTION_USER_CREATE);
            assertThat(vo.module()).isEqualTo(OperationLog.MODULE_PERMISSION);
            assertThat(vo.targetType()).isEqualTo(OperationLog.TARGET_USER);
            assertThat(vo.targetId()).isEqualTo(99L);
            assertThat(vo.result()).isEqualTo(OperationLog.RESULT_SUCCESS);
            assertThat(vo.logTime()).isEqualTo(LocalDateTime.of(2026, 9, 14, 10, 0));
        });
    }

    @Test
    @DisplayName("列表：系统动作（userId 为空）不反查用户，operatorName 保持为空")
    void pageLogs_shouldLeaveOperatorBlankForSystemAction() {
        OperationLog log = log(8L, null, OperationLog.ACTION_RECYCLE_PURGE, OperationLog.TARGET_SYSTEM, null);
        pageWith(List.of(log), 1L);

        PageResult<AuditLogVO> result = service.pageLogs(query(1L, 20L));

        assertThat(result.getRecords()).singleElement()
                .extracting(AuditLogVO::operatorName)
                .isNull();
        verifyNoInteractions(userLookupPort);
    }

    @Test
    @DisplayName("列表：反查不到用户时 operatorName 回落为空（不抛异常）")
    void pageLogs_shouldTolerateMissingContact() {
        OperationLog log = log(9L, 404L, OperationLog.ACTION_USER_DELETE, OperationLog.TARGET_USER, 404L);
        pageWith(List.of(log), 1L);
        when(userLookupPort.findContacts(Set.of(404L))).thenReturn(Map.of());

        PageResult<AuditLogVO> result = service.pageLogs(query(1L, 20L));

        assertThat(result.getRecords()).singleElement()
                .extracting(AuditLogVO::operatorName)
                .isNull();
    }

    @Test
    @DisplayName("列表：pageSize 收敛到上界 100，current 至少为 1")
    void pageLogs_shouldClampPagination() {
        pageWith(List.of(), 0L);

        PageResult<AuditLogVO> result = service.pageLogs(query(0L, 500L));

        assertThat(result.getCurrent()).isEqualTo(1L);
        assertThat(result.getPageSize()).isEqualTo(100L);
    }

    @Test
    @DisplayName("时间区间倒挂：抛 PARAM_OUT_OF_RANGE，不打库")
    void pageLogs_shouldRejectInvertedTimeRange() {
        AuditLogQueryDTO inverted = new AuditLogQueryDTO(null, null, null, null, null, null,
                LocalDateTime.of(2026, 9, 15, 0, 0), LocalDateTime.of(2026, 9, 14, 0, 0), 1L, 20L);

        assertThatThrownBy(() -> service.pageLogs(inverted))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo(ErrorCode.PARAM_OUT_OF_RANGE.getCode());
        verifyNoInteractions(operationLogMapper);
    }

    @Test
    @DisplayName("导出：走 selectList 且强制拼接 LIMIT 上界，绕开分页插件 100 上限")
    void exportLogs_shouldQueryWithHardLimit() {
        OperationLog log = log(11L, 2L, OperationLog.ACTION_APPROVE, OperationLog.TARGET_APPLICATION, 3L);
        when(operationLogMapper.selectList(any())).thenReturn(List.of(log));
        when(userLookupPort.findContacts(Set.of(2L)))
                .thenReturn(Map.of(2L, new UserContact(2L, "李四", null, null)));

        List<AuditLogVO> exported = service.exportLogs(query(1L, 20L));

        assertThat(exported).singleElement().satisfies(vo -> {
            assertThat(vo.id()).isEqualTo(11L);
            assertThat(vo.operatorName()).isEqualTo("李四");
            assertThat(vo.action()).isEqualTo(OperationLog.ACTION_APPROVE);
        });

        ArgumentCaptor<Wrapper<OperationLog>> captor = ArgumentCaptor.forClass(Wrapper.class);
        verify(operationLogMapper).selectList(captor.capture());
        assertThat(captor.getValue().getSqlSegment())
                .contains("LIMIT " + AuditLogQueryService.EXPORT_MAX_ROWS);
    }

    @Test
    @DisplayName("导出：过滤条件与列表一致（action 精确匹配）")
    void exportLogs_shouldApplySameFilters() {
        when(operationLogMapper.selectList(any())).thenReturn(List.of());

        service.exportLogs(new AuditLogQueryDTO(null, OperationLog.ACTION_REVOKE, OperationLog.MODULE_PERMISSION,
                null, null, null, null, null, 1L, 20L));

        ArgumentCaptor<Wrapper<OperationLog>> captor = ArgumentCaptor.forClass(Wrapper.class);
        verify(operationLogMapper).selectList(captor.capture());
        assertThat(captor.getValue().getSqlSegment())
                .contains("action")
                .contains("module")
                .contains("ORDER BY");
    }

    /* ============================ fixtures ============================ */

    private void pageWith(List<OperationLog> records, long total) {
        doAnswer(invocation -> {
            Page<OperationLog> page = invocation.getArgument(0);
            page.setRecords(records);
            page.setTotal(total);
            return page;
        }).when(operationLogMapper).selectPage(any(), any());
    }

    private static AuditLogQueryDTO query(long current, long pageSize) {
        return new AuditLogQueryDTO(null, null, null, null, null, null, null, null, current, pageSize);
    }

    private static OperationLog log(Long id, Long userId, String action, String targetType, Long targetId) {
        OperationLog log = new OperationLog();
        log.setId(id);
        log.setUserId(userId);
        log.setAction(action);
        log.setModule(OperationLog.MODULE_PERMISSION);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setTraceId("trace-" + id);
        log.setIp("10.0.0.1");
        log.setResult(OperationLog.RESULT_SUCCESS);
        log.setDetail("{\"k\":\"v\"}");
        log.setLogTime(LocalDateTime.of(2026, 9, 14, 10, 0));
        return log;
    }
}
