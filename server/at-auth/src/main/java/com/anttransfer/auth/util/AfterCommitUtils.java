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
package com.anttransfer.auth.util;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * 事务提交后副作用执行器（本人换头像的「删旧文件 / 发资料变更事件」统一入口）。
 *
 * <p><b>为什么需要它：</b>头像的存储 key 在事务内落库，而两类副作用都不能提前发生——
 * ① 删除旧图：提交前删，事务一旦回滚，库里的旧 key 就指向一个已不存在的文件，用户看到的是
 * 「操作失败，同时头像也永久碎了」；② 广播资料变更事件：提交前发，各端会去拉一个并不存在的
 * {@code ?v=}，必然是碎图。</p>
 *
 * <p>本类与 {@code at-permission}/{@code at-file} 的同名工具结构同构。之所以没有抽到
 * {@code at-common}：共享内核的依赖面被刻意压到「仅 mybatis-plus 注解 + slf4j + lombok」，
 * 而本类依赖 Spring 事务基础设施；跨模块抽到某个业务模块又违反「各业务模块仅依赖 at-common」
 * 的模块铁律。重复的多份实现属已知取舍（与 {@code AuthAuditLogger} 同类）。</p>
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

    /**
     * 注册<b>回滚后</b>补偿动作：事务回滚时执行；提交成功则什么都不做；无活动事务时不执行。
     *
     * <p>用于「副作用已经在事务内发生且无法回滚」的场景——新头像已经落盘，事务失败时必须
     * 把它撤掉，否则磁盘上会留一份没有任何记录指向它的文件。</p>
     */
    public static void runIfRolledBack(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != TransactionSynchronization.STATUS_COMMITTED) {
                    action.run();
                }
            }
        });
    }
}
