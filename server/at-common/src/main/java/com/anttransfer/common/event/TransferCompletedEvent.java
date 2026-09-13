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
 * 传输完成事件（at-transfer 在分片合并落库、事务提交后发布）。
 *
 * <p>用途：通知域据此给发起人发「传输已完成」提醒（{@code notify_type=8}），
 * 该提醒纳入待办中心（见 {@code NotifyType#isTodo}）。事件<b>不含文件字节</b>，
 * 只承载可推送的元信息摘要。</p>
 *
 * <p><b>落地状态（AT-DIFF-11）：</b>at-transfer 当前尚未实现（CE 传输主线未开工），
 * 本事件先由 at-common 定义契约、at-collaboration 侧监听器就绪；at-transfer 实现时
 * 只需在合并成功后 {@code afterCommit} 发布本事件即可自动打通通知与待办，
 * 无需再改动通知域。</p>
 *
 * @param transferId 传输任务 ID（{@code sys_upload_task.id} 或其演进后的传输任务表）
 * @param userId     传输发起人用户 ID（接收提醒者）
 * @param fileName   文件名（用于提醒文案）
 * @param fileSize   文件字节数
 * @param finishedAt 完成时刻
 * @author AntTransfer CE
 */
public record TransferCompletedEvent(
        Long transferId,
        Long userId,
        String fileName,
        Long fileSize,
        LocalDateTime finishedAt) {
}
