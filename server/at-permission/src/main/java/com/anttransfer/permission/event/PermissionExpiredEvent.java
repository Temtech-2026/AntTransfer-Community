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
package com.anttransfer.permission.event;

import java.time.LocalDateTime;

/**
 * 授权到期回收事件（PermissionGrantExpireScheduler 事务提交后发布）。
 *
 * <p>事件仅承载「通知 / 审计」侧行为（写审计日志、通知申请人可选），
 * <b>不承载授权状态变更本身</b>——回收状态已在回收任务的同事务内通过 CAS 落库，
 * 事件属事务提交后的异步副作用（见 system-design §6 事务红线 / use-case-flows §2.4）。</p>
 *
 * <p>订阅示例（消费者位于同一 Spring 容器，如审计模块）：</p>
 * <pre>{@code
 * @EventListener
 * public void onGrantExpired(PermissionExpiredEvent event) {
 *     // 写 sys_operation_log(action=REVOKE, detail=事件快照)；可选 sys_notify_message 通知申请人
 * }
 * }</pre>
 *
 * @param grantId      被回收的授权记录 ID
 * @param userId       被授权人用户 ID
 * @param resourceType 目标资源类型（SPACE / FILE）
 * @param resourceId   目标资源 ID
 * @param grantType    授权类型（ACCESS / DOWNLOAD）
 * @param expireAt     授权原定过期时间
 * @param revokedAt    实际回收时间
 * @author AntTransfer CE
 */
public record PermissionExpiredEvent(
        Long grantId,
        Long userId,
        String resourceType,
        Long resourceId,
        String grantType,
        LocalDateTime expireAt,
        LocalDateTime revokedAt) {
}
