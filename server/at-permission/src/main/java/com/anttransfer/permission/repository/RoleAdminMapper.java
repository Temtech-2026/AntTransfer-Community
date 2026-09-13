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

import com.anttransfer.permission.model.entity.SysRole;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 角色写侧 Mapper（sys_role，at-permission 自持表族）。
 *
 * <p>常规 CRUD 走 {@link BaseMapper}（自动携带逻辑删除过滤）；仅「角色编码占用判定」
 * 需要含逻辑删除行的裸查询，故单列一个方法。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface RoleAdminMapper extends BaseMapper<SysRole> {

    /**
     * 角色编码是否已被占用（<b>含已逻辑删除的行</b>）。
     *
     * <p>与 {@code sys_user.username} 同理：V1 的 {@code uk_role_code} 是纯 code 唯一键，
     * 逻辑删除的角色仍占着那个编码。若只看 {@code deleted=0} 就放行新建，
     * 插入会撞唯一键抛 500——把「可用性判定」与数据库约束对齐，才能给出 1019 业务错误。</p>
     *
     * @param code      角色编码
     * @param excludeId 排除的角色 ID（更新场景排除自身；null=不排除）
     */
    @Select("""
            <script>
            select count(1) from sys_role
            where code = #{code}
            <if test="excludeId != null">
                and id &lt;&gt; #{excludeId}
            </if>
            </script>
            """)
    int countByCodeAnyState(@Param("code") String code, @Param("excludeId") Long excludeId);
}
