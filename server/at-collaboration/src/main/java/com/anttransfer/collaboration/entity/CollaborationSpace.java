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
package com.anttransfer.collaboration.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 协作空间实体（骨架）。
 *
 * <p>职责：映射 {@code collaboration_space} 表，代表一个多人协作的
 * 逻辑容器（例如“团队项目 / 共享文件夹”）。任务与文件通过空间 ID
 * 挂载到空间内，成员则通过成员子表（协作时扩展）关联本空间。</p>
 *
 * @author AntTransfer CE
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("collaboration_space")
public class CollaborationSpace extends BaseEntity {

    /** 空间名称 */
    @TableField("name")
    private String name;

    /** 空间创建人（所有者）用户 ID */
    @TableField("owner_user_id")
    private Long ownerUserId;

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
