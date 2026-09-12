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
 * at-transfer 传输任务核心模块。
 *
 * <p>模块职责：AntTransfer 的核心领域——“传输任务”。覆盖任务创建、
 * 排队调度、分片/断点续传、进度实时上报、暂停 / 恢复 / 取消、失败重试与
 * 任务审计等能力。领域实体见 {@link com.anttransfer.transfer.model.entity.TransferRecord}。</p>
 *
 * <p>设计约定：</p>
 * <ul>
 *     <li>文件元数据与物理存储归 at-file 模块；本模块通过任务单号/fileId 协作，不直接持文件流；</li>
 *     <li>任务状态流转需收敛到模块内的状态机校验，禁止散落各处 if/else；</li>
 *     <li>禁止依赖其他 at-* 业务模块（跨模块能力通过 at-bootstrap 侧组合）。</li>
 * </ul>
 *
 * <p>包结构（统一分层）：{@code controller}（接口层）、{@code service}（调度与状态机，业务逻辑与事务边界）、
 * {@code repository}（数据访问层）、{@code model/entity}（实体）、{@code model/dto}（入参）、
 * {@code model/vo}（出参视图）、{@code event}（领域事件）、{@code config}（模块内配置）。</p>
 */
package com.anttransfer.transfer;
