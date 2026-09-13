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
package com.anttransfer.file.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * 文件模块调度与异步装配。
 *
 * <p>文件模块需要两类后台能力：</p>
 * <ul>
 *     <li><b>定时清理</b>：回收站到期物理回收、打包产物过期清理、限速器空闲淘汰
 *         （见 {@code FileCleanupScheduler}），由 {@link EnableScheduling} 驱动；</li>
 *     <li><b>异步打包</b>：zip 打包属长耗时 IO，须移出请求线程，使用独立有界线程池，
 *         避免挤占 Web 容器线程与全局异步池。</li>
 * </ul>
 *
 * <p>打包线程池拒绝策略选择 {@link ThreadPoolExecutor.AbortPolicy}：任务提交前已做
 * 每用户并发校验（见 {@code PackService}），队列耗尽时快速失败远优于静默排队。</p>
 *
 * @author AntTransfer CE
 */
@Configuration
@EnableScheduling
public class FileSchedulingConfig {

    /** 打包线程池 Bean 名，供 {@code PackService} 按名注入，避免与全局执行器冲突。 */
    public static final String PACK_EXECUTOR = "filePackExecutor";

    /**
     * 打包专用线程池：有界队列 + 中止策略，守护线程不阻塞应用退出。
     *
     * @return 打包任务执行器
     */
    @Bean(PACK_EXECUTOR)
    public ThreadPoolTaskExecutor filePackExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(64);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("at-file-pack-");
        executor.setDaemon(true);
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(false);
        executor.initialize();
        return executor;
    }
}
