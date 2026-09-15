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
package com.anttransfer.transfer.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Collection;
import java.util.List;
import java.util.TreeSet;

/**
 * 已收分片索引的序列化工具：在 {@code sys_upload_task.uploaded_indexes}
 * （{@code varchar(8192)} 存 JSON 数组串）与内存集合之间转换。
 *
 * <p>解析失败一律降级为<b>空集</b>而不是抛异常：索引串损坏时「当作没收到分片」
 * 只会导致重传若干分片，而抛异常会让整个任务彻底不可续传——两害相权取轻。</p>
 *
 * @author AntTransfer CE
 */
final class ChunkIndexes {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ChunkIndexes() {
    }

    /** 解析索引串；{@code null} / 空 / 非法 JSON 一律返回空集（升序）。 */
    static TreeSet<Integer> parse(String json) {
        TreeSet<Integer> indexes = new TreeSet<>();
        if (json == null || json.isBlank()) {
            return indexes;
        }
        try {
            List<Integer> parsed = MAPPER.readValue(json, new TypeReference<List<Integer>>() {
            });
            if (parsed != null) {
                for (Integer index : parsed) {
                    if (index != null && index >= 0) {
                        indexes.add(index);
                    }
                }
            }
        } catch (Exception ignored) {
            // 索引串损坏 → 视为空集，让客户端重传（见类注释）
            return new TreeSet<>();
        }
        return indexes;
    }

    /** 序列化为 JSON 数组串（升序，便于人工排查与断言）。 */
    static String write(Collection<Integer> indexes) {
        try {
            return MAPPER.writeValueAsString(new TreeSet<>(indexes));
        } catch (Exception e) {
            // int 列表序列化不应失败；真失败说明运行环境异常，交由上层兜底
            throw new IllegalStateException("分片索引序列化失败", e);
        }
    }
}
