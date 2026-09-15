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
package com.anttransfer.transfer.model.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 秒传预检请求（POST {@code /v1/transfers/precheck}）。
 *
 * <p><b>字段名与前端契约</b>：目标目录在线上叫 {@code parentId}（与
 * {@code web/src/pages/file/index.tsx} 的 {@code precheckExtra} 一致），
 * 落库到 {@code sys_upload_task.parent_id}，合并时作为 {@code folderId} 透传给 at-file——
 * 前端字段名与 at-file 内部字段名不同，这个映射只在服务层做一次。</p>
 *
 * @param fileName  文件名（含扩展名）
 * @param sizeBytes 文件总大小（字节）
 * @param sha256    客户端计算的整件 SHA-256（小写十六进制，服务端仅用于比对，不作为可信来源）
 * @param parentId  目标目录 ID；{@code null} 或 {@code 0} 表示根目录
 * @author AntTransfer CE
 */
public record PrecheckRequest(
        @NotBlank(message = "文件名不能为空")
        @Size(max = 255, message = "文件名过长")
        String fileName,

        @NotNull(message = "文件大小不能为空")
        @Min(value = 1, message = "文件大小必须大于 0")
        Long sizeBytes,

        @NotBlank(message = "文件指纹不能为空")
        String sha256,

        Long parentId) {
}
