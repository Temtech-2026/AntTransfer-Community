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
package com.anttransfer.permission.model.vo;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

import java.time.LocalDateTime;

/**
 * 审计日志列表 / 导出视图（跨域投影：FILE / PERMISSION / AUTH 的审计行共用同一结构）。
 *
 * <p><b>为什么带 {@code operatorName}：</b>审计记录只存 {@code user_id}，而追责场景里
 * 「谁干的」首先看的是可读的展示名。展示名经 {@code UserLookupPort.findContacts} 批量
 * 反查（{@code sys_user} 属 at-auth 表族，不得直连），查不到时回落为 null，
 * 由前端展示为「已注销用户 / 系统」——{@code user_id} 为空即匿名或系统任务
 * （如到期回收、回收站清理），此时本身就没有操作人。</p>
 *
 * <p><b>只读快照：</b>本视图仅用于展示 / 导出，不承担回写。{@code detail} 原样透出
 * （写入侧已脱敏，绝不含口令 / 令牌 / 提取码明文）。</p>
 *
 * @param id           日志 ID
 * @param userId       操作人用户 ID（匿名 / 系统任务为 null）
 * @param operatorName 操作人展示名（反查不到或系统任务为 null）
 * @param action       动作编码（{@code USER_CREATE} / {@code APPROVE} / {@code FILE_DOWNLOAD}…）
 * @param module       所属域：AUTH/PERMISSION/TRANSFER/FILE/COLLABORATION/COMMON
 * @param targetType   操作对象类型：USER/ROLE/FILE/SHARE/APPLICATION/GRANT/SYSTEM…
 * @param targetId     操作对象 ID
 * @param traceId      链路追踪 ID（排障凭证）
 * @param ip           来源 IP
 * @param result       结果：0-成功 1-失败
 * @param detail       审计详情（脱敏后的 JSON / 可读上下文）
 * @param logTime      审计事件时间（业务时间）
 * @author AntTransfer CE
 */
public record AuditLogVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long id,
        @JsonSerialize(using = ToStringSerializer.class)
        Long userId,
        String operatorName,
        String action,
        String module,
        String targetType,
        @JsonSerialize(using = ToStringSerializer.class)
        Long targetId,
        String traceId,
        String ip,
        Integer result,
        String detail,
        LocalDateTime logTime) {
}
