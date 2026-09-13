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
package com.anttransfer.permission.repository;

import com.anttransfer.permission.model.entity.SysRolePermission;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 角色-权限点关联 Mapper（sys_role_permission）。
 *
 * <p>替换语义与 {@link UserRoleMapper} 一致：{@code uk_role_permission(role_id, permission_id)}
 * 是纯唯一键，逻辑删除行占位，故必须按「复活 / 停用 / 新增」三分类处理，
 * 不能用删旧插新（详见该 Mapper 的类注释）。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface RolePermissionMapper extends BaseMapper<SysRolePermission> {

    /** 角色当前生效的权限点 ID 集合（deleted=0）。 */
    @Select("select permission_id from sys_role_permission where role_id = #{roleId} and deleted = 0")
    List<Long> selectPermissionIdsByRoleId(@Param("roleId") Long roleId);

    /** 该角色的全部关联行（含已逻辑删除），供替换语义分类。 */
    @Select("select id, role_id, permission_id, deleted from sys_role_permission where role_id = #{roleId}")
    List<SysRolePermission> selectAllByRoleIdIncludingDeleted(@Param("roleId") Long roleId);

    /** 按主键停用关联行（绕过逻辑删除过滤）。 */
    @Update("""
            update sys_role_permission set deleted = 1, update_by = #{operatorId}, update_time = now()
            where id = #{id}
            """)
    int markDeleted(@Param("id") Long id, @Param("operatorId") Long operatorId);

    /** 按主键复活关联行（绕过逻辑删除过滤）。 */
    @Update("""
            update sys_role_permission set deleted = 0, update_by = #{operatorId}, update_time = now()
            where id = #{id}
            """)
    int markRestored(@Param("id") Long id, @Param("operatorId") Long operatorId);
}
