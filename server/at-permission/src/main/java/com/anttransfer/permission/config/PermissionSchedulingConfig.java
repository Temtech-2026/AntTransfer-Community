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
package com.anttransfer.permission.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * at-permission 域定时调度开关。
 *
 * <p>启用 Spring 任务调度（{@code @Scheduled}）并让 at-permission 内的定时任务
 * （如 {@code PermissionGrantExpireScheduler} 授权到期回收）随模块扫描装配。
 * 单实例默认单线程调度器；多实例部署前请为回收任务引入分布式锁（如 Redis）防重执行。</p>
 *
 * @author AntTransfer CE
 */
@Configuration
@EnableScheduling
public class PermissionSchedulingConfig {
}
