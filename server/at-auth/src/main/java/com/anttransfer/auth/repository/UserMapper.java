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
package com.anttransfer.auth.repository;

import com.anttransfer.auth.model.entity.SysUser;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.Collection;
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

    /**
     * 批量查询用户摘要（id / nickname / username / email / avatar_url），供 at-common {@code UserLookupPort}
     * 实现会话列表展示名、头像与 P1 邮件通知收件——只取所需最小列，不外泄密码散列与账号状态。
     *
     * <p>{@code avatar_url} 取的是<b>存储 key</b>，由 {@code JdbcUserLookupPort} 经
     * {@code AvatarStoragePort#urlOf} 拼成对外地址后再交给消费方；SQL 这层不做拼接。</p>
     *
     * @param ids 用户 ID 集合（调用方保证非空）
     * @return 命中的用户摘要列表
     */
    @Select("""
            <script>
            select id, nickname, username, email, avatar_url
            from sys_user
            where deleted = 0
              and id in
              <foreach collection="ids" item="id" open="(" separator="," close=")">
                  #{id}
              </foreach>
            </script>
            """)
    List<SysUser> selectBriefByIds(@Param("ids") Collection<Long> ids);

    /**
     * 系统管理面用户分页（at-permission 经 {@code UserAdminPort} 调用）。
     *
     * <p><b>为什么动态条件写在这里而不是调用方：</b>「本部门及以下」需要递归 {@code sys_dept.ancestors}，
     * 而 sys_dept 属 at-auth 表族——把子树 SQL 留在表主，调用方只传「范围意图」
     * （deptId + includeSubtree），跨模块边界上不出现对方表名。</p>
     *
     * <p>{@code restrictUserId} 用于数据范围「本人」：只回操作者自己一行，
     * 使「用户列表」在最小数据范围下也不会横向暴露他人账号。</p>
     */
    @Select("""
            <script>
            select u.*
            from sys_user u
            where u.deleted = 0
            <if test="keyword != null and keyword != ''">
                and (u.username like concat('%', #{keyword}, '%')
                     or u.nickname like concat('%', #{keyword}, '%')
                     or u.email like concat('%', #{keyword}, '%')
                     or u.mobile like concat('%', #{keyword}, '%'))
            </if>
            <if test="status != null">
                and u.status = #{status}
            </if>
            <if test="restrictUserId != null">
                and u.id = #{restrictUserId}
            </if>
            <if test="deptId != null">
                <choose>
                    <when test="includeSubtree">
                        and (u.dept_id = #{deptId} or u.dept_id in (
                             select d.id from sys_dept d
                             where d.deleted = 0 and d.ancestors like concat('%/', #{deptId}, '/%')))
                    </when>
                    <otherwise>
                        and u.dept_id = #{deptId}
                    </otherwise>
                </choose>
            </if>
            order by u.id desc
            </script>
            """)
    IPage<SysUser> selectAdminPage(IPage<SysUser> page,
                                   @Param("keyword") String keyword,
                                   @Param("status") Integer status,
                                   @Param("deptId") Long deptId,
                                   @Param("includeSubtree") boolean includeSubtree,
                                   @Param("restrictUserId") Long restrictUserId);

    /**
     * 登录账号是否已被占用（<b>含已逻辑删除的行</b>）。
     *
     * <p>不能只看 {@code deleted = 0}：V1 的 {@code uk_username} 是纯 username 唯一键，
     * 逻辑删除的行仍占着那个字符串。若这里放行、让用户用一个「曾经被删掉」的账号建号，
     * 插入会直接撞唯一键抛 500——把「其实可用/不可用」的判定与数据库约束对齐，
     * 才能给出 1016 USERNAME_CONFLICT 这样的业务错误而不是数据库异常。</p>
     */
    @Select("select count(1) from sys_user where username = #{username}")
    int countUsernameAnyState(@Param("username") String username);

    /** 邮箱是否已被占用（仅统计未删除行；email 无唯一键，去重口径由应用保证）。 */
    @Select("""
            <script>
            select count(1) from sys_user
            where deleted = 0 and email = #{email}
            <if test="excludeUserId != null">
                and id &lt;&gt; #{excludeUserId}
            </if>
            </script>
            """)
    int countEmailInUse(@Param("email") String email, @Param("excludeUserId") Long excludeUserId);

    /** 改账号状态（仅未删除行；禁用由调用方在同一动作中吊销会话）。 */
    @Update("""
            update sys_user set status = #{status}, update_by = #{operatorId}
            where id = #{userId} and deleted = 0
            """)
    int updateStatus(@Param("userId") Long userId, @Param("status") int status,
                     @Param("operatorId") Long operatorId);

    /** 调岗：改所属部门（{@code deptId} 为 null 表示解除部门分配）。 */
    @Update("""
            update sys_user set dept_id = #{deptId}, update_by = #{operatorId}
            where id = #{userId} and deleted = 0
            """)
    int updateDept(@Param("userId") Long userId, @Param("deptId") Long deptId,
                   @Param("operatorId") Long operatorId);

    /**
     * 换头像：把 {@code avatar_url} 置为新的存储 key（见 {@code AvatarStoragePort}）。
     *
     * <p>不用 {@code updateById} 走实体更新：{@code avatar_url} 存的是<b>不透明 key</b>，
     * 不是可被清空的「用户资料」——这里只做「指向新文件」这一个语义明确的动作，
     * 顺带避免 {@code null} 字段在 MyBatis-Plus 里「不更新」与「想清空」的歧义。
     * 旧文件由调用方在事务提交后清理。</p>
     */
    @Update("""
            update sys_user set avatar_url = #{avatarKey}, update_by = #{operatorId}
            where id = #{userId} and deleted = 0
            """)
    int updateAvatar(@Param("userId") Long userId, @Param("avatarKey") String avatarKey,
                     @Param("operatorId") Long operatorId);

    /** 只读头像存储 key（供头像直出端点使用；不取整行，避免把散列等敏感列读进内存）。 */
    @Select("select avatar_url from sys_user where id = #{userId} and deleted = 0")
    String selectAvatarKey(@Param("userId") Long userId);

    /** 重置口令：同时递增 token_epoch 吊销该用户全部在途会话。 */
    @Update("""
            update sys_user
            set password_hash = #{passwordHash}, token_epoch = token_epoch + 1, update_by = #{operatorId}
            where id = #{userId} and deleted = 0
            """)
    int updatePassword(@Param("userId") Long userId, @Param("passwordHash") String passwordHash,
                       @Param("operatorId") Long operatorId);
}
