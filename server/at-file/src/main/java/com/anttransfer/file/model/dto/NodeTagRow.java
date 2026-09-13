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

import lombok.Getter;
import lombok.Setter;

/**
 * 「条目 → 标签」联表投影行，仅用于列表页批量回显标签（避免 N+1 查询）。
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class NodeTagRow {

    /** 引用条目 ID */
    private Long nodeId;

    /** 标签 ID */
    private Long tagId;

    /** 标签名 */
    private String name;

    /** 标签颜色 */
    private String color;
}
