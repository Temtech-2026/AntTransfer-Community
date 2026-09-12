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
 * <p>包结构（统一分层）：{@code controller}（接口层）、{@code service}（权限判定，业务逻辑与事务边界）、
 * {@code repository}（数据访问层 MyBatis-Plus Mapper）、{@code model/entity}（权限表持久化实体）、
 * {@code model/dto}（入参）、{@code model/vo}（出参视图）、{@code event}（领域事件，如 PermissionExpiredEvent）、
 * {@code config}（模块内配置）；另有 {@code annotation}（权限注解）、{@code aspect}（校验切面）、
 * {@code security}（鉴权上下文）、{@code job}（到期回收定时任务）。</p>
 */
package com.anttransfer.permission;
