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
package com.anttransfer.file.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 批量打包下载任务（映射 {@code sys_pack_task}，见 sql/V6__file_management.sql）。
 *
 * <p><b>为什么是异步任务而非同步流式 zip：</b>同步打包时若用户在下载途中取消，服务端往往
 * 要到写响应失败才发现，此时压缩线程已跑完大半——CPU 白烧且无法续传。落成任务后：
 * 产物可续传（Range 直接作用在 zip 文件上）、可重试、可过期清理，超限也能在创建入口就拒绝。</p>
 *
 * <p>状态流转：{@code 0 排队 → 1 打包中 → 2 已完成}；{@code 0/1 → 3 失败}；{@code 2 → 4 已过期}。
 * 状态迁移一律 CAS（{@code update ... where id=? and status=?}），防止「清理任务」与
 * 「打包完成」并发时把已完成的任务改回过期。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_pack_task")
public class PackTask extends BaseEntity {

    /** 排队中 */
    public static final int STATUS_QUEUED = 0;
    /** 打包中 */
    public static final int STATUS_RUNNING = 1;
    /** 已完成（产物可下载） */
    public static final int STATUS_DONE = 2;
    /** 失败 */
    public static final int STATUS_FAILED = 3;
    /** 已过期（产物已清理） */
    public static final int STATUS_EXPIRED = 4;

    /** 任务单号（对用户可读） */
    @TableField("task_no")
    private String taskNo;

    /** 发起用户 ID（产物仅本人可下载） */
    @TableField("user_id")
    private Long userId;

    /** 任务状态：0-排队 1-打包中 2-已完成 3-失败 4-已过期 */
    @TableField("status")
    private Integer status;

    /** 打包文件数（创建时确定） */
    @TableField("file_count")
    private Integer fileCount;

    /** 打包原始总字节数 */
    @TableField("total_bytes")
    private Long totalBytes;

    /**
     * 待打包条目 ID 列表（英文逗号分隔，顺序即 zip 条目顺序）。
     *
     * <p><b>为什么必须落库：</b>打包是异步任务。若只把 ID 列表捕获在工作线程的内存闭包里，
     * 进程重启、线程池拒绝或任务重试时就再也说不清「这一单该打哪些文件」，只能留下一条永远卡在
     * 「排队中」的僵尸记录。落库后任务自包含：既能安全重试，排障时也能直接看出这一单的内容。</p>
     */
    @TableField("node_ids")
    private String nodeIds;

    /** 任务级速率上限（字节/秒，0=不限） */
    @TableField("speed_limit")
    private Long speedLimit;

    /** 产物文件名 */
    @TableField("product_name")
    private String productName;

    /** 产物存储相对路径 */
    @TableField("product_path")
    private String productPath;

    /** 产物字节数 */
    @TableField("product_size")
    private Long productSize;

    /** 产物过期时间（到期清理并置 4） */
    @TableField("expire_time")
    private LocalDateTime expireTime;

    /** 完成 / 失败时间 */
    @TableField("finish_time")
    private LocalDateTime finishTime;

    /** 失败原因（status=3 时填写） */
    @TableField("error_msg")
    private String errorMsg;

    /** 是否仍在进行中（排队 / 打包中），用于「超限在入口拒绝」的并发计数 */
    public boolean isActive() {
        return status != null && (status == STATUS_QUEUED || status == STATUS_RUNNING);
    }
}
