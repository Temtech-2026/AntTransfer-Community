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
 * 用户-角色关联实体（sys_user_role，RBAC 多对多）。
 *
 * <p><b>唯一键是陷阱：</b>V1 的 {@code uk_user_role(user_id, role_id)} 是纯唯一键，
 * 逻辑删除的行仍占用组合。因此「替换用户角色」不能简单地 删旧 + 插新：
 * 若某角色此前被移除（行 {@code deleted=1}），再次分配时 {@code insert} 会直接撞唯一键。
 * 正确做法见 {@code UserRoleMapper}：先按当前行判定「复活 / 停用 / 新增」三类，
 * 复活与停用都是按主键原地更新 {@code deleted}。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_user_role")
public class SysUserRole extends BaseEntity {

    /** 用户 ID（逻辑关联 sys_user，写侧主在 at-auth） */
    @TableField("user_id")
    private Long userId;

    /** 角色 ID（逻辑关联 sys_role，本模块自持） */
    @TableField("role_id")
    private Long roleId;
}
