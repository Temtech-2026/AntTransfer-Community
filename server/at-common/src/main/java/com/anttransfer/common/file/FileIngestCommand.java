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
 * 文件落库指令：描述「为谁、以什么名字、登记哪一份内容」。
 *
 * <p>刻意不携带字节流：字节流的传输由 {@link FileIngestPort#ingest} 的独立参数承载，
 * 因为「预检秒传」只需要指纹不需要字节，两者入参形态本就不同。</p>
 *
 * @param ownerUserId 归属用户 ID（条目所有者）
 * @param fileName    展示文件名（含扩展名，不含路径）
 * @param folderId    所属目录 ID，{@code null} 或 {@code 0} 表示根目录
 * @param level       密级；{@code null} 表示继承目录
 * @param contentType MIME 类型；{@code null} 表示由实现按文件名推断
 * @param sha256      内容 SHA-256（64 位小写十六进制，服务端计算所得）
 * @param sizeBytes   内容字节数
 * @author AntTransfer CE
 */
public record FileIngestCommand(
        Long ownerUserId,
        String fileName,
        Long folderId,
        Integer level,
        String contentType,
        String sha256,
        long sizeBytes) {
}
