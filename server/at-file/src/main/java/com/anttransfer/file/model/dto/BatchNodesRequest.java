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

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * 文件节点批量操作请求（批量删除 / 批量还原等）。
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class BatchNodesRequest {

    /** 文件节点 ID 列表。 */
    @NotEmpty(message = "nodeIds 不能为空")
    @Size(max = 200, message = "单次批量操作不能超过 200 个文件")
    private List<Long> nodeIds;
}
