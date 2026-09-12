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
package com.anttransfer.transfer.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 传输任务实体（骨架）。
 *
 * <p>职责：映射 {@code sys_upload_task} 表，记录一次分片上传任务的业务信息
 * （文件、进度、状态、错误信息）。继承 {@link BaseEntity} 自动获得
 * id / createBy / createTime / updateBy / updateTime / deleted 公共字段。</p>
 *
 * <p>状态机（status 字段取值约定，校验逻辑应收敛于 at-transfer service 层；
 * 合并为长 IO，在数据库事务外进行，落库只包短事务状态迁移）：</p>
 * <pre>
 *   0 排队中 → 1 传输中 ⇄ 2 已暂停
 *   1 传输中 → 6 合并中 → 3 已完成
 *   0/1/2/6 → 4 失败（可重试 → 重新进入 0）
 *   0/1/2/6 → 5 已取消
 * </pre>
 *
 * @author AntTransfer CE
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_upload_task")
public class TransferRecord extends BaseEntity {

    /** 传输业务编号（对用户可读，如 AT20260906001） */
    @TableField("task_no")
    private String taskNo;

    /** 关联文件 ID（at-file 模块的 sys_file.id，本模块不直接操作文件字节） */
    @TableField("file_id")
    private Long fileId;

    /** 文件名（冗余展示，便于列表页免查文件表） */
    @TableField("file_name")
    private String fileName;

    /** 文件总大小（字节） */
    @TableField("file_size")
    private Long fileSize;

    /**
     * 任务状态：0-排队中 1-传输中 2-已暂停 3-已完成 4-失败 5-已取消 6-合并中
     * （骨架采用 Integer 并配合状态机校验，后续可升级为枚举映射）
     */
    @TableField("status")
    private Integer status;

    /** 已传输字节数（用于进度 = transferredSize / fileSize 与断点续传） */
    @TableField("transferred_size")
    private Long transferredSize;

    /** 失败原因（仅在 status=4 时有值，前端可展示重试建议） */
    @TableField("error_msg")
    private String errorMsg;
}
