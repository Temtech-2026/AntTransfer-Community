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
import com.anttransfer.permission.constant.SystemAdminConstants;
import com.anttransfer.permission.model.dto.AuditLogQueryDTO;
import com.anttransfer.permission.model.vo.AuditLogVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 审计日志检索与导出（只读，US-06 / PRD §4.6）。
 *
 * <p><b>为什么查询入口在 at-permission：</b>审计写入器有三份（at-file ×2 / at-permission ×1，
 * 见 {@code PermissionAuditLogger} 类注释），但「读」是单一职责——权限点
 * {@code audit:log:read}、AUDITOR 角色、审计菜单都归口权限域，故查询/导出集中在本模块，
 * 各业务模块只负责写。实体与 Mapper 在 at-common，本类不越过模块铁律。</p>
 *
 * <p><b>append-only 只读承诺：</b>本服务只调用 {@code selectPage / selectList}，
 * 不提供任何 update / delete 语义。审计记录不可改、不可删（PRD §3 US-06），
 * 归档清理属独立周期任务，不在此实现。</p>
 *
 * <p><b>不使用数据范围收敛：</b>持有 {@code audit:log:read} 的只有内置 SUPER_ADMIN 与
 * AUDITOR，两者 data_scope 均为 3（全部）；审计的合规价值恰恰在于「全量可追溯」，
 * 按部门过滤会把一次跨部门越权的证据切掉。故此处不套 {@code AccessControlService}，
 * 功能权限点即唯一闸门。若未来出现非全量的审计只读角色，须在此补收敛而非放宽。</p>
 *
 * <p><b>排序固定：</b>一律按 {@code log_time DESC, id DESC}，对齐索引
 * {@code idx_log_time(log_time)}；不接受任意字段排序，避免出现走不了索引的全表排序。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
public class AuditLogQueryService {

    /**
     * 单次导出上限。
     *
     * <p>分页插件的 {@code maxLimit=100} 只作用于 {@code selectPage}，导出走
     * {@code selectList} 不受其约束，因此必须自设上界——否则一个空条件导出会把
     * 整张审计表（留存 ≥ 6 个月，量级最大）读进内存。超限时截断而非报错，
     * 保证「归档导出」这一只读动作始终可用。</p>
     */
    public static final int EXPORT_MAX_ROWS = 10_000;

    private final OperationLogMapper operationLogMapper;
    private final UserLookupPort userLookupPort;

    public AuditLogQueryService(OperationLogMapper operationLogMapper, UserLookupPort userLookupPort) {
        this.operationLogMapper = operationLogMapper;
        this.userLookupPort = userLookupPort;
    }

    /**
     * 审计日志分页（按操作人 / 对象 / 域动作 / 结果 / 时间过滤）。
     */
    public PageResult<AuditLogVO> pageLogs(AuditLogQueryDTO query) {
        assertTimeRange(query);
        long current = clampCurrent(query.current());
        long pageSize = clampSize(query.pageSize());

        Page<OperationLog> page = operationLogMapper.selectPage(
                new Page<>(current, pageSize), toWrapper(query));
        return PageResult.of(toVOs(page.getRecords()), page.getTotal(), page.getCurrent(), page.getSize());
    }

    /**
     * 审计日志导出（同一套过滤条件，结果集固定上界 {@link #EXPORT_MAX_ROWS}）。
     *
     * <p>用 {@code last("LIMIT ...")} 而非 {@code selectPage}：后者会被全局分页插件
     * 收敛到 100 条，导出变成「只导首页」，与用户预期严重不符。此处拼接的是编译期
     * 常量，无注入面。</p>
     */
    public List<AuditLogVO> exportLogs(AuditLogQueryDTO query) {
        assertTimeRange(query);
        LambdaQueryWrapper<OperationLog> wrapper = toWrapper(query)
                .last("LIMIT " + EXPORT_MAX_ROWS);
        return toVOs(operationLogMapper.selectList(wrapper));
    }

    /* ============================ 内部实现 ============================ */

    /**
     * 组装过滤条件（列表与导出共用，保证筛出的集合一致）。
     *
     * <p>条件使用 {@code eq} 精确匹配：审计检索要的是「可复现的精确证据集」，
     * 模糊匹配会把无关记录混进导出报告，削弱其证据效力。动作 / 域 / 对象类型
     * 由前端从字典下拉选择，无需 LIKE。</p>
     */
    private LambdaQueryWrapper<OperationLog> toWrapper(AuditLogQueryDTO query) {
        return Wrappers.<OperationLog>lambdaQuery()
                .eq(query.userId() != null, OperationLog::getUserId, query.userId())
                .eq(StringUtils.hasText(query.action()), OperationLog::getAction, query.action())
                .eq(StringUtils.hasText(query.module()), OperationLog::getModule, query.module())
                .eq(StringUtils.hasText(query.targetType()), OperationLog::getTargetType, query.targetType())
                .eq(query.targetId() != null, OperationLog::getTargetId, query.targetId())
                .eq(query.result() != null, OperationLog::getResult, query.result())
                .ge(query.startTime() != null, OperationLog::getLogTime, query.startTime())
                .le(query.endTime() != null, OperationLog::getLogTime, query.endTime())
                .orderByDesc(OperationLog::getLogTime)
                .orderByDesc(OperationLog::getId);
    }

    /** 批量投影为视图，并一次性反查操作人展示名（N+1 → 1）。 */
    private List<AuditLogVO> toVOs(List<OperationLog> logs) {
        if (logs == null || logs.isEmpty()) {
            return List.of();
        }
        Set<Long> userIds = logs.stream()
                .map(OperationLog::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, UserContact> contacts = userIds.isEmpty() ? Map.of() : userLookupPort.findContacts(userIds);
        return logs.stream().map(log -> toVO(log, contacts)).toList();
    }

    private AuditLogVO toVO(OperationLog log, Map<Long, UserContact> contacts) {
        UserContact contact = log.getUserId() == null ? null : contacts.get(log.getUserId());
        return new AuditLogVO(
                log.getId(),
                log.getUserId(),
                contact == null ? null : contact.displayName(),
                log.getAction(),
                log.getModule(),
                log.getTargetType(),
                log.getTargetId(),
                log.getTraceId(),
                log.getIp(),
                log.getResult(),
                log.getDetail(),
                log.getLogTime());
    }

    /** 时间区间自检：开始晚于结束属于无效检索，早失败避免拿空结果误判「无此记录」。 */
    private void assertTimeRange(AuditLogQueryDTO query) {
        if (query.startTime() != null && query.endTime() != null
                && query.startTime().isAfter(query.endTime())) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "开始时间不能晚于结束时间");
        }
    }

    private long clampCurrent(long current) {
        return Math.max(current, 1L);
    }

    private long clampSize(long pageSize) {
        return Math.min(Math.max(pageSize, 1L), SystemAdminConstants.MAX_PAGE_SIZE);
    }
}
