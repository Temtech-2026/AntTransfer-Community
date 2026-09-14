/*
 * Copyright (c) 2026 AntTransfer Community Contributors
 * Licensed under the Apache License, Version 2.0.
 */
package com.anttransfer.transfer.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 分片上传配置（前缀 {@code anttransfer.transfer}）。
 *
 * <p><b>与 multipart 上限的联动</b>：单分片走 {@code multipart/form-data} 上传，
 * 因此 {@code spring.servlet.multipart.max-file-size} 必须 ≥ {@link #chunkSize}，
 * 否则请求会在进入 Controller 前被 Servlet 容器直接拒绝（表现为裸 400，业务日志无栈）。
 * 两者已在 {@code application.yml} 中对齐。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "anttransfer.transfer")
public class TransferProperties {

    /** 默认单分片大小：8 MiB（与 {@code anttransfer.file.chunk-size} 保持一致） */
    private long chunkSize = 8L * 1024 * 1024;

    /** 单分片大小上限：64 MiB，须与 multipart 的 max-file-size 对齐 */
    private long maxChunkSize = 64L * 1024 * 1024;

    /**
     * 单任务分片数上限：1024。
     *
     * <p>上限存在的硬约束是 {@code sys_upload_task.uploaded_indexes} 为 {@code varchar(8192)}：
     * 索引集是 JSON 数组串，1024 个索引约 6 KB，留有余量；再大就有截断风险。
     * 超过上限时改为<b>放大分片</b>而不是拒绝上传（见 {@code TransferTaskService#resolveChunkSize}），
     * 因此可传输的最大文件为 {@code maxChunkSize × maxChunkCount} = 64 GiB。</p>
     */
    private int maxChunkCount = 1024;

    /** 分片暂存根目录（合片前的 {@code *.part} 与 {@code merged.bin}） */
    private String stagingRoot = "./data/transfer-staging";

    /** 单用户同时进行中的任务数上限，超出以 4103 拒绝，防止暂存盘被刷爆 */
    private int maxActiveTasks = 3;

    /** 进行中任务的保留时长（小时）：超时任务在后续预检时顺带标记失败并清理暂存 */
    private int taskTtlHours = 24;
}
