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
import com.anttransfer.transfer.model.entity.TransferTask;
import com.anttransfer.transfer.repository.TransferTaskMapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Objects;
import java.util.TreeSet;

/**
 * 任务状态迁移的唯一入口：所有写库动作都在<b>短事务</b>里以 CAS 完成。
 *
 * <p>与 {@code ChunkStore} 的分工是刻意的——大文件 IO 一律在事务外完成，
 * 状态记账才进事务：这样锁粒度是「一行一毫秒」，而不是「一行挂整个分片写入过程」。
 * 若把落盘 IO 放进事务，一个 8 MiB 分片就能让行锁与连接被占住数百毫秒，
 * 并发补传会迅速把连接池打满。</p>
 *
 * @author AntTransfer CE
 */
@Service
@RequiredArgsConstructor
public class TransferTaskStateStore {

    private final TransferTaskMapper transferTaskMapper;

    /**
     * 行锁读取并校验归属。
     *
     * @throws BusinessException 任务不存在或不属于该用户（统一 4101，不泄露他人任务是否存在）
     */
    @Transactional
    public TransferTask lockOwned(long uploadId, long userId) {
        TransferTask task = transferTaskMapper.selectForUpdate(uploadId);
        if (task == null || !Objects.equals(task.getUserId(), userId)) {
            throw new BusinessException(ErrorCode.TRANSFER_TASK_NOT_FOUND);
        }
        return task;
    }

    /**
     * 记录一个已收分片（幂等：重复上传同一索引不会重复累加字节）。
     *
     * <p>索引集合的「读—改—写」在行锁内完成，因此并发补传不会互相覆盖。</p>
     *
     * @param bytes 该分片字节数（仅首次收录时计入已传量）
     * @return 迁移后的任务快照
     */
    @Transactional
    public TransferTask appendPart(long uploadId, long userId, int index, long bytes) {
        TransferTask task = lockOwned(uploadId, userId);
        if (Objects.equals(task.getStatus(), TransferTask.STATUS_MERGING)
                || task.isTerminal()) {
            throw new BusinessException(ErrorCode.TRANSFER_STATE_ERROR);
        }
        TreeSet<Integer> received = ChunkIndexes.parse(task.getUploadedIndexes());
        long transferred = task.getTransferredSize() == null ? 0L : task.getTransferredSize();
        if (received.add(index)) {
            transferred += bytes;
        }
        String indexesJson = ChunkIndexes.write(received);
        transferTaskMapper.update(null, new LambdaUpdateWrapper<TransferTask>()
                .eq(TransferTask::getId, uploadId)
                .set(TransferTask::getUploadedIndexes, indexesJson)
                .set(TransferTask::getTransferredSize, transferred)
                .set(TransferTask::getStatus, TransferTask.STATUS_UPLOADING)
                .set(TransferTask::getUpdateBy, userId));
        task.setUploadedIndexes(indexesJson);
        task.setTransferredSize(transferred);
        task.setStatus(TransferTask.STATUS_UPLOADING);
        return task;
    }

    /**
     * CAS 状态迁移：仅当当前状态落在 {@code fromStatuses} 内才成功。
     *
     * @return {@code true}=迁移成功；{@code false}=状态已被并发方推进（调用方应据此返回 4102）
     */
    @Transactional
    public boolean transition(long uploadId,
                              Collection<Integer> fromStatuses,
                              int toStatus,
                              Long fileId,
                              String errorMsg,
                              long operator) {
        return transferTaskMapper.update(null, new LambdaUpdateWrapper<TransferTask>()
                .eq(TransferTask::getId, uploadId)
                .in(TransferTask::getStatus, fromStatuses)
                .set(TransferTask::getStatus, toStatus)
                .set(TransferTask::getErrorMsg, errorMsg)
                .set(fileId != null, TransferTask::getFileId, fileId)
                .set(TransferTask::getUpdateBy, operator)) == 1;
    }

    /** 标记任务失败并写入原因（供合并异常路径回写，不影响主异常上抛）。 */
    @Transactional
    public void markFailed(long uploadId, String errorMsg, long operator) {
        transferTaskMapper.update(null, new LambdaUpdateWrapper<TransferTask>()
                .eq(TransferTask::getId, uploadId)
                .in(TransferTask::getStatus,
                        TransferTask.STATUS_QUEUED,
                        TransferTask.STATUS_UPLOADING,
                        TransferTask.STATUS_PAUSED,
                        TransferTask.STATUS_MERGING)
                .set(TransferTask::getStatus, TransferTask.STATUS_FAILED)
                .set(TransferTask::getErrorMsg, errorMsg)
                .set(TransferTask::getUpdateBy, operator));
    }
}
