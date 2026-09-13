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

import com.anttransfer.permission.model.entity.PermissionGrant;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 临时授权 Mapper。
 *
 * <p>到期回收扫描依赖表索引 {@code idx_user_expire(user_id,status,expire_at)} /
 * {@code idx_expire(status,expire_at)}（见 sql/V1__schema.sql），查询按
 * {@code status=1 AND expire_at<=now} 命中索引最左前缀，无需全表扫。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface PermissionGrantMapper extends BaseMapper<PermissionGrant> {

    /**
     * 实时判定「该用户对该资源是否持有生效授权」（申请冲突校验 / 访问判定合并）。
     *
     * <p><b>过期判定交给数据库时钟</b>（{@code expire_at > now()}，P-9），不依赖定时任务——
     * 定时回收仅做状态收敛与通知，判定侧始终以 {@code status=1 AND expire_at > now()} 为准，
     * 二者之间不存在「已过期但任务未跑」的放行窗口。</p>
     *
     * <p>走 {@code idx_user_resource(user_id, resource_type, resource_id, status)} 最左前缀。</p>
     */
    @Select("""
            select count(1)
            from sys_user_file_permission
            where user_id = #{userId}
              and resource_type = #{resourceType}
              and resource_id = #{resourceId}
              and grant_type = #{grantType}
              and status = 1
              and (expire_at is null or expire_at > now())
              and deleted = 0
            """)
    long countActiveGrant(@Param("userId") Long userId,
                          @Param("resourceType") String resourceType,
                          @Param("resourceId") Long resourceId,
                          @Param("grantType") String grantType);

    /**
     * 查询「审批获得」且仍生效的授权（调岗 / 离职权限重评估的回收范围）。
     *
     * <p>重评估只回收 {@code grant_source=2}（审批获得），角色继承（1）随 RBAC 角色变更另行失效，
     * 不由本入口处理。</p>
     */
    @Select("""
            select *
            from sys_user_file_permission
            where user_id = #{userId}
              and grant_source = 2
              and status = 1
              and deleted = 0
            """)
    List<PermissionGrant> selectActiveApprovalGrants(@Param("userId") Long userId);
}
