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
package com.anttransfer.permission.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 文件授权实体（骨架，映射 {@code sys_user_file_permission}）。
 *
 * <p>对象级「实际授权」记录（V1 sys_ 表族，见 sql/V1__schema.sql）：表达对特定
 * 文件 / 资源的显式授权，带来源与到期时间。状态机 {@code 1-生效 → 2-到期回收 / 3-撤销}
 * 不可逆；到期回收由 {@code PermissionGrantExpireScheduler} 按 {@code expire_at}
 * 扫描并 CAS 置 2，状态迁移一律禁止「查-判-改」读改写（见 system-design §6 红线 P-1）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_user_file_permission")
public class PermissionGrant extends BaseEntity {

    /** 生效（可访问判定的唯一有效态） */
    public static final int STATUS_ACTIVE = 1;

    /** 到期回收（定时任务置入，终态） */
    public static final int STATUS_EXPIRED = 2;

    /** 撤销（安全管理员/审批人提前撤销，终态） */
    public static final int STATUS_REVOKED = 3;

    /** 来源类型：角色继承（角色静态授权 / 对象级策略放平，expire_at 通常为 null） */
    public static final int SOURCE_ROLE = 1;

    /** 来源类型：审批获得（申请单批复通过写入，expire_at 取批复的时效时间点） */
    public static final int SOURCE_APPROVAL = 2;

    /** 来源申请单 ID（回收 / 撤销溯源；角色继承来源为 null） */
    @TableField("application_id")
    private Long applicationId;

    /** 被授权人用户 ID（逻辑关联 sys_user） */
    @TableField("user_id")
    private Long userId;

    /** 目标资源类型：FILE-文件 SPACE-空间 GROUP-项目/群组（CE 默认 FILE） */
    @TableField("resource_type")
    private String resourceType;

    /** 目标资源 ID（逻辑关联；CE 下为 sys_file.id） */
    @TableField("resource_id")
    private Long resourceId;

    /** 授权动作：ACCESS-访问 DOWNLOAD-下载 EDIT-编辑 SHARE-外发 DESTROY-销毁 */
    @TableField("grant_type")
    private String grantType;

    /** 授权来源：1-角色继承 2-审批获得（见常量 SOURCE_ROLE / SOURCE_APPROVAL） */
    @TableField("grant_source")
    private Integer grantSource;

    /** 授权级别：1-低 2-中 3-高 */
    @TableField("level")
    private Integer level;

    /** 审批人用户 ID（逻辑关联 sys_user；角色继承来源可为 null） */
    @TableField("approve_by")
    private Long approveBy;

    /** 授权过期时间（到期回收判据；null=长期有效 / 跟随角色） */
    @TableField("expire_at")
    private LocalDateTime expireAt;

    /** 状态：1-生效 2-到期回收 3-撤销 */
    @TableField("status")
    private Integer status;

    /** 实际回收 / 撤销时间 */
    @TableField("revoke_at")
    private LocalDateTime revokeAt;
}
