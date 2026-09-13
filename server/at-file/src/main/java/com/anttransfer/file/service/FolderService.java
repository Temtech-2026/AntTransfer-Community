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
import com.anttransfer.file.model.dto.CreateFolderRequest;
import com.anttransfer.file.model.dto.MoveRequest;
import com.anttransfer.file.model.dto.RenameRequest;
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.file.model.entity.Folder;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.file.model.vo.FolderVO;
import com.anttransfer.file.repository.FileNodeMapper;
import com.anttransfer.file.repository.FolderMapper;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 目录树服务：承载物化路径（{@code sys_folder.path}）带来的建 / 改 / 移 / 删与整树组装。
 *
 * <p><b>为什么整树一次性返回：</b>目录规模受 {@code maxFolderDepth} 约束，且渲染目录树必须
 * 一次拿全才能正确展开祖先链；分页只会把「一次查询」拆成一串有状态往返。</p>
 *
 * <p><b>为什么移动要重写子孙路径：</b>{@code path} 是「空间换时间」的物化路径——前缀查询、
 * 防成环全靠它，代价就是移动目录时必须把整棵子树的 path 一次性对齐（见
 * {@link FolderMapper#replaceSubtreePath}），这也是目录移动被定义为低频操作的原因。</p>
 *
 * <p><b>删除目录 ≠ 销毁文件：</b>删除目录只把目录及其子孙目录下的文件「请进回收站」并逻辑删除目录，
 * {@code sys_file.ref_count} 不变——文件仍可还原，只是暂时失去目录归属。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FolderService {

    /** 未显式指定且无法继承时的默认密级 */
    private static final int DEFAULT_LEVEL = 1;

    private final FolderMapper folderMapper;
    private final FileNodeMapper fileNodeMapper;
    private final FileOwnershipGuard ownershipGuard;
    private final FileAuditLogger auditLogger;
    private final FileProperties properties;

    /**
     * 新建目录（同层不重名）。
     *
     * @param ownerUserId 归属用户 ID
     * @param request     新建请求
     * @return 新建目录视图
     */
    @Transactional(rollbackFor = Exception.class)
    public FolderVO create(Long ownerUserId, CreateFolderRequest request) {
        Folder parent = ownershipGuard.requireOwnedFolder(normalizeFolderId(request.getParentId()), ownerUserId);
        int depth = parent == null ? 1 : depthOf(parent.getDepth()) + 1;
        if (depth > properties.getMaxFolderDepth()) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "目录层级超过上限 " + properties.getMaxFolderDepth());
        }
        String name = request.getName().trim();
        Long parentId = parentIdOf(parent);
        if (folderNameExists(ownerUserId, parentId, name, null)) {
            throw new BusinessException(ErrorCode.FOLDER_NAME_CONFLICT);
        }

        // 自分配主键后即可算出物化路径，避免「先插入再回写 path」的第二次写库
        long folderId = IdWorker.getId();
        String parentPath = parent == null ? "/" : normalizePath(parent);

        Folder folder = new Folder();
        folder.setId(folderId);
        folder.setParentId(parentId);
        folder.setOwnerUserId(ownerUserId);
        folder.setName(name);
        folder.setPath(parentPath + folderId + "/");
        folder.setDepth(depth);
        folder.setLevel(resolveLevel(request.getLevel(), parent));
        folder.setGroupId(parent == null ? null : parent.getGroupId());
        folder.setSpaceId(parent == null ? null : parent.getSpaceId());
        folder.setCreateBy(ownerUserId);
        folder.setUpdateBy(ownerUserId);
        folderMapper.insert(folder);

        auditLogger.success(OperationLog.ACTION_FOLDER_CREATE, OperationLog.TARGET_FOLDER, folderId,
                Map.of("name", name, "parentId", parentId));
        return FolderVO.of(folder);
    }

    /**
     * 重命名目录（同层不重名）。物化路径基于 ID，改名不影响子孙路径。
     *
     * @param ownerUserId 归属用户 ID
     * @param folderId    目录 ID
     * @param request     重命名请求
     * @return 更新后的目录视图
     */
    @Transactional(rollbackFor = Exception.class)
    public FolderVO rename(Long ownerUserId, Long folderId, RenameRequest request) {
        Folder folder = ownershipGuard.requireOwnedFolder(normalizeFolderId(folderId), ownerUserId);
        String name = request.getName().trim();
        if (!name.equals(folder.getName()) && folderNameExists(ownerUserId, folder.getParentId(), name, folder.getId())) {
            throw new BusinessException(ErrorCode.FOLDER_NAME_CONFLICT);
        }
        folder.setName(name);
        folder.setUpdateBy(ownerUserId);
        folderMapper.updateById(folder);

        auditLogger.success(OperationLog.ACTION_FOLDER_RENAME, OperationLog.TARGET_FOLDER, folderId,
                Map.of("name", name));
        return FolderVO.of(folder);
    }

    /**
     * 移动目录到目标父目录下。
     *
     * <p>校验顺序：目标归属 → 同层不重名 → 成环 → 深度上限。成环判定用物化路径前缀比对
     * （目标路径以被移动目录路径为前缀，即目标是其自身或子孙），比递归查父链更省往返。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param folderId    被移动目录 ID
     * @param request     移动请求（{@code targetFolderId} 为目标父目录）
     */
    @Transactional(rollbackFor = Exception.class)
    public void move(Long ownerUserId, Long folderId, MoveRequest request) {
        Folder folder = ownershipGuard.requireOwnedFolder(normalizeFolderId(folderId), ownerUserId);
        Folder target = ownershipGuard.requireOwnedFolder(normalizeFolderId(request.getTargetFolderId()), ownerUserId);
        Long targetParentId = parentIdOf(target);
        if (Objects.equals(folder.getParentId(), targetParentId)) {
            return;
        }
        String oldPrefix = normalizePath(folder);
        if (target != null && (target.getId().equals(folder.getId()) || normalizePath(target).startsWith(oldPrefix))) {
            throw new BusinessException(ErrorCode.FOLDER_MOVE_INVALID);
        }
        if (folderNameExists(ownerUserId, targetParentId, folder.getName(), folder.getId())) {
            throw new BusinessException(ErrorCode.FOLDER_NAME_CONFLICT);
        }

        List<Folder> subtree = folderMapper.findSubtree(ownerUserId, oldPrefix);
        int subtreeHeight = subtree.stream()
                .mapToInt(item -> depthOf(item.getDepth()) - depthOf(folder.getDepth()))
                .max()
                .orElse(0);
        int newDepth = depthOf(target == null ? null : target.getDepth()) + 1;
        if (newDepth + subtreeHeight > properties.getMaxFolderDepth()) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "目录层级超过上限 " + properties.getMaxFolderDepth());
        }

        String newPrefix = (target == null ? "/" : normalizePath(target)) + folder.getId() + "/";
        int depthDelta = newDepth - depthOf(folder.getDepth());
        folderMapper.replaceSubtreePath(ownerUserId, oldPrefix, newPrefix, depthDelta);
        // replaceSubtreePath 只重写 path/depth；被移动目录自身的 parent_id 需单独修正
        folderMapper.update(null, Wrappers.<Folder>lambdaUpdate()
                .eq(Folder::getId, folder.getId())
                .eq(Folder::getOwnerUserId, ownerUserId)
                .set(Folder::getParentId, targetParentId)
                .set(Folder::getUpdateBy, ownerUserId));

        auditLogger.success(OperationLog.ACTION_FOLDER_MOVE, OperationLog.TARGET_FOLDER, folderId,
                Map.of("targetFolderId", targetParentId, "descendantCount", Math.max(subtree.size() - 1, 0)));
    }

    /**
     * 删除目录（含子孙）：目录及其子孙目录下的文件进入回收站，目录本身逻辑删除。
     *
     * @param ownerUserId 归属用户 ID
     * @param folderId    目录 ID
     * @return 一并移入回收站的文件数
     */
    @Transactional(rollbackFor = Exception.class)
    public int delete(Long ownerUserId, Long folderId) {
        Folder folder = ownershipGuard.requireOwnedFolder(normalizeFolderId(folderId), ownerUserId);
        List<Folder> subtree = folderMapper.findSubtree(ownerUserId, normalizePath(folder));
        List<Long> folderIds = subtree.stream().map(Folder::getId).toList();

        int recycled = fileNodeMapper.moveFolderItemsToRecycle(ownerUserId, folderIds,
                FileNode.STATUS_RECYCLE, LocalDateTime.now(), ownerUserId);
        folderMapper.delete(Wrappers.<Folder>lambdaQuery()
                .eq(Folder::getOwnerUserId, ownerUserId)
                .in(Folder::getId, folderIds));

        auditLogger.success(OperationLog.ACTION_FOLDER_DELETE, OperationLog.TARGET_FOLDER, folderId,
                Map.of("name", folder.getName(), "folderCount", folderIds.size(), "recycledFileCount", recycled));
        return recycled;
    }

    /**
     * 组装当前用户的完整目录树（仅未删除目录），根为 {@code parent_id=0} 的顶层目录。
     *
     * <p>按 depth 升序处理保证「父先于子」被实例化；父目录缺失（数据漂移）时按顶层处理，
     * 避免整棵树因一条脏数据而丢节点。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @return 顶层目录列表（children 递归嵌套，空数组而非 null）
     */
    @Transactional(readOnly = true)
    public List<FolderVO> tree(Long ownerUserId) {
        List<Folder> folders = folderMapper.selectList(Wrappers.<Folder>lambdaQuery()
                .eq(Folder::getOwnerUserId, ownerUserId)
                .orderByAsc(Folder::getDepth)
                .orderByAsc(Folder::getName));

        Map<Long, FolderVO> byId = new LinkedHashMap<>();
        for (Folder folder : folders) {
            byId.put(folder.getId(), FolderVO.of(folder));
        }
        List<FolderVO> roots = new ArrayList<>();
        for (Folder folder : folders) {
            FolderVO vo = byId.get(folder.getId());
            FolderVO parent = folder.getParentId() == null ? null : byId.get(folder.getParentId());
            if (parent == null) {
                roots.add(vo);
            } else {
                parent.getChildren().add(vo);
            }
        }
        return roots;
    }

    /** 同层目录重名判定（{@code excludeId} 用于改名时排除自身）。 */
    private boolean folderNameExists(Long ownerUserId, Long parentId, String name, Long excludeId) {
        return folderMapper.selectCount(Wrappers.<Folder>lambdaQuery()
                .eq(Folder::getOwnerUserId, ownerUserId)
                .eq(Folder::getParentId, parentId)
                .eq(Folder::getName, name)
                .ne(excludeId != null, Folder::getId, excludeId)) > 0;
    }

    private int resolveLevel(Integer requested, Folder parent) {
        if (requested != null) {
            return requested;
        }
        Integer inherited = parent == null ? null : parent.getLevel();
        return inherited == null ? DEFAULT_LEVEL : inherited;
    }

    private static Long normalizeFolderId(Long folderId) {
        return folderId == null ? Folder.ROOT_ID : folderId;
    }

    private static Long parentIdOf(Folder parent) {
        return parent == null ? Folder.ROOT_ID : parent.getId();
    }

    private static int depthOf(Integer depth) {
        return depth == null ? 0 : depth;
    }

    /** 物化路径兜底：正常形如 {@code /1/8/}；脏数据（null / 非法）时回退为「以自身 ID 为路径」。 */
    private static String normalizePath(Folder folder) {
        String path = folder.getPath();
        if (path != null && path.startsWith("/") && path.endsWith("/")) {
            return path;
        }
        return "/" + folder.getId() + "/";
    }
}
