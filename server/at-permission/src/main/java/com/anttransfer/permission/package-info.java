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
/**
 * at-permission 权限控制模块。
 *
 * <p>模块职责：RBAC（基于角色的访问控制）核心——权限点（Permission）定义、
 * 角色（Role）与权限绑定、接口权限注解 {@link com.anttransfer.permission.annotation.RequirePermission}
 * 及其 AOP 校验实现。</p>
 *
 * <p>设计约定：本模块只做“能不能访问”的判定，不关心用户“是谁”的细节；
 * 用户身份信息由 at-auth 提供。为避免模块间编译期耦合，
 * at-permission 应通过自有的“当前用户抽象”（如从上下文读取角色码集合）进行判定。</p>
 *
 * <p>建议子包规划：{@code annotation}（注解）、{@code service}（权限判定）、
 * {@code entity / mapper}（角色权限表持久化）。</p>
 */
package com.anttransfer.permission;
