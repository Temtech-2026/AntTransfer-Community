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
package com.anttransfer.permission.util;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * 事务提交后副作用执行器（事件发布 / 缓存失效的统一入口）。
 *
 * <p>授权与申请单状态在事务内落库，而<b>事件与缓存失效必须等提交成功之后</b>才发生：
 * 否则事务回滚时会留下「事件已发但库里没有」的幻影授权（[T-01]）。
 * 无活动事务时立即执行，保证单测与无事务调用路径行为一致。</p>
 *
 * @author AntTransfer CE
 */
public final class AfterCommitUtils {

    private AfterCommitUtils() {
    }

    /**
     * 注册提交后动作：有事务则挂到 {@code afterCommit} 回调，否则立即执行。
     */
    public static void run(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
