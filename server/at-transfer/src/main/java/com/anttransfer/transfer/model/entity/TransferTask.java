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
import lombok.Getter;
import lombok.Setter;

/**
 * 分片上传任务（表 {@code sys_upload_task}）。
 *
 * <p>断点续传的唯一权威来源：进度与已收分片索引都落在本表（Redis 若做镜像只作加速，不作判据）。
 * {@link #getId()} 即雪花 ID，直接作为对外上传票据 {@code uploadId}。</p>
 *
 * <h3>状态机</h3>
 * <pre>
 *   0 排队 ──▶ 1 传输中 ⇄ 2 已暂停 ──▶ 6 合并中 ──▶ 3 已完成
 *   0 / 1 / 2 / 6 ──▶ 4 失败（可重试） / 5 已取消
 * </pre>
 * 迁移一律 CAS（{@code UPDATE ... WHERE status IN (...)}），防止并发合并 / 并发取消互相覆盖。
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_upload_task")
public class TransferTask extends BaseEntity {

    /** 排队中：任务已建、尚未收到任何分片 */
    public static final int STATUS_QUEUED = 0;
    /** 传输中：已至少收到一个分片 */
    public static final int STATUS_UPLOADING = 1;
    /** 已暂停 */
    public static final int STATUS_PAUSED = 2;
    /** 已完成：内容已落库，{@link #fileId} 已回填 */
    public static final int STATUS_COMPLETED = 3;
    /** 失败：{@link #errorMsg} 有值 */
    public static final int STATUS_FAILED = 4;
    /** 已取消 */
    public static final int STATUS_CANCELED = 5;
    /** 合并中：已抢占合并权，禁止再写分片 */
    public static final int STATUS_MERGING = 6;

    /** 任务单号（对用户可读，唯一键 uk_task_no） */
    @TableField("task_no")
    private String taskNo;

    /** 上传发起人用户 ID */
    @TableField("user_id")
    private Long userId;

    /** 合并落库后回填的 sys_file.id */
    @TableField("file_id")
    private Long fileId;

    /** 文件名（冗余展示） */
    @TableField("file_name")
    private String fileName;

    /** 目标目录 ID（0=根目录；预检上报，合并落库时作为 folderId 透传 at-file） */
    @TableField("parent_id")
    private Long parentId;

    /** 整件 SHA-256（预检上报，合并后与整件重算值比对） */
    @TableField("sha256")
    private String sha256;

    /** 文件总大小（字节） */
    @TableField("file_size")
    private Long fileSize;

    /** 分片大小（字节，任务创建时固化，续传以本字段为准） */
    @TableField("chunk_size")
    private Integer chunkSize;

    /** 分片总数 */
    @TableField("chunk_count")
    private Integer chunkCount;

    /** 已收分片索引（JSON 数组串，如 {@code [0,1,2]}） */
    @TableField("uploaded_indexes")
    private String uploadedIndexes;

    /** 已传字节数（进度 = transferredSize / fileSize） */
    @TableField("transferred_size")
    private Long transferredSize;

    /** 任务状态，取值见 {@code STATUS_*} 常量 */
    @TableField("status")
    private Integer status;

    /** 失败原因（status=4 时有值） */
    @TableField("error_msg")
    private String errorMsg;

    /** 是否已进入终态（完成 / 失败 / 取消） */
    public boolean isTerminal() {
        return status != null
                && (status == STATUS_COMPLETED || status == STATUS_FAILED || status == STATUS_CANCELED);
    }
}
