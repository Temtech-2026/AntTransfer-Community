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
 * 文件-标签关联（映射 {@code sys_file_tag}，见 sql/V6__file_management.sql）。
 *
 * <p>{@code ownerUserId} 是从 node 冗余下来的：按标签筛选时条件形如
 * 「join 本表 + where owner_user_id=? and tag_id=?」——把归属条件收在同一张表上，
 * 就不必为了防越权再去 join {@code sys_file_node}，索引 {@code idx_owner_node} 可直接覆盖。
 * 冗余列的代价是节点改归属时要同步，而 CE 不支持文件转移归属，故不存在该同步路径。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_file_tag")
public class FileTag extends BaseEntity {

    /** 引用条目 ID（逻辑关联 {@code sys_file_node.id}） */
    @TableField("node_id")
    private Long nodeId;

    /** 标签 ID（逻辑关联 {@code sys_tag.id}） */
    @TableField("tag_id")
    private Long tagId;

    /** 归属用户 ID（冗余自 node，用于越权过滤） */
    @TableField("owner_user_id")
    private Long ownerUserId;
}
