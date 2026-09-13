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

import com.anttransfer.permission.model.SystemAdminModels.UserRoleRow;
import com.anttransfer.permission.model.entity.SysUserRole;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.Collection;
import java.util.List;

/**
 * 用户-角色关联 Mapper（sys_user_role）。
 *
 * <p><b>为什么「替换用户角色」要用 {@link #selectAllByUserIdIncludingDeleted} +
 * {@link #markDeleted}/{@link #markRestored} 三分类，而不是删旧插新：</b>
 * {@code uk_user_role(user_id, role_id)} 是纯唯一键，逻辑删除行仍占位。
 * 「先软删后插入」在重复分配同一角色时必撞唯一键；「只软删不复活」则会让
 * 重新分配静默失效（行仍在但 deleted=1，权限解析读不到）。故替换语义必须是：
 * 在集合内且原先被删的 → 复活；不在集合内且原先生效的 → 停用；集合内且无历史行的 → 新增。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface UserRoleMapper extends BaseMapper<SysUserRole> {

    /** 用户当前生效的角色 ID 集合（deleted=0）。 */
    @Select("select role_id from sys_user_role where user_id = #{userId} and deleted = 0")
    List<Long> selectRoleIds(@Param("userId") Long userId);

    /** 某角色下的生效用户 ID 集合（角色授权变更后需要失效其权限缓存的受众）。 */
    @Select("select user_id from sys_user_role where role_id = #{roleId} and deleted = 0")
    List<Long> selectUserIdsByRoleId(@Param("roleId") Long roleId);

    /** 角色是否仍有生效用户（角色「在用」判定，禁止删除在用角色）。 */
    @Select("select count(1) from sys_user_role where role_id = #{roleId} and deleted = 0")
    long countByRoleId(@Param("roleId") Long roleId);

    /**
     * 批量取多个用户的角色（用户列表页的 N+1 解法）。
     *
     * <p>空集合直接返回空列表由调用方保证（{@code in ()} 是非法 SQL）。</p>
     */
    @Select("""
            <script>
            select ur.user_id as userId, r.id as roleId, r.code as roleCode
            from sys_user_role ur
                     join sys_role r on r.id = ur.role_id
            where ur.deleted = 0
              and r.deleted = 0
              and ur.user_id in
              <foreach collection="userIds" item="uid" open="(" separator="," close=")">#{uid}</foreach>
            </script>
            """)
    List<UserRoleRow> selectRolesByUserIds(@Param("userIds") Collection<Long> userIds);

    /**
     * 统计仍「正常」（未禁用、未删除）地持有某内置角色的用户数——防自锁的账号维度锚点。
     *
     * <p>停用 / 删除 / 摘除最后一个 SUPER_ADMIN 持有者，与在角色侧削空 SUPER_ADMIN
     * 的权限集是同一类事故：系统仍在跑，但没人能再管理它。故两个维度都要挡。</p>
     */
    @Select("""
            select count(distinct ur.user_id)
            from sys_user_role ur
                     join sys_role r on r.id = ur.role_id
                     join sys_user u on u.id = ur.user_id
            where r.code = #{roleCode}
              and ur.deleted = 0
              and r.deleted = 0
              and u.deleted = 0
              and u.status = 0
            """)
    long countEnabledUsersByRoleCode(@Param("roleCode") String roleCode);

    /** 该用户的全部关联行（含已逻辑删除），供替换语义做「复活 / 停用 / 新增」分类。 */
    @Select("select id, user_id, role_id, deleted from sys_user_role where user_id = #{userId}")
    List<SysUserRole> selectAllByUserIdIncludingDeleted(@Param("userId") Long userId);

    /** 按主键停用关联行（绕过逻辑删除过滤，用于原地软删）。 */
    @Update("""
            update sys_user_role set deleted = 1, update_by = #{operatorId}, update_time = now()
            where id = #{id}
            """)
    int markDeleted(@Param("id") Long id, @Param("operatorId") Long operatorId);

    /** 按主键复活关联行（绕过逻辑删除过滤，用于重复分配场景）。 */
    @Update("""
            update sys_user_role set deleted = 0, update_by = #{operatorId}, update_time = now()
            where id = #{id}
            """)
    int markRestored(@Param("id") Long id, @Param("operatorId") Long operatorId);
}
