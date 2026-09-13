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

import com.anttransfer.permission.model.entity.ApprovalRequest;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 权限申请单 Mapper。
 *
 * <p>索引依赖（sql/V1__schema.sql）：{@code idx_applicant_resource(applicant_id, resource_type,
 * resource_id, status)} 支撑「防重复活动态」判重，{@code idx_approver(approver_id, status)}
 * 支撑「待我审批」分页，{@code idx_status_created(status, create_time)} 支撑超时扫描。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface ApprovalRequestMapper extends BaseMapper<ApprovalRequest> {

    /**
     * 统计同人同资源是否已有进行中（待审 0 / 转审 3）申请单——防重复提交（1009）。
     * 走 {@code idx_applicant_resource} 最左前缀。
     */
    @Select("""
            select count(1)
            from sys_approval_request
            where applicant_id = #{applicantId}
              and resource_type = #{resourceType}
              and resource_id = #{resourceId}
              and status in (0, 3)
              and deleted = 0
            """)
    long countActive(@Param("applicantId") Long applicantId,
                     @Param("resourceType") String resourceType,
                     @Param("resourceId") Long resourceId);

    /**
     * 查询可用于「彻底销毁物理文件」的已通过高敏感审批单号（供 at-file 的 SPI 适配器调用）。
     *
     * <p>语义见 {@code SensitiveDestroyApprovalPort#findApprovedHighSensitiveDestroy}：
     * 四条件为 applicant_id 本人 + resource_type=FILE + resource_id=fileId + level=3 + status=1。
     * 取最近批复的一张（{@code decided_at} 倒序），走 {@code idx_applicant_resource} 最左前缀
     * 过滤出申请单后按时间排序，代价可控。</p>
     *
     * @param applicantId 执行销毁的用户 ID（须为审批单申请人本人）
     * @param fileId      目标物理文件 ID（sys_file.id）
     * @return 审批单号；无可用审批单返回 null
     */
    @Select("""
            select application_no
            from sys_approval_request
            where applicant_id = #{applicantId}
              and resource_type = 'FILE'
              and resource_id = #{resourceId}
              and level = 3
              and status = 1
              and deleted = 0
            order by decided_at desc
            limit 1
            """)
    String findApprovedHighSensitiveDestroy(@Param("applicantId") Long applicantId,
                                           @Param("resourceId") Long resourceId);
}
