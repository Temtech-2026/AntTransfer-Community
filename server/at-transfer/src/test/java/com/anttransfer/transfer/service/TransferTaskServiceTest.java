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
import com.anttransfer.common.file.FileIngestPort;
import com.anttransfer.common.file.FileIngestResult;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.transfer.MybatisPlusTestSupport;
import com.anttransfer.transfer.config.TransferProperties;
import com.anttransfer.transfer.model.dto.MergeRequest;
import com.anttransfer.transfer.model.dto.PrecheckRequest;
import com.anttransfer.transfer.model.entity.TransferTask;
import com.anttransfer.transfer.model.vo.ChunkPartsVO;
import com.anttransfer.transfer.model.vo.MergeResultVO;
import com.anttransfer.transfer.model.vo.PartUploadedVO;
import com.anttransfer.transfer.model.vo.PrecheckResultVO;
import com.anttransfer.transfer.repository.TransferTaskMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 分片上传编排的单元测试。
 *
 * <p>本测试锁定的是「决策」而不是「落盘」：暂存读写、行级 CAS、跨域落库分别由
 * {@link ChunkStore}、{@link TransferTaskStateStore}、{@code FileIngestPort} 负责，
 * 这里只验证 Service 在这些协作者之上做出的取舍是否正确——尤其是三处容易写错的地方：</p>
 * <ol>
 *   <li>两个 B 类流程分支码（4001 未命中 / 4002 缺片）必须是<b>返回值</b>而非异常，
 *       否则 {@code data} 会在全局异常处理器里丢失；</li>
 *   <li>「同内容复用任务」必须把目标目录计入判定，否则同内容传到两个目录只有一个目录拿到文件；</li>
 *   <li>失败路径的清理范围要区分「可重试的 IO 失败」与「不可挽救的整件指纹不符」；</li>
 *   <li>暂停 / 恢复是<b>意图登记</b>而不是服务端闸门：暂停只拒绝「合并中」与终态，
 *       恢复目标态由服务端按已收分片判定，两者都幂等——前端的 pause/resume 上报是
 *       尽力而为的，失败也不该阻断续传。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class TransferTaskServiceTest {

    private static final long USER_ID = 7L;
    private static final String SHA = "a".repeat(64);
    private static final String OTHER_SHA = "c".repeat(64);
    /** 测试里统一用 8 字节作分片，与 {@code TransferProperties} 的 8 MiB 默认值无关 */
    private static final int UNIT = 8;

    @Mock
    private TransferTaskMapper transferTaskMapper;

    @Mock
    private TransferTaskStateStore stateStore;

    @Mock
    private ChunkStore chunkStore;

    @Mock
    private FileIngestPort fileIngestPort;

    private TransferProperties properties;
    private TransferTaskService service;

    @BeforeAll
    static void initMybatisPlus() {
        // 复用同内容任务的查询条件走 Lambda 构造器，需先补齐 TableInfo 缓存（无 Spring 容器）
        MybatisPlusTestSupport.initTableInfo();
    }

    @BeforeEach
    void setUp() {
        properties = new TransferProperties();
        service = new TransferTaskService(transferTaskMapper, stateStore, chunkStore, properties, fileIngestPort);
    }

    // ---------------------------------------------------------------- 预检

    @Test
    @DisplayName("预检命中秒传：直接回引用，不建上传任务（一个字节都不传）")
    void shouldReturnInstantReferenceOnPrecheckHit() {
        given(fileIngestPort.tryInstant(any())).willReturn(Optional.of(new FileIngestResult(100L, 200L, true)));

        PrecheckResultVO vo = service.precheck(USER_ID, new PrecheckRequest("报告.pdf", 10L, SHA, null));

        assertThat(vo.instant()).isTrue();
        // 雪花 ID 必须以字符串过线，否则浏览器解析 JSON number 时末位会被取整
        assertThat(vo.fileId()).isEqualTo("100");
        assertThat(vo.nodeId()).isEqualTo("200");
        assertThat(vo.uploadId()).isNull();
        verify(transferTaskMapper, never()).insert(any(TransferTask.class));
    }

    @Test
    @DisplayName("预检未命中：新建任务，回字符串票据，并把 parentId 透传落库")
    void shouldCreateTaskWhenPrecheckMisses() {
        given(fileIngestPort.tryInstant(any())).willReturn(Optional.empty());
        given(transferTaskMapper.selectList(any())).willReturn(List.of());
        given(transferTaskMapper.selectCount(any())).willReturn(0L);
        willAnswer(invocation -> {
            invocation.<TransferTask>getArgument(0).setId(1001L);
            return 1;
        }).given(transferTaskMapper).insert(any(TransferTask.class));

        PrecheckResultVO vo = service.precheck(USER_ID, new PrecheckRequest("报告.pdf", 10L, SHA, 55L));

        assertThat(vo.instant()).isFalse();
        assertThat(vo.uploadId()).isEqualTo("1001");
        assertThat(vo.chunkSize()).isEqualTo((int) properties.getChunkSize());
        // 10 字节 < 8 MiB → 只有 1 片
        assertThat(vo.chunkCount()).isEqualTo(1);

        ArgumentCaptor<TransferTask> captor = ArgumentCaptor.forClass(TransferTask.class);
        verify(transferTaskMapper).insert(captor.capture());
        assertThat(captor.getValue().getParentId()).isEqualTo(55L);
        assertThat(captor.getValue().getStatus()).isEqualTo(TransferTask.STATUS_QUEUED);
        assertThat(captor.getValue().getUploadedIndexes()).isEqualTo("[]");
    }

    @Test
    @DisplayName("预检复用进行中任务：票据与分片参数都按任务固化值回，不另起一份暂存")
    void shouldReuseInFlightTask() {
        TransferTask existing = task(1002L, TransferTask.STATUS_UPLOADING, 4, 3, 12L, "[0]");
        given(fileIngestPort.tryInstant(any())).willReturn(Optional.empty());
        given(transferTaskMapper.selectList(any())).willReturn(List.of(existing));

        PrecheckResultVO vo = service.precheck(USER_ID, new PrecheckRequest("报告.pdf", 12L, SHA, 0L));

        assertThat(vo.uploadId()).isEqualTo("1002");
        assertThat(vo.chunkSize()).isEqualTo(4);
        assertThat(vo.chunkCount()).isEqualTo(3);
        verify(transferTaskMapper, never()).insert(any(TransferTask.class));
    }

    @Test
    @DisplayName("预检超过并发任务上限：以 4103 拒绝，不新建任务")
    void shouldRejectWhenActiveTaskLimitReached() {
        given(fileIngestPort.tryInstant(any())).willReturn(Optional.empty());
        given(transferTaskMapper.selectList(any())).willReturn(List.of());
        given(transferTaskMapper.selectCount(any())).willReturn((long) properties.getMaxActiveTasks());

        assertThatThrownBy(() -> service.precheck(USER_ID, new PrecheckRequest("报告.pdf", 10L, SHA, null)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.TRANSFER_LIMIT_EXCEEDED.getCode()));
        verify(transferTaskMapper, never()).insert(any(TransferTask.class));
    }

    @Test
    @DisplayName("预检文件超过「单分片上限 × 分片数上限」：以 4006 拒绝，不放大分片硬撑")
    void shouldRejectOversizedFile() {
        long tooLarge = Math.multiplyExact((long) properties.getMaxChunkSize(), properties.getMaxChunkCount()) + 1;
        given(fileIngestPort.tryInstant(any())).willReturn(Optional.empty());
        given(transferTaskMapper.selectList(any())).willReturn(List.of());
        given(transferTaskMapper.selectCount(any())).willReturn(0L);

        assertThatThrownBy(() -> service.precheck(USER_ID, new PrecheckRequest("big.bin", tooLarge, SHA, null)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.FILE_TOO_LARGE.getCode()));
    }

    @Test
    @DisplayName("预检 parentId 为负：参数越界，且在触达秒传端口之前就拒绝")
    void shouldRejectNegativeParentId() {
        assertThatThrownBy(() -> service.precheck(USER_ID, new PrecheckRequest("报告.pdf", 10L, SHA, -1L)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.PARAM_OUT_OF_RANGE.getCode()));
        verify(fileIngestPort, never()).tryInstant(any());
    }

    // ------------------------------------------------------------ 续传查询

    @Test
    @DisplayName("续传查询：已终态任务按「不存在」处理，不泄露他人 / 历史任务的进度")
    void shouldHideTerminalTaskFromPartsQuery() {
        given(transferTaskMapper.selectById(9L)).willReturn(task(9L, TransferTask.STATUS_COMPLETED, UNIT, 1, 8L, "[0]"));

        assertThatThrownBy(() -> service.parts(USER_ID, 9L))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.TRANSFER_TASK_NOT_FOUND.getCode()));
    }

    @Test
    @DisplayName("续传查询：回数据库里已确认的索引集与任务固化的分片参数")
    void shouldReturnReceivedIndexes() {
        given(transferTaskMapper.selectById(1007L))
                .willReturn(task(1007L, TransferTask.STATUS_UPLOADING, UNIT, 3, 24L, "[0,2]"));

        ChunkPartsVO vo = service.parts(USER_ID, 1007L);

        assertThat(vo.received()).containsExactly(0, 2);
        assertThat(vo.chunkSize()).isEqualTo(UNIT);
        assertThat(vo.chunkCount()).isEqualTo(3);
        // 状态必须一并回：否则「已暂停」只写不读，换设备 / 清缓存的客户端无法区分
        // 「用户主动暂停」与「客户端异常退出」
        assertThat(vo.status()).isEqualTo(TransferTask.STATUS_UPLOADING);
    }

    // ------------------------------------------------------------ 分片上传

    @Test
    @DisplayName("上传分片：非末片字节数不符即拒绝，且不落盘（避免用残片污染后续合并）")
    void shouldRejectPartWithUnexpectedSize() {
        given(transferTaskMapper.selectById(1005L))
                .willReturn(task(1005L, TransferTask.STATUS_UPLOADING, UNIT, 2, 16L, "[]"));

        assertThatThrownBy(() -> service.savePart(
                USER_ID, 1005L, 0, null, new ByteArrayInputStream(new byte[5]), 5L))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.PARAM_FORMAT_ERROR.getCode()));
        verify(chunkStore, never()).writeChunk(anyLong(), anyInt(), any(), anyLong());
    }

    @Test
    @DisplayName("上传分片：分片指纹不符即删残片并报 4003，绝不写进索引集")
    void shouldDeletePartWhenHashMismatches() {
        given(transferTaskMapper.selectById(1008L))
                .willReturn(task(1008L, TransferTask.STATUS_UPLOADING, UNIT, 1, 8L, "[]"));
        given(chunkStore.sha256(any())).willReturn(OTHER_SHA);

        assertThatThrownBy(() -> service.savePart(
                USER_ID, 1008L, 0, SHA, new ByteArrayInputStream(new byte[UNIT]), UNIT))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.FILE_INTEGRITY_ERROR.getCode()));
        verify(chunkStore).deleteChunk(1008L, 0);
        verify(stateStore, never()).appendPart(anyLong(), anyLong(), anyInt(), anyLong());
    }

    @Test
    @DisplayName("上传分片：成功回执给出「已确认收到」的索引清单（对齐前端 received: number[]）")
    void shouldReturnReceivedCountAfterPartSaved() {
        given(transferTaskMapper.selectById(1010L))
                .willReturn(task(1010L, TransferTask.STATUS_UPLOADING, UNIT, 2, 16L, "[]"));
        given(stateStore.appendPart(1010L, USER_ID, 0, (long) UNIT))
                .willReturn(task(1010L, TransferTask.STATUS_UPLOADING, UNIT, 2, 16L, "[0]"));

        PartUploadedVO vo = service.savePart(
                USER_ID, 1010L, 0, null, new ByteArrayInputStream(new byte[UNIT]), UNIT);

        // 回的是索引清单而不是计数：前端按 number[] 消费，回计数会让类型与载荷不符
        assertThat(vo.received()).containsExactly(0);
    }

    // ---------------------------------------------------------------- 合并

    @Test
    @DisplayName("合并缺片：回 4002 分支并附 received/missing，而不是抛异常把 data 丢掉")
    void shouldReturnChunkMissingBranchInsteadOfThrowing() {
        given(transferTaskMapper.selectById(1003L))
                .willReturn(task(1003L, TransferTask.STATUS_UPLOADING, UNIT, 3, 24L, "[0,2]"));
        given(chunkStore.hasChunk(1003L, 0)).willReturn(true);
        given(chunkStore.hasChunk(1003L, 2)).willReturn(true);

        MergeResultVO vo = service.merge(USER_ID, 1003L, new MergeRequest(SHA, 3, 24L));

        assertThat(vo.isChunkMissing()).isTrue();
        assertThat(vo.missing()).containsExactly(1);
        assertThat(vo.received()).containsExactly(0, 2);
        assertThat(vo.fileId()).isNull();
        verify(chunkStore, never()).merge(anyLong(), anyInt());
    }

    @Test
    @DisplayName("合并：客户端分片总数与任务固化值不符视为请求过期，以 2005 拒绝")
    void shouldRejectStaleMergeRequest() {
        given(transferTaskMapper.selectById(1012L))
                .willReturn(task(1012L, TransferTask.STATUS_UPLOADING, UNIT, 2, 16L, "[0,1]"));

        assertThatThrownBy(() -> service.merge(USER_ID, 1012L, new MergeRequest(SHA, 3, 16L)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.PARAM_OUT_OF_RANGE.getCode()));
    }

    @Test
    @DisplayName("合并成功：整件指纹一致才落库，回 fileId / nodeId 字符串并清掉暂存")
    void shouldMergeAndIngestOnSuccess(@TempDir Path tempDir) throws IOException {
        Path merged = tempDir.resolve("merged.bin");
        Files.write(merged, new byte[UNIT]);

        given(transferTaskMapper.selectById(1004L))
                .willReturn(task(1004L, TransferTask.STATUS_UPLOADING, UNIT, 1, (long) UNIT, "[0]"));
        given(chunkStore.hasChunk(1004L, 0)).willReturn(true);
        given(stateStore.transition(anyLong(), any(), anyInt(), any(), any(), anyLong())).willReturn(true);
        given(chunkStore.merge(1004L, 1)).willReturn(merged);
        given(chunkStore.sha256(merged)).willReturn(SHA);
        given(fileIngestPort.ingest(any(), any())).willReturn(new FileIngestResult(999L, 1111L, false));

        MergeResultVO vo = service.merge(USER_ID, 1004L, new MergeRequest(SHA, 1, (long) UNIT));

        assertThat(vo.isChunkMissing()).isFalse();
        assertThat(vo.fileId()).isEqualTo("999");
        // 条目 ID 必须一并回传：下游（引用进聊天消息、权限申请、回跳文件域）认的是它
        assertThat(vo.nodeId()).isEqualTo("1111");
        assertThat(vo.sha256()).isEqualTo(SHA);
        verify(chunkStore).deleteTaskDir(1004L);
    }

    @Test
    @DisplayName("合并整件指纹不符：标记失败并清掉暂存（重传整件与补片都不可能救回）")
    void shouldFailAndCleanStagingWhenWholeHashMismatches(@TempDir Path tempDir) throws IOException {
        Path merged = tempDir.resolve("merged.bin");
        Files.write(merged, new byte[UNIT]);

        given(transferTaskMapper.selectById(1006L))
                .willReturn(task(1006L, TransferTask.STATUS_UPLOADING, UNIT, 1, (long) UNIT, "[0]"));
        given(chunkStore.hasChunk(1006L, 0)).willReturn(true);
        given(stateStore.transition(anyLong(), any(), anyInt(), any(), any(), anyLong())).willReturn(true);
        given(chunkStore.merge(1006L, 1)).willReturn(merged);
        // 任务上报 SHA，但服务端重算得到 OTHER_SHA → 整件不一致
        given(chunkStore.sha256(merged)).willReturn(OTHER_SHA);

        assertThatThrownBy(() -> service.merge(USER_ID, 1006L, new MergeRequest(SHA, 1, (long) UNIT)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.FILE_INTEGRITY_ERROR.getCode()));
        verify(chunkStore).deleteTaskDir(1006L);
        verify(stateStore).markFailed(anyLong(), any(), anyLong());
    }

    @Test
    @DisplayName("合并他人的任务：按「不存在」处理，不区分 403/404 以免探测票据号")
    void shouldRejectMergingForeignTask() {
        TransferTask foreign = task(1013L, TransferTask.STATUS_UPLOADING, UNIT, 1, (long) UNIT, "[0]");
        foreign.setUserId(USER_ID + 1);
        given(transferTaskMapper.selectById(1013L)).willReturn(foreign);

        assertThatThrownBy(() -> service.merge(USER_ID, 1013L, new MergeRequest(SHA, 1, (long) UNIT)))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.TRANSFER_TASK_NOT_FOUND.getCode()));
    }

    // ---------------------------------------------------------------- 取消

    @Test
    @DisplayName("取消已终态任务：以 4102 拒绝，避免把「已完成」改写成「已取消」")
    void shouldRejectCancellingTerminalTask() {
        given(transferTaskMapper.selectById(1011L))
                .willReturn(task(1011L, TransferTask.STATUS_COMPLETED, UNIT, 1, (long) UNIT, "[0]"));

        assertThatThrownBy(() -> service.cancel(USER_ID, 1011L))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.TRANSFER_STATE_ERROR.getCode()));
        verify(chunkStore, never()).deleteTaskDir(anyLong());
    }

    @Test
    @DisplayName("取消进行中任务：CAS 抢占成功后清理暂存")
    void shouldCancelAndCleanStaging() {
        given(transferTaskMapper.selectById(1014L))
                .willReturn(task(1014L, TransferTask.STATUS_UPLOADING, UNIT, 2, 16L, "[0]"));
        given(stateStore.transition(anyLong(), any(), anyInt(), any(), any(), anyLong())).willReturn(true);

        service.cancel(USER_ID, 1014L);

        verify(chunkStore).deleteTaskDir(1014L);
    }

    // ------------------------------------------------------------ 暂停 / 恢复

    @Test
    @DisplayName("暂停进行中任务：CAS 只允许从「排队/传输中」迁到「已暂停」，且不动暂存分片")
    void shouldPauseRunningTask() {
        given(transferTaskMapper.selectById(1015L))
                .willReturn(task(1015L, TransferTask.STATUS_UPLOADING, UNIT, 2, 16L, "[0]"));
        given(stateStore.transition(anyLong(), any(), anyInt(), any(), any(), anyLong())).willReturn(true);

        service.pause(USER_ID, 1015L);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<Integer>> from = ArgumentCaptor.forClass(Collection.class);
        verify(stateStore).transition(eq(1015L), from.capture(), eq(TransferTask.STATUS_PAUSED),
                isNull(), isNull(), eq(USER_ID));
        // 可暂停源态被焊死为「排队 / 传输中」：合并是不可中断的长过程，放进来会让
        // 任务卡在「已暂停」而分片已开始被拼件读取
        assertThat(from.getValue()).containsExactlyInAnyOrder(
                TransferTask.STATUS_QUEUED, TransferTask.STATUS_UPLOADING);
        // 暂停保留暂存（暂停是为了续传，删分片是取消的语义）
        verify(chunkStore, never()).deleteTaskDir(anyLong());
    }

    @Test
    @DisplayName("暂停已暂停任务：幂等成功，不重复发 CAS（重试 / 多端同时暂停都不该报错）")
    void shouldPauseIdempotently() {
        given(transferTaskMapper.selectById(1016L))
                .willReturn(task(1016L, TransferTask.STATUS_PAUSED, UNIT, 2, 16L, "[0]"));

        service.pause(USER_ID, 1016L);

        verify(stateStore, never()).transition(anyLong(), any(), anyInt(), any(), any(), anyLong());
    }

    @Test
    @DisplayName("暂停合并中任务：CAS 抢不到源态，以 4102 拒绝")
    void shouldRejectPausingMergingTask() {
        given(transferTaskMapper.selectById(1017L))
                .willReturn(task(1017L, TransferTask.STATUS_MERGING, UNIT, 2, 16L, "[0,1]"));
        given(stateStore.transition(anyLong(), any(), anyInt(), any(), any(), anyLong())).willReturn(false);

        assertThatThrownBy(() -> service.pause(USER_ID, 1017L))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.TRANSFER_STATE_ERROR.getCode()));
    }

    @Test
    @DisplayName("暂停已终态任务：按「不存在」处理，让客户端凭 4101 重走预检")
    void shouldHideTerminalTaskFromPause() {
        given(transferTaskMapper.selectById(1018L))
                .willReturn(task(1018L, TransferTask.STATUS_COMPLETED, UNIT, 1, (long) UNIT, "[0]"));

        assertThatThrownBy(() -> service.pause(USER_ID, 1018L))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.TRANSFER_TASK_NOT_FOUND.getCode()));
        verify(stateStore, never()).transition(anyLong(), any(), anyInt(), any(), any(), anyLong());
    }

    @Test
    @DisplayName("恢复已传过片的暂停任务：回到「传输中」（状态机 1 的语义就是已收到分片）")
    void shouldResumePausedTaskWithReceivedParts() {
        given(transferTaskMapper.selectById(1019L))
                .willReturn(task(1019L, TransferTask.STATUS_PAUSED, UNIT, 2, 16L, "[0]"));
        given(stateStore.transition(anyLong(), any(), anyInt(), any(), any(), anyLong())).willReturn(true);

        service.resume(USER_ID, 1019L);

        // 回到 1 还是 0 由服务端按已收分片判定：让客户端各报一份必然与库漂移
        verify(stateStore).transition(1019L, Set.of(TransferTask.STATUS_PAUSED),
                TransferTask.STATUS_UPLOADING, null, null, USER_ID);
    }

    @Test
    @DisplayName("恢复尚无分片的暂停任务：回到「排队」，不谎报「传输中」")
    void shouldResumePausedTaskBackToQueued() {
        given(transferTaskMapper.selectById(1020L))
                .willReturn(task(1020L, TransferTask.STATUS_PAUSED, UNIT, 2, 16L, "[]"));
        given(stateStore.transition(anyLong(), any(), anyInt(), any(), any(), anyLong())).willReturn(true);

        service.resume(USER_ID, 1020L);

        verify(stateStore).transition(1020L, Set.of(TransferTask.STATUS_PAUSED),
                TransferTask.STATUS_QUEUED, null, null, USER_ID);
    }

    @Test
    @DisplayName("恢复本就在推进中的任务：幂等成功，不重复发 CAS（暂停上报没落地或已被恢复）")
    void shouldResumeIdempotently() {
        given(transferTaskMapper.selectById(1021L))
                .willReturn(task(1021L, TransferTask.STATUS_UPLOADING, UNIT, 2, 16L, "[0]"));

        service.resume(USER_ID, 1021L);

        verify(stateStore, never()).transition(anyLong(), any(), anyInt(), any(), any(), anyLong());
    }

    @Test
    @DisplayName("恢复合并中的任务：暂停源态已不存在，以 4102 拒绝")
    void shouldRejectResumingMergingTask() {
        given(transferTaskMapper.selectById(1022L))
                .willReturn(task(1022L, TransferTask.STATUS_MERGING, UNIT, 2, 16L, "[0,1]"));

        assertThatThrownBy(() -> service.resume(USER_ID, 1022L))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getCode())
                        .isEqualTo(ErrorCode.TRANSFER_STATE_ERROR.getCode()));
    }

    private static TransferTask task(long id, int status, int chunkSize, int chunkCount,
                                     long fileSize, String uploadedIndexes) {
        TransferTask task = new TransferTask();
        task.setId(id);
        task.setUserId(USER_ID);
        task.setFileName("报告.pdf");
        task.setParentId(0L);
        task.setSha256(SHA);
        task.setFileSize(fileSize);
        task.setChunkSize(chunkSize);
        task.setChunkCount(chunkCount);
        task.setUploadedIndexes(uploadedIndexes);
        task.setTransferredSize(0L);
        task.setStatus(status);
        return task;
    }
}
