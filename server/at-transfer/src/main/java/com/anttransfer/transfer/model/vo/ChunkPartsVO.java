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
package com.anttransfer.transfer.model.vo;

import java.util.List;

/**
 * 分片接收状态（GET {@code /v1/transfers/{uploadId}/parts}），断点续传的判据接口。
 *
 * <p>客户端以 {@link #received} 为「服务端已确认收到」的唯一清单，只补传差集；
 * 因此本接口必须读数据库而不是读暂存目录——目录里的残片可能尚未被事务确认。</p>
 *
 * @param received   服务端已确认收到的分片索引（升序，空表示尚未收到任何分片）
 * @param chunkSize  任务固化的分片大小
 * @param chunkCount 任务固化的分片总数
 * @author AntTransfer CE
 */
public record ChunkPartsVO(List<Integer> received, Integer chunkSize, Integer chunkCount) {
}
