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
 * at-file 文件存储模块。
 *
 * <p>模块职责：文件全生命周期管理——上传（含分片 / 断点续传 / 秒传）、
 * 下载、元数据持久化 {@link com.anttransfer.file.model.entity.FileObject}、
 * 多存储后端抽象（本地磁盘、对象存储 S3 协议 / 腾讯云 COS 等）。</p>
 *
 * <p>设计约定：</p>
 * <ul>
 *     <li>对外暴露“文件服务”能力，物理存储后端通过 SPI / 策略接口扩展，切换后端不改业务代码；</li>
 *     <li>上传成功后返回稳定 fileId，业务模块（如 at-transfer）只持有 fileId，不直接读写字节；</li>
 *     <li>禁止依赖其他 at-* 业务模块。</li>
 * </ul>
 *
 * <p>包结构（统一分层）：{@code controller}（接口层）、{@code service}（业务逻辑与事务边界，
 * 含 {@code service/storage} 存储策略）、{@code repository}（数据访问层）、
 * {@code model/entity}（FileObject）、{@code model/dto}（入参）、{@code model/vo}（出参视图）、
 * {@code event}（领域事件）、{@code config}（模块内配置）。</p>
 */
package com.anttransfer.file;
