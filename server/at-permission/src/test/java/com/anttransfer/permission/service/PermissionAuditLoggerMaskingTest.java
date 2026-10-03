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
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

/**
 * 权限管理审计写入器「落库前必须脱敏」的回归契约测试。
 *
 * <p>与 at-file 的 {@code AuditLoggerMaskingTest} 同构：本模块的写入器在类注释里同样承诺
 * 「口令明文 / 哈希、令牌一律不入 detail」，但该承诺此前只靠调用方自觉。本测试断言
 * <b>进入 Mapper 的那一版 detail</b> 已不含明文——重置口令是管理端高危操作，
 * 一旦明文口令落到 append-only 表就再也删不掉。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class PermissionAuditLoggerMaskingTest {

    private static final String SECRET = "P@ssw0rd-Plain";

    @Mock
    private OperationLogMapper operationLogMapper;

    @Mock
    private PlatformTransactionManager transactionManager;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("权限审计：口令类键在落库前被替换为 ***，明文不残留")
    void permissionAuditMasksPasswordBeforePersist() {
        PermissionAuditLogger logger =
                new PermissionAuditLogger(operationLogMapper, objectMapper, transactionManager);

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("newPassword", SECRET);
        extra.put("targetUserName", "alice");
        logger.success("user.password.reset", "user", 7L, extra);

        ArgumentCaptor<OperationLog> captor = ArgumentCaptor.forClass(OperationLog.class);
        verify(operationLogMapper).insert(captor.capture());
        String detail = captor.getValue().getDetail();

        assertThat(detail).contains("\"newPassword\":\"***\"");
        assertThat(detail).doesNotContain(SECRET);
        // 「谁重置了谁的」必须保留，否则把审计写废
        assertThat(detail).contains("alice");
        assertThat(detail).contains("\"action\":\"user.password.reset\"");
    }
}
