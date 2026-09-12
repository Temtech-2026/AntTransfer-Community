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
 * at-collaboration 协作共享模块。
 *
 * <p>模块职责：围绕“人 + 任务 + 文件”的协作能力——协作空间
 * {@link com.anttransfer.collaboration.model.entity.CollaborationSpace}、
 * 成员与角色（协作者 / 管理员）、分享链接（有效期 / 访问码）、操作审计。</p>
 *
 * <p>设计约定：</p>
 * <ul>
 *     <li>协作空间只保存“组织关系”（谁能在哪个空间里看到 / 操作哪些资源）；</li>
 *     <li>资源（传输任务 / 文件）的归属校验通过空间 ID 协作，禁止复制其他模块实体；</li>
 *     <li>禁止依赖其他 at-* 业务模块。</li>
 * </ul>
 *
 * <p>包结构（统一分层）：{@code controller}（接口层）、{@code service}（业务逻辑与事务边界）、
 * {@code repository}（数据访问层）、{@code model/entity}（实体）、{@code model/dto}（入参）、
 * {@code model/vo}（出参视图）、{@code event}（领域事件）、{@code config}（模块内配置）。</p>
 */
package com.anttransfer.collaboration;
