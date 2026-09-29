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
import com.anttransfer.common.spi.scan.VirusScanner;
import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.extension.FileScanPipeline;
import com.anttransfer.file.model.dto.InstantUploadRequest;
import com.anttransfer.file.model.vo.FileVersionVO;
import com.anttransfer.file.model.vo.UploadResultVO;
import com.anttransfer.file.storage.FileStorage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Locale;

/**
 * 文件内容服务：把「字节层」的动作（磁盘探测、落盘）与「元数据层」的事务隔离开。
 *
 * <p><b>为什么单独一层：</b>内容落盘是不可回滚的 IO。它一旦被包进
 * {@link org.springframework.transaction.annotation.Transactional}，就会出现
 * 「事务回滚了、磁盘上却多了个文件」的脏副本；而把大文件的读写拖进事务，
 * 又会长时间占住数据库连接。所以这里的约定是：<b>IO 在本类、事务在
 * {@link FileNodeService}</b>，两者严格分开。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileContentService {

    private final FileStorage fileStorage;
    private final FileNodeService fileNodeService;
    private final FileVersionService fileVersionService;
    private final FileProperties properties;
    private final FileScanPipeline fileScanPipeline;

    /**
     * 秒传：仅做一次磁盘探测（事务外），命中则交由 {@link FileNodeService} 建引用。
     *
     * @param ownerUserId 归属用户 ID
     * @param request     秒传请求
     * @return 上传结果（{@code instant=true}）
     */
    public UploadResultVO instantUpload(Long ownerUserId, InstantUploadRequest request) {
        String sha256 = request.getSha256().toLowerCase(Locale.ROOT);
        // 事务外先做 IO 判定：磁盘上没有字节就一定不是秒传
        if (!fileStorage.contentExists(sha256)) {
            throw new BusinessException(ErrorCode.INSTANT_UPLOAD_MISS);
        }
        return fileNodeService.instantUploadNode(ownerUserId, request, sha256);
    }

    /**
     * 登记一份上传的内容：先按内容哈希落盘（IO，事务外），再进入短事务写元数据。
     *
     * <p>内容寻址写入天然幂等——同一哈希重复落盘会复用既有副本，因此「同内容重传」在字节层
     * 就不会产生第二份文件，这正是秒传与物理去重的共同底座。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param name        展示文件名
     * @param folderId    所属目录 ID（可空 = 根）
     * @param level       密级（可空 = 继承目录）
     * @param contentType MIME 类型
     * @param sha256      内容 SHA-256（由调用方在服务端计算，不信任客户端上报值）
     * @param sizeBytes   字节数
     * @param in          内容流（由调用方负责关闭）
     * @return 上传结果
     */
    public UploadResultVO upload(Long ownerUserId, String name, Long folderId, Integer level,
                                 String contentType, String sha256, long sizeBytes, InputStream in) {
        String normalizedSha = sha256 == null ? null : sha256.trim().toLowerCase(Locale.ROOT);
        if (normalizedSha == null || normalizedSha.isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "缺少内容指纹 sha256");
        }
        if (sizeBytes < 0) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "文件大小不能为负");
        }
        if (sizeBytes > properties.getMaxFileSize()) {
            throw new BusinessException(ErrorCode.FILE_TOO_LARGE);
        }
        String relativePath;
        try {
            relativePath = fileStorage.storeContent(in, normalizedSha);
        } catch (IOException e) {
            log.error("文件落盘失败：sha256={}, sizeBytes={}", normalizedSha, sizeBytes, e);
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL, e);
        }
        // 入库安全闸门：CE 的默认扫描器恒放行且不读盘（与接入前逐字节一致）；EE 命中时在此拒绝登记。
        // 注意此处不删物理内容——内容寻址是共享的，删它会连带破坏引用同一份字节的其他文件
        fileScanPipeline.assertClean(scanContext(normalizedSha, name, sizeBytes, ownerUserId));
        return fileNodeService.registerStoredContent(ownerUserId, name, folderId, level,
                contentType, normalizedSha, sizeBytes, relativePath);
    }

    /**
     * 上传新版本：先落盘（IO，事务外），再交由 {@link FileVersionService} 在短事务里切换版本。
     *
     * <p>与 {@link #upload} 的差别是「不新建条目」：字节换了一份，引用条目仍是同一条，旧内容转为历史版本。
     * 落盘依旧走内容寻址，因此「新版本与旧版本内容相同」不会多占磁盘，也不会凭空多出一个版本。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     * @param contentType MIME 类型
     * @param sha256      内容 SHA-256（由调用方在服务端计算）
     * @param sizeBytes   字节数
     * @param in          内容流（由调用方负责关闭）
     * @param remark      版本备注（可空）
     * @return 新版本视图（版本功能关闭时返回当前版本视图）
     */
    public FileVersionVO uploadNewVersion(Long ownerUserId, Long nodeId, String contentType,
                                          String sha256, long sizeBytes, InputStream in, String remark) {
        String normalizedSha = sha256 == null ? null : sha256.trim().toLowerCase(Locale.ROOT);
        if (normalizedSha == null || normalizedSha.isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "缺少内容指纹 sha256");
        }
        if (sizeBytes < 0) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "文件大小不能为负");
        }
        if (sizeBytes > properties.getMaxFileSize()) {
            throw new BusinessException(ErrorCode.FILE_TOO_LARGE);
        }
        // 落盘不可回滚，务必先把「无权 / 已回收」这类必然失败的情况拦在写字节之前
        fileNodeService.requireVersionTarget(ownerUserId, nodeId);
        String relativePath;
        try {
            relativePath = fileStorage.storeContent(in, normalizedSha);
        } catch (IOException e) {
            log.error("新版本落盘失败：nodeId={}, sha256={}, sizeBytes={}", nodeId, normalizedSha, sizeBytes, e);
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL, e);
        }
        // 版本上传同样过闸门；此路径未加载条目名，扩展名留空（EE 若依赖扩展名可按内容嗅探）
        fileScanPipeline.assertClean(scanContext(normalizedSha, null, sizeBytes, ownerUserId));
        return fileVersionService.createVersion(ownerUserId, nodeId, contentType, normalizedSha,
                sizeBytes, relativePath, remark);
    }

    /**
     * 构造入库扫描上下文。
     *
     * <p>内容访问器是惰性的：CE 的默认扫描器恒放行且不打开流，所以「没有杀毒能力的部署」
     * 不会因为这个接缝多出一次读盘。</p>
     */
    private VirusScanner.VirusScanContext scanContext(String normalizedSha, String name,
                                                     long sizeBytes, Long ownerUserId) {
        return new VirusScanner.VirusScanContext(normalizedSha, name, FileTypePolicy.extOfName(name),
                sizeBytes, ownerUserId, () -> {
            try {
                return fileStorage.contentResource(normalizedSha).getInputStream();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }
}
