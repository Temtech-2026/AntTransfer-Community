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
package com.anttransfer.file.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

/**
 * 目录实体（映射 {@code sys_folder}，见 sql/V6__file_management.sql）。
 *
 * <p>{@code path} 是物化路径（{@code /祖先/…/自身/}，根为 {@code /}），一次存储换来三处简化：
 * 查子树用前缀匹配、防成环用前缀比对、整树搬迁用一次 REPLACE。代价是移动目录要重写子孙路径
 * （见 {@code FolderService#move}），但目录移动是低频操作，而列表查询是高频的。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_folder")
public class Folder extends BaseEntity {

    /** 根目录 ID：{@code parent_id}/{@code folder_id} 的 0 值约定，避免用 null 表达「根」导致索引失效 */
    public static final long ROOT_ID = 0L;

    /** 父目录 ID（0=根目录） */
    @TableField("parent_id")
    private Long parentId;

    /** 归属用户 ID——防水平越权的唯一依据，所有查询必须带此条件 */
    @TableField("owner_user_id")
    private Long ownerUserId;

    /** 目录名（同一父级下由服务层保证不重名） */
    @TableField("name")
    private String name;

    /** 物化路径：{@code /祖先1/祖先2/…/自身/}，根目录为 {@code /} */
    @TableField("path")
    private String path;

    /** 层级深度（根下第一级=1） */
    @TableField("depth")
    private Integer depth;

    /** 敏感级别：1-低 2-中 3-高（新建继承父目录，可单独调级） */
    @TableField("level")
    private Integer level;

    /** 归属项目 / 群组 ID（null=个人目录） */
    @TableField("group_id")
    private Long groupId;

    /** 归属协作空间 ID（预留，null=个人目录） */
    @TableField("space_id")
    private Long spaceId;
}
