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
package com.anttransfer.file.service;

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
 * 审计写入器「落库前必须脱敏」的回归契约测试。
 *
 * <p><b>守的是什么：</b>{@code SensitiveDataMasker} 本身已有单测（在 at-common），
 * 但「工具类正确」与「写入器真的调了它」是两件事。三个写入器的类注释长期承诺
 * 「detail 已脱敏」，而实现只是「调用方记得别 put」——这类约束的失效方式是<b>静默</b>的：
 * 少一次清洗没有任何运行时症状，只有事后翻 append-only 表时才发现明文口令已永久留档。
 * 故这里用<b>捕获 {@code OperationLog}</b> 的方式，断言「进入 Mapper 的那一版 detail」
 * 已经不含明文，把「调用方自觉」变成「改坏了就红」。</p>
 *
 * <p><b>已知边界（未覆盖，非本测试失职）：</b>{@code SensitiveDataMasker} 是<b>按键名</b>
 * 判定，不做值扫描。若调用方把提取码拼进 {@code reason} 这类自由文本里
 * （如「提取码错误：AB12CD」），键名是 {@code reason}，不在敏感键集合内，不会被遮。
 * 该缺口属调用方传参纪律，需要另立约束（或改为结构化传参），不在本次接线范围内。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class AuditLoggerMaskingTest {

    private static final String SECRET = "SuperSecret123";

    @Mock
    private OperationLogMapper operationLogMapper;

    @Mock
    private PlatformTransactionManager transactionManager;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("文件审计：口令类键在落库前被替换为 ***，明文不残留")
    void fileAuditMasksPasswordBeforePersist() {
        FileAuditLogger logger = new FileAuditLogger(operationLogMapper, objectMapper, transactionManager);

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("password", SECRET);
        extra.put("fileName", "report.pdf");
        logger.success("file.upload", "file", 1L, extra);

        String detail = captureDetail();
        assertThat(detail).contains("\"password\":\"***\"");
        assertThat(detail).doesNotContain(SECRET);
        // 非敏感键必须原样保留，否则「脱敏」会退化成「把审计写废」
        assertThat(detail).contains("report.pdf");
        assertThat(detail).contains("\"action\":\"file.upload\"");
    }

    @Test
    @DisplayName("分享审计：提取码在落库前被替换为 ***，明文不残留")
    void shareAuditMasksExtractCodeBeforePersist() {
        ShareAuditLogger logger = new ShareAuditLogger(operationLogMapper, objectMapper);

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("extractCode", "AB12CD");
        extra.put("accessType", "download");
        logger.log("share.redeem", null, 9L, "1.2.3.4", "UA/1.0", false, extra);

        String detail = captureDetail();
        assertThat(detail).contains("\"extractCode\":\"***\"");
        assertThat(detail).doesNotContain("AB12CD");
        assertThat(detail).contains("download");
    }

    /** 取出真正交给 Mapper 的那一版 detail（脱敏发生在序列化前，故此处即最终落库值）。 */
    private String captureDetail() {
        ArgumentCaptor<OperationLog> captor = ArgumentCaptor.forClass(OperationLog.class);
        verify(operationLogMapper).insert(captor.capture());
        return captor.getValue().getDetail();
    }
}
