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

import com.anttransfer.file.model.entity.Folder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 目录树节点视图对象。
 *
 * <p>树由服务端一次性组装返回（而非前端多次请求子级）：目录规模受深度上限约束，
 * 且渲染目录树需要「一次拿全」才能正确展开祖先链，分页反而增加往返。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class FolderVO {

    /** 目录 ID */
    private Long id;

    /** 父目录 ID（0=根） */
    private Long parentId;

    /** 目录名 */
    private String name;

    /** 深度（根下第一级=1） */
    private Integer depth;

    /** 密级 */
    private Integer level;

    /** 创建时间 */
    private LocalDateTime createTime;

    /** 子目录（叶子为空数组，永不为 null，省去前端判空） */
    private List<FolderVO> children = new ArrayList<>();

    /**
     * 由实体转换（不递归子级，树由 Service 组装）。
     */
    public static FolderVO of(Folder folder) {
        FolderVO vo = new FolderVO();
        vo.setId(folder.getId());
        vo.setParentId(folder.getParentId());
        vo.setName(folder.getName());
        vo.setDepth(folder.getDepth());
        vo.setLevel(folder.getLevel());
        vo.setCreateTime(folder.getCreateTime());
        return vo;
    }
}
