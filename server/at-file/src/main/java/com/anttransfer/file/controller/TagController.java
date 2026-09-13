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
import com.anttransfer.file.model.dto.AssignTagsRequest;
import com.anttransfer.file.model.dto.TagRequest;
import com.anttransfer.file.model.vo.TagVO;
import com.anttransfer.file.security.CurrentUserContext;
import com.anttransfer.file.service.TagService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 标签接口（L1 层：参数绑定 + 权限声明 + 响应包装）。
 *
 * <p>权限口径：标签是文件管理的一部分，读用 {@code file:preview}、写用 {@code file:edit}——
 * 不另立 {@code tag:*} 权限点，避免「能改文件却不能改标签」这类割裂。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    /**
     * 标签列表（附关联文件数）。
     *
     * @return 标签列表
     */
    @GetMapping("/tags")
    @RequiresPerm("file:preview")
    public Result<List<TagVO>> list() {
        return Result.ok(tagService.list(CurrentUserContext.currentUserId()));
    }

    /**
     * 创建标签。
     *
     * @param request 创建请求
     * @return 新建标签
     */
    @PostMapping("/tags")
    @RequiresPerm("file:edit")
    public Result<TagVO> create(@Valid @RequestBody TagRequest request) {
        return Result.ok(tagService.create(CurrentUserContext.currentUserId(), request));
    }

    /**
     * 更新标签。
     *
     * @param tagId   标签 ID
     * @param request 更新请求
     * @return 更新后的标签
     */
    @PutMapping("/tags/{tagId}")
    @RequiresPerm("file:edit")
    public Result<TagVO> update(@PathVariable Long tagId, @Valid @RequestBody TagRequest request) {
        return Result.ok(tagService.update(CurrentUserContext.currentUserId(), tagId, request));
    }

    /**
     * 删除标签（连带清理其全部文件关联）。
     *
     * @param tagId 标签 ID
     * @return 空响应
     */
    @DeleteMapping("/tags/{tagId}")
    @RequiresPerm("file:edit")
    public Result<Void> delete(@PathVariable Long tagId) {
        tagService.delete(CurrentUserContext.currentUserId(), tagId);
        return Result.ok();
    }

    /**
     * 查询某文件当前标签。
     *
     * @param nodeId 条目 ID
     * @return 标签列表
     */
    @GetMapping("/files/{nodeId}/tags")
    @RequiresPerm("file:preview")
    public Result<List<TagVO>> nodeTags(@PathVariable Long nodeId) {
        return Result.ok(tagService.nodeTags(CurrentUserContext.currentUserId(), nodeId));
    }

    /**
     * 设置文件标签（全量覆盖，传空数组即清空）。
     *
     * @param nodeId  条目 ID
     * @param request 打标请求
     * @return 覆盖后的标签列表
     */
    @PutMapping("/files/{nodeId}/tags")
    @RequiresPerm("file:edit")
    public Result<List<TagVO>> assign(@PathVariable Long nodeId, @Valid @RequestBody AssignTagsRequest request) {
        return Result.ok(tagService.assign(CurrentUserContext.currentUserId(), nodeId, request));
    }
}
