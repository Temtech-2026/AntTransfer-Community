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
package com.anttransfer.file.controller;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.permission.RequiresPerm;
import com.anttransfer.common.ratelimit.RateLimit;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.result.Result;
import com.anttransfer.file.model.dto.BatchNodesRequest;
import com.anttransfer.file.model.dto.CopyRequest;
import com.anttransfer.file.model.dto.InstantUploadRequest;
import com.anttransfer.file.model.dto.MoveRequest;
import com.anttransfer.file.model.dto.NodeQuery;
import com.anttransfer.file.model.dto.RenameRequest;
import com.anttransfer.file.model.vo.DownloadTicketVO;
import com.anttransfer.file.model.vo.FileNodeVO;
import com.anttransfer.file.model.vo.PreviewVO;
import com.anttransfer.file.model.vo.UploadResultVO;
import com.anttransfer.file.security.CurrentUserContext;
import com.anttransfer.file.service.FileContentService;
import com.anttransfer.file.service.FileDownloadService;
import com.anttransfer.file.service.FileDownloadTicketService;
import com.anttransfer.file.service.FileNodeService;
import com.anttransfer.file.service.FilePreviewService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * 文件接口（L1 层：参数绑定 + 权限声明 + 响应包装）。
 *
 * <p>权限口径：查询 / 预览用 {@code file:preview}；下载换票用 {@code file:download}；
 * 上传 / 秒传用 {@code file:upload}；改名 / 移动 / 复制 / 移入回收站 / 还原用 {@code file:edit}；
 * 只有「彻底销毁 / 清空回收站」才要求 {@code file:destroy}——因为它们会真正回收物理文件。</p>
 *
 * <p><b>两个免登录取件端点的权限归属（重要）：</b>{@code /content} 与 {@code /thumbnail}
 * 必须放行匿名请求（浏览器原生下载、{@code <img src>}、下载工具都无法携带 Authorization 头），
 * 因此它们<b>不做</b> {@code @RequiresPerm}，权限判定被前移到换票阶段：
 * {@code /ticket} 在登录态下校验 {@code file:download} 并签发票据，票据载荷携带取件范围；
 * 取件时服务层逐项复核「票据绑定 + 条目归属」。这样即使端点匿名可达，
 * 无票或票不匹配一律 4018，权限点也不会被绕过。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/files")
@RequiredArgsConstructor
public class FileController {

    private static final int HASH_BUFFER_SIZE = 8192;
    private static final int MAX_NAME_LENGTH = 255;
    private static final String DEFAULT_NAME = "未命名文件";

    private final FileNodeService fileNodeService;
    private final FileContentService fileContentService;
    private final FileDownloadTicketService fileDownloadTicketService;
    private final FileDownloadService fileDownloadService;
    private final FilePreviewService filePreviewService;

    /**
     * 换取下载票据（短时、绑定用户与文件）。
     *
     * <p>两步式取件的第一步：本端点<b>在登录态与权限下</b>完成全部判定，
     * 换出的票据是后续免登录取件端点的唯一凭证。</p>
     *
     * @param nodeId 条目 ID
     * @return 票据与取件地址
     */
    @PostMapping("/{nodeId}/ticket")
    @RequiresPerm("file:download")
    @RateLimit(windowSeconds = 60, max = 60, key = "file-ticket", message = "获取下载凭证过于频繁，请稍后再试")
    public Result<DownloadTicketVO> ticket(@PathVariable Long nodeId) {
        return Result.ok(fileDownloadTicketService.issue(CurrentUserContext.currentUserId(), nodeId));
    }

    /**
     * 取件：Range 流式下载（<b>免登录</b>，凭票据鉴权）。
     *
     * <p><b>为什么必须放行匿名：</b>{@code <a href>} 原生下载、播放器与下载工具都无法携带
     * Authorization 头。安全性由票据承担——票据在签发时已完成登录态、{@code file:download}
     * 权限与归属校验，此处再由服务层逐项复核绑定关系与条目归属。</p>
     *
     * <p>支持 {@code Range} 断点续传；{@code speedLimit} 为任务级可选限速（字节/秒，0=不限速），
     * 与全局限速同时生效。{@code disposition=inline} 仅对 PDF / 光栅图生效（防内联 XSS）。</p>
     *
     * @param nodeId      条目 ID
     * @param ticket      下载票据
     * @param speedLimit  任务级速率上限（字节/秒，可空）
     * @param disposition inline / attachment（可空，默认 attachment）
     */
    @GetMapping("/{nodeId}/content")
    @RateLimit(windowSeconds = 60, max = 300, key = "file-content", message = "下载请求过于频繁，请稍后再试")
    public void content(@PathVariable Long nodeId,
                        @RequestParam("ticket") String ticket,
                        @RequestParam(value = "speedLimit", required = false) Long speedLimit,
                        @RequestParam(value = "disposition", required = false) String disposition,
                        HttpServletRequest request,
                        HttpServletResponse response) {
        fileDownloadService.download(nodeId, ticket, speedLimit, disposition,
                request.getHeader(HttpHeaders.RANGE), response);
    }

