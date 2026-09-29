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
package com.anttransfer.transfer.event;

import com.anttransfer.common.event.TransferCompletedEvent;
import com.anttransfer.transfer.model.entity.TransferTask;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 传输领域事件发布器：把「传输结果」翻译成 at-common 定义的事件契约。
 *
 * <p><b>为何单独一层而不在 Service 里直接 {@code publishEvent}：</b>
 * {@link TransferCompletedEvent} 是跨模块契约（消费方是 at-collaboration 的通知监听器），
 * 集中一处发布才能统一「何时发 / 发什么 / 发失败怎么办」的口径，
 * 也避免每个业务流程各自拼事件载荷时漏字段。</p>
 *
 * <p><b>发布时机（调用方义务）：</b>必须在<b>状态已提交之后</b>调用。
 * CE 的合并路径里 {@code TransferTaskStateStore#transition} 自带独立事务、返回即已提交，
 * 故合并成功分支直接调用是安全的；监听器侧另有 {@code REQUIRES_NEW} 兜底，
 * 保证通知落库不随业务事务回滚。</p>
 *
 * <p><b>失败语义：</b>事件只承载副作用（站内通知 / 待办投影），
 * 因此本类吞掉发布异常并留痕——通知发不出去绝不能反向影响一笔已完成的传输。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TransferEventPublisher {

    private final ApplicationEventPublisher applicationEventPublisher;

    /** 传输完成（分片已合并、内容已落库且任务状态已置「已完成」）。 */
    public void publishCompleted(TransferTask task) {
        if (task == null || task.getId() == null || task.getUserId() == null) {
            log.warn("[transfer] 传输完成事件载荷不完整，跳过发布：task={}", task);
            return;
        }
        try {
            applicationEventPublisher.publishEvent(new TransferCompletedEvent(
                    task.getId(),
                    task.getUserId(),
                    task.getFileName(),
                    task.getFileSize(),
                    LocalDateTime.now()));
        } catch (Exception e) {
            log.error("传输完成事件发布失败（不影响已落库的传输结果）：uploadId={}, cause={}",
                    task.getId(), e.toString());
        }
    }
}
