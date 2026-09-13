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
package com.anttransfer.file.security;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.file.model.entity.Folder;
import com.anttransfer.file.repository.FileNodeMapper;
import com.anttransfer.file.repository.FolderMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.LinkedHashMap;
import java.util.stream.Collectors;

/**
 * 数据归属校验：文件管理的每一处读写都必须先过这里，防水平越权（用户 A 凭猜测 ID 操作 B 的文件）。
 *
 * <p><b>刻意的设计：越权一律回答「不存在」。</b>若对「不是你的文件」返回 403、对「不存在」
 * 返回 404，攻击者就能靠状态码差异把资源 ID 空间扫一遍——这是典型的<b>存在性泄露</b>。
 * 所以本类只可能抛 {@code 4005 FILE_NOT_FOUND} / {@code 4013 FOLDER_NOT_FOUND}，
 * 让「不存在」与「无权限」在响应上完全不可区分。</p>
 *
 * <p><b>为什么单独抽一类而不是散在各 Service：</b>归属条件是安全边界。散落各处时，
 * 只要有一处漏写（例如某个新加的按标签查询忘了带 owner_user_id），就形成一条越权通道，
 * 且 code review 时极难发现。集中后至少保证「所有入口都点名了它」。</p>
 *
 * <p><b>它不替代 RBAC：</b>与 {@code @RequiresPerm} 是「与」关系——权限点回答「这类操作他能不能做」，
 * 本类回答「这个具体资源是不是他的」。</p>
 *
 * @author AntTransfer CE
 */
@Component
@RequiredArgsConstructor
public class FileOwnershipGuard {

    private final FileNodeMapper fileNodeMapper;
    private final FolderMapper folderMapper;

    /** 当前登录用户 ID；未登录即抛 {@code 1001}（由 at-gateway 统一转 401）。 */
    public Long currentUserId() {
        return CurrentUserContext.currentUserId();
    }

    /**
     * 加载并校验文件条目归属（使用当前登录用户）。
     *
     * @param nodeId 引用条目 ID
     * @return 归属校验通过的条目
     * @throws BusinessException 条目不存在或不属于当前用户（均为 4005）
     */
    public FileNode requireOwnedNode(Long nodeId) {
        return requireOwnedNode(nodeId, currentUserId());
    }

    /**
     * 加载并校验文件条目归属。
     *
     * @param nodeId      引用条目 ID
     * @param ownerUserId 期望的归属用户 ID
     * @return 归属校验通过的条目
     * @throws BusinessException 条目不存在或归属不符（均为 4005）
     */
    public FileNode requireOwnedNode(Long nodeId, Long ownerUserId) {
        if (nodeId == null) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
        FileNode node = fileNodeMapper.selectById(nodeId);
        if (node == null || !Objects.equals(node.getOwnerUserId(), ownerUserId)) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
        return node;
    }

    /**
     * 批量加载并校验归属（打包下载等一次操作多个文件的场景）。
     *
     * <p>任一条目不合法即<b>整批拒绝</b>：部分成功的打包会让用户拿到一个「缺了几个文件」
     * 的 zip 却毫无提示，比直接失败更糟。返回顺序与入参一致，便于上层按请求顺序建立 zip 条目。</p>
     *
     * @param nodeIds     条目 ID 集合
     * @param ownerUserId 期望归属用户
     * @return 按入参顺序排列的条目列表
     * @throws BusinessException 存在缺失或越权条目（4005）
     */
    public List<FileNode> requireOwnedNodes(Collection<Long> nodeIds, Long ownerUserId) {
        if (nodeIds == null || nodeIds.isEmpty()) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
        Map<Long, FileNode> found = fileNodeMapper.selectBatchIds(nodeIds).stream()
                .filter(n -> Objects.equals(n.getOwnerUserId(), ownerUserId))
                .collect(Collectors.toMap(FileNode::getId, n -> n, (a, b) -> a, LinkedHashMap::new));
        if (found.size() != nodeIds.size()) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
        return nodeIds.stream().map(found::get).toList();
    }

    /**
     * 加载并校验目录归属。
     *
     * @param folderId    目录 ID；{@code 0} 表示根目录，直接放行（根不是实体，无归属可言）
     * @param ownerUserId 期望的归属用户 ID
     * @return 归属校验通过的目录；{@code folderId=0} 时返回 {@code null}
     * @throws BusinessException 目录不存在或归属不符（均为 4013）
     */
    public Folder requireOwnedFolder(Long folderId, Long ownerUserId) {
        if (folderId == null || folderId == Folder.ROOT_ID) {
            return null;
        }
        Folder folder = folderMapper.selectById(folderId);
        if (folder == null || !Objects.equals(folder.getOwnerUserId(), ownerUserId)) {
            throw new BusinessException(ErrorCode.FOLDER_NOT_FOUND);
        }
        return folder;
    }

    /**
     * 校验一组目录是否全部属于指定用户（移动 / 删除时校验目标目录）。
     *
     * @param folderIds   目录 ID 集合（允许含 0，表示根）
     * @param ownerUserId 期望归属用户
     * @throws BusinessException 存在不属于该用户的目录（4013）
     */
    public void requireOwnedFolders(Set<Long> folderIds, Long ownerUserId) {
        if (folderIds == null || folderIds.isEmpty()) {
            return;
        }
        Set<Long> real = folderIds.stream().filter(id -> id != null && id != Folder.ROOT_ID).collect(Collectors.toSet());
        if (real.isEmpty()) {
            return;
        }
        long owned = folderMapper.selectBatchIds(real).stream()
                .filter(f -> Objects.equals(f.getOwnerUserId(), ownerUserId))
                .count();
        if (owned != real.size()) {
            throw new BusinessException(ErrorCode.FOLDER_NOT_FOUND);
        }
    }
}
