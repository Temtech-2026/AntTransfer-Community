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
package com.anttransfer.permission.mapper;

import com.anttransfer.permission.model.PermissionModels.RoleGrant;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * RBAC 只读查询（sys_user_role / sys_role / sys_role_permission / sys_permission /
 * sys_dept / sys_user）。角色与权限变更即时生效的关键：本类每次按需查询 + Redis 短缓存，
 * 授权 / 角色变更后调用 PermissionService.invalidate 主动失效。
 *
 * @author AntTransfer CE
 */
@Mapper
public interface RbacAccessMapper {

    /**
     * 用户全部角色（含数据范围）。
     */
    @Select("""
            select r.code as roleCode, r.data_scope as dataScope
            from sys_role r
                     join sys_user_role ur on ur.role_id = r.id
            where ur.user_id = #{userId}
              and r.deleted = 0
              and ur.deleted = 0
            """)
    List<RoleGrant> selectRoles(@Param("userId") Long userId);

    /**
     * 用户可达权限点（操作点 type=2）并集：多角色授权 UNION（distinct）。
     */
    @Select("""
            select distinct p.perm_code
            from sys_permission p
                     join sys_role_permission rp on rp.permission_id = p.id
                     join sys_role r on r.id = rp.role_id
                     join sys_user_role ur on ur.role_id = r.id
            where ur.user_id = #{userId}
              and p.type = 2
              and p.deleted = 0
              and rp.deleted = 0
              and r.deleted = 0
              and ur.deleted = 0
            """)
    List<String> selectPermCodes(@Param("userId") Long userId);

    /**
     * 用户所属部门 ID（null = 未分配部门，数据范围「本部门及以下」时视同无范围）。
     */
    @Select("select u.dept_id from sys_user u where u.id = #{userId} and u.deleted = 0")
    Long selectUserDeptId(@Param("userId") Long userId);

    /**
     * 部门祖先链（如 /0/12/），供「本部门及以下」数据范围判定（system-design §3.3 / V1 sys_dept）。
     */
    @Select("select d.ancestors from sys_dept d where d.id = #{deptId} and d.deleted = 0")
    String selectDeptAncestors(@Param("deptId") Long deptId);
}
