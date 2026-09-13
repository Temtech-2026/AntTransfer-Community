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
 * 角色-权限点关联实体（sys_role_permission，角色静态授权的数据源）。
 *
 * <p>与 {@link SysUserRole} 同样的唯一键陷阱：{@code uk_role_permission(role_id, permission_id)}
 * 是纯唯一键，逻辑删除行占位，因此「替换角色权限集」必须走
 * {@code RolePermissionMapper} 的复活 / 停用 / 新增三分类，而非删旧插新。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_role_permission")
public class SysRolePermission extends BaseEntity {

    /** 角色 ID（逻辑关联 sys_role） */
    @TableField("role_id")
    private Long roleId;

    /** 权限点 ID（逻辑关联 sys_permission） */
    @TableField("permission_id")
    private Long permissionId;
}
