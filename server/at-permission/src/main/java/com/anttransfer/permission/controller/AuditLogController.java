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
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.result.Result;
import com.anttransfer.permission.constant.SystemAdminConstants;
import com.anttransfer.permission.model.dto.AuditLogQueryDTO;
import com.anttransfer.permission.model.vo.AuditLogVO;
import com.anttransfer.permission.service.AuditLogQueryService;
import com.anttransfer.permission.util.AuditLogCsv;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 审计日志读端点（US-06 三权分立与审计）。
 *
 * <p><b>前缀 {@code /v1/audit}：</b>审计不是「系统管理面」的子资源——系统管理面
 * （{@code /v1/system/**}）受众是管理员，而审计的受众是独立的安全审计员
 * （AUDITOR，data_scope=3 但只有只读权限点）。给审计独立前缀，使其权限点
 * {@code audit:log:read} 与菜单 {@code audit}（V2 的 101 节点）在路由层也一一对应。</p>
 *
 * <p><b>两个端点共用一个权限点：</b>「查询」与「导出」是同一份数据的两种取数方式，
 * 导出并不比查询多泄露任何字段（{@code detail} 写入侧已脱敏）。若拆成两个权限点，
 * 会让「能看不能导」这种无安全收益的组合成立，反而增加授权矩阵复杂度。</p>
 *
 * <p>审计记录 append-only：本控制器不提供任何写端点（含删除 / 清空），
 * 与「任何角色都无 {@code audit:log:clear}」的红线一致。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/audit")
public class AuditLogController {

    private static final DateTimeFormatter FILE_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final AuditLogQueryService auditLogQueryService;

    public AuditLogController(AuditLogQueryService auditLogQueryService) {
        this.auditLogQueryService = auditLogQueryService;
    }

    /**
     * 审计日志分页检索。
     *
     * <p>过滤维度对齐 {@code sys_operation_log} 的四个索引；时间参数为 ISO-8601
     * 本地时间（{@code 2026-09-14T00:00:00}），列表固定按 {@code logTime} 倒序。</p>
     */
    @GetMapping("/logs")
    @RequiresPerm(SystemAdminConstants.PERM_AUDIT_LOG_READ)
    public Result<PageResult<AuditLogVO>> page(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) Long targetId,
            @RequestParam(required = false) Integer result,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime,
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long pageSize) {
        return Result.ok(auditLogQueryService.pageLogs(new AuditLogQueryDTO(
                userId, action, module, targetType, targetId, result,
                startTime, endTime, current, pageSize)));
    }

    /**
     * 审计日志导出（CSV，同一套过滤条件）。
     *
     * <p>返回附件而非 {@code Result} 包裹的 JSON：导出是要落盘归档的文件流，
     * 让浏览器按 {@code Content-Disposition} 直接下载；错误仍由全局异常处理返回
     * 标准 JSON 错误体（{@code Content-Type} 以实际响应为准）。</p>
     */
    @GetMapping("/logs/export")
    @RequiresPerm(SystemAdminConstants.PERM_AUDIT_LOG_READ)
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) Long targetId,
            @RequestParam(required = false) Integer result,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        List<AuditLogVO> logs = auditLogQueryService.exportLogs(new AuditLogQueryDTO(
                userId, action, module, targetType, targetId, result,
                startTime, endTime, 1L, AuditLogQueryService.EXPORT_MAX_ROWS));
        byte[] body = AuditLogCsv.write(logs);
        String fileName = "audit-log-" + LocalDateTime.now().format(FILE_TIME) + ".csv";
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                // 与文件下载同一防线：禁止把 .csv 内容当 HTML 渲染（存储型 XSS）
                .header("X-Content-Type-Options", "nosniff")
                .contentLength(body.length)
                .body(body);
    }
}
