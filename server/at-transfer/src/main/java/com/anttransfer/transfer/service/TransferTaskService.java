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
import com.anttransfer.common.file.FileIngestCommand;
import com.anttransfer.common.file.FileIngestPort;
import com.anttransfer.common.file.FileIngestResult;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.transfer.config.TransferProperties;
import com.anttransfer.transfer.model.dto.MergeRequest;
import com.anttransfer.transfer.model.dto.PrecheckRequest;
import com.anttransfer.transfer.model.entity.TransferTask;
import com.anttransfer.transfer.model.vo.ChunkPartsVO;
import com.anttransfer.transfer.model.vo.MergeResultVO;
import com.anttransfer.transfer.model.vo.PartUploadedVO;
import com.anttransfer.transfer.model.vo.PrecheckResultVO;
import com.anttransfer.transfer.repository.TransferTaskMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

/**
 * 分片上传编排：预检（秒传 / 建任务）→ 分片续传 → 合并落库 → 取消。
 *
 * <p><b>字节与元数据的分工</b>：本服务负责「把分片拼成整件」，
 * 整件内容的落库（内容寻址、引用计数、密级、上传审计）通过
 * {@link FileIngestPort} 交给 at-file——两处都写会让文件域规则出现第二份实现。</p>
 *
 * <p><b>为什么合并前要先 CAS 到「合并中」</b>：合并是「读全部分片 → 写整件」的长过程。
 * 若不先抢占，两个并发 merge 会各自拼一遍并各自落库，产生重复文件与重复引用；
 * 抢占后失败方拿 0 行更新，直接以 4102 拒绝。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TransferTaskService {

    private static final Pattern SHA256_PATTERN = Pattern.compile("^[0-9a-f]{64}$");
    private static final DateTimeFormatter TASK_NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final long MEBIBYTE = 1024L * 1024L;

    /** 可继续写分片的状态 */
    private static final Set<Integer> WRITABLE_STATUSES =
            Set.of(TransferTask.STATUS_QUEUED, TransferTask.STATUS_UPLOADING, TransferTask.STATUS_PAUSED);
    /** 进行中（占用暂存盘）的状态，用于复用判定与并发上限判定 */
    private static final Set<Integer> ACTIVE_STATUSES =
            Set.of(TransferTask.STATUS_QUEUED, TransferTask.STATUS_UPLOADING,
                    TransferTask.STATUS_PAUSED, TransferTask.STATUS_MERGING);
    /** 可抢占合并的状态 */
    private static final Set<Integer> MERGEABLE_STATUSES = WRITABLE_STATUSES;
    /** 可通过 DELETE 主动取消的状态 */
    private static final Set<Integer> CANCELABLE_STATUSES =
            Set.of(TransferTask.STATUS_QUEUED, TransferTask.STATUS_UPLOADING,
                    TransferTask.STATUS_PAUSED, TransferTask.STATUS_MERGING);

    private final TransferTaskMapper transferTaskMapper;
    private final TransferTaskStateStore stateStore;
    private final ChunkStore chunkStore;
    private final TransferProperties properties;
    private final FileIngestPort fileIngestPort;

    /* ============================ 预检 ============================ */

    /**
     * 秒传预检：命中直接建引用；未命中返回上传票据并建（或复用）任务。
     */
    public PrecheckResultVO precheck(long userId, PrecheckRequest request) {
        String fileName = normalizeFileName(request.fileName());
        String sha256 = normalizeSha256(request.sha256());
        long sizeBytes = request.sizeBytes();
        long parentId = normalizeParentId(request.parentId());

        // 1) 秒传：内容已在服务端 → 只建引用，不产生任何传输任务
        Optional<FileIngestResult> instant = fileIngestPort.tryInstant(
                new FileIngestCommand(userId, fileName, parentId, null, null, sha256, sizeBytes));
        if (instant.isPresent()) {
            FileIngestResult result = instant.get();
            return PrecheckResultVO.instant(result.fileId(), result.nodeId());
        }

        // 2) 复用同内容的进行中任务：断点续传 / 用户重试都不该另起一份暂存
        TransferTask reusable = findReusable(userId, sha256, sizeBytes, parentId);
        if (reusable != null) {
            chunkStore.ensureTaskDir(reusable.getId());
            return PrecheckResultVO.missing(reusable.getId(), reusable.getChunkSize(), reusable.getChunkCount());
        }

        // 3) 并发护栏：单用户进行中任务过多会无界占用暂存盘
        if (transferTaskMapper.selectCount(new LambdaQueryWrapper<TransferTask>()
                .eq(TransferTask::getUserId, userId)
                .in(TransferTask::getStatus, ACTIVE_STATUSES)) >= properties.getMaxActiveTasks()) {
            throw new BusinessException(ErrorCode.TRANSFER_LIMIT_EXCEEDED);
        }

        // 4) 建新任务
        int chunkSize = resolveChunkSize(sizeBytes);
        int chunkCount = (int) ((sizeBytes + chunkSize - 1) / chunkSize);
        TransferTask task = createTask(userId, fileName, sha256, sizeBytes, parentId, chunkSize, chunkCount);
        chunkStore.ensureTaskDir(task.getId());
        return PrecheckResultVO.missing(task.getId(), chunkSize, chunkCount);
    }

    /* ============================ 分片续传 ============================ */

    /** 查询服务端已确认收到的分片索引（断点续传判据）。 */
    public ChunkPartsVO parts(long userId, long uploadId) {
        TransferTask task = requireAlive(userId, uploadId);
        return new ChunkPartsVO(List.copyOf(ChunkIndexes.parse(task.getUploadedIndexes())),
                task.getChunkSize(), task.getChunkCount());
    }

    /**
     * 接收单个分片：先落盘（事务外）→ 校验 → 再记账（短事务）。
     *
     * @param hash 客户端上报的分片 SHA-256，可空；非空时服务端比对，不符以 4003 拒绝并删除残片
     */
    public PartUploadedVO savePart(long userId, long uploadId, int index, String hash,
                                   InputStream content, long size) {
        TransferTask task = requireOwned(userId, uploadId);
        if (!WRITABLE_STATUSES.contains(task.getStatus())) {
            // 终态任务视为「不存在」让前端重走预检；合并中的任务明确拒绝
            throw new BusinessException(task.isTerminal()
                    ? ErrorCode.TRANSFER_TASK_NOT_FOUND : ErrorCode.TRANSFER_STATE_ERROR);
        }
        if (index < 0 || index >= task.getChunkCount()) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE);
        }
        if (size != expectedChunkSize(task, index)) {
            throw new BusinessException(ErrorCode.PARAM_FORMAT_ERROR);
        }

        chunkStore.ensureTaskDir(uploadId);
        chunkStore.writeChunk(uploadId, index, content, size);

        String expectedHash = (hash == null || hash.isBlank()) ? null : normalizeSha256(hash);
        if (expectedHash != null && !expectedHash.equals(chunkStore.sha256(chunkStore.chunkPath(uploadId, index)))) {
            chunkStore.deleteChunk(uploadId, index);
            throw new BusinessException(ErrorCode.FILE_INTEGRITY_ERROR);
        }

        TransferTask updated = stateStore.appendPart(uploadId, userId, index, size);
        // 回索引清单而非计数：与前端 PartUploadedResult.received: number[] 对齐
        return new PartUploadedVO(List.copyOf(ChunkIndexes.parse(updated.getUploadedIndexes())));
    }

    /* ============================ 合并落库 ============================ */

    /**
     * 合并分片并落库。
     *
     * <p>顺序不能变：先确认分片齐全 → CAS 抢占合并权 → 拼件与校验（事务外 IO）
     * → 落库 → 终态记账 → 清理暂存。任一环节失败都要回写失败态，
     * 但只有「完整性失败」才清理暂存（其余保留以便续传 / 重试）。</p>
     */
    public MergeResultVO merge(long userId, long uploadId, MergeRequest request) {
        TransferTask task = requireOwned(userId, uploadId);
        if (!MERGEABLE_STATUSES.contains(task.getStatus())) {
            throw new BusinessException(task.isTerminal()
                    ? ErrorCode.TRANSFER_TASK_NOT_FOUND : ErrorCode.TRANSFER_STATE_ERROR);
        }
        if (!Objects.equals(request.chunkCount(), task.getChunkCount())
                || !Objects.equals(request.sizeBytes(), task.getFileSize())) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE);
        }

        List<Integer> missing = findMissingChunks(task);
        if (!missing.isEmpty()) {
            // 4002 是 B 类流程分支码（HTTP 200），不是异常：以返回值携带缺失清单，交由控制器转成 data
            log.warn("合并中止：任务 {} 缺少分片 {}", uploadId, missing);
            return MergeResultVO.chunkMissing(
                    List.copyOf(ChunkIndexes.parse(task.getUploadedIndexes())), missing);
        }

        if (!stateStore.transition(uploadId, MERGEABLE_STATUSES, TransferTask.STATUS_MERGING, null, null, userId)) {
            throw new BusinessException(ErrorCode.TRANSFER_STATE_ERROR);
        }

        String reportedSha = normalizeSha256(request.sha256());
        Path merged;
        try {
            merged = chunkStore.merge(uploadId, task.getChunkCount());
            long actualSize = Files.size(merged);
            String actualSha = chunkStore.sha256(merged);
            if (actualSize != task.getFileSize()
                    || !actualSha.equals(reportedSha)
                    || !actualSha.equals(task.getSha256())) {
                throw new BusinessException(ErrorCode.FILE_INTEGRITY_ERROR);
            }

            FileIngestResult result;
            try (InputStream in = Files.newInputStream(merged)) {
                result = fileIngestPort.ingest(new FileIngestCommand(userId, task.getFileName(),
                        task.getParentId(), null, null, actualSha, task.getFileSize()), in);
            }
            boolean completed = stateStore.transition(uploadId, Set.of(TransferTask.STATUS_MERGING),
                    TransferTask.STATUS_COMPLETED, result.fileId(), null, userId);
            if (!completed) {
                // 合并期间被 DELETE 抢先取消：内容已落库，任务状态停在「已取消」，
                // 不回滚内容（回滚要删 at-file 的引用计数，属于另一个事务边界），只留痕。
                log.warn("任务 {} 在合并期间被并发取消，内容已落库（fileId={}）但任务状态未落为完成",
                        uploadId, result.fileId());
            }
            chunkStore.deleteTaskDir(uploadId);
            return MergeResultVO.merged(result.fileId(), actualSha);
        } catch (BusinessException e) {
            stateStore.markFailed(uploadId, e.getErrorCode().getMessage(), userId);
            if (e.getErrorCode() == ErrorCode.FILE_INTEGRITY_ERROR) {
                // 完整性失败不可续传：残件留着只会污染下一次合并
                chunkStore.deleteTaskDir(uploadId);
            }
            throw e;
        } catch (IOException e) {
            log.error("合并任务 {} 落盘或读取失败", uploadId, e);
            stateStore.markFailed(uploadId, ErrorCode.FILE_UPLOAD_FAIL.getMessage(), userId);
            // 暂存保留：IO 类失败允许用户重试合并
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL);
        }
    }

    /** 取消任务并清理暂存。已终态任务不可取消。 */
    public void cancel(long userId, long uploadId) {
        TransferTask task = requireOwned(userId, uploadId);
        if (task.isTerminal()) {
            throw new BusinessException(ErrorCode.TRANSFER_STATE_ERROR);
        }
        boolean canceled = stateStore.transition(uploadId,
                CANCELABLE_STATUSES, TransferTask.STATUS_CANCELED, null, null, userId);
        if (!canceled) {
            // 状态已被并发方推进（如合并刚好落为已完成）：不能再删暂存目录，
            // 否则会把手握「合并中」的那一方正在读的分片删掉
            throw new BusinessException(ErrorCode.TRANSFER_STATE_ERROR);
        }
        chunkStore.deleteTaskDir(uploadId);
    }

    /* ============================ 内部方法 ============================ */

    private List<Integer> findMissingChunks(TransferTask task) {
        TreeSet<Integer> received = ChunkIndexes.parse(task.getUploadedIndexes());
        List<Integer> missing = new ArrayList<>();
        for (int index = 0; index < task.getChunkCount(); index++) {
            if (!received.contains(index) || !chunkStore.hasChunk(task.getId(), index)) {
                missing.add(index);
            }
        }
        return missing;
    }

    private TransferTask createTask(long userId, String fileName, String sha256, long sizeBytes,
                                    long parentId, int chunkSize, int chunkCount) {
        for (int attempt = 0; attempt < 3; attempt++) {
            TransferTask task = new TransferTask();
            task.setTaskNo(nextTaskNo());
            task.setUserId(userId);
            task.setFileName(fileName);
            task.setParentId(parentId);
            task.setSha256(sha256);
            task.setFileSize(sizeBytes);
            task.setChunkSize(chunkSize);
            task.setChunkCount(chunkCount);
            task.setUploadedIndexes(ChunkIndexes.write(List.of()));
            task.setTransferredSize(0L);
            task.setStatus(TransferTask.STATUS_QUEUED);
            task.setCreateBy(userId);
            task.setUpdateBy(userId);
            try {
                transferTaskMapper.insert(task);
                return task;
            } catch (DuplicateKeyException e) {
                // 任务单号撞号（概率极低）：清掉已生成的雪花 ID 换号重试
                log.warn("任务单号撞号，重试第 {} 次", attempt + 1);
                task.setId(null);
            }
        }
        throw new BusinessException(ErrorCode.SYSTEM_ERROR);
    }

    private TransferTask findReusable(long userId, String sha256, long sizeBytes, long parentId) {
        List<TransferTask> tasks = transferTaskMapper.selectList(new LambdaQueryWrapper<TransferTask>()
                .eq(TransferTask::getUserId, userId)
                .eq(TransferTask::getSha256, sha256)
                .eq(TransferTask::getFileSize, sizeBytes)
                .eq(TransferTask::getParentId, parentId)
                .in(TransferTask::getStatus, ACTIVE_STATUSES)
                .orderByDesc(TransferTask::getId)
                .last("limit 1"));
        return tasks.isEmpty() ? null : tasks.get(0);
    }

    private TransferTask requireOwned(long userId, long uploadId) {
        TransferTask task = transferTaskMapper.selectById(uploadId);
        if (task == null || !Objects.equals(task.getUserId(), userId)) {
            throw new BusinessException(ErrorCode.TRANSFER_TASK_NOT_FOUND);
        }
        return task;
    }

    private TransferTask requireAlive(long userId, long uploadId) {
        TransferTask task = requireOwned(userId, uploadId);
        if (!ACTIVE_STATUSES.contains(task.getStatus())) {
            throw new BusinessException(ErrorCode.TRANSFER_TASK_NOT_FOUND);
        }
        return task;
    }

    /** 期望的分片字节数：末片为余数，其余等长。 */
    private long expectedChunkSize(TransferTask task, int index) {
        if (index < task.getChunkCount() - 1) {
            return task.getChunkSize();
        }
        return task.getFileSize() - (long) task.getChunkSize() * (task.getChunkCount() - 1);
    }

    /**
     * 解析实际分片大小：常规文件用配置值；文件过大时放大分片，
     * 以守住 {@code uploaded_indexes} 的 {@code varchar(8192)} 上限；
     * 若连放大的分片都超上限，说明超出「单文件可传」范围，以 4006 拒绝。
     */
    private int resolveChunkSize(long sizeBytes) {
        long maxChunkSize = Math.max(properties.getMaxChunkSize(), MEBIBYTE);
        int maxChunkCount = Math.max(properties.getMaxChunkCount(), 1);
        if (sizeBytes > maxChunkSize * maxChunkCount) {
            throw new BusinessException(ErrorCode.FILE_TOO_LARGE);
        }
        long chunkSize = properties.getChunkSize();
        if (chunkSize <= 0 || chunkSize > maxChunkSize) {
            chunkSize = maxChunkSize;
        }
        if ((sizeBytes + chunkSize - 1) / chunkSize > maxChunkCount) {
            long needed = (sizeBytes + maxChunkCount - 1) / maxChunkCount;
            chunkSize = Math.max(chunkSize, Math.min(maxChunkSize, alignUp(needed, MEBIBYTE)));
        }
        return (int) Math.min(chunkSize, Integer.MAX_VALUE);
    }

    private static long alignUp(long value, long unit) {
        return ((value + unit - 1) / unit) * unit;
    }

    private static String nextTaskNo() {
        return "AT" + TASK_NO_FORMAT.format(LocalDateTime.now())
                + String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));
    }

    private static String normalizeFileName(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING);
        }
        String name = raw.trim();
        if (name.isEmpty() || name.length() > 255
                || name.indexOf('/') >= 0 || name.indexOf('\\') >= 0
                || name.chars().anyMatch(c -> c < 0x20 || c == 0x7F)) {
            throw new BusinessException(ErrorCode.PARAM_FORMAT_ERROR);
        }
        return name;
    }

    private static String normalizeSha256(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING);
        }
        String sha = raw.trim().toLowerCase(Locale.ROOT);
        if (!SHA256_PATTERN.matcher(sha).matches()) {
            throw new BusinessException(ErrorCode.PARAM_FORMAT_ERROR);
        }
        return sha;
    }

    /** 目标目录归一：缺省视为根目录（0），负数直接拒绝。 */
    private static long normalizeParentId(Long raw) {
        long parentId = raw == null ? 0L : raw;
        if (parentId < 0) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE);
        }
        return parentId;
    }
}
