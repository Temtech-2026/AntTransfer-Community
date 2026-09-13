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

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 审计日志 CSV 序列化（导出接口专用）。
 *
 * <p><b>为什么手写而不是引 POI / EasyExcel：</b>导出需求是「把检索结果落成可直接归档的
 * 表格文本」，审计归档对格式无样式要求，CSV 足够且零新增依赖。引入 Excel 库会给
 * at-permission 增加一个与业务无关的体积负担（且 EE 才可能需要 xlsx）。</p>
 *
 * <p><b>两个易错点已被处理：</b></p>
 * <ol>
 *     <li><b>UTF-8 BOM</b>：Excel 打开无 BOM 的 UTF-8 CSV 会把中文识别成乱码，
 *         故在文件头写入 {@code EF BB BF} 三字节；</li>
 *     <li><b>字段转义</b>：{@code detail} 是 JSON，天然含逗号与双引号。含
 *         {@code , " \r \n} 的字段用双引号包裹，内部双引号翻倍，否则整行列数会错位。</li>
 * </ol>
 *
 * <p>结论：只做「展示用导出」，不承诺可被程序无损回读（那属于归档任务的数据交换范畴）。</p>
 *
 * @author AntTransfer CE
 */
public final class AuditLogCsv {

    /** 时间列格式：与前端 / 日志检索的时间语义一致（本地时间，秒级）。 */
    private static final DateTimeFormatter TIME_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** UTF-8 BOM，供 Excel 正确识别中文。 */
    private static final byte[] UTF8_BOM = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};

    /** 导出行分隔符：CRLF 兼容 Windows Excel。 */
    private static final String CRLF = "\r\n";

    /** 表头（与 {@link AuditLogVO} 字段一一对应）。 */
    private static final String[] HEADERS = {
            "日志ID", "操作时间", "操作人ID", "操作人", "所属域", "动作",
            "对象类型", "对象ID", "结果", "来源IP", "追踪ID", "详情"
    };

    private AuditLogCsv() {
    }

    /**
     * 把审计视图列表序列化为带 BOM 的 UTF-8 CSV 字节。
     *
     * @param logs 待导出记录（可空，返回仅含表头的文件）
     * @return CSV 字节（含 BOM）
     */
    public static byte[] write(List<AuditLogVO> logs) {
        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", HEADERS)).append(CRLF);
        if (logs != null) {
            for (AuditLogVO log : logs) {
                csv.append(escape(text(log.id())))
                        .append(',').append(escape(time(log.logTime())))
                        .append(',').append(escape(text(log.userId())))
                        .append(',').append(escape(log.operatorName()))
                        .append(',').append(escape(log.module()))
                        .append(',').append(escape(log.action()))
                        .append(',').append(escape(log.targetType()))
                        .append(',').append(escape(text(log.targetId())))
                        .append(',').append(escape(resultText(log.result())))
                        .append(',').append(escape(log.ip()))
                        .append(',').append(escape(log.traceId()))
                        .append(',').append(escape(log.detail()))
                        .append(CRLF);
            }
        }

        byte[] body = csv.toString().getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[UTF8_BOM.length + body.length];
        System.arraycopy(UTF8_BOM, 0, out, 0, UTF8_BOM.length);
        System.arraycopy(body, 0, out, UTF8_BOM.length, body.length);
        return out;
    }

    /** 结果码转可读文本（未知值原样透出，避免静默丢信息）。 */
    private static String resultText(Integer result) {
        if (result == null) {
            return "";
        }
        if (result == OperationLog.RESULT_SUCCESS) {
            return "成功";
        }
        if (result == OperationLog.RESULT_FAIL) {
            return "失败";
        }
        return String.valueOf(result);
    }

    /** 按 CSV 规则转义：仅含分隔符 / 引号 / 换行的字段才加引号包裹。 */
    private static String escape(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        boolean needQuote = value.indexOf(',') >= 0
                || value.indexOf('"') >= 0
                || value.indexOf('\n') >= 0
                || value.indexOf('\r') >= 0;
        String escaped = value.replace("\"", "\"\"");
        return needQuote ? '"' + escaped + '"' : escaped;
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String time(LocalDateTime value) {
        return value == null ? "" : value.format(TIME_FORMATTER);
    }
}
