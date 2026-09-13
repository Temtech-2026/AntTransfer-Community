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
package com.anttransfer.file.model.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * 秒传（instant upload）请求：以内容寻址指纹尝试直接建引用，免去字节上传。
 *
 * <p>秒传的本质是「引用层复用」：命中物理内容后，若调用方尚无同内容引用则新增
 * {@code sys_file_node} 行并递增 {@code ref_count}，否则直接复用既有节点，
 * 因此同一用户对同一内容重复秒传是幂等的（不产生重复行）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class InstantUploadRequest {

    /** 文件 SHA-256（64 位小写十六进制）。 */
    @NotBlank(message = "sha256 不能为空")
    @Pattern(regexp = "[0-9a-fA-F]{64}", message = "sha256 必须为 64 位十六进制")
    private String sha256;

    /** 文件字节数。 */
    @NotNull(message = "文件大小不能为空")
    @Min(value = 0, message = "文件大小不能为负")
    private Long sizeBytes;

    /** 文件展示名（含扩展名）。 */
    @NotBlank(message = "文件名不能为空")
    @Size(max = 255, message = "文件名长度不能超过 255")
    @Pattern(regexp = "[^/\\\\:*?\"<>|]+", message = "文件名包含非法字符")
    private String name;

    /** 所属目录 ID，0 表示根目录。 */
    private Long folderId = 0L;

    /** 密级；为空则继承目录。 */
    private Integer level;
}
