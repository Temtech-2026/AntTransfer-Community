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

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.model.entity.PackTask;
import com.anttransfer.file.model.vo.PackTaskVO;
import com.anttransfer.file.repository.PackTaskMapper;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.anttransfer.file.storage.FileStorage;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 越权用例 TC-H-04「读取他人的传输 / 打包任务」的可执行载体。
 *
 * <p>打包任务是最容易被忽略的越权面：任务 ID 是雪花值，但<b>任务详情里带着产物文件名与大小</b>，
 * 产物接口更是直接吐字节流。一旦归属判错，攻击者不需要猜到文件 ID，只要遍历任务 ID
 * 就能拿到别人的整包数据。故这里同时钉死两条链路（详情 / 产物下发）。</p>
 *
 * <p>泄漏面不止「返回体」：产物接口一旦越过归属判定，就会开始读磁盘并把字节写进响应。
 * 因此拒绝路径必须断言<b>响应对象与下载服务都没有被触碰</b>，而不是只看异常类型。</p>
 *
 * <p>纯 POJO + Mockito 测试，不起 Spring 上下文。</p>
 *
 * @author AntTransfer CE
 */
class PackTaskOwnershipTest {

    private static final long ME = 7L;
    private static final long OTHER = 8L;
    private static final long TASK_OF_OTHER = 9001L;

    private PackTaskMapper packTaskMapper;
    private FileDownloadService fileDownloadService;
    private PackService service;

    @BeforeEach
    void setUp() {
        packTaskMapper = mock(PackTaskMapper.class);
        fileDownloadService = mock(FileDownloadService.class);
        service = new PackService(
                packTaskMapper,
                mock(FileOwnershipGuard.class),
                mock(FileAuditLogger.class),
                mock(FileProperties.class),
                mock(FileStorage.class),
                fileDownloadService);
    }

    private PackTask task(long id, long userId, int status) {
        PackTask task = new PackTask();
        task.setId(id);
        task.setUserId(userId);
        task.setTaskNo("PACK-0001");
        task.setStatus(status);
        task.setProductName("bundle.zip");
        return task;
    }

    @Test
    @DisplayName("TC-H-04 读他人的打包任务：判不存在（4026），不返回任何任务信息")
    void detail_otherUsersTask_isRejectedAsNotFound() {
        when(packTaskMapper.selectById(TASK_OF_OTHER)).thenReturn(task(TASK_OF_OTHER, OTHER, PackTask.STATUS_DONE));

        BusinessException ex = assertThrows(BusinessException.class, () -> service.detail(ME, TASK_OF_OTHER));

        assertEquals(ErrorCode.PACK_TASK_NOT_FOUND.getCode(), ex.getCode());
    }

    @Test
    @DisplayName("TC-H-04 下载他人的打包产物：拒绝，且不读磁盘、不写响应")
    void downloadProduct_otherUsersTask_neverTouchesStorageOrResponse() {
        when(packTaskMapper.selectById(TASK_OF_OTHER)).thenReturn(task(TASK_OF_OTHER, OTHER, PackTask.STATUS_DONE));
        HttpServletResponse response = mock(HttpServletResponse.class);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.downloadProduct(ME, TASK_OF_OTHER, null, response));

        assertEquals(ErrorCode.PACK_TASK_NOT_FOUND.getCode(), ex.getCode());
        // 归属判定必须在「开始吐字节」之前：否则攻击者拿到的不是错误码，而是别人的整包数据
        verifyNoInteractions(fileDownloadService);
        verifyNoInteractions(response);
    }

    @Test
    @DisplayName("TC-H-04 taskId 为 null：直接判不存在，不查库")
    void detail_nullTaskId_isRejectedWithoutQuery() {
        BusinessException ex = assertThrows(BusinessException.class, () -> service.detail(ME, null));

        assertEquals(ErrorCode.PACK_TASK_NOT_FOUND.getCode(), ex.getCode());
        verifyNoInteractions(packTaskMapper);
    }

    @Test
    @DisplayName("本人的任务：正常返回（防「一律拒绝」的假通过）")
    void detail_ownTask_returnsView() {
        when(packTaskMapper.selectById(11L)).thenReturn(task(11L, ME, PackTask.STATUS_DONE));

        PackTaskVO vo = service.detail(ME, 11L);

        assertNotNull(vo);
        assertEquals(11L, vo.getId());
        verify(packTaskMapper).selectById(any(Long.class));
    }
}
