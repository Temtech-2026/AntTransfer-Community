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
package com.anttransfer.file.util;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * 事务提交后回调工具：把 Redis 等外部副作用推迟到<b>数据库事务提交成功后</b>执行。
 *
 * <p><b>为什么必须有它</b>：先写 Redis 再回滚数据库会造成「缓存已变、事实未变」的不一致
 * （如分享已建但 Redis 配额镜像存在、分享已撤销但镜像未删）。</p>
 *
 * <p>无事务上下文时立即执行（单元测试 / 非事务调用路径同样安全）。</p>
 *
 * @author AntTransfer CE
 */
public final class AfterCommitUtils {

    private AfterCommitUtils() {
    }

    /**
     * 注册提交后回调（无事务则立即执行）。
     *
     * @param action 回调动作
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
