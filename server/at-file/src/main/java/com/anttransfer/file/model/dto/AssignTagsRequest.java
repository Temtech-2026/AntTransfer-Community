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

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * 文件打标请求：以「全量覆盖」语义设置文件标签集合。
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class AssignTagsRequest {

    /** 目标标签 ID 列表；传空数组表示清空该文件的全部标签。 */
    @NotNull(message = "tagIds 不能为空")
    @Size(max = 20, message = "单文件标签数不能超过 20")
    private List<Long> tagIds;
}
