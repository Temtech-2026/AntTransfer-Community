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
import com.anttransfer.file.model.entity.Folder;
import com.anttransfer.file.repository.FileNodeMapper;
import com.anttransfer.file.repository.FolderMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 防水平越权核心单测：{@link FileOwnershipGuard} 是<b>所有读写路径的唯一归属入口</b>。
 *
 * <p>三条不可退让的语义在这里被钉死：</p>
 * <ol>
 *   <li><b>越权 = 不存在</b>：操作他人资源与操作不存在的资源，错误码必须完全一致。
 *       一旦两者可区分，攻击者就能用响应差异把别人的 ID 空间扫一遍（存在性泄露）。</li>
 *   <li><b>批量操作整批拒绝</b>：只要有一条不合法就全批失败，绝不「跳过越权项、返回其余」——
 *       后者会让用户拿到一份缺文件的打包结果却毫无提示。</li>
 *   <li><b>根目录放行但不查库</b>：{@code folderId=0} 不是实体，无归属可言，也不该产生一次白查。</li>
 * </ol>
 *
 * <p>纯 POJO + Mockito 测试，不起 Spring 上下文。</p>
 *
 * @author AntTransfer CE
 */
class FileOwnershipGuardTest {

    private static final long ME = 7L;
    private static final long OTHER = 8L;

    private FileNodeMapper fileNodeMapper;
    private FolderMapper folderMapper;
    private FileOwnershipGuard guard;

    @BeforeEach
    void setUp() {
        fileNodeMapper = mock(FileNodeMapper.class);
        folderMapper = mock(FolderMapper.class);
        guard = new FileOwnershipGuard(fileNodeMapper, folderMapper);
    }

    private FileNode node(long id, long ownerUserId) {
        FileNode node = new FileNode();
        node.setId(id);
        node.setOwnerUserId(ownerUserId);
        return node;
    }

    private Folder folder(long id, long ownerUserId) {
        Folder folder = new Folder();
        folder.setId(id);
        folder.setOwnerUserId(ownerUserId);
        return folder;
    }

    /* ============================ 文件条目 ============================ */

    @Test
    @DisplayName("本人的条目：放行并原样返回")
    void ownedNode_shouldPass() {
        when(fileNodeMapper.selectById(100L)).thenReturn(node(100L, ME));

        FileNode result = guard.requireOwnedNode(100L, ME);

        assertEquals(100L, result.getId());
    }

    @Test
    @DisplayName("他人的条目与不存在的条目：错误码必须完全一致（存在性不泄露）")
    void nodeOfOtherUser_isIndistinguishableFromMissing() {
        when(fileNodeMapper.selectById(100L)).thenReturn(node(100L, OTHER));

        BusinessException foreign = assertThrows(BusinessException.class,
                () -> guard.requireOwnedNode(100L, ME));
        when(fileNodeMapper.selectById(100L)).thenReturn(null);
        BusinessException missing = assertThrows(BusinessException.class,
                () -> guard.requireOwnedNode(100L, ME));

        assertEquals(ErrorCode.FILE_NOT_FOUND.getCode(), foreign.getCode());
        assertEquals(missing.getCode(), foreign.getCode(), "越权与不存在的响应必须不可区分");
    }

    @Test
    @DisplayName("nodeId 为 null：直接判不存在，不查库")
    void nullNodeId_shouldRejectWithoutQuery() {
        BusinessException ex = assertThrows(BusinessException.class, () -> guard.requireOwnedNode(null, ME));

        assertSame(ErrorCode.FILE_NOT_FOUND, ex.getErrorCode());
        verifyNoInteractions(fileNodeMapper);
    }

    @Test
    @DisplayName("批量：混入一条他人条目 → 整批拒绝")
    void batchWithForeignNode_shouldRejectWholeBatch() {
        when(fileNodeMapper.selectBatchIds(List.of(1L, 2L, 3L)))
                .thenReturn(List.of(node(1L, ME), node(2L, OTHER), node(3L, ME)));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> guard.requireOwnedNodes(List.of(1L, 2L, 3L), ME));

        assertSame(ErrorCode.FILE_NOT_FOUND, ex.getErrorCode(), "部分成功会产出静默缺件的打包结果");
    }

    @Test
    @DisplayName("批量：有条目查不到（已销毁 / 不存在）→ 同样整批拒绝")
    void batchWithMissingNode_shouldRejectWholeBatch() {
        when(fileNodeMapper.selectBatchIds(List.of(1L, 2L)))
                .thenReturn(List.of(node(1L, ME)));

        assertThrows(BusinessException.class, () -> guard.requireOwnedNodes(List.of(1L, 2L), ME));
    }

    @Test
    @DisplayName("批量：空集合 → 判不存在，不查库")
    void emptyBatch_shouldRejectWithoutQuery() {
        assertThrows(BusinessException.class, () -> guard.requireOwnedNodes(List.of(), ME));

        verifyNoInteractions(fileNodeMapper);
    }

    @Test
    @DisplayName("批量：全部合法 → 返回顺序与入参一致（打包按序建 zip 条目）")
    void ownedBatch_shouldKeepRequestOrder() {
        when(fileNodeMapper.selectBatchIds(List.of(3L, 1L, 2L)))
                .thenReturn(List.of(node(1L, ME), node(2L, ME), node(3L, ME)));

        List<Long> ids = guard.requireOwnedNodes(List.of(3L, 1L, 2L), ME).stream().map(FileNode::getId).toList();

        assertEquals(List.of(3L, 1L, 2L), ids);
    }

    /* ============================ 目录 ============================ */

    @Test
    @DisplayName("根目录（folderId=0）：放行且不查库")
    void rootFolder_shouldPassWithoutQuery() {
        assertNull(guard.requireOwnedFolder(Folder.ROOT_ID, ME));

        verifyNoInteractions(folderMapper);
    }

    @Test
    @DisplayName("他人目录：按不存在处理（4013，与 4005 各自独立但同样不泄露）")
    void folderOfOtherUser_shouldThrowFolderNotFound() {
        when(folderMapper.selectById(200L)).thenReturn(folder(200L, OTHER));

        BusinessException foreign = assertThrows(BusinessException.class,
                () -> guard.requireOwnedFolder(200L, ME));
        when(folderMapper.selectById(200L)).thenReturn(null);
        BusinessException missing = assertThrows(BusinessException.class,
                () -> guard.requireOwnedFolder(200L, ME));

        assertSame(ErrorCode.FOLDER_NOT_FOUND, foreign.getErrorCode());
        assertEquals(missing.getCode(), foreign.getCode());
    }

    @Test
    @DisplayName("批量校验目录：含他人目录即拒绝；含 0（根）不参与校验")
    void requireOwnedFolders_shouldIgnoreRootButRejectForeign() {
        when(folderMapper.selectBatchIds(Set.of(1L, 2L))).thenReturn(List.of(folder(1L, ME)));

        assertThrows(BusinessException.class, () -> guard.requireOwnedFolders(Set.of(0L, 1L, 2L), ME));

        // 只把非根目录送进查询：根不是实体，带进去只会多一次必然失败的计数
        verify(folderMapper).selectBatchIds(Set.of(1L, 2L));
        verify(folderMapper, never()).selectBatchIds(Set.of(0L, 1L, 2L));
    }

    @Test
    @DisplayName("批量校验目录：只有根目录时直接放行，不查库")
    void requireOwnedFolders_withOnlyRoot_shouldPassWithoutQuery() {
        guard.requireOwnedFolders(Set.of(Folder.ROOT_ID), ME);

        verifyNoInteractions(folderMapper);
    }
}
