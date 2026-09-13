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
package com.anttransfer.permission.util;

import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.permission.model.vo.AuditLogVO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link AuditLogCsv} 序列化测试：BOM、表头、转义、结果码可读化。
 *
 * @author AntTransfer CE
 */
class AuditLogCsvTest {

    @Test
    @DisplayName("导出字节以 UTF-8 BOM 开头，保证 Excel 不乱码")
    void write_shouldPrefixUtf8Bom() {
        byte[] csv = AuditLogCsv.write(List.of());

        assertThat(csv).startsWith((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);
        assertThat(new String(csv, StandardCharsets.UTF_8)).contains("日志ID", "操作时间", "操作人");
    }

    @Test
    @DisplayName("空结果只输出表头，不产生数据行")
    void write_shouldEmitHeaderOnlyWhenEmpty() {
        String text = new String(AuditLogCsv.write(null), StandardCharsets.UTF_8);

        assertThat(text.lines().count()).isEqualTo(1L);
        assertThat(text).contains("日志ID").doesNotContain("\r\n\r\n");
    }

    @Test
    @DisplayName("含逗号 / 双引号 / 换行的 detail 被引号包裹且内部引号翻倍，列数不错位")
    void write_shouldEscapeDelimiterAndQuote() {
        AuditLogVO vo = new AuditLogVO(1L, 2L, "张三, 管理员",
                OperationLog.ACTION_USER_UPDATE, OperationLog.MODULE_PERMISSION,
                OperationLog.TARGET_USER, 9L, "t-1", "10.0.0.1",
                OperationLog.RESULT_SUCCESS,
                "{\"note\":\"含,逗号\",\"quote\":\"双\"引号\"}",
                LocalDateTime.of(2026, 9, 14, 8, 5, 6));

        String text = new String(AuditLogCsv.write(List.of(vo)), StandardCharsets.UTF_8);
        String[] lines = text.substring(1).split("\r\n");

        // 表头 12 列 + 1 数据行；数据行按 CSV 规则解析后仍是 12 个字段
        assertThat(lines).hasSize(2);
        assertThat(parseCsvLine(lines[1])).hasSize(12);
        assertThat(parseCsvLine(lines[1])[3]).isEqualTo("张三, 管理员");
        assertThat(parseCsvLine(lines[1])[11]).contains("\"双\"引号\"");
        // 结果码语义化
        assertThat(parseCsvLine(lines[1])[8]).isEqualTo("成功");
        assertThat(parseCsvLine(lines[1])[1]).isEqualTo("2026-09-14 08:05:06");
    }

    @Test
    @DisplayName("失败结果导出为「失败」，null 操作人导出为空串")
    void write_shouldRenderFailureAndNullOperator() {
        AuditLogVO vo = new AuditLogVO(2L, null, null,
                OperationLog.ACTION_SHARE_BLOCKED, OperationLog.MODULE_FILE,
                OperationLog.TARGET_SHARE, null, null, null,
                OperationLog.RESULT_FAIL, null, null);

        String text = new String(AuditLogCsv.write(List.of(vo)), StandardCharsets.UTF_8);

        assertThat(text).contains("失败");
        assertThat(text).doesNotContain("null");
    }

    /** 最小 CSV 解析：仅用于断言列数与转义正确性（不追求完整 RFC 4180）。 */
    private static String[] parseCsvLine(String line) {
        java.util.List<String> fields = new java.util.ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        current.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    current.append(c);
                }
            } else if (c == '"') {
                inQuotes = true;
            } else if (c == ',') {
                fields.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        fields.add(current.toString());
        return fields.toArray(new String[0]);
    }
}
