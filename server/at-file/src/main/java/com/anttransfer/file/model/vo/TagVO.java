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
package com.anttransfer.file.model.vo;

import com.anttransfer.file.model.entity.Tag;
import lombok.Getter;
import lombok.Setter;

/**
 * 标签视图对象。
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class TagVO {

    /** 标签 ID */
    private Long id;

    /** 标签名 */
    private String name;

    /** 展示色（#RRGGBB） */
    private String color;

    /** 关联文件数（标签管理页展示影响面）。 */
    private Long refCount;

    /**
     * 由实体转换（不含关联计数）。
     */
    public static TagVO of(Tag tag) {
        TagVO vo = new TagVO();
        vo.setId(tag.getId());
        vo.setName(tag.getName());
        vo.setColor(tag.getColor());
        return vo;
    }
}
