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
package com.anttransfer.permission.model.dto;

import java.time.LocalDateTime;

/**
 * 审计日志检索条件（查询与导出共用一套过滤，避免「列表能筛、导出筛不了」的错位）。
 *
 * <p>各字段与 {@code sys_operation_log} 的四个索引一一对应，保证常见过滤都能走索引：
 * {@code userId+logTime}（idx_user_time）、{@code targetType+targetId+logTime}（idx_target）、
 * {@code module+action+logTime}（idx_module_action）、纯 {@code logTime}（idx_log_time）。
 * 全部为可选条件，缺省即不加该维度过滤。</p>
 *
 * <p>分页参数 {@code current / pageSize} 仅列表接口使用；导出接口忽略二者，
 * 改用服务层固定上限（见 {@code AuditLogQueryService.EXPORT_MAX_ROWS}）。</p>
 *
 * @param userId     操作人用户 ID（可空）
 * @param action     动作编码（精确匹配，可空）
 * @param module     所属域（精确匹配，可空）
 * @param targetType 对象类型（精确匹配，可空）
 * @param targetId   对象 ID（可空，通常与 targetType 同用）
 * @param result     结果：0-成功 1-失败（可空）
 * @param startTime  事件时间下界（含，可空）
 * @param endTime    事件时间上界（含，可空）
 * @param current    页码（从 1 开始）
 * @param pageSize   每页条数（服务层收敛到 1..100）
 * @author AntTransfer CE
 */
public record AuditLogQueryDTO(
        Long userId,
        String action,
        String module,
        String targetType,
        Long targetId,
        Integer result,
        LocalDateTime startTime,
        LocalDateTime endTime,
        long current,
        long pageSize) {
}
