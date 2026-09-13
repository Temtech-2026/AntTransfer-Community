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

import com.anttransfer.common.permission.RequiresPerm;
import com.anttransfer.common.result.Result;
import com.anttransfer.file.model.dto.CreateFolderRequest;
import com.anttransfer.file.model.dto.MoveRequest;
import com.anttransfer.file.model.dto.RenameRequest;
import com.anttransfer.file.model.vo.FolderVO;
import com.anttransfer.file.security.CurrentUserContext;
import com.anttransfer.file.service.FolderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 目录树接口（L1 层：只做参数绑定、权限声明与响应包装，业务全部在 {@link FolderService}）。
 *
 * <p>权限口径：浏览目录属读操作（{@code file:preview}）；建 / 改 / 移 / 删目录属编辑操作
 * （{@code file:edit}）——删目录只是把文件请进回收站，不销毁物理文件，故不要求 {@code file:destroy}。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/folders")
@RequiredArgsConstructor
public class FolderController {

    private final FolderService folderService;

    /**
     * 获取当前用户完整目录树。
     *
     * @return 顶层目录列表（children 递归嵌套）
     */
    @GetMapping("/tree")
    @RequiresPerm("file:preview")
    public Result<List<FolderVO>> tree() {
        return Result.ok(folderService.tree(CurrentUserContext.currentUserId()));
    }

    /**
     * 新建目录。
     *
     * @param request 新建请求
     * @return 新建目录
     */
    @PostMapping
    @RequiresPerm("file:edit")
    public Result<FolderVO> create(@Valid @RequestBody CreateFolderRequest request) {
        return Result.ok(folderService.create(CurrentUserContext.currentUserId(), request));
    }

    /**
     * 重命名目录。
     *
     * @param folderId 目录 ID
     * @param request  重命名请求
     * @return 更新后的目录
     */
    @PatchMapping("/{folderId}/rename")
    @RequiresPerm("file:edit")
    public Result<FolderVO> rename(@PathVariable Long folderId, @Valid @RequestBody RenameRequest request) {
        return Result.ok(folderService.rename(CurrentUserContext.currentUserId(), folderId, request));
    }

    /**
     * 移动目录。
     *
     * @param folderId 目录 ID
     * @param request  移动请求
     * @return 空响应
     */
    @PatchMapping("/{folderId}/move")
    @RequiresPerm("file:edit")
    public Result<Void> move(@PathVariable Long folderId, @Valid @RequestBody MoveRequest request) {
        folderService.move(CurrentUserContext.currentUserId(), folderId, request);
        return Result.ok();
    }

    /**
     * 删除目录（含子孙目录，目录内文件进入回收站）。
     *
     * @param folderId 目录 ID
     * @return 一并移入回收站的文件数
     */
    @DeleteMapping("/{folderId}")
    @RequiresPerm("file:edit")
    public Result<Integer> delete(@PathVariable Long folderId) {
        return Result.ok(folderService.delete(CurrentUserContext.currentUserId(), folderId));
    }
}
