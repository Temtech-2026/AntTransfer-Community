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
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 文件列表查询条件（多条件筛选 + 排序）。
 *
 * <p>所有条件均为可选，彼此为「与」关系；{@code sort} 采用 {@code 字段,asc|desc} 形式，
 * 服务端以白名单映射到物理列，杜绝排序字段注入。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class NodeQuery {

    /** 页码，从 1 开始。 */
    private long current = 1L;

    /** 每页条数，服务端上限 100。 */
    private long pageSize = 20L;

    /** 排序表达式，例如 {@code sizeBytes,desc}；缺省按更新时间倒序。 */
    private String sort;

    /** 所属目录 ID；为空表示不限目录。 */
    private Long folderId;

    /** 标签 ID；命中该标签的文件才返回。 */
    private Long tagId;

    /**
     * 标签 ID 集合，<b>与 {@link #tagId} 为 AND 关系</b>（同时命中全部标签）。
     *
     * <p>与 {@code tagId} 并存而不是取而代之，是为了不动已发布的单标签契约。</p>
     */
    private List<Long> tagIds;

    /** 关键字，对文件名做前缀/包含匹配。 */
    private String keyword;

    /** 扩展名（不含点），如 {@code pdf}。 */
    private String ext;

    /** 密级。 */
    private Integer level;

    /** 上传人（用于「我上传的 / 他人共享」筛选）。 */
    private Long uploadUserId;

    /** 大小下界（字节，含）。 */
    private Long minSize;

    /** 大小上界（字节，含）。 */
    private Long maxSize;

    /** 创建时间下界（含）。 */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime startTime;

    /** 创建时间上界（含）。 */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime endTime;
}