    /**
     * 图片缩略图（<b>免登录</b>，凭票据鉴权）。
     *
     * <p>{@code <img src>} 同样无法携带 Authorization 头，故走票据。</p>
     *
     * @param nodeId 条目 ID
     * @param ticket 票据（预览票或下载票）
     */
    @GetMapping("/{nodeId}/thumbnail")
    @RateLimit(windowSeconds = 60, max = 300, key = "file-thumbnail", message = "预览请求过于频繁，请稍后再试")
    public void thumbnail(@PathVariable Long nodeId,
                          @RequestParam("ticket") String ticket,
                          HttpServletResponse response) {
        filePreviewService.writeThumbnail(nodeId, ticket, response);
    }

    /**
     * 预览：服务端下发预览策略（文本内联 / PDF / 图片 / 仅下载 / 不支持）。
     *
     * <p>Office 系列一律 {@code download-only}——服务端转码需引入 LibreOffice / POI 全量依赖，CE 不做。</p>
     *
     * @param nodeId 条目 ID
     * @return 预览视图
     */
    @GetMapping("/{nodeId}/preview")
    @RequiresPerm("file:preview")
    public Result<PreviewVO> preview(@PathVariable Long nodeId) {
        return Result.ok(filePreviewService.preview(CurrentUserContext.currentUserId(), nodeId));
    }

    /**
     * 文件分页列表（多条件筛选 + 排序）。
     *
     * @param query 查询条件（folderId / keyword / ext / level / size 区间 / 时间区间 / tagId / sort 等）
     * @return 分页结果
     */
    @GetMapping
    @RequiresPerm("file:preview")
    public Result<PageResult<FileNodeVO>> page(NodeQuery query) {
        return Result.ok(fileNodeService.page(CurrentUserContext.currentUserId(), query));
    }

    /**
     * 回收站分页列表。
     *
     * @param query 查询条件
     * @return 分页结果
     */
    @GetMapping("/recycle")
    @RequiresPerm("file:preview")
    public Result<PageResult<FileNodeVO>> recyclePage(NodeQuery query) {
        return Result.ok(fileNodeService.recyclePage(CurrentUserContext.currentUserId(), query));
    }

    /**
     * 文件详情。
     *
     * @param nodeId 条目 ID
     * @return 条目视图
     */
    @GetMapping("/{nodeId}")
    @RequiresPerm("file:preview")
    public Result<FileNodeVO> detail(@PathVariable Long nodeId) {
        return Result.ok(fileNodeService.detail(CurrentUserContext.currentUserId(), nodeId));
    }

    /**
     * 秒传：命中既有内容时不传输字节，只建引用。
     *
     * @param request 秒传请求
     * @return 上传结果
     */
    @PostMapping("/instant")
    @RequiresPerm("file:upload")
    public Result<UploadResultVO> instant(@Valid @RequestBody InstantUploadRequest request) {
        return Result.ok(fileContentService.instantUpload(CurrentUserContext.currentUserId(), request));
    }

    /**
     * 上传文件（小文件直传；大文件走分片上传主流程）。
     *
     * <p>sha256 由服务端流式计算，不信任客户端上报值——内容寻址存储以哈希为路径，
     * 一旦客户端可以谎报哈希，就会把 A 的字节写进 B 的路径，污染全局去重。</p>
     *
     * @param file     上传文件（multipart）
     * @param folderId 目标目录（可空 = 根）
     * @param level    密级（可空 = 继承目录）
     * @return 上传结果
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequiresPerm("file:upload")
    public Result<UploadResultVO> upload(@RequestPart("file") MultipartFile file,
                                         @RequestParam(value = "folderId", required = false) Long folderId,
                                         @RequestParam(value = "level", required = false) Integer level) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "上传文件不能为空");
        }
        String name = sanitizeFileName(file.getOriginalFilename());
        String sha256 = sha256Hex(file);
        try (InputStream in = file.getInputStream()) {
            return Result.ok(fileContentService.upload(CurrentUserContext.currentUserId(), name, folderId, level,
                    file.getContentType(), sha256, file.getSize(), in));
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL, e);
        }
    }

    /**
     * 重命名文件。
     *
     * @param nodeId  条目 ID
     * @param request 重命名请求
     * @return 更新后的条目
     */
    @PatchMapping("/{nodeId}/rename")
    @RequiresPerm("file:edit")
    public Result<FileNodeVO> rename(@PathVariable Long nodeId, @Valid @RequestBody RenameRequest request) {
        return Result.ok(fileNodeService.rename(CurrentUserContext.currentUserId(), nodeId, request));
    }

