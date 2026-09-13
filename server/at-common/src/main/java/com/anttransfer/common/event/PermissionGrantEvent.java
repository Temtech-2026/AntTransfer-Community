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
package com.anttransfer.common.event;

import java.time.LocalDateTime;

/**
 * 授权下发事件（审批通过、写 {@code sys_user_file_permission} 后，<b>事务提交后</b>发布）。
 *
 * <p>与 {@link PermissionExpiredEvent} 对称：<b>事件不承载授权状态变更本身</b>——授权记录
 * 已在审批同事务内落库（CAS + insert），事件只承载提交后的副作用（通知申请人、失效
 * {@code at:perm} 缓存、审计）。发布点一律置于 {@code TransactionSynchronization.afterCommit}
 * （[T-01]），避免「事务回滚但事件已发」的幻影授权。</p>
 *
 * <p><b>为何位于 at-common（AT-DIFF-10）：</b>本事件原属 at-permission 的 {@code event} 包，
 * 但发布后的副作用至少有两个<b>不同模块</b>的消费者——at-collaboration（转成站内通知 +
 * WebSocket 推送）与审计侧。按模块依赖铁律，跨模块消费的事件契约必须沉到共享内核，
 * 否则 at-collaboration 必须编译期依赖 at-permission。发布方（at-permission）与消费方
 * 均只依赖 at-common，事件语义与载荷与移动前完全一致（纯包名迁移，无破坏性变更）。</p>
 *
 * @param applicationId 来源申请单 ID
 * @param grantId       授权记录 ID（{@code sys_user_file_permission.id}）
 * @param userId        被授权人用户 ID
 * @param resourceType  资源类型
 * @param resourceId    资源 ID
 * @param grantType     最终授权动作（ACCESS / DOWNLOAD / EDIT / SHARE）
 * @param expireAt      最终到期时刻（null = 长期有效）
 * @param approverId    审批人用户 ID
 * @author AntTransfer CE
 */
public record PermissionGrantEvent(
        Long applicationId,
        Long grantId,
        Long userId,
        String resourceType,
        Long resourceId,
        String grantType,
        LocalDateTime expireAt,
        Long approverId) {
}
