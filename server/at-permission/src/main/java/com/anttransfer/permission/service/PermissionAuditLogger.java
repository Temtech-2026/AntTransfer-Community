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
import com.anttransfer.common.security.AuthenticatedUser;
import com.anttransfer.common.security.SensitiveDataMasker;
import com.anttransfer.permission.security.AuthzContext;
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
 * 权限与系统管理审计器：把「用户 / 角色管理、审批、授权回收」这些写操作留痕到
 * {@code sys_operation_log}。
 *
 * <p>本类与 at-file 的 {@code FileAuditLogger} <b>结构同构</b>（自取 MDC / 请求 / 安全上下文、
 * 成功入调用方事务、失败走 {@code REQUIRES_NEW} 独立事务、永不抛异常）。之所以没有抽成一份
 * 共享实现：审计写入依赖 {@code HttpServletRequest} 与 Jackson，而 {@code at-common} 的依赖面
 * 被刻意压到「仅 mybatis-plus 注解 + slf4j + lombok」（见 server/at-common/pom.xml 注释），
 * 无法承载 web 层能力；跨模块抽到某个业务模块又违反「at-permission 仅依赖 at-common」的模块铁律。
 * 因此共享的是<b>实体与 Mapper</b>（已在 at-common），而非写入器。三份同构写入器属已知取舍，
 * 已登记于 docs/development/AT-DIFF-todos.md。</p>
 *
 * <p><b>永不抛异常：</b>审计写失败不能反过来让管理操作失败。全部吞掉并记 error 日志，
 * 由监控告警而非请求方感知。</p>
 *
 * <p><b>成功 / 失败的落库时机不同（与 FileAuditLogger 同一口径）：</b>成功记录加入调用方事务，
 * 使「业务回滚了、库里却留着一条成功」不可能发生；失败记录开独立事务先提交，
 * 因为失败审计的典型形态是「记一条 fail，紧接着 throw」——若跟随业务事务，
 * 那声 {@code throw} 触发的回滚会把它一并抹掉，于是「越权被拒」这类最需要留痕的事件
 * 恰恰在库里查不到。</p>
 *
 * <p><b>绝不记录敏感字段：</b>口令明文 / 哈希、令牌、提取码等一律不入 {@code detail}；
 * 重置口令只记「谁重置了谁的」，不记内容。该约束<b>不依赖调用方自觉</b>：{@code detail} 在
 * 序列化前统一经 {@link SensitiveDataMasker#maskMap} 按键名机械清洗，即便未来有人误 put，
 * 落库的也只是 {@code ***}（按键名判定，整棵子树替换，见 {@link SensitiveDataMasker}）。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
public class PermissionAuditLogger {

    private static final int MAX_DETAIL_LENGTH = 2000;
    private static final int MAX_IP_LENGTH = 64;
    private static final int MAX_UA_LENGTH = 256;

    private final OperationLogMapper operationLogMapper;
    private final ObjectMapper objectMapper;

    /**
     * 失败审计的独立事务模板：不用 {@code @Transactional} 注解，因为作用点是本类的私有分支，
     * 注解要走代理、自调用会失效。
     */
    private final TransactionTemplate failAuditTx;

    public PermissionAuditLogger(OperationLogMapper operationLogMapper, ObjectMapper objectMapper,
                                 PlatformTransactionManager transactionManager) {
        this.operationLogMapper = operationLogMapper;
        this.objectMapper = objectMapper;
        this.failAuditTx = new TransactionTemplate(transactionManager);
        this.failAuditTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * 记录一次权限 / 系统管理操作。
     *
     * @param action     动作编码（{@link OperationLog} 中的 {@code ACTION_*} 常量）
     * @param targetType 对象类型（{@link OperationLog} 中的 {@code TARGET_*} 常量）
     * @param targetId   对象 ID（可为 null，如系统级批量回收记 {@code TARGET_SYSTEM}）
     * @param success    是否成功
     * @param extra      附加上下文（如 from → to、变更前后集合），序列化进 detail
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
            log.error("写权限管理审计失败（不影响业务）：action={}, targetId={}", action, targetId, e);
        }
    }

    /** 记录成功事件（最常用形态）。 */
    public void success(String action, String targetType, Long targetId, Map<String, Object> extra) {
        log(action, targetType, targetId, true, extra);
    }

    /** 记录失败事件（如红线守卫拦截），独立事务落库以扛住随后的业务回滚。 */
    public void fail(String action, String targetType, Long targetId, String reason) {
        log(action, targetType, targetId, false, Map.of("reason", reason == null ? "" : reason));
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
        entity.setModule(OperationLog.MODULE_PERMISSION);
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

    /** 取当前用户 ID，未登录返回 null（到期回收等系统任务无操作人）。 */
    private Long currentUserIdQuietly() {
        return AuthzContext.getOptionalUser().map(AuthenticatedUser::getId).orElse(null);
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