    /**
     * 移动文件。
     *
     * @param nodeId  条目 ID
     * @param request 移动请求
     * @return 更新后的条目
     */
    @PatchMapping("/{nodeId}/move")
    @RequiresPerm("file:edit")
    public Result<FileNodeVO> move(@PathVariable Long nodeId, @Valid @RequestBody MoveRequest request) {
        return Result.ok(fileNodeService.move(CurrentUserContext.currentUserId(), nodeId, request));
    }

    /**
     * 复制文件（新增引用，不复制字节）。
     *
     * @param nodeId  条目 ID
     * @param request 复制请求
     * @return 新条目
     */
    @PostMapping("/{nodeId}/copy")
    @RequiresPerm("file:edit")
    public Result<FileNodeVO> copy(@PathVariable Long nodeId, @Valid @RequestBody CopyRequest request) {
        return Result.ok(fileNodeService.copy(CurrentUserContext.currentUserId(), nodeId, request));
    }

    /**
     * 删除文件（移入回收站，可还原）。
     *
     * @param nodeId 条目 ID
     * @return 空响应
     */
    @DeleteMapping("/{nodeId}")
    @RequiresPerm("file:edit")
    public Result<Void> delete(@PathVariable Long nodeId) {
        fileNodeService.moveToRecycle(CurrentUserContext.currentUserId(), nodeId);
        return Result.ok();
    }

    /**
     * 批量删除文件（移入回收站）。
     *
     * @param request 条目 ID 列表
     * @return 实际移入回收站条数
     */
    @PostMapping("/batch/recycle")
    @RequiresPerm("file:edit")
    public Result<Integer> batchRecycle(@Valid @RequestBody BatchNodesRequest request) {
        return Result.ok(fileNodeService.batchMoveToRecycle(CurrentUserContext.currentUserId(), request.getNodeIds()));
    }

    /**
     * 从回收站还原。
     *
     * @param nodeId 条目 ID
     * @return 还原后的条目
     */
    @PostMapping("/{nodeId}/restore")
    @RequiresPerm("file:edit")
    public Result<FileNodeVO> restore(@PathVariable Long nodeId) {
        return Result.ok(fileNodeService.restore(CurrentUserContext.currentUserId(), nodeId));
    }

    /**
     * 彻底销毁（不可逆，引用归零时回收物理文件）。
     *
     * @param nodeId 条目 ID
     * @return 空响应
     */
    @DeleteMapping("/{nodeId}/destroy")
    @RequiresPerm("file:destroy")
    public Result<Void> destroy(@PathVariable Long nodeId) {
        fileNodeService.destroy(CurrentUserContext.currentUserId(), nodeId);
        return Result.ok();
    }

    /**
     * 清空回收站（分批，单次上限见 {@code recycleCleanupBatchSize}）。
     *
     * @return 本次销毁条数
     */
    @PostMapping("/recycle/empty")
    @RequiresPerm("file:destroy")
    public Result<Integer> emptyRecycle() {
        return Result.ok(fileNodeService.emptyRecycle(CurrentUserContext.currentUserId()));
    }

    /** 流式计算 SHA-256（十六进制小写）。 */
    private static String sha256Hex(MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[HASH_BUFFER_SIZE];
            int read;
            while ((read = in.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL, "读取上传文件失败");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("当前 JVM 不支持 SHA-256", e);
        }
    }

    /**
     * 清洗上传文件名：去掉客户端可能携带的路径段与文件系统保留字符，并限制长度。
     * 存储层按内容哈希寻址，文件名仅用于展示与下载回显，故清洗以「不误导、不注入」为准。
     */
    private static String sanitizeFileName(String originalFilename) {
        if (originalFilename == null) {
            return DEFAULT_NAME;
        }
        String cleaned = originalFilename.replace('\\', '/');
        int slash = cleaned.lastIndexOf('/');
        if (slash >= 0) {
            cleaned = cleaned.substring(slash + 1);
        }
        cleaned = cleaned.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (cleaned.isEmpty() || ".".equals(cleaned) || "..".equals(cleaned)) {
            return DEFAULT_NAME;
        }
        return cleaned.length() > MAX_NAME_LENGTH ? cleaned.substring(cleaned.length() - MAX_NAME_LENGTH) : cleaned;
    }
}
