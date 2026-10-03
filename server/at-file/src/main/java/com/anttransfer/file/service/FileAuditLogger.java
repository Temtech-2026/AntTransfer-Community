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

import com.anttransfer.common.security.AuthenticatedUser;
import com.anttransfer.common.security.SensitiveDataMasker;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.common.audit.repository.OperationLogMapper;
import com.anttransfer.file.security.CurrentUserContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 文件管理审计器：把「关键操作写 {@code sys_operation_log}」收敛成一处。
 *
 * <p><b>与 {@code ShareAuditLogger} 的差别在「调用方要传什么」：</b>分享域那个要求调用方
 * 自行传入 userId / clientIp / userAgent。文件管理的写点多出一个数量级（上传、下载、改、
 * 移、删、还原、销毁、回滚、打包…），若每个调用点都要凑齐这三样，漏传是迟早的事——
 * 而审计的失效方式是<b>静默</b>的（少一行日志没人会发现），恰恰最不能靠人工纪律保证。
 * 故本类直接从 MDC / 请求上下文 / 安全上下文自取，调用方只需描述「发生了什么」。</p>
 *
 * <p><b>永不抛异常：</b>审计失败不能反过来让业务失败（用户上传成功却因日志写不进去而报错，
 * 是主次颠倒）。全部吞掉并记 error 日志，由监控告警而非请求方感知。</p>
 *
 * <p><b>失败记录走独立事务（REQUIRES_NEW）——这是本类唯一的非平凡之处：</b>
 * 失败审计的典型调用形态是<b>「记一条 fail，紧接着 throw」</b>
 * （如销毁高敏感文件时缺审批单，见 {@code FileNodeService#destroy}）。
 * 若该 INSERT 跟随业务事务，那声 {@code throw} 触发的回滚会把它一并抹掉，
 * 于是「越权 / 缺审批被拒」这类<b>最需要留痕的事件</b>恰恰在库里查不到——
 * 审计只在一切顺利时可信，等于没有。故失败记录开独立事务先提交，
 * 业务事务随后回滚也不影响它。成功记录则相反：继续加入调用方事务，
 * 使「业务回滚了、库里却留着一条成功」不可能发生。</p>
 *
 * <p><b>敏感字段机械化清洗：</b>{@code detail} 在序列化前统一经
 * {@link SensitiveDataMasker#maskMap} 按键名清洗（口令 / 令牌 / 提取码等整棵子树替换为
 * {@code ***}）。不靠调用方自觉——审计表是 append-only，一次误 put 就是明文永久留档。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
public class FileAuditLogger {

    private static final int MAX_DETAIL_LENGTH = 2000;
    private static final int MAX_IP_LENGTH = 64;
    private static final int MAX_UA_LENGTH = 256;

    private final OperationLogMapper operationLogMapper;
    private final ObjectMapper objectMapper;

    /**
     * 失败审计的独立事务模板：不用 {@code @Transactional} 注解是因为作用点是本类的私有分支，
     * 注解要走代理、自调用会失效（见 {@link #log} 的类注说明）。
     */
    private final TransactionTemplate failAuditTx;

    public FileAuditLogger(OperationLogMapper operationLogMapper, ObjectMapper objectMapper,
                           PlatformTransactionManager transactionManager) {
        this.operationLogMapper = operationLogMapper;
        this.objectMapper = objectMapper;
        this.failAuditTx = new TransactionTemplate(transactionManager);
        this.failAuditTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * 记录一次文件管理操作。
     *
     * @param action     动作编码（{@link OperationLog} 中的 {@code ACTION_*} 常量）
     * @param targetType 对象类型（{@link OperationLog} 中的 {@code TARGET_*} 常量）
     * @param targetId   对象 ID（可为 null，如「批量删除」记主对象）
     * @param success    是否成功
     * @param extra      附加上下文（如文件名、大小、审批单号），会被序列化进 detail
     */
    public void log(String action, String targetType, Long targetId, boolean success, Map<String, Object> extra) {
        try {
            OperationLog entity = buildEntity(action, targetType, targetId, success, extra);
            if (success) {
                operationLogMapper.insert(entity);
            } else {
                failAuditTx.executeWithoutResult(status -> operationLogMapper.insert(entity));
            }
        } catch (Exception e) {
            log.error("写文件管理审计失败（不影响业务）：action={}, targetId={}", action, targetId, e);
        }
    }

    /** 组装审计行（不含写入），便于把「组装失败」与「写入失败」统一收口到同一处兜底。 */
    private OperationLog buildEntity(String action, String targetType, Long targetId, boolean success,
                                     Map<String, Object> extra) throws Exception {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("action", action);
        HttpServletRequest request = currentRequest();
        String userAgent = request == null ? null : request.getHeader("User-Agent");
        if (userAgent != null && !userAgent.isBlank()) {
            detail.put("ua", truncate(userAgent, MAX_UA_LENGTH));
        }
        if (extra != null && !extra.isEmpty()) {
            detail.putAll(extra);
        }

        OperationLog entity = new OperationLog();
        entity.setUserId(currentUserIdQuietly());
        entity.setAction(action);
        entity.setModule(OperationLog.MODULE_FILE);
        entity.setTargetType(targetType);
        entity.setTargetId(targetId);
        entity.setTraceId(MDC.get("traceId"));
        entity.setIp(truncate(clientIp(request), MAX_IP_LENGTH));
        entity.setResult(success ? OperationLog.RESULT_SUCCESS : OperationLog.RESULT_FAIL);
        entity.setDetail(truncate(objectMapper.writeValueAsString(SensitiveDataMasker.maskMap(detail)),
                MAX_DETAIL_LENGTH));
        entity.setLogTime(LocalDateTime.now());
        return entity;
    }

    /** 记录成功事件（最常用形态）。 */
    public void success(String action, String targetType, Long targetId, Map<String, Object> extra) {
        log(action, targetType, targetId, true, extra);
    }

    /** 记录失败事件；审计失败时通常没有更多上下文，故只带原因。 */
    public void fail(String action, String targetType, Long targetId, String reason) {
        log(action, targetType, targetId, false, Map.of("reason", reason == null ? "" : reason));
    }

    /** 取当前用户 ID，未登录返回 null（系统级清理任务无操作人）。 */
    private Long currentUserIdQuietly() {
        return CurrentUserContext.getOptionalUser().map(AuthenticatedUser::getId).orElse(null);
    }

    /** 取当前请求（定时任务等无请求上下文的场景返回 null）。 */
    private HttpServletRequest currentRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            return attrs.getRequest();
        }
        return null;
    }

    /**
     * 解析真实客户端 IP：优先取代理链首个地址。
     *
     * <p>审计里记到的是「反代 IP」还是「真实来源」，直接决定这条日志能不能用于追责。</p>
     */
    private String clientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        return (realIp != null && !realIp.isBlank()) ? realIp : request.getRemoteAddr();
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
