/*
 * Copyright (c) 2026 AntTransfer Community Contributors
 * Licensed under the Apache License, Version 2.0.
 */
package com.anttransfer.transfer.model.vo;

/**
 * 预检结果，一个 VO 承载两种分支（前端据 {@code instant} 与响应码区分）：
 *
 * <ul>
 *   <li><b>秒传命中</b>：HTTP 200 + {@code code=0}，{@code instant=true}，携带 {@link #fileId}/{@link #nodeId}；</li>
 *   <li><b>未命中</b>：HTTP 200 + {@code code=4001}，{@code instant=false}，携带上传票据
 *       {@link #uploadId}/{@link #chunkSize}/{@link #chunkCount}，前端据此切片续传。</li>
 * </ul>
 *
 * <p><b>为什么 ID 是 String 而不是 Long</b>：上传链路的主键是雪花 ID（19 位，量级 ~1.9e18），
 * 超过 JS {@code Number.MAX_SAFE_INTEGER}（9.007e15）。前端
 * {@code web/src/services/upload/types.ts} 把 {@code uploadId}/{@code fileId}/{@code nodeId}
 * 声明为 {@code string}，且 {@code docs/api/README.md} 的示例也以引号包裹 ID。
 * 若按 JSON number 下发，浏览器解析时末位会被静默取整，
 * 之后 {@code GET/PUT /v1/transfers/{uploadId}/parts} 必定 4101。
 * 故上传域的 ID 一律以字符串过线（路由与请求体解析不受影响，Spring 会转回 Long）。</p>
 *
 * @param instant    是否命中秒传
 * @param fileId     命中的物理文件 ID（仅命中时有值）
 * @param nodeId     命中的引用条目 ID（仅命中时有值）
 * @param uploadId   上传票据（仅未命中时有值）
 * @param chunkSize  分片大小（仅未命中时有值）
 * @param chunkCount 分片总数（仅未命中时有值）
 * @author AntTransfer CE
 */
public record PrecheckResultVO(
        boolean instant,
        String fileId,
        String nodeId,
        String uploadId,
        Integer chunkSize,
        Integer chunkCount) {

    /** 秒传命中分支（HTTP 200 + code=0）。 */
    public static PrecheckResultVO instant(Long fileId, Long nodeId) {
        return new PrecheckResultVO(true, toId(fileId), toId(nodeId), null, null, null);
    }

    /** 未命中分支（HTTP 200 + code=4001）。 */
    public static PrecheckResultVO missing(Long uploadId, Integer chunkSize, Integer chunkCount) {
        return new PrecheckResultVO(false, null, null, toId(uploadId), chunkSize, chunkCount);
    }

    private static String toId(Long id) {
        return id == null ? null : id.toString();
    }
}
