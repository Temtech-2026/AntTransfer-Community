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
 * 角色实体（sys_role）。
 *
 * <p><b>表族归属：</b>RBAC 表族（sys_role / sys_permission / sys_user_role /
 * sys_role_permission）由 at-permission 自持（architecture.md §1.2.2），
 * 因此角色 CRUD 在本模块内直接读写，不经 SPI——与 sys_user 的写侧必须绕道
 * {@code UserAdminPort} 形成对照。</p>
 *
 * <p>{@link #dataScope} 是安全基线：内置角色的数据范围不可变更（改 DEPT_ADMIN 为 3
 * 等于把全公司数据一次性下放）；非内置角色也不得超过操作者自身数据范围。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_role")
public class SysRole extends BaseEntity {

    /** 是否内置：内置角色（1）禁止删除 */
    public static final int BUILT_IN = 1;

    /** 是否内置：非内置（自建角色，可删除） */
    public static final int NOT_BUILT_IN = 0;

    /** 角色编码（唯一，uk_role_code；内置角色编码不可修改） */
    private String code;

    /** 角色名称 */
    private String name;

    /** 数据范围：1-本人 2-本部门及以下 3-全部（见 AccessControlService.SCOPE_*） */
    @TableField("data_scope")
    private Integer dataScope;

    /** 是否内置：1-内置（禁止删除） 0-自建 */
    @TableField("built_in")
    private Integer builtIn;

    /** 备注 */
    private String remark;

    /** 是否内置角色。 */
    public boolean isBuiltIn() {
        return builtIn != null && builtIn == BUILT_IN;
    }
}
