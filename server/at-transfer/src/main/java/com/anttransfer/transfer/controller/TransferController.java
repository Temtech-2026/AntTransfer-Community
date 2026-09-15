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
package com.anttransfer.transfer.controller;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.permission.RequiresPerm;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.Result;
import com.anttransfer.transfer.model.dto.MergeRequest;
import com.anttransfer.transfer.model.dto.PrecheckRequest;
import com.anttransfer.transfer.model.vo.ChunkPartsVO;
import com.anttransfer.transfer.model.vo.MergeResultVO;
import com.anttransfer.transfer.model.vo.PartUploadedVO;
import com.anttransfer.transfer.model.vo.PrecheckResultVO;
import com.anttransfer.transfer.security.CurrentUserContext;
import com.anttransfer.transfer.service.TransferTaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;

/**
 * 分片上传主线（PRD §4.1）：预检 → 续传查询 → 分片上传 → 合并落库 → 取消。
 *
 * <p><b>为什么整条链统一要 {@code file:upload}</b>：五个端点都只是在「把某个文件写进文件域」
 * 这条路上前进了一步，没有任何一个是可以只读的。若把 {@code GET /parts} 降级为登录即可，
 * 就会出现「无上传权的人也能凭票据号枚举他人任务进度」的越权缝隙
 * （服务层用 {@code userId} 兜底，但接口层不该先放进来）。</p>
 *
 * <p><b>为什么 merge / cancel 不复用「详情查询」控制器</b>：它们共享
 * {@code /v1/transfers/{uploadId}} 这段路径，拆成两个 {@code @RestController} 会让
 * 「谁的注解管哪个 HTTP 方法」变得难以一眼看全；上传链路的五个动作写在一个类里更好审。</p>
 *
 * <p><b>两个 B 类流程分支码在 HTTP 层都是 200</b>（{@code code=4001} 秒传未命中、
 * {@code code=4002} 分片缺失）：它们是「主流程的正常岔路」，不是错误，
 * 故用 {@link Result#failWithData} 把分支所需的 data 带出去，而不是抛异常
 * （异常经全局处理器只会回 {@code Result<Void>}，data 会丢）。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/transfers")
@RequiredArgsConstructor
public class TransferController {

    /** 分片字节流字段名，与前端 {@code PART_FILE_FIELD} 对齐 */
    private static final String PART_FILE_FIELD = "chunk";
    /** 分片 SHA-256 字段名，与前端 {@code PART_HASH_FIELD} 对齐 */
    private static final String PART_HASH_FIELD = "hash";

    private final TransferTaskService transferTaskService;

    /**
     * 秒传预检：命中直接建引用；未命中回上传票据（4001）。
     */
    @PostMapping("/precheck")
    @RequiresPerm("file:upload")
    public Result<PrecheckResultVO> precheck(@Valid @RequestBody PrecheckRequest request) {
        PrecheckResultVO vo = transferTaskService.precheck(CurrentUserContext.currentUserId(), request);
        return vo.instant() ? Result.ok(vo)
                : Result.failWithData(ErrorCode.INSTANT_UPLOAD_MISS, vo);
    }

    /**
     * 查询服务端已确认收到的分片索引，用于断点续传。
     */
    @GetMapping("/{uploadId}/parts")
    @RequiresPerm("file:upload")
    public Result<ChunkPartsVO> parts(@PathVariable long uploadId) {
        return Result.ok(transferTaskService.parts(CurrentUserContext.currentUserId(), uploadId));
    }

    /**
     * 上传单个分片。
     *
     * <p>索引以路径为准（路径即资源定位，表单里的 {@code index} 字段是前端冗余上报，忽略），
     * {@code hash} 可空：非空时服务端比对分片 SHA-256，不符以 4003 拒绝并删掉残片。</p>
     */
    @PutMapping(value = "/{uploadId}/parts/{index}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequiresPerm("file:upload")
    public Result<PartUploadedVO> uploadPart(@PathVariable long uploadId,
                                             @PathVariable int index,
                                             @RequestParam(PART_FILE_FIELD) MultipartFile chunk,
                                             @RequestParam(name = PART_HASH_FIELD, required = false) String hash) {
        if (chunk == null || chunk.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING);
        }
        try (InputStream content = chunk.getInputStream()) {
            return Result.ok(transferTaskService.savePart(
                    CurrentUserContext.currentUserId(), uploadId, index, hash, content, chunk.getSize()));
        } catch (IOException e) {
            // 读流失败属传输层故障，按可重试的上传失败回，不泄露底层路径
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL);
        }
    }

    /**
     * 合并分片并落库；缺片时以 4002 携带缺失清单（HTTP 200）。
     */
    @PostMapping("/{uploadId}/merge")
    @RequiresPerm("file:upload")
    public Result<MergeResultVO> merge(@PathVariable long uploadId, @Valid @RequestBody MergeRequest request) {
        MergeResultVO vo = transferTaskService.merge(CurrentUserContext.currentUserId(), uploadId, request);
        return vo.isChunkMissing() ? Result.failWithData(ErrorCode.CHUNK_MISSING, vo)
                : Result.ok(vo);
    }

    /**
     * 取消上传任务并清理暂存分片。
     */
    @DeleteMapping("/{uploadId}")
    @RequiresPerm("file:upload")
    public Result<Void> cancel(@PathVariable long uploadId) {
        transferTaskService.cancel(CurrentUserContext.currentUserId(), uploadId);
        return Result.ok();
    }
}
