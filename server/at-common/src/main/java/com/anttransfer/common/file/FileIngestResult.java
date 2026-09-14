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
package com.anttransfer.common.file;

/**
 * 文件落库结果。
 *
 * @param fileId  物理文件 ID（{@code sys_file.id}），用于对外回执与去重排查
 * @param nodeId  引用条目 ID（{@code sys_file_node.id}），文件列表展示的实际载体
 * @param instant 是否命中秒传：{@code true} 表示本次未传输任何字节，仅新增引用
 * @author AntTransfer CE
 */
public record FileIngestResult(Long fileId, Long nodeId, boolean instant) {
}
