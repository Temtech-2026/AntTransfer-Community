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
package com.anttransfer.collaboration.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 协作空间实体（骨架）。
 *
 * <p>职责：映射 {@code sys_space} 表（DDL 见
 * {@code sql/V4__menu_route_user_type_and_collaboration.sql}），代表一个多人协作的
 * 逻辑容器（例如“团队项目 / 共享文件夹”）。任务与文件通过空间 ID
 * 挂载到空间内；成员关系落在 {@code sys_group_member}（按 {@code group_id}
 * 维度），空间可通过 {@link #groupId} 归属某个项目 / 群组。</p>
 *
 * @author AntTransfer CE
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_space")
public class CollaborationSpace extends BaseEntity {

    /** 空间名称 */
    @TableField("name")
    private String name;

    /** 空间创建人（所有者）用户 ID */
    @TableField("owner_user_id")
    private Long ownerUserId;

    /** 归属项目 / 群组 ID（逻辑关联 {@code sys_group}，null = 独立空间） */
    @TableField("group_id")
    private Long groupId;

    /** 空间描述 */
    @TableField("description")
    private String description;

    /** 成员数量上限（0 = 不限制） */
    @TableField("member_limit")
    private Integer memberLimit;

    /** 空间状态：0-草稿 1-进行中 2-已归档 3-已解散（骨架值约定） */
    @TableField("status")
    private Integer status;

    /** 空间过期时间（null = 永久有效） */
    @TableField("expire_time")
    private LocalDateTime expireTime;
}
