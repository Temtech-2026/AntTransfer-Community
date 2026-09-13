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
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.Result;
import com.anttransfer.file.model.vo.FileVersionVO;
import com.anttransfer.file.security.CurrentUserContext;
import com.anttransfer.file.service.FileContentService;
import com.anttransfer.file.service.FileVersionService;
import com.anttransfer.file.util.FileHashUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * 历史版本接口（P1）。
 *
 * <p>统一走 {@code file:version} 权限点：版本是文件能力的子集，单独授权才能让「可下载但不可改版」
 * 这类角色配置成为可能，同时又不与 {@code file:edit} 混淆（改元数据 ≠ 换内容）。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/files/{nodeId}/versions")
@RequiredArgsConstructor
public class FileVersionController {

    private final FileVersionService fileVersionService;
    private final FileContentService fileContentService;

    /**
     * 近 N 版列表（新→旧，含当前版本标记）。
     *
     * @param nodeId 条目 ID
     * @return 版本列表
     */
    @GetMapping
    @RequiresPerm("file:version")
    public Result<List<FileVersionVO>> list(@PathVariable Long nodeId) {
        return Result.ok(fileVersionService.list(CurrentUserContext.currentUserId(), nodeId));
    }

    /**
     * 上传新版本（multipart）。
     *
     * <p>指纹在这里由服务端现算，不接受客户端上报——与上传主链路同一原则（见 {@link FileHashUtils}）。</p>
     *
     * @param nodeId 条目 ID
     * @param file   新版本内容
     * @param remark 版本备注（可空）
     * @return 新版本视图
     */
    @PostMapping
    @RequiresPerm("file:version")
    public Result<FileVersionVO> create(@PathVariable Long nodeId,
                                        @RequestParam("file") MultipartFile file,
                                        @RequestParam(value = "remark", required = false) String remark) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "新版本内容不能为空");
        }
        String sha256 = FileHashUtils.sha256Hex(file);
        try {
            return Result.ok(fileContentService.uploadNewVersion(CurrentUserContext.currentUserId(), nodeId,
                    file.getContentType(), sha256, file.getSize(), file.getInputStream(), remark));
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL, "读取上传文件失败");
        }
    }

    /**
     * 回滚到指定历史版本（产生一个内容等于旧版本的新版本）。
     *
     * @param nodeId    条目 ID
     * @param versionNo 目标版本号
     * @return 回滚后产生的新版本视图
     */
    @PostMapping("/{versionNo}/rollback")
    @RequiresPerm("file:version")
    public Result<FileVersionVO> rollback(@PathVariable Long nodeId, @PathVariable Integer versionNo) {
        return Result.ok(fileVersionService.rollback(CurrentUserContext.currentUserId(), nodeId, versionNo));
    }
}
