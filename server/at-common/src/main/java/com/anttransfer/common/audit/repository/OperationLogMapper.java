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
package com.anttransfer.common.audit.repository;

import com.anttransfer.common.audit.OperationLog;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 操作审计日志 Mapper（append-only：仅 insert / select，禁止 update / delete 语义）。
 *
 * <p>放在共享内核而非某个业务模块：审计是跨域横切能力，且 V1 表注释已归口
 * 「at-common 审计」（详见 {@link OperationLog} 类注释）。扫描方式与其它 Mapper 一致——
 * 以 {@code @Mapper} 注解被 MyBatis 自动扫描（启动类位于 {@code com.anttransfer}，
 * 本包在其子包内）。</p>
 *
 * <p><b>不使用 updateById / deleteById</b>：审计表是 append-only，业务代码不应出现这两个调用；
 * 归档清理属独立的周期任务范畴，按 {@code log_time} 整表导出后清理，不在业务模块实现。</p>
 *
 * <p>写入方：{@code at-file} 的 {@code FileAuditLogger} / {@code ShareAuditLogger}，
 * {@code at-permission} 的 {@code PermissionAuditLogger}。
 * 查询方：{@code at-permission} 的 {@code AuditLogQueryService}。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface OperationLogMapper extends BaseMapper<OperationLog> {
}
