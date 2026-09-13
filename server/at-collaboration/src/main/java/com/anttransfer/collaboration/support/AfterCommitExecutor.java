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
package com.anttransfer.collaboration.support;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * 「事务提交后执行」小工具——把 WebSocket 推送推迟到数据真正落定之后。
 *
 * <p><b>为什么必须有它：</b>通知与会话消息都是「先落库、再推送」。若在事务内直接推送，
 * 一旦外层事务随后回滚，就会出现<b>幻影消息</b>——接收人已经看到弹窗，库里却查不到该消息，
 * 刷新后消息凭空消失，且未读数不会变化，是典型的「不可复现的 bug 报告」。
 * 反之，提交后推送失败只会让在线用户退化为「下次补拉才看到」，<b>不丢消息</b>。</p>
 *
 * <p><b>无事务场景：</b>调用方未开启事务（如纯查询后的补推、定时任务）时直接执行——
 * 此时不存在「提交」概念，同步执行即最终一致。</p>
 *
 * <p><b>异常语义：</b>{@code afterCommit} 回调中抛出的异常不会影响已提交的事务
 * （Spring 仅记录日志），因此调用方仍应对推送做各自的 try/catch 隔离，
 * 避免一条消息推送失败导致后续消息不再推送。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class AfterCommitExecutor {

    /**
     * 注册提交后动作；无活动事务时立即执行。
     *
     * @param task 待执行动作（非空）
     */
    public void run(Runnable task) {
        if (task == null) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
            return;
        }
        task.run();
    }
}
