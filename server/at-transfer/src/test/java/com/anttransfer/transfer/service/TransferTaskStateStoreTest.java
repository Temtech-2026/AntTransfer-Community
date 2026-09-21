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

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.transfer.MybatisPlusTestSupport;
import com.anttransfer.transfer.model.entity.TransferTask;
import com.anttransfer.transfer.repository.TransferTaskMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;

/**
 * 任务状态记账（行锁内读—改—写）的单元测试。
 *
 * <p>这里焊死的是<b>并发下最容易写错的一条</b>：暂停与分片写入天然并发——
 * 前端 abort 只停掉本地 XHR，已经发到服务端（或已在途中）的分片仍会落库。
 * 若 {@code appendPart} 无条件把状态写回「传输中」，用户刚点的暂停会被静默撤销：
 * 界面上显示「已暂停」，库里却是「传输中」，刷新后任务永远显示进行中。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class TransferTaskStateStoreTest {

    private static final long USER_ID = 7L;

    @Mock
    private TransferTaskMapper transferTaskMapper;

    private TransferTaskStateStore stateStore;

    @BeforeAll
    static void initMybatisPlus() {
        // appendPart 的更新条件走 Lambda 构造器，无 Spring 容器时需先补齐 TableInfo 缓存
        MybatisPlusTestSupport.initTableInfo();
    }

    @BeforeEach
    void setUp() {
        stateStore = new TransferTaskStateStore(transferTaskMapper);
    }

    @Test
    @DisplayName("在途分片落到已暂停任务：只记账，不把状态改回「传输中」")
    void shouldKeepPausedStatusWhenInFlightPartLands() {
        given(transferTaskMapper.selectForUpdate(1015L))
                .willReturn(task(1015L, TransferTask.STATUS_PAUSED, "[0]"));
        given(transferTaskMapper.update(isNull(), any())).willReturn(1);

        TransferTask updated = stateStore.appendPart(1015L, USER_ID, 1, 8L);

        // 分片仍然收录（恢复后不必重传），但用户的显式暂停意图不被改写
        assertThat(updated.getStatus()).isEqualTo(TransferTask.STATUS_PAUSED);
        assertThat(updated.getUploadedIndexes()).isEqualTo("[0,1]");
        assertThat(updated.getTransferredSize()).isEqualTo(8L);
    }

    @Test
    @DisplayName("在途分片落到排队任务：推进为「传输中」")
    void shouldAdvanceToUploadingWhenPartLandsOnQueuedTask() {
        given(transferTaskMapper.selectForUpdate(1016L))
                .willReturn(task(1016L, TransferTask.STATUS_QUEUED, "[]"));
        given(transferTaskMapper.update(isNull(), any())).willReturn(1);

        TransferTask updated = stateStore.appendPart(1016L, USER_ID, 0, 8L);

        assertThat(updated.getStatus()).isEqualTo(TransferTask.STATUS_UPLOADING);
        assertThat(updated.getUploadedIndexes()).isEqualTo("[0]");
    }

    @Test
    @DisplayName("在途分片落到合并中任务：以 4102 拒绝（合并正在读分片，不能改写记账）")
    void shouldRejectPartOnMergingTask() {
        given(transferTaskMapper.selectForUpdate(1017L))
                .willReturn(task(1017L, TransferTask.STATUS_MERGING, "[0,1]"));

        assertThatThrownBy(() -> stateStore.appendPart(1017L, USER_ID, 2, 8L))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.TRANSFER_STATE_ERROR.getCode()));
    }

    @Test
    @DisplayName("在途分片落到已终态任务：以 4102 拒绝（取消后到达的分片是孤儿）")
    void shouldRejectPartOnTerminalTask() {
        given(transferTaskMapper.selectForUpdate(1018L))
                .willReturn(task(1018L, TransferTask.STATUS_CANCELED, "[0]"));

        assertThatThrownBy(() -> stateStore.appendPart(1018L, USER_ID, 1, 8L))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.TRANSFER_STATE_ERROR.getCode()));
    }

    @Test
    @DisplayName("行锁读取：任务不属于当前用户时按「不存在」处理，不泄露他人任务是否存在")
    void shouldHideForeignTaskFromLockOwned() {
        TransferTask foreign = task(1019L, TransferTask.STATUS_UPLOADING, "[0]");
        foreign.setUserId(USER_ID + 1);
        given(transferTaskMapper.selectForUpdate(1019L)).willReturn(foreign);

        assertThatThrownBy(() -> stateStore.lockOwned(1019L, USER_ID))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.TRANSFER_TASK_NOT_FOUND.getCode()));
    }

    private static TransferTask task(long id, int status, String uploadedIndexes) {
        TransferTask task = new TransferTask();
        task.setId(id);
        task.setUserId(USER_ID);
        task.setFileName("报告.pdf");
        task.setParentId(0L);
        task.setSha256("a".repeat(64));
        task.setFileSize(16L);
        task.setChunkSize(8);
        task.setChunkCount(2);
        task.setUploadedIndexes(uploadedIndexes);
        task.setTransferredSize(0L);
        task.setStatus(status);
        return task;
    }
}
