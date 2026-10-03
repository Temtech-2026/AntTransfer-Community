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
package com.anttransfer.file.service;

import com.anttransfer.common.approval.SensitiveDestroyApprovalPort;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.MybatisPlusTestSupport;
import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.file.repository.FileNodeMapper;
import com.anttransfer.file.repository.FileObjectMapper;
import com.anttransfer.file.repository.FileTagMapper;
import com.anttransfer.file.repository.FileVersionMapper;
import com.anttransfer.file.repository.FolderMapper;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.anttransfer.file.storage.FileStorage;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.List;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 越权用例 TC-H-02「A 请求删除 fileB」的服务层载体：<b>不仅要拒绝，还必须什么都没改</b>。
 *
 * <p>为什么不能只断言抛出 4005：越权的真正危害是<b>副作用</b>——文件被移进了攻击者的回收站
 * （对受害者表现为「文件凭空消失」），或清空回收站时把别人的行一起销毁。因此每个拒绝用例
 * 都额外钉死「写操作一次都没发生」。</p>
 *
 * <p>另有第二道防线值得单独守护：{@code recycle} 与 {@code emptyRecycle} 的 SQL
 * <b>自带 {@code owner_user_id} 条件</b>。即便将来有人在调用处漏掉 guard，SQL 仍不会碰到他人数据。
 * 这条条件一旦被「优化」掉就会静默失去保护，故用捕获到的条件片段把它固定下来。</p>
 *
 * <p>纯 POJO + Mockito 测试，不起 Spring 上下文。</p>
 *
 * @author AntTransfer CE
 */
class FileRecycleOwnershipTest {

    private static final long ME = 7L;
    private static final long OTHER = 8L;

    private FileNodeMapper fileNodeMapper;
    private FileAuditLogger auditLogger;
    private FileProperties properties;
    private FileNodeService service;

    @BeforeEach
    void setUp() {
        MybatisPlusTestSupport.initTableInfo();
        fileNodeMapper = mock(FileNodeMapper.class);
        auditLogger = mock(FileAuditLogger.class);
        properties = mock(FileProperties.class);
        service = new FileNodeService(
                fileNodeMapper,
                mock(FileObjectMapper.class),
                mock(FolderMapper.class),
                mock(FileTagMapper.class),
                mock(FileVersionMapper.class),
                // 用真实 guard：越权判定本身就是被测语义，mock 掉等于绕过
                new FileOwnershipGuard(fileNodeMapper, mock(FolderMapper.class)),
                auditLogger,
                properties,
                mock(FileStorage.class),
                mock(SensitiveDestroyApprovalPort.class),
                mock(PlatformTransactionManager.class));
    }

    private FileNode node(long id, long ownerUserId, int status) {
        FileNode node = new FileNode();
        node.setId(id);
        node.setOwnerUserId(ownerUserId);
        node.setStatus(status);
        node.setName("file-" + id);
        return node;
    }

    private static String sqlOf(Wrapper<?> wrapper) {
        String segment = wrapper.getSqlSegment();
        return segment == null ? "" : segment.toLowerCase(Locale.ROOT);
    }

    /* ============================ 单条删除 ============================ */

    @Test
    @DisplayName("TC-H-02 删除他人的文件：判不存在（4005），且写操作与审计一次都没发生")
    void moveToRecycle_foreignFile_isRejectedWithoutSideEffect() {
        when(fileNodeMapper.selectById(200L)).thenReturn(node(200L, OTHER, FileNode.STATUS_NORMAL));

        BusinessException ex = assertThrows(BusinessException.class, () -> service.moveToRecycle(ME, 200L));

        assertEquals(ErrorCode.FILE_NOT_FOUND.getCode(), ex.getCode());
        // 真正的危害是副作用：B 的文件必须还在（表现为「A 的回收站里不该多出别人的文件」）
        verify(fileNodeMapper, never()).update(any(), any());
        verifyNoInteractions(auditLogger);
    }

    /* ============================ 批量删除 ============================ */

    @Test
    @DisplayName("TC-H-02 批量删除混入他人文件：整批拒绝，绝不部分成功")
    void batchMoveToRecycle_mixedIds_rejectsWholeBatch() {
        when(fileNodeMapper.selectBatchIds(List.of(1L, 200L)))
                .thenReturn(List.of(node(1L, ME, FileNode.STATUS_NORMAL), node(200L, OTHER, FileNode.STATUS_NORMAL)));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.batchMoveToRecycle(ME, List.of(1L, 200L)));

        assertEquals(ErrorCode.FILE_NOT_FOUND.getCode(), ex.getCode());
        verify(fileNodeMapper, never()).update(any(), any());
        verifyNoInteractions(auditLogger);
    }

    @Test
    @DisplayName("TC-H-02 全为本人文件：放行（防「一律拒绝」的假通过），且条件里仍带 owner 收口")
    @SuppressWarnings("unchecked")
    void batchMoveToRecycle_allOwned_movesAndKeepsOwnerScope() {
        when(fileNodeMapper.selectBatchIds(List.of(1L)))
                .thenReturn(List.of(node(1L, ME, FileNode.STATUS_NORMAL)));
        when(fileNodeMapper.update(any(), any())).thenReturn(1);

        int affected = service.batchMoveToRecycle(ME, List.of(1L));

        assertEquals(1, affected);
        ArgumentCaptor<Wrapper<FileNode>> captor = ArgumentCaptor.forClass(Wrapper.class);
        verify(fileNodeMapper).update(any(), captor.capture());
        String sql = sqlOf(captor.getValue());
        assertTrue(sql.contains("owner_user_id"),
                "回收条件必须自带 owner 收口，否则漏掉一次 guard 就会改到他人数据：" + sql);
        assertTrue(sql.contains("status"), "只回收「正常态」条目，已在回收站的不得重复计数：" + sql);
    }

    /* ============================ 清空回收站 ============================ */

    @Test
    @DisplayName("TC-H-02 清空回收站：不是一条无条件 DELETE，查询自带 owner 条件")
    @SuppressWarnings("unchecked")
    void emptyRecycle_isOwnerScopedNotBlanketDelete() {
        when(properties.getRecycleCleanupBatchSize()).thenReturn(20);
        when(fileNodeMapper.selectList(any())).thenReturn(List.of());

        int destroyed = service.emptyRecycle(ME);

        assertEquals(0, destroyed);
        ArgumentCaptor<Wrapper<FileNode>> captor = ArgumentCaptor.forClass(Wrapper.class);
        verify(fileNodeMapper).selectList(captor.capture());
        String sql = sqlOf(captor.getValue());
        assertTrue(sql.contains("owner_user_id"),
                "清空回收站必须限定在本人范围内，否则一次调用会销毁全站回收站：" + sql);
        assertTrue(sql.contains("status"), "必须限定「回收站状态」，不能顺手带走正常文件：" + sql);
        // 没有「无差别删库」兜底：一条 deleteById / delete 都不能出现
        verify(fileNodeMapper, never()).deleteById(any(Long.class));
        verify(fileNodeMapper, never()).delete(any());
    }
}
