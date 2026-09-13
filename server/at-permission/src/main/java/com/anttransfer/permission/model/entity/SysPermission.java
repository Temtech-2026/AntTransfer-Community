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
package com.anttransfer.permission.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

/**
 * 权限点实体（sys_permission，菜单 / 操作点 / 数据范围三维度成树）。
 *
 * <p><b>只读：</b>CE 的权限点是「全量枚举」而非可编辑数据——V2/V9 迁移脚本是唯一写入方。
 * 本实体只服务于角色授权时的两件事：① 返回可选权限点树给前端勾选；
 * ② 校验提交的 {@code permissionIds} 确实存在（防越权写入幽灵权限点）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_permission")
public class SysPermission extends BaseEntity {

    /** 维度：菜单 */
    public static final int TYPE_MENU = 1;

    /** 维度：操作 / 按钮点 */
    public static final int TYPE_ACTION = 2;

    /** 维度：数据范围 */
    public static final int TYPE_DATA_SCOPE = 3;

    /** 权限点编码（唯一，uk_perm_code），如 {@code system:user:list} */
    @TableField("perm_code")
    private String permCode;

    /** 权限点名称 */
    @TableField("perm_name")
    private String permName;

    /** 维度：1-菜单 2-操作 / 按钮 3-数据范围 */
    private Integer type;

    /** 父权限点 ID（0=根；权限点成树） */
    @TableField("parent_id")
    private Long parentId;

    /** 排序号（升序） */
    @TableField("sort_no")
    private Integer sortNo;
}
