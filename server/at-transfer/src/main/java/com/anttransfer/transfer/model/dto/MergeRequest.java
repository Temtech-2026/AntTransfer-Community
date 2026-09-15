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

/**
 * 合并请求（POST {@code /v1/transfers/{uploadId}/merge}）。
 *
 * @param sha256     客户端整件 SHA-256；服务端合并后会重算并与之比对，不一致返回 4003
 * @param chunkCount 客户端视角的分片总数；与任务固化值不符即视为请求过期（2005）
 * @param sizeBytes  客户端视角的文件总大小，用于双口径校验
 * @author AntTransfer CE
 */
public record MergeRequest(
        @NotBlank(message = "文件指纹不能为空")
        String sha256,

        @NotNull(message = "分片总数不能为空")
        @Min(value = 1, message = "分片总数必须大于 0")
        Integer chunkCount,

        @NotNull(message = "文件大小不能为空")
        @Min(value = 1, message = "文件大小必须大于 0")
        Long sizeBytes) {
}
