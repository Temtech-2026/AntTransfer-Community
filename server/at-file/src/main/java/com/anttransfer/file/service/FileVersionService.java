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
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.file.model.entity.FileObject;
import com.anttransfer.file.model.entity.FileVersion;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.file.model.vo.FileVersionVO;
import com.anttransfer.file.repository.FileNodeMapper;
import com.anttransfer.file.repository.FileObjectMapper;
import com.anttransfer.file.repository.FileVersionMapper;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.anttransfer.file.storage.FileStorage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 历史版本服务（P1）：近 N 版列表、新版本落版本、回滚、超限裁剪。
 *
 * <h3>版本与引用计数的闭环（本域最容易出事的点）</h3>
 * <p>历史版本行<b>刻意不计入</b> {@code sys_file.ref_count}——计数只表达「有多少条存活条目引用这份字节」。
 * 但版本行确实还指向老内容，于是「引用计数归零」就不再等于「内容可回收」。因此：</p>
 * <ul>
 *     <li>切换版本时，老内容的引用计数递减后，必须走
 *         {@link FileNodeService#registerPurgeIfOrphaned}，由它再多看一道
 *         {@code sys_file_version} 存活数，避免「刚切完版本，字节就被回收」；</li>
 *     <li>裁剪版本时，被裁掉的版本行逻辑删除后同样要复核，否则会出现
 *         「版本列表已看不到某一版，字节却一直留在磁盘上」的静默泄漏。</li>
 * </ul>
 *
 * <h3>回滚为什么产生新版本</h3>
 * <p>回滚不是「把指针拨回去」，而是把目标版本的 {@code fileId} 复制成一条更高的 {@code versionNo}。
 * 这样「谁在什么时候回滚到了哪一版」永久可查，也不存在「回滚把历史抹掉」的可能。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileVersionService {

    /** 新建条目的初始版本号（与 {@code FileNodeService} 的口径一致）。 */
    private static final int INITIAL_VERSION_NO = 1;

    /**
     * 裁剪时单次扫描的版本行上限。
     *
     * <p>保留数默认只有 10，正常远用不到这个上限；设上限是为了防「历史数据把某条目灌进几万条版本」
     * 时一次性捞出全表。超出部分会在后续上传 / 回滚时被继续裁掉。</p>
     */
    private static final int PRUNE_SCAN_LIMIT = 1000;

    private final FileVersionMapper fileVersionMapper;
    private final FileNodeMapper fileNodeMapper;
    private final FileObjectMapper fileObjectMapper;
    private final FileNodeService fileNodeService;
    private final FileOwnershipGuard ownershipGuard;
    private final FileAuditLogger auditLogger;
    private final FileProperties properties;
    private final FileStorage fileStorage;

    /**
     * 近 N 版列表（新→旧，含当前版本标记）。
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     * @return 版本列表；版本功能关闭时返回空列表
     */
    @Transactional(readOnly = true)
    public List<FileVersionVO> list(Long ownerUserId, Long nodeId) {
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        if (!properties.isVersionEnabled()) {
            // 关闭后「不记录新版本、列表返回空」，已有版本数据保持不动（重新打开即可见）
            return List.of();
        }
        return fileVersionMapper.findByNodeId(nodeId, Math.max(properties.getVersionKeepCount(), 1))
                .stream()
                .map(version -> FileVersionVO.of(version, node.getVersionNo()))
                .toList();
    }

    /**
     * 把条目当前内容切换为一份新内容，并落一条新版本记录。
     *
     * <p><b>不改变条目名：</b>版本切换只换内容，文件名属「重命名」职责。版本行会快照当时的名字，
     * 因此重命名历史仍在版本列表里可查，不必靠「上传新版本时顺手改名」来承载。</p>
     *
     * @param ownerUserId  归属用户 ID
     * @param nodeId       条目 ID
     * @param contentType  MIME 类型
     * @param sha256       新内容 SHA-256（小写）
     * @param sizeBytes    新内容字节数
     * @param relativePath 新内容的存储相对路径（仅新建物理行时使用）
     * @param remark       版本备注（可空）
     * @return 新版本视图
     */
    @Transactional(rollbackFor = Exception.class)
    public FileVersionVO createVersion(Long ownerUserId, Long nodeId, String contentType,
                                       String sha256, long sizeBytes, String relativePath, String remark) {
        FileNode node = fileNodeService.requireVersionTarget(ownerUserId, nodeId);
        if (Objects.equals(node.getSha256(), sha256) && Objects.equals(node.getSizeBytes(), sizeBytes)) {
            // 内容一字未变：不制造一个「和上一版完全相同」的版本，直接用当前视图应答
            return currentVersionView(node);
        }
        boolean enabled = properties.isVersionEnabled();
        int currentNo = nodeVersionNo(node);
        if (enabled) {
            // 先给「切换前的当前版本」补一条快照：否则首次上传新版本后，旧内容会从版本列表里凭空消失
            recordVersionIfAbsent(node, currentNo, "上传新版本前的快照", ownerUserId);
        }

        FileObject file = fileNodeService.acquireContentReference(
                ownerUserId, node.getName(), contentType, sha256, sizeBytes, relativePath);
        int newNo = currentNo + 1;
        Long oldFileId = node.getFileId();
        String oldSha = node.getSha256();

        node.setFileId(file.getId());
        node.setContentType(contentType);
        node.setSizeBytes(sizeBytes);
        node.setSha256(sha256);
        node.setVersionNo(newNo);
        updateNodeContent(ownerUserId, node);

        if (enabled) {
            recordVersion(node, newNo, remark, ownerUserId);
        }
        releaseOldContent(ownerUserId, nodeId, oldFileId, oldSha, file.getId());
        if (enabled) {
            prune(nodeId, ownerUserId);
        }

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("versionNo", newNo);
        extra.put("sha256", sha256);
        extra.put("sizeBytes", sizeBytes);
        auditLogger.success(OperationLog.ACTION_VERSION_CREATE, OperationLog.TARGET_FILE, nodeId, extra);
        return enabled ? latestVersionView(node, newNo) : currentVersionView(node);
    }

    /**
     * 回滚到指定历史版本（生成一个内容等于旧版本的新版本）。
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     * @param versionNo   目标版本号
     * @return 回滚后产生的新版本视图
     */
    @Transactional(rollbackFor = Exception.class)
    public FileVersionVO rollback(Long ownerUserId, Long nodeId, Integer versionNo) {
        FileNode node = fileNodeService.requireVersionTarget(ownerUserId, nodeId);
        if (!properties.isVersionEnabled()) {
            // 关闭版本功能时列表恒为空，「回滚到某版」无从谈起
            throw new BusinessException(ErrorCode.FILE_VERSION_NOT_FOUND);
        }
        if (versionNo == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "版本号不能为空");
        }
        FileVersion target = fileVersionMapper.findByNodeAndVersion(nodeId, versionNo);
        if (target == null) {
            throw new BusinessException(ErrorCode.FILE_VERSION_NOT_FOUND);
        }
        int currentNo = nodeVersionNo(node);
        if (currentNo == versionNo) {
            // 已经是当前版本：幂等返回，不制造一个与当前内容相同的「新版本」
            return latestVersionView(node, currentNo);
        }
        if (target.getFileId() == null || target.getSha256() == null
                || fileObjectMapper.selectRefCount(target.getFileId()) == null
                || !fileStorage.contentExists(target.getSha256())) {
            // 目标版本的内容已不在：宁可明确 4023，也不把一个取不到字节的版本设成当前
            throw new BusinessException(ErrorCode.FILE_VERSION_NOT_FOUND);
        }

        // 回滚前先把当前内容固化成一条版本行，否则「回滚掉的这一版」会从历史里消失
        recordVersionIfAbsent(node, currentNo, "回滚前的当前版本", ownerUserId);

        Long oldFileId = node.getFileId();
        String oldSha = node.getSha256();
        fileObjectMapper.increaseRefCount(target.getFileId());

        int newNo = Math.max(currentNo, fileVersionMapper.selectMaxVersionNo(nodeId)) + 1;
        node.setFileId(target.getFileId());
        node.setSizeBytes(target.getSizeBytes());
        node.setSha256(target.getSha256());
        node.setVersionNo(newNo);
        updateNodeContent(ownerUserId, node);
        recordVersion(node, newNo, "回滚到 v" + versionNo, ownerUserId);

        releaseOldContent(ownerUserId, nodeId, oldFileId, oldSha, target.getFileId());
        prune(nodeId, ownerUserId);

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("versionNo", newNo);
        extra.put("targetVersionNo", versionNo);
        auditLogger.success(OperationLog.ACTION_VERSION_ROLLBACK, OperationLog.TARGET_FILE, nodeId, extra);
        return latestVersionView(node, newNo);
    }

    /* ============================ 内部实现 ============================ */

    /**
     * 裁剪超出保留数的版本：逻辑删除版本行，并复核其内容是否已成为孤儿。
     *
     * <p>先删版本行再复核是关键——{@code registerPurgeIfOrphaned} 看的是「存活版本数」，
     * 若顺序反过来，当前这一版会被自己算进引用里，裁剪永远回收不了任何字节。</p>
     */
    private void prune(Long nodeId, Long operator) {
        int keep = Math.max(properties.getVersionKeepCount(), 1);
        List<FileVersion> versions = fileVersionMapper.findByNodeId(nodeId, PRUNE_SCAN_LIMIT);
        if (versions.size() <= keep) {
            return;
        }
        for (FileVersion stale : versions.subList(keep, versions.size())) {
            if (fileVersionMapper.deleteLogically(stale.getId()) == 0) {
                continue;
            }
            fileNodeService.registerPurgeIfOrphaned(stale.getFileId(), stale.getSha256());
            Map<String, Object> extra = new LinkedHashMap<>();
            extra.put("versionNo", stale.getVersionNo());
            extra.put("keepCount", keep);
            auditLogger.success(OperationLog.ACTION_VERSION_PRUNE, OperationLog.TARGET_FILE, nodeId, extra);
        }
    }

    /**
     * 释放被替换掉的老内容引用。
     *
     * <p>若新旧 {@code fileId} 相同（内容寻址去重命中同一份字节），跳过递减：
     * 同一个引用在切换前后其实是同一条，减一再加一等于什么都没做，
     * 但把计数先减到 0 就可能触发一轮无谓的物理回收判定。</p>
     */
    private void releaseOldContent(Long ownerUserId, Long nodeId, Long oldFileId, String oldSha, Long newFileId) {
        if (oldFileId == null || Objects.equals(oldFileId, newFileId)) {
            return;
        }
        if (fileObjectMapper.decreaseRefCount(oldFileId) == 0) {
            log.warn("老版本引用计数已为 0，跳过递减：nodeId={}, fileId={}", nodeId, oldFileId);
        }
        // 老内容可能仍被其他条目 / 其他版本引用，是否回收统一交给三道闸判定
        fileNodeService.registerPurgeIfOrphaned(oldFileId, oldSha);
    }

    private void updateNodeContent(Long ownerUserId, FileNode node) {
        fileNodeMapper.update(null, Wrappers.<FileNode>lambdaUpdate()
                .eq(FileNode::getId, node.getId())
                .eq(FileNode::getOwnerUserId, ownerUserId)
                .set(FileNode::getFileId, node.getFileId())
                .set(FileNode::getContentType, node.getContentType())
                .set(FileNode::getSizeBytes, node.getSizeBytes())
                .set(FileNode::getSha256, node.getSha256())
                .set(FileNode::getVersionNo, node.getVersionNo())
                .set(FileNode::getUpdateBy, ownerUserId));
    }

    private void recordVersionIfAbsent(FileNode node, int versionNo, String remark, Long operator) {
        if (fileVersionMapper.findByNodeAndVersion(node.getId(), versionNo) != null) {
            return;
        }
        recordVersion(node, versionNo, remark, operator);
    }

    private void recordVersion(FileNode node, int versionNo, String remark, Long operator) {
        FileVersion version = new FileVersion();
        version.setNodeId(node.getId());
        version.setFileId(node.getFileId());
        version.setVersionNo(versionNo);
        version.setName(node.getName());
        version.setSizeBytes(node.getSizeBytes());
        version.setSha256(node.getSha256());
        version.setRemark(remark);
        version.setUploadUserId(operator);
        version.setCreateBy(operator);
        version.setUpdateBy(operator);
        fileVersionMapper.insert(version);
    }

    private FileVersionVO latestVersionView(FileNode node, int versionNo) {
        FileVersion version = fileVersionMapper.findByNodeAndVersion(node.getId(), versionNo);
        return version == null ? currentVersionView(node) : FileVersionVO.of(version, node.getVersionNo());
    }

    /**
     * 用条目当前状态合成一条「当前版本」视图：版本功能关闭时列表里仍应看到文件当下的样子，
     * 而不是一个空列表让前端误以为文件没有内容。
     */
    private static FileVersionVO currentVersionView(FileNode node) {
        FileVersionVO vo = new FileVersionVO();
        vo.setVersionNo(node.getVersionNo());
        vo.setName(node.getName());
        vo.setSizeBytes(node.getSizeBytes());
        vo.setSha256(node.getSha256());
        vo.setUploadUserId(node.getUploadUserId());
        vo.setCreateTime(node.getUpdateTime());
        vo.setCurrent(true);
        return vo;
    }

    private static int nodeVersionNo(FileNode node) {
        return node.getVersionNo() == null ? INITIAL_VERSION_NO : node.getVersionNo();
    }
}
