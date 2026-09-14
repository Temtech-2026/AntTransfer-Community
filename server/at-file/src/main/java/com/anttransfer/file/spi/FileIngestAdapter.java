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
package com.anttransfer.file.spi;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.file.FileIngestCommand;
import com.anttransfer.common.file.FileIngestPort;
import com.anttransfer.common.file.FileIngestResult;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.model.dto.InstantUploadRequest;
import com.anttransfer.file.model.vo.UploadResultVO;
import com.anttransfer.file.service.FileContentService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.Optional;

/**
 * {@link FileIngestPort} 的 at-file 侧实现：把「登记一份内容」适配到既有上传链路。
 *
 * <p>本适配器<b>只做参数翻译，不复制任何规则</b>——内容寻址落盘、引用计数、
 * 密级继承、上传审计（含传输量口径）全部由 {@link FileContentService} 承担，
 * 因此分片上传与直传落在同一套规则上，不会出现两套行为。</p>
 *
 * @author AntTransfer CE
 */
@Component
@RequiredArgsConstructor
public class FileIngestAdapter implements FileIngestPort {

    private final FileContentService fileContentService;

    @Override
    public Optional<FileIngestResult> tryInstant(FileIngestCommand command) {
        InstantUploadRequest request = new InstantUploadRequest();
        request.setName(command.fileName());
        request.setSha256(command.sha256());
        request.setSizeBytes(command.sizeBytes());
        if (command.folderId() != null) {
            request.setFolderId(command.folderId());
        }
        request.setLevel(command.level());
        try {
            UploadResultVO result = fileContentService.instantUpload(command.ownerUserId(), request);
            return Optional.of(new FileIngestResult(result.getFileId(), result.getNodeId(), true));
        } catch (BusinessException e) {
            // 未命中是「预期分支」而非异常：转成 empty 交由调用方走分片上传，不向上抛
            if (e.getErrorCode() == ErrorCode.INSTANT_UPLOAD_MISS) {
                return Optional.empty();
            }
            throw e;
        }
    }

    @Override
    public FileIngestResult ingest(FileIngestCommand command, InputStream content) {
        UploadResultVO result = fileContentService.upload(
                command.ownerUserId(), command.fileName(), command.folderId(), command.level(),
                command.contentType(), command.sha256(), command.sizeBytes(), content);
        return new FileIngestResult(result.getFileId(), result.getNodeId(), result.isInstant());
    }
}
