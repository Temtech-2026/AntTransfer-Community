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
import com.anttransfer.common.result.PageResult;
import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.model.dto.BatchNodesRequest;
import com.anttransfer.file.model.dto.CopyRequest;
import com.anttransfer.file.model.dto.InstantUploadRequest;
import com.anttransfer.file.model.dto.MoveRequest;
import com.anttransfer.file.model.dto.NodeQuery;
import com.anttransfer.file.model.dto.NodeTagRow;
import com.anttransfer.file.model.dto.RenameRequest;
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.file.model.entity.FileObject;
import com.anttransfer.file.model.entity.Folder;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.file.model.vo.FileNodeVO;
import com.anttransfer.file.model.vo.TagVO;
import com.anttransfer.file.model.vo.UploadResultVO;
import com.anttransfer.file.repository.FileNodeMapper;
import com.anttransfer.file.repository.FileObjectMapper;
import com.anttransfer.file.repository.FileTagMapper;
import com.anttransfer.file.repository.FileVersionMapper;
import com.anttransfer.file.repository.FolderMapper;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.anttransfer.file.storage.FileStorage;
import com.anttransfer.file.util.AfterCommitUtils;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 文件条目服务：分页筛选 / 排序、元数据操作，以及「引用计数归零才回收物理文件」的完整生命周期。
 *
 * <h3>引用计数口径（全模块唯一，勿在别处另立）</h3>
 * <ul>
 *     <li>首次入库：{@code sys_file.ref_count = 1}；</li>
 *     <li>秒传命中 / 复制：{@code +1}（同一份字节，多一个引用条目）；</li>
 *     <li><b>移入回收站：不变</b>——引用还在，物理文件必须留着供还原，否则「还原」就成了空壳；</li>
 *     <li>彻底销毁 / 回收站到期清理：{@code -1}，<b>归零才删物理文件</b>。</li>
 * </ul>
 *
 * <h3>物理回收为什么要放到事务提交之后</h3>
 * <p>删物理字节不可回滚。若在事务内删盘、事务又回滚，就会出现「数据库说文件还在、磁盘上已经没了」
 * 的不可恢复损坏。故本类只在事务内做「减计数 + 判定归零」，真正的
 * {@code deletePhysically + deleteContent} 通过 {@link AfterCommitUtils} 推到提交后执行
 * （详见 {@link #purgePhysical}）。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileNodeService {

    /** 与分页插件上限保持一致，避免「请求 1000 条、返回 100 条」的静默收敛 */
    private static final long MAX_PAGE_SIZE = 100L;
    private static final int DEFAULT_LEVEL = 1;
    private static final int DEFAULT_VERSION_NO = 1;
    /** 高敏感级别：彻底销毁时必须额外关联一张已通过的 level=3 审批单 */
    private static final int HIGH_LEVEL = 3;
    private static final int STORAGE_TYPE_LOCAL = 1;
    private static final int FILE_STATUS_AVAILABLE = 0;
    private static final int RECYCLE_IDS_IN_AUDIT = 50;
    private static final int MAX_COPY_SUFFIX = 100;
    private static final String DEFAULT_FILE_NAME = "未命名文件";

    private final FileNodeMapper fileNodeMapper;
    private final FileObjectMapper fileObjectMapper;
    private final FolderMapper folderMapper;
    private final FileTagMapper fileTagMapper;
    private final FileVersionMapper fileVersionMapper;
    private final FileOwnershipGuard ownershipGuard;
    private final FileAuditLogger auditLogger;
    private final FileProperties properties;
    private final FileStorage fileStorage;
    /** 高敏感销毁的审批依据（读走 SPI，绝不跨模块直读 at-permission 的审批表）。 */
    private final SensitiveDestroyApprovalPort sensitiveDestroyApprovalPort;
    /**
     * 事务管理器：撞唯一键后需要一份<b>只读的独立事务</b>来回查对手已提交的行
     * （见 {@link #readFreshFileObject}）。
     */
    private final PlatformTransactionManager transactionManager;

    /* ======================= 列表：多条件筛选 + 排序 ======================= */

    /**
     * 正常态文件分页查询（多条件筛选 + 白名单排序 + 标签批量回显）。
     *
     * @param ownerUserId 归属用户 ID（列表永远只返回本人文件，筛选条件不能放宽这条边界）
     * @param query       查询条件
     * @return 分页结果
     */
    @Transactional(readOnly = true)
    public PageResult<FileNodeVO> page(Long ownerUserId, NodeQuery query) {
        return queryPage(ownerUserId, query, FileNode.STATUS_NORMAL, false);
    }

    /**
     * 回收站分页查询（默认按入站时间倒序）。
     *
     * @param ownerUserId 归属用户 ID
     * @param query       查询条件
     * @return 分页结果
     */
    @Transactional(readOnly = true)
    public PageResult<FileNodeVO> recyclePage(Long ownerUserId, NodeQuery query) {
        return queryPage(ownerUserId, query, FileNode.STATUS_RECYCLE, true);
    }

    /**
     * 文件详情（含标签）。
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     * @return 条目视图
     */
    @Transactional(readOnly = true)
    public FileNodeVO detail(Long ownerUserId, Long nodeId) {
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        FileNodeVO vo = FileNodeVO.of(node);
        vo.setTags(loadTags(List.of(nodeId)).getOrDefault(nodeId, List.of()));
        return vo;
    }

    /**
     * 校验「可写新版本 / 可回滚」的目标条目：必须是本人条目且不在回收站。
     *
     * <p>暴露给历史版本链路，目的是把「落盘前先验权」这一步提前：新版本要先把字节写到磁盘，
     * 若等落完盘再发现条目不属于本人或已在回收站，磁盘上就平白多了一份没人引用的内容
     * （虽然有内容寻址去重兜底，但它确实成了孤儿）。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     * @return 目标条目
     */
    public FileNode requireVersionTarget(Long ownerUserId, Long nodeId) {
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        ensureNotInRecycle(node);
        return node;
    }

    /* ============================ 元数据操作 ============================ */

    /**
     * 重命名文件（同目录不重名；同时刷新扩展名）。
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     * @param request     重命名请求
     * @return 更新后的条目视图
     */
    @Transactional(rollbackFor = Exception.class)
    public FileNodeVO rename(Long ownerUserId, Long nodeId, RenameRequest request) {
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        ensureNotInRecycle(node);
        String name = request.getName().trim();
        if (name.equals(node.getName())) {
            return FileNodeVO.of(node);
        }
        if (fileNameExists(ownerUserId, node.getFolderId(), name, node.getId())) {
            throw new BusinessException(ErrorCode.FOLDER_NAME_CONFLICT);
        }
        fileNodeMapper.update(null, Wrappers.<FileNode>lambdaUpdate()
                .eq(FileNode::getId, node.getId())
                .eq(FileNode::getOwnerUserId, ownerUserId)
                .set(FileNode::getName, name)
                .set(FileNode::getExt, extensionOf(name))
                .set(FileNode::getUpdateBy, ownerUserId));
        node.setName(name);
        node.setExt(extensionOf(name));

        auditLogger.success(OperationLog.ACTION_FILE_RENAME, OperationLog.TARGET_FILE, nodeId,
                Map.of("name", name));
        return FileNodeVO.of(node);
    }

    /**
     * 移动文件到目标目录（同目录不重名；物理内容不变，故引用计数不变）。
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     * @param request     移动请求
     * @return 更新后的条目视图
     */
    @Transactional(rollbackFor = Exception.class)
    public FileNodeVO move(Long ownerUserId, Long nodeId, MoveRequest request) {
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        ensureNotInRecycle(node);
        Folder target = ownershipGuard.requireOwnedFolder(normalizeFolderId(request.getTargetFolderId()), ownerUserId);
        Long targetFolderId = target == null ? Folder.ROOT_ID : target.getId();
        if (Objects.equals(node.getFolderId(), targetFolderId)) {
            return FileNodeVO.of(node);
        }
        if (fileNameExists(ownerUserId, targetFolderId, node.getName(), node.getId())) {
            throw new BusinessException(ErrorCode.FOLDER_NAME_CONFLICT);
        }
        fileNodeMapper.update(null, Wrappers.<FileNode>lambdaUpdate()
                .eq(FileNode::getId, node.getId())
                .eq(FileNode::getOwnerUserId, ownerUserId)
                .set(FileNode::getFolderId, targetFolderId)
                .set(FileNode::getUpdateBy, ownerUserId));
        node.setFolderId(targetFolderId);

        auditLogger.success(OperationLog.ACTION_FILE_MOVE, OperationLog.TARGET_FILE, nodeId,
                Map.of("targetFolderId", targetFolderId));
        return FileNodeVO.of(node);
    }

    /**
     * 复制文件到目标目录：新增引用条目并 {@code ref_count + 1}，物理字节不复制。
     *
     * <p>与重命名 / 移动不同，复制遇同名不报错而是自动消歧（追加「副本 / 副本2」），
     * 因为「复制一份」的用户预期就是得到一个可共存的新文件。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      源条目 ID
     * @param request     复制请求
     * @return 新条目视图
     */
    @Transactional(rollbackFor = Exception.class)
    public FileNodeVO copy(Long ownerUserId, Long nodeId, CopyRequest request) {
        FileNode source = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        ensureNotInRecycle(source);
        Folder target = ownershipGuard.requireOwnedFolder(normalizeFolderId(request.getTargetFolderId()), ownerUserId);
        Long targetFolderId = target == null ? Folder.ROOT_ID : target.getId();
        String desired = StringUtils.hasText(request.getName()) ? request.getName().trim() : source.getName();
        String name = resolveCopyName(ownerUserId, targetFolderId, desired);

        // 先加引用再插条目：同一事务内，插入失败会一并回滚，不会留下虚增的计数
        fileObjectMapper.increaseRefCount(source.getFileId());

        FileNode node = new FileNode();
        node.setFileId(source.getFileId());
        node.setOwnerUserId(ownerUserId);
        node.setFolderId(targetFolderId);
        node.setName(name);
        node.setExt(extensionOf(name));
        node.setContentType(source.getContentType());
        node.setSizeBytes(source.getSizeBytes());
        node.setSha256(source.getSha256());
        node.setLevel(source.getLevel());
        node.setVersionNo(source.getVersionNo());
        node.setStatus(FileNode.STATUS_NORMAL);
        node.setUploadUserId(ownerUserId);
        node.setGroupId(target == null ? source.getGroupId() : target.getGroupId());
        node.setSpaceId(target == null ? source.getSpaceId() : target.getSpaceId());
        node.setCreateBy(ownerUserId);
        node.setUpdateBy(ownerUserId);
        fileNodeMapper.insert(node);

        auditLogger.success(OperationLog.ACTION_FILE_COPY, OperationLog.TARGET_FILE, node.getId(),
                Map.of("sourceNodeId", nodeId, "name", name));
        return FileNodeVO.of(node);
    }

    /**
     * 移入回收站（普通删除）：置 {@code status=1}，<b>不动引用计数</b>，物理文件保留。
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     */
    @Transactional(rollbackFor = Exception.class)
    public void moveToRecycle(Long ownerUserId, Long nodeId) {
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        if (node.inRecycle()) {
            return;
        }
        recycle(ownerUserId, List.of(node.getId()));
        auditLogger.success(OperationLog.ACTION_FILE_DELETE, OperationLog.TARGET_FILE, nodeId,
                Map.of("name", node.getName()));
    }

    /**
     * 批量移入回收站（整批先校验归属，避免部分成功后中途失败）。
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeIds     条目 ID 列表
     * @return 实际移入条数（已在回收站的不重复计数）
     */
    @Transactional(rollbackFor = Exception.class)
    public int batchMoveToRecycle(Long ownerUserId, List<Long> nodeIds) {
        List<FileNode> nodes = ownershipGuard.requireOwnedNodes(nodeIds, ownerUserId);
        List<Long> recyclable = nodes.stream().filter(node -> !node.inRecycle()).map(FileNode::getId).toList();
        if (recyclable.isEmpty()) {
            return 0;
        }
        int affected = recycle(ownerUserId, recyclable);
        auditLogger.success(OperationLog.ACTION_FILE_DELETE, OperationLog.TARGET_FILE, null,
                Map.of("count", affected, "nodeIds", recyclable.stream().limit(RECYCLE_IDS_IN_AUDIT).toList()));
        return affected;
    }

    /**
     * 从回收站还原到原目录（原目录已被删除则落到根，并做同名消歧，避免产生孤儿条目）。
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     * @return 还原后的条目视图
     */
    @Transactional(rollbackFor = Exception.class)
    public FileNodeVO restore(Long ownerUserId, Long nodeId) {
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        if (!node.inRecycle()) {
            return FileNodeVO.of(node);
        }
        Long folderId = resolveRestoreFolder(ownerUserId, node.getFolderId());
        String name = resolveCopyName(ownerUserId, folderId, node.getName());
        fileNodeMapper.update(null, Wrappers.<FileNode>lambdaUpdate()
                .eq(FileNode::getId, node.getId())
                .eq(FileNode::getOwnerUserId, ownerUserId)
                .set(FileNode::getStatus, FileNode.STATUS_NORMAL)
                .set(FileNode::getRecycleTime, null)
                .set(FileNode::getRecycleBy, null)
                .set(FileNode::getFolderId, folderId)
                .set(FileNode::getName, name)
                .set(FileNode::getExt, extensionOf(name))
                .set(FileNode::getUpdateBy, ownerUserId));

        auditLogger.success(OperationLog.ACTION_FILE_RESTORE, OperationLog.TARGET_FILE, nodeId,
                Map.of("folderId", folderId, "name", name));
        return detail(ownerUserId, nodeId);
    }

    /**
     * 彻底销毁（不可逆）：<b>绕过回收站</b>直接逻辑删除条目并 {@code ref_count - 1}，归零后回收物理文件。
     *
     * <p>与 {@link #moveToRecycle} 的区别在于「不可逆」：后者只是置 {@code status=1} 且不动引用计数，
     * 而销毁一旦执行，条目与（版本到期后的）物理字节都不会再回来，故不校验 {@code status}，
     * 正常态与回收站态都能直接销毁。</p>
     *
     * <h3>{@code 4017} 的完整口径（两个条件，缺一不可）</h3>
     * <ol>
     *     <li><b>超级管理员</b>：由 RBAC 的 {@code file:destroy} 权限点兜底，该点已收敛为仅 SUPER_ADMIN
     *         持有（见 {@code sql/V8__restrict_file_destroy_to_super_admin.sql}）；</li>
     *     <li><b>关联一张「已通过」的高敏感（level=3）审批单</b>：读走 {@link SensitiveDestroyApprovalPort}，
     *         绝不跨模块直读 at-permission 的审批表（模块边界铁律）。</li>
     * </ol>
     *
     * <p>审批单只对高敏感文件强制：审批路由本身按密级选节点，给 level=1 的文件要求一张 level=3 的审批单
     * 在流程上不可达。低密级文件仍受「超级管理员」这一条约束，只是不必额外走审批。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param nodeId      条目 ID
     */
    @Transactional(rollbackFor = Exception.class)
    public void destroy(Long ownerUserId, Long nodeId) {
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        String approvalNo = null;
        if (node.getLevel() != null && node.getLevel() >= HIGH_LEVEL) {
            approvalNo = sensitiveDestroyApprovalPort.findApprovedHighSensitiveDestroy(ownerUserId, node.getFileId());
            if (approvalNo == null) {
                auditLogger.fail(OperationLog.ACTION_FILE_DESTROY, OperationLog.TARGET_FILE, nodeId,
                        "高敏感文件缺少已通过（level=3）的销毁审批单");
                throw new BusinessException(ErrorCode.FILE_DESTROY_FORBIDDEN);
            }
        }
        releaseReference(node);

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("fileId", node.getFileId());
        extra.put("name", node.getName());
        extra.put("level", node.getLevel());
        if (approvalNo != null) {
            extra.put("approvalNo", approvalNo);
        }
        auditLogger.success(OperationLog.ACTION_FILE_DESTROY, OperationLog.TARGET_FILE, nodeId, extra);
    }

    /**
     * 清空回收站（分批，单次上限 {@code recycleCleanupBatchSize}）。
     *
     * <p>超大回收站需要多次调用 / 等下一轮定时清理，避免一个请求把成千上万行锁进同一事务。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @return 本次销毁条数
     */
    @Transactional(rollbackFor = Exception.class)
    public int emptyRecycle(Long ownerUserId) {
        List<FileNode> batch = fileNodeMapper.selectList(Wrappers.<FileNode>lambdaQuery()
                .eq(FileNode::getOwnerUserId, ownerUserId)
                .eq(FileNode::getStatus, FileNode.STATUS_RECYCLE)
                .orderByAsc(FileNode::getRecycleTime)
                .last("limit " + properties.getRecycleCleanupBatchSize()));
        if (batch.isEmpty()) {
            return 0;
        }
        batch.forEach(this::releaseReference);
        auditLogger.success(OperationLog.ACTION_FILE_DESTROY, OperationLog.TARGET_FILE, null,
                Map.of("count", batch.size(), "scope", "emptyRecycle"));
        return batch.size();
    }

    /**
     * 回收站到期清理（系统级、跨用户，单批上限 {@code recycleCleanupBatchSize}）。
     *
     * <p>由 {@code FileCleanupScheduler} 分批循环调用，每批一个事务，避免长事务与磁盘 IO 尖峰。</p>
     *
     * @return 本批销毁条数
     */
    @Transactional(rollbackFor = Exception.class)
    public int purgeExpiredRecycle() {
        LocalDateTime deadline = LocalDateTime.now().minusDays(properties.getRecycleRetentionDays());
        List<FileNode> expired = fileNodeMapper.findExpiredRecycle(deadline, properties.getRecycleCleanupBatchSize());
        if (expired.isEmpty()) {
            return 0;
        }
        expired.forEach(this::releaseReference);
        auditLogger.success(OperationLog.ACTION_RECYCLE_PURGE, OperationLog.TARGET_FILE, null,
                Map.of("count", expired.size(), "deadline", deadline.toString()));
        log.info("回收站到期清理：{} 条（保留期 {} 天）", expired.size(), properties.getRecycleRetentionDays());
        return expired.size();
    }

    /* ========================== 上传 / 秒传 ========================== */

    /**
     * 秒传：命中既有物理内容时直接建引用（{@code ref_count + 1}），不传字节。
     *
     * <p>幂等口径：同一用户已有同一内容的<b>正常态</b>条目时直接复用、不重复建行也不重复计数，
     * 因此重复秒传不会把 {@code ref_count} 灌大。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param request     秒传请求（{@code sha256} 已由调用方规整为小写）
     * @param sha256      规整后的内容 SHA-256
     * @return 上传结果
     */
    @Transactional(rollbackFor = Exception.class)
    public UploadResultVO instantUploadNode(Long ownerUserId, InstantUploadRequest request, String sha256) {
        Folder folder = ownershipGuard.requireOwnedFolder(normalizeFolderId(request.getFolderId()), ownerUserId);
        Long folderId = folder == null ? Folder.ROOT_ID : folder.getId();

        FileObject file = fileObjectMapper.findByContent(sha256, request.getSizeBytes());
        if (file == null) {
            // 物理层判定已在 FileContentService 完成（磁盘探测属 IO，不能进事务），此处是元数据缺失
            throw new BusinessException(ErrorCode.INSTANT_UPLOAD_MISS);
        }
        FileNode existing = findNormalNodeByContent(ownerUserId, sha256, request.getSizeBytes());
        if (existing != null) {
            return toUploadResult(existing, file, true);
        }
        if (isLogicallyDeleted(file)) {
            fileObjectMapper.revive(file.getId());
        }
        fileObjectMapper.increaseRefCount(file.getId());

        FileNode node = buildNode(ownerUserId, file, request.getName(), folderId,
                resolveLevel(request.getLevel(), folder));
        fileNodeMapper.insert(node);

        auditLogger.success(OperationLog.ACTION_FILE_UPLOAD, OperationLog.TARGET_FILE, node.getId(),
                Map.of("name", node.getName(), "instant", true, "fileId", file.getId(),
                        OperationLog.DETAIL_SIZE_BYTES, Objects.requireNonNullElse(node.getSizeBytes(), 0L),
                        OperationLog.DETAIL_TRANSFERRED_BYTES, 0L));
        return toUploadResult(node, file, true);
    }

    /**
     * 登记一份「字节已落盘」的新文件：内容寻址去重 + 引用计数 + 建条目。
     *
     * <p>字节落盘（IO）由调用方在事务外完成，本方法只碰数据库。若并发下他人抢先写入了同一内容，
     * 唯一键 {@code uk_sha256_size} 会拦住插入，此处回退为「复用 + 计数」而非报错——
     * 去重逻辑不能因为竞态就失败。</p>
     *
     * @param ownerUserId  归属用户 ID
     * @param name         展示文件名
     * @param folderIdRaw  所属目录 ID（可空 = 根）
     * @param level        密级（可空 = 继承目录）
     * @param contentType  MIME 类型
     * @param sha256       内容 SHA-256（小写）
     * @param sizeBytes    字节数
     * @param relativePath 内容寻址相对路径
     * @return 上传结果
     */
    @Transactional(rollbackFor = Exception.class)
    public UploadResultVO registerStoredContent(Long ownerUserId, String name, Long folderIdRaw, Integer level,
                                                String contentType, String sha256, long sizeBytes,
                                                String relativePath) {
        Folder folder = ownershipGuard.requireOwnedFolder(normalizeFolderId(folderIdRaw), ownerUserId);
        Long folderId = folder == null ? Folder.ROOT_ID : folder.getId();

        FileObject file = fileObjectMapper.findByContent(sha256, sizeBytes);
        boolean reused = file != null;
        if (file == null) {
            file = new FileObject();
            file.setOriginalName(name);
            file.setStorageType(STORAGE_TYPE_LOCAL);
            file.setStoragePath(relativePath);
            file.setContentType(contentType);
            file.setSizeBytes(sizeBytes);
            file.setSha256(sha256);
            file.setUploadUserId(ownerUserId);
            file.setStatus(FILE_STATUS_AVAILABLE);
            file.setRefCount(1);
            file.setCreateBy(ownerUserId);
            file.setUpdateBy(ownerUserId);
            try {
                fileObjectMapper.insert(file);
            } catch (DuplicateKeyException e) {
                // 并发下他人抢先写入了同一内容：唯一键拦住了插入，收口为「复用 + 计数」。
                // 回查必须换一份新快照（理由见 readFreshFileObject）：本事务的快照建立于上面那次
                // findByContent，而对手的行是在那之后才提交的，沿用旧快照会读到空，把「复用」退化成报错。
                file = readFreshFileObject(sha256, sizeBytes);
                if (file == null) {
                    throw e;
                }
                reused = true;
            }
        }
        if (reused) {
            if (isLogicallyDeleted(file)) {
                fileObjectMapper.revive(file.getId());
            }
            fileObjectMapper.increaseRefCount(file.getId());
        }

        FileNode node = buildNode(ownerUserId, file, name, folderId, resolveLevel(level, folder));
        fileNodeMapper.insert(node);

        auditLogger.success(OperationLog.ACTION_FILE_UPLOAD, OperationLog.TARGET_FILE, node.getId(),
                Map.of("name", name, "instant", reused, "fileId", file.getId(),
                        OperationLog.DETAIL_SIZE_BYTES, Objects.requireNonNullElse(node.getSizeBytes(), 0L),
                        OperationLog.DETAIL_TRANSFERRED_BYTES,
                        reused ? 0L : Objects.requireNonNullElse(node.getSizeBytes(), 0L)));
        return toUploadResult(node, file, reused);
    }

    /**
     * 为一份物理内容<b>取得一个新引用</b>（内容寻址去重 + {@code ref_count + 1}），返回物理文件行。
     *
     * <p>专供「上传新版本 / 回滚」复用：新版本的字节很可能早已在库中（同内容秒传过、或被别的条目引用），
     * 此时只加计数、不新增物理行。引用计数的增减规则只在本类维护，因此这条路径也放在这里，
     * 避免 {@code FileVersionService} 另立一套口径。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param name        原始文件名（仅新建物理行时用于留痕）
     * @param contentType MIME 类型
     * @param sha256      内容 SHA-256（小写）
     * @param sizeBytes   字节数
     * @param relativePath 内容寻址相对路径（仅新建物理行时使用）
     * @return 物理文件行（{@code id} 必然非空）
     */
    @Transactional(rollbackFor = Exception.class)
    public FileObject acquireContentReference(Long ownerUserId, String name, String contentType,
                                              String sha256, long sizeBytes, String relativePath) {
        FileObject file = fileObjectMapper.findByContent(sha256, sizeBytes);
        if (file == null) {
            file = new FileObject();
            file.setOriginalName(name);
            file.setStorageType(STORAGE_TYPE_LOCAL);
            file.setStoragePath(relativePath);
            file.setContentType(contentType);
            file.setSizeBytes(sizeBytes);
            file.setSha256(sha256);
            file.setUploadUserId(ownerUserId);
            file.setStatus(FILE_STATUS_AVAILABLE);
            file.setRefCount(1);
            file.setCreateBy(ownerUserId);
            file.setUpdateBy(ownerUserId);
            try {
                fileObjectMapper.insert(file);
                return file;
            } catch (DuplicateKeyException e) {
                // 并发下他人抢先写入了同一内容：唯一键拦住插入，回退为「复用 + 计数」而非报错。
                // 回查必须换一份新快照（理由见 readFreshFileObject）：普通查询看到的是撞键之前
                // 建立的那份快照，读不到对手刚提交的行，会让「复用」退化成报错。
                file = readFreshFileObject(sha256, sizeBytes);
                if (file == null) {
                    throw e;
                }
            }
        }
        if (isLogicallyDeleted(file)) {
            fileObjectMapper.revive(file.getId());
        }
        fileObjectMapper.increaseRefCount(file.getId());
        return file;
    }

    /**
     * 撞唯一键后，用<b>只读的独立事务</b>回查对手已提交的行。
     *
     * <p><b>为什么不能在本事务里回查：</b>本事务的一致性读快照建立于 {@code insert} 之前那次
     * {@code findByContent}，而对手的行是在那之后才提交的，沿用旧快照会稳定读到空。</p>
     *
     * <p><b>为什么不能在本事务里做当前读（{@code for share}）：</b>撞键的 {@code insert} 已在对
     * 手行上留下共享锁，而本方法之后还要对同一行做 {@code ref_count + 1}（排他锁），多个并发输家
     * 同时升级就会互相等待——真库并发用例实测到的正是
     * {@code Deadlock found when trying to get lock}。换成只读、不持锁的独立事务，既拿到新快照，
     * 又不与各自的计数写入互相纠缠。</p>
     *
     * <p>该事务只读、不改动任何数据，因此即便调用方处在更大的写事务里（如
     * {@code FileVersionService#createVersion}），也不会破坏其原子性。</p>
     */
    private FileObject readFreshFileObject(String sha256, long sizeBytes) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        template.setReadOnly(true);
        return template.execute(status -> fileObjectMapper.findByContent(sha256, sizeBytes));
    }

    /* ============================ 内部实现 ============================ */

    private PageResult<FileNodeVO> queryPage(Long ownerUserId, NodeQuery query, int status, boolean recycleSort) {
        long current = Math.max(query.getCurrent(), 1L);
        long pageSize = Math.min(Math.max(query.getPageSize(), 1L), MAX_PAGE_SIZE);

        LambdaQueryWrapper<FileNode> wrapper = Wrappers.<FileNode>lambdaQuery()
                .eq(FileNode::getOwnerUserId, ownerUserId)
                .eq(FileNode::getStatus, status);
        if (query.getFolderId() != null) {
            wrapper.eq(FileNode::getFolderId, query.getFolderId());
        }
        if (StringUtils.hasText(query.getKeyword())) {
            wrapper.like(FileNode::getName, query.getKeyword().trim());
        }
        if (StringUtils.hasText(query.getExt())) {
            wrapper.eq(FileNode::getExt, normalizeExt(query.getExt()));
        }
        if (query.getLevel() != null) {
            wrapper.eq(FileNode::getLevel, query.getLevel());
        }
        if (query.getUploadUserId() != null) {
            wrapper.eq(FileNode::getUploadUserId, query.getUploadUserId());
        }
        if (query.getMinSize() != null) {
            wrapper.ge(FileNode::getSizeBytes, query.getMinSize());
        }
        if (query.getMaxSize() != null) {
            wrapper.le(FileNode::getSizeBytes, query.getMaxSize());
        }
        if (query.getStartTime() != null) {
            wrapper.ge(FileNode::getCreateTime, query.getStartTime());
        }
        if (query.getEndTime() != null) {
            wrapper.le(FileNode::getCreateTime, query.getEndTime());
        }
        List<Long> tagFiltered = null;
        if (query.getTagId() != null) {
            tagFiltered = fileTagMapper.findNodeIdsByTag(ownerUserId, query.getTagId());
            if (tagFiltered.isEmpty()) {
                // 空集合 = 无结果，不能当成「忽略标签条件」
                return PageResult.empty(current, pageSize);
            }
        }
        if (query.getTagIds() != null && !query.getTagIds().isEmpty()) {
            // 去重后再断言「命中标签数 = 期望数」：重复传同一标签会被 having 判成「未命全」
            List<Long> expectedTags = query.getTagIds().stream()
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
            if (!expectedTags.isEmpty()) {
                List<Long> byTags = fileTagMapper.findNodeIdsByTags(ownerUserId, expectedTags, expectedTags.size());
                if (byTags.isEmpty()) {
                    return PageResult.empty(current, pageSize);
                }
                if (tagFiltered == null) {
                    tagFiltered = byTags;
                } else {
                    Set<Long> byTagSet = new HashSet<>(byTags);
                    tagFiltered = tagFiltered.stream().filter(byTagSet::contains).toList();
                    if (tagFiltered.isEmpty()) {
                        return PageResult.empty(current, pageSize);
                    }
                }
            }
        }
        if (tagFiltered != null) {
            wrapper.in(FileNode::getId, tagFiltered);
        }
        applySort(wrapper, query.getSort(), recycleSort);

        Page<FileNode> result = fileNodeMapper.selectPage(new Page<>(current, pageSize), wrapper);
        return PageResult.of(toVOList(result.getRecords()), result.getTotal(), result.getCurrent(), result.getSize());
    }

    private List<FileNodeVO> toVOList(List<FileNode> nodes) {
        if (nodes.isEmpty()) {
            return new ArrayList<>();
        }
        Map<Long, List<TagVO>> tagsByNode = loadTags(nodes.stream().map(FileNode::getId).toList());
        List<FileNodeVO> records = new ArrayList<>(nodes.size());
        for (FileNode node : nodes) {
            FileNodeVO vo = FileNodeVO.of(node);
            vo.setTags(tagsByNode.getOrDefault(node.getId(), List.of()));
            records.add(vo);
        }
        return records;
    }

    private Map<Long, List<TagVO>> loadTags(List<Long> nodeIds) {
        if (nodeIds == null || nodeIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<TagVO>> grouped = new LinkedHashMap<>();
        for (NodeTagRow row : fileTagMapper.findTagsByNodeIds(nodeIds)) {
            TagVO tag = new TagVO();
            tag.setId(row.getTagId());
            tag.setName(row.getName());
            tag.setColor(row.getColor());
            grouped.computeIfAbsent(row.getNodeId(), key -> new ArrayList<>()).add(tag);
        }
        return grouped;
    }

    /**
     * 排序：白名单字段映射到物理列，杜绝排序字段注入；末尾恒追加主键以保证翻页稳定
     * （否则排序键相同时数据库返回顺序不定，会翻出重复行、漏掉其他行）。
     */
    private void applySort(LambdaQueryWrapper<FileNode> wrapper, String sort, boolean recycleSort) {
        List<SortTerm> terms = parseSort(sort);
        if (terms.isEmpty()) {
            if (recycleSort) {
                wrapper.orderByDesc(FileNode::getRecycleTime);
            } else {
                wrapper.orderByDesc(FileNode::getUpdateTime);
            }
            wrapper.orderByDesc(FileNode::getId);
            return;
        }
        for (SortTerm term : terms) {
            switch (term.field()) {
                case "name" -> wrapper.orderBy(true, term.ascending(), FileNode::getName);
                case "sizeBytes" -> wrapper.orderBy(true, term.ascending(), FileNode::getSizeBytes);
                case "ext" -> wrapper.orderBy(true, term.ascending(), FileNode::getExt);
                case "level" -> wrapper.orderBy(true, term.ascending(), FileNode::getLevel);
                case "versionNo" -> wrapper.orderBy(true, term.ascending(), FileNode::getVersionNo);
                case "createTime" -> wrapper.orderBy(true, term.ascending(), FileNode::getCreateTime);
                case "updateTime" -> wrapper.orderBy(true, term.ascending(), FileNode::getUpdateTime);
                case "recycleTime" -> wrapper.orderBy(true, term.ascending(), FileNode::getRecycleTime);
                default -> log.debug("忽略非白名单排序字段：{}", term.field());
            }
        }
        wrapper.orderByDesc(FileNode::getId);
    }

    /**
     * 解析 {@code sort} 表达式，兼容三种写法：
     * {@code sizeBytes,desc}（契约写法）、{@code -createTime}、{@code name}（缺省升序）。
     */
    private static List<SortTerm> parseSort(String sort) {
        if (!StringUtils.hasText(sort)) {
            return List.of();
        }
        List<SortTerm> terms = new ArrayList<>();
        for (String raw : sort.split(",")) {
            String token = raw.trim();
            if (token.isEmpty()) {
                continue;
            }
            if (("asc".equalsIgnoreCase(token) || "desc".equalsIgnoreCase(token)) && !terms.isEmpty()) {
                SortTerm last = terms.remove(terms.size() - 1);
                terms.add(new SortTerm(last.field(), "asc".equalsIgnoreCase(token)));
                continue;
            }
            if (token.startsWith("-")) {
                terms.add(new SortTerm(token.substring(1).trim(), false));
            } else if (token.startsWith("+")) {
                terms.add(new SortTerm(token.substring(1).trim(), true));
            } else {
                terms.add(new SortTerm(token, true));
            }
        }
        return terms;
    }

    private int recycle(Long ownerUserId, Collection<Long> nodeIds) {
        return fileNodeMapper.update(null, Wrappers.<FileNode>lambdaUpdate()
                .eq(FileNode::getOwnerUserId, ownerUserId)
                .eq(FileNode::getStatus, FileNode.STATUS_NORMAL)
                .in(FileNode::getId, nodeIds)
                .set(FileNode::getStatus, FileNode.STATUS_RECYCLE)
                .set(FileNode::getRecycleTime, LocalDateTime.now())
                .set(FileNode::getRecycleBy, ownerUserId)
                .set(FileNode::getUpdateBy, ownerUserId));
    }

    private Long resolveRestoreFolder(Long ownerUserId, Long folderId) {
        if (folderId == null || folderId == Folder.ROOT_ID) {
            return Folder.ROOT_ID;
        }
        Folder folder = folderMapper.selectById(folderId);
        return (folder == null || !Objects.equals(folder.getOwnerUserId(), ownerUserId)) ? Folder.ROOT_ID : folderId;
    }

    private FileNode findNormalNodeByContent(Long ownerUserId, String sha256, Long sizeBytes) {
        List<FileNode> nodes = fileNodeMapper.selectList(Wrappers.<FileNode>lambdaQuery()
                .eq(FileNode::getOwnerUserId, ownerUserId)
                .eq(FileNode::getSha256, sha256)
                .eq(FileNode::getSizeBytes, sizeBytes)
                .eq(FileNode::getStatus, FileNode.STATUS_NORMAL)
                .orderByAsc(FileNode::getId)
                .last("limit 1"));
        return nodes.isEmpty() ? null : nodes.get(0);
    }

    private FileNode buildNode(Long ownerUserId, FileObject file, String name, Long folderId, int level) {
        FileNode node = new FileNode();
        node.setFileId(file.getId());
        node.setOwnerUserId(ownerUserId);
        node.setFolderId(folderId);
        node.setName(name);
        node.setExt(extensionOf(name));
        node.setContentType(file.getContentType());
        node.setSizeBytes(file.getSizeBytes());
        node.setSha256(file.getSha256());
        node.setLevel(level);
        node.setVersionNo(DEFAULT_VERSION_NO);
        node.setStatus(FileNode.STATUS_NORMAL);
        node.setUploadUserId(ownerUserId);
        node.setCreateBy(ownerUserId);
        node.setUpdateBy(ownerUserId);
        return node;
    }

    private boolean fileNameExists(Long ownerUserId, Long folderId, String name, Long excludeId) {
        return fileNodeMapper.selectCount(Wrappers.<FileNode>lambdaQuery()
                .eq(FileNode::getOwnerUserId, ownerUserId)
                .eq(FileNode::getFolderId, folderId == null ? Folder.ROOT_ID : folderId)
                .eq(FileNode::getStatus, FileNode.STATUS_NORMAL)
                .eq(FileNode::getName, name)
                .ne(excludeId != null, FileNode::getId, excludeId)) > 0;
    }

    private String resolveCopyName(Long ownerUserId, Long folderId, String desired) {
        String base = StringUtils.hasText(desired) ? desired.trim() : DEFAULT_FILE_NAME;
        if (!fileNameExists(ownerUserId, folderId, base, null)) {
            return base;
        }
        String stem = base;
        String suffix = "";
        int dot = base.lastIndexOf('.');
        if (dot > 0) {
            stem = base.substring(0, dot);
            suffix = base.substring(dot);
        }
        for (int i = 1; i <= MAX_COPY_SUFFIX; i++) {
            String candidate = stem + " (副本" + (i == 1 ? "" : i) + ")" + suffix;
            if (!fileNameExists(ownerUserId, folderId, candidate, null)) {
                return candidate;
            }
        }
        throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "同名副本过多，请显式指定名称");
    }

    /**
     * 逻辑删除条目并递减引用计数；归零且无存活引用时，登记「提交后回收物理文件」。
     *
     * <p>{@code deleteById} 走逻辑删除，重复执行返回 0 行，据此天然幂等——
     * 定时清理与用户手动销毁并发命中同一条目时，只有一方会真正递减计数。</p>
     */
    private void releaseReference(FileNode node) {
        if (fileNodeMapper.deleteById(node.getId()) == 0) {
            return;
        }
        // 条目退场时，它的历史版本必须一并退场：版本行仍持有同一个 file_id，
        // 只逻辑删条目而留版本行，物理回收的第三道闸（countLiveVersions）会永远不放字节。
        fileVersionMapper.deleteByNodeId(node.getId());
        if (node.getFileId() == null) {
            return;
        }
        if (fileObjectMapper.decreaseRefCount(node.getFileId()) == 0) {
            log.warn("引用计数已为 0，跳过递减：fileId={}, nodeId={}", node.getFileId(), node.getId());
        }
        registerPurgeIfOrphaned(node.getFileId(), node.getSha256());
    }

    /**
     * 引用计数已递减后，复核「是否仍有任何东西持有这份内容」，无则登记提交后物理回收。
     *
     * <p>三次闸门缺一不可，任一不为零都说明还有引用方：</p>
     * <ol>
     *     <li>{@code sys_file.ref_count}：物理层自增计数（首次入库 / 秒传 / 复制时 +1）；</li>
     *     <li>{@code sys_file_node} 存活行数：与计数交叉验证，防计数漂移导致误删；</li>
     *     <li>{@code sys_file_version} 存活版本数：历史版本刻意不占 {@code ref_count}，
     *         却同样指向这份字节——漏掉这一道就会「回滚到旧版时字节已没了」。</li>
     * </ol>
     *
     * <p>公开给 {@code FileVersionService} 复用：版本裁剪 / 版本切换同样要按同一口径判定孤儿内容，
     * 口径只此一处，避免两套判断漂移。</p>
     *
     * @param fileId 物理文件 ID（可空）
     * @param sha256 内容哈希（可空，用于删字节）
     */
    public void registerPurgeIfOrphaned(Long fileId, String sha256) {
        if (fileId == null) {
            return;
        }
        Integer remain = fileObjectMapper.selectRefCount(fileId);
        if (remain != null && remain > 0) {
            return;
        }
        if (fileNodeMapper.countLiveRefs(fileId) > 0) {
            return;
        }
        if (fileVersionMapper.countLiveVersions(fileId) > 0) {
            return;
        }
        AfterCommitUtils.run(() -> purgePhysical(fileId, sha256));
    }

    /**
     * 物理回收：删元数据行 + 删内容字节（事务提交后执行）。
     *
     * <p><b>顺序是先删行、后删字节</b>：反过来的话（字节没了、行还在），下次同内容上传会命中一个
     * 「有记录、无字节」的空壳行，直接产出坏文件；而先删行最多留下无人引用的孤儿字节，
     * 那份字节的路径由内容哈希决定，同内容再次上传时会被 {@code storeContent} 原样复用，无害。</p>
     *
     * <p>执行前再复核一次计数：提交后到回调之间若有并发秒传把引用加回去，则放弃回收。</p>
     */
    private void purgePhysical(Long fileId, String sha256) {
        try {
            Integer remain = fileObjectMapper.selectRefCount(fileId);
            if (remain != null && remain > 0) {
                return;
            }
            if (fileNodeMapper.countLiveRefs(fileId) > 0) {
                return;
            }
            if (fileVersionMapper.countLiveVersions(fileId) > 0) {
                return;
            }
            fileObjectMapper.deletePhysically(fileId);
            if (sha256 != null) {
                fileStorage.deleteContent(sha256);
            }
            log.info("物理文件回收完成：fileId={}, sha256={}", fileId, sha256);
        } catch (Exception e) {
            log.error("物理文件回收失败（元数据清理结果保留，字节留待后续清理）：fileId={}, sha256={}",
                    fileId, sha256, e);
        }
    }

    private UploadResultVO toUploadResult(FileNode node, FileObject file, boolean instant) {
        UploadResultVO vo = new UploadResultVO();
        vo.setNodeId(node.getId());
        vo.setFileId(file.getId());
        vo.setName(node.getName());
        vo.setInstant(instant);
        vo.setVersionNo(node.getVersionNo());
        vo.setSizeBytes(node.getSizeBytes());
        vo.setSha256(node.getSha256());
        vo.setRefCount(fileObjectMapper.selectRefCount(file.getId()));
        return vo;
    }

    private void ensureNotInRecycle(FileNode node) {
        if (node.inRecycle()) {
            throw new BusinessException(ErrorCode.FILE_IN_RECYCLE);
        }
    }

    private int resolveLevel(Integer requested, Folder folder) {
        if (requested != null) {
            return requested;
        }
        Integer inherited = folder == null ? null : folder.getLevel();
        return inherited == null ? DEFAULT_LEVEL : inherited;
    }

    private static boolean isLogicallyDeleted(FileObject file) {
        return file.getDeleted() != null && file.getDeleted() == 1;
    }

    private static Long normalizeFolderId(Long folderId) {
        return folderId == null ? Folder.ROOT_ID : folderId;
    }

    /** 取小写扩展名（无扩展名返回 null；超长扩展名截断，防脏文件名撑爆索引列）。 */
    private static String extensionOf(String name) {
        if (name == null) {
            return null;
        }
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return null;
        }
        String ext = name.substring(dot + 1).toLowerCase(Locale.ROOT);
        return ext.length() > 32 ? ext.substring(0, 32) : ext;
    }

    private static String normalizeExt(String ext) {
        String normalized = ext.trim().toLowerCase(Locale.ROOT);
        return normalized.startsWith(".") ? normalized.substring(1) : normalized;
    }

    /** 排序项（record 不可变，改方向时重建）。 */
    private record SortTerm(String field, boolean ascending) {
    }
}
