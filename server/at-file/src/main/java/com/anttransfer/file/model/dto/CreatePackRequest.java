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
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * 批量打包下载请求：把多个文件节点流式打成 zip 产物，异步构建后再下载。
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class CreatePackRequest {

    /** 待打包的文件节点 ID 列表。 */
    @NotEmpty(message = "打包文件列表不能为空")
    @Size(max = 200, message = "单次打包文件数不能超过 200")
    private List<Long> nodeIds;

    /** 该打包任务级限速（字节/秒），为空则不额外限速（仍受全局上限约束）。 */
    @Min(value = 1024, message = "限速不能低于 1 KiB/s")
    private Long speedLimit;

    /** 打包产物文件名（不含 .zip），为空则由服务端生成。 */
    @Size(max = 128, message = "文件名长度不能超过 128")
    private String productName;
}
