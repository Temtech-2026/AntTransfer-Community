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
package com.anttransfer.auth.mapper;

import com.anttransfer.auth.entity.SysUser;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 用户数据访问（at-auth 域内自持，不含业务模块依赖）。
 *
 * @author AntTransfer CE
 */
@Mapper
public interface UserMapper extends BaseMapper<SysUser> {

    /**
     * 按登录账号查询用户（自动携带逻辑删除过滤 deleted=0）。
     */
    @Select("select * from sys_user where username = #{username} and deleted = 0")
    SysUser selectByUsername(@Param("username") String username);

    /**
     * 查询用户角色编码集合（角色变更即时生效的关键：不缓存在 JWT 中）。
     */
    @Select("""
            select r.code
            from sys_role r
                     join sys_user_role ur on ur.role_id = r.id
            where ur.user_id = #{userId}
              and r.deleted = 0
              and ur.deleted = 0
            order by r.id
            """)
    List<String> selectRoleCodes(@Param("userId") Long userId);

    /**
     * 全端吊销：事务内原子自增会话吊销纪元（幂等，重复调用无害）。
     *
     * @return 受影响行数（0 表示用户不存在或已删除）
     */
    @Update("update sys_user set token_epoch = token_epoch + 1 where id = #{userId} and deleted = 0")
    int bumpTokenEpoch(@Param("userId") Long userId);
}
