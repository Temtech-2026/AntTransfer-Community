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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 外发分享审计写入器（append-only）。
 *
 * <p>覆盖两类留痕要求：</p>
 * <ul>
 *     <li>外发拦截（后缀黑名单 / 敏感词）——「谁试图外发什么、为何被拦」；</li>
 *     <li>访客下载 / 预览——「谁（IP/UA）在何时取走了哪份文件」（PRD 安全合规要求）。</li>
 * </ul>
 *
 * <p><b>吞异常策略</b>：审计写失败不能反向阻断用户业务（否则一次 DB 抖动会演变为
 * 「所有人都无法外发 / 下载」），故此处 catch 并 error 告警，交由日志采集侧兜底。
 * 这是有意取舍：<b>审计尽力而为，业务可用性优先</b>。</p>
 *
 * <p><b>UA 落位</b>：{@code sys_operation_log} 无 UA 列，UA 与上下文一并写入 {@code detail}
 * （JSON，超长截断），不新增 Flyway 迁移。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ShareAuditLogger {

    /** detail 最大长度（防超长 UA / 原因串撑爆列） */
    private static final int MAX_DETAIL_LENGTH = 1000;
    /** IP 最大长度（适配列定义） */
    private static final int MAX_IP_LENGTH = 64;
    /** UA 最大长度（写入 detail 前的截断） */
    private static final int MAX_UA_LENGTH = 300;

    private final OperationLogMapper operationLogMapper;
    private final ObjectMapper objectMapper;

    /**
     * 记录一次外发分享审计事件。
     *
     * @param action    动作编码（见 {@link OperationLog} 常量）
     * @param userId    操作人（访客为 {@code null}）
     * @param shareId   链接 ID
     * @param clientIp  来源 IP
     * @param userAgent 来源 UA
     * @param success   是否成功
     * @param extra     附加上下文（可空；如 reason / fileName / accessType）
     */
    public void log(String action, Long userId, Long shareId, String clientIp, String userAgent,
                    boolean success, Map<String, Object> extra) {
        try {
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("action", action);
            if (userAgent != null && !userAgent.isBlank()) {
                detail.put("ua", truncate(userAgent, MAX_UA_LENGTH));
            }
            if (extra != null) {
                detail.putAll(extra);
            }
            OperationLog entity = new OperationLog();
            entity.setUserId(userId);
            entity.setAction(action);
            entity.setModule(OperationLog.MODULE_FILE);
            entity.setTargetType(OperationLog.TARGET_SHARE);
            entity.setTargetId(shareId);
            entity.setTraceId(MDC.get("traceId"));
            entity.setIp(truncate(clientIp, MAX_IP_LENGTH));
            entity.setResult(success ? OperationLog.RESULT_SUCCESS : OperationLog.RESULT_FAIL);
            entity.setDetail(truncate(objectMapper.writeValueAsString(detail), MAX_DETAIL_LENGTH));
            entity.setLogTime(LocalDateTime.now());
            operationLogMapper.insert(entity);
        } catch (Exception e) {
            log.error("写外发分享审计失败（不影响业务）：action={}, shareId={}", action, shareId, e);
        }
    }

    /**
     * 便捷方法：记录成功事件。
     */
    public void success(String action, Long userId, Long shareId, String clientIp, String userAgent,
                        Map<String, Object> extra) {
        log(action, userId, shareId, clientIp, userAgent, true, extra);
    }

    /**
     * 便捷方法：记录失败 / 拦截事件。
     */
    public void failure(String action, Long userId, Long shareId, String clientIp, String userAgent, String reason) {
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("reason", reason);
        log(action, userId, shareId, clientIp, userAgent, false, extra);
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
