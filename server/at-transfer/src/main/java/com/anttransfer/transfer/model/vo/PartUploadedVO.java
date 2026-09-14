/*
 * Copyright (c) 2026 AntTransfer Community Contributors
 * Licensed under the Apache License, Version 2.0.
 */
package com.anttransfer.transfer.model.vo;

import java.util.List;

/**
 * 单个分片上传回执（PUT {@code /v1/transfers/{uploadId}/parts/{index}}）。
 *
 * <p>⚠️ {@code received} 是<b>索引清单（升序去重）</b>，不是计数——与前端
 * {@code PartUploadedResult.received: number[]} 逐字对齐。回计数会让前端拿到的
 * 类型与实际载荷不符（JS 侧 `received ? {received} : null` 会把它当数组透传下去）。</p>
 *
 * <p>断点续传的<b>权威来源始终是</b> {@code GET /v1/transfers/{uploadId}/parts}：
 * 并发上传时本地回执可能落后于服务端真实集合，前端不应据此裁剪待传清单。</p>
 *
 * @param received 服务端已确认收到的分片索引清单
 * @author AntTransfer CE
 */
public record PartUploadedVO(List<Integer> received) {
}
