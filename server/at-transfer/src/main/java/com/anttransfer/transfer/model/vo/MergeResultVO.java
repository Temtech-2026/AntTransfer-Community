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
 * 合并结果，一个 VO 承载两种分支（前端据响应码区分）——与 {@link PrecheckResultVO} 同构：
 *
 * <ul>
 *   <li><b>合并成功</b>：HTTP 200 + {@code code=0}，携带 {@link #fileId}/{@link #sha256}；</li>
 *   <li><b>分片缺失</b>：HTTP 200 + {@code code=4002}（B 类流程分支码），
 *       {@link #missing} 非空且携带缺失分片清单，前端据此回到续传入口补传。</li>
 * </ul>
 *
 * <p><b>为什么缺片不抛异常</b>：4002 是「正常业务分支」而非失败（docs/api/README.md §7），
 * 与 4001 秒传未命中共用同一处理策略。若走 {@code BusinessException}，
 * 经全局异常处理器只会回 {@code Result<Void>}，契约要求的 {@code data.missing}
 * 会丢失，前端被迫多打一次 {@code GET /parts} 才能知道补哪些片。</p>
 *
 * <p>{@link #fileId} 为 String 的理由同 {@link PrecheckResultVO}：雪花 ID 超出 JS 安全整数范围。</p>
 *
 * @param fileId   落库后的物理文件 ID（仅成功时有值）
 * @param sha256   服务端对整件重算的 SHA-256（仅成功时有值，与客户端上报值一致才可能成功）
 * @param received 服务端已确认收到的分片索引（仅缺片时有值，便于前端就地展示进度）
 * @param missing  缺失的分片索引（仅缺片时有值）
 * @author AntTransfer CE
 */
public record MergeResultVO(
        String fileId,
        String sha256,
        List<Integer> received,
        List<Integer> missing) {

    /** 合并成功分支。 */
    public static MergeResultVO merged(Long fileId, String sha256) {
        return new MergeResultVO(fileId == null ? null : fileId.toString(), sha256, null, null);
    }

    /** 分片缺失分支（B 类流程分支码 4002）。 */
    public static MergeResultVO chunkMissing(List<Integer> received, List<Integer> missing) {
        return new MergeResultVO(null, null, received, missing);
    }

    /** 是否缺片分支。 */
    public boolean isChunkMissing() {
        return missing != null;
    }
}
