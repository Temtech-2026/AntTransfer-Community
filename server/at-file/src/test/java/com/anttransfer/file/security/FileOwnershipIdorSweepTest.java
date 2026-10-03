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
package com.anttransfer.file.security;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.file.repository.FileNodeMapper;
import com.anttransfer.file.repository.FolderMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 越权用例 TC-H-08「IDOR 遍历」的可执行载体。
 *
 * <p>单点越权与<b>可遍历性</b>是两件事：单点用例只证明「这一个 ID 被拒」，而攻击者真正做的是
 * 从小到大扫 ID 空间。因此本类不看单次结果，而是要求<b>整段扫描的响应完全同质</b>——
 * 错误码与提示语在「他人的资源」和「不存在的资源」之间必须逐字一致。</p>
 *
 * <p>为什么连 message 一起断言：只对齐 code、却让 message 带上「无权访问某个已存在的文件」，
 * 攻击者仍能用一句话的差异区分「这个 ID 存在但不是我的」与「这个 ID 不存在」，
 * 从而把整张表的 ID 空间枚举出来（存在性泄露）。</p>
 *
 * <p>纯 POJO + Mockito 测试，不起 Spring 上下文。</p>
 *
 * @author AntTransfer CE
 */
class FileOwnershipIdorSweepTest {

    private static final long ME = 7L;
    private static final long OTHER = 8L;

    /** 扫描区间上限：范围本身不参与判定，取足够大以覆盖「批量翻页」场景。 */
    private static final int SWEEP_LIMIT = 100;
    private static final int CHUNK_SIZE = 10;

    private FileNodeMapper fileNodeMapper;
    private FileOwnershipGuard guard;

    @BeforeEach
    void setUp() {
        fileNodeMapper = mock(FileNodeMapper.class);
        guard = new FileOwnershipGuard(fileNodeMapper, mock(FolderMapper.class));
    }

    /** 偶数 ID 属于他人，奇数 ID 不存在——两种「不该给」的情形交替出现。 */
    private void stubEvenIdsBelongToOther() {
        when(fileNodeMapper.selectById(anyLong())).thenAnswer(invocation -> {
            long id = invocation.getArgument(0);
            if (id % 2 != 0) {
                return null;
            }
            FileNode node = new FileNode();
            node.setId(id);
            node.setOwnerUserId(OTHER);
            return node;
        });
    }

    @Test
    @DisplayName("TC-H-08 连续扫描相邻 ID：无一条返回他人数据，且响应逐字同质（不可区分存在性）")
    void sweepAdjacentIds_isUniformlyRejected() {
        stubEvenIdsBelongToOther();
        Set<Integer> codes = new HashSet<>();
        Set<String> messages = new HashSet<>();
        List<Long> leaked = new ArrayList<>();

        for (long id = 1; id <= SWEEP_LIMIT; id++) {
            long current = id;
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> guard.requireOwnedNode(current, ME),
                    "ID " + current + " 越权/不存在时必须拒绝，不得返回任何数据");
            codes.add(ex.getCode());
            messages.add(ex.getMessage());
            if (ex.getCode() != ErrorCode.FILE_NOT_FOUND.getCode()) {
                leaked.add(current);
            }
        }

        assertEquals(List.of(), leaked, "扫描过程中出现了非 4005 的响应：越权路径被绕开");
        assertEquals(1, codes.size(), "整段扫描的错误码必须唯一：" + codes);
        assertEquals(1, messages.size(), "整段扫描的提示语必须唯一，否则可用措辞差异反推 ID 是否存在：" + messages);
    }

    @Test
    @DisplayName("TC-H-08 分批扫描：每批含他人条目即整批拒绝，绝不返回「部分可用」的结果")
    void sweepBatches_neverPartiallySucceed() {
        stubEvenIdsBelongToOther();

        for (int start = 1; start <= SWEEP_LIMIT; start += CHUNK_SIZE) {
            List<Long> chunk = new ArrayList<>();
            for (long id = start; id < start + CHUNK_SIZE; id++) {
                chunk.add(id);
            }
            List<Long> ids = List.copyOf(chunk);
            when(fileNodeMapper.selectBatchIds(ids)).thenAnswer(invocation -> {
                List<FileNode> found = new ArrayList<>();
                for (Long id : ids) {
                    if (id % 2 == 0) {
                        FileNode node = new FileNode();
                        node.setId(id);
                        node.setOwnerUserId(OTHER);
                        found.add(node);
                    }
                }
                return found;
            });

            assertThrows(BusinessException.class, () -> guard.requireOwnedNodes(ids, ME),
                    "批次 " + ids + " 混有他人条目，必须整批失败");
        }
    }
}
