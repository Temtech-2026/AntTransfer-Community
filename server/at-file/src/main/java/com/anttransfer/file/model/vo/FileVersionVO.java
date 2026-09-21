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
package com.anttransfer.file.model.vo;

import com.anttransfer.file.model.entity.FileVersion;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 文件历史版本视图对象。
 *
 * <p>版本记录 ID / 上传人 ID 为 19 位雪花 ID，须以字符串过线（理由见 {@link FileNodeVO}）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class FileVersionVO {

    /** 版本记录 ID */
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    /** 版本号（同一文件内递增） */
    private Integer versionNo;

    /** 该版本文件名（重命名留痕） */
    private String name;

    /** 该版本字节数 */
    private Long sizeBytes;

    /** 该版本内容 SHA-256 */
    private String sha256;

    /** 版本备注 */
    private String remark;

    /** 该版本上传 / 产生人 */
    @JsonSerialize(using = ToStringSerializer.class)
    private Long uploadUserId;

    /** 版本产生时间 */
    private LocalDateTime createTime;

    /** 是否为当前生效版本（前端据此禁用「回滚到本版」）。 */
    private boolean current;

    /**
     * 由实体转换。
     *
     * @param version     版本实体
     * @param currentNode 条目当前版本号
     */
    public static FileVersionVO of(FileVersion version, Integer currentNode) {
        FileVersionVO vo = new FileVersionVO();
        vo.setId(version.getId());
        vo.setVersionNo(version.getVersionNo());
        vo.setName(version.getName());
        vo.setSizeBytes(version.getSizeBytes());
        vo.setSha256(version.getSha256());
        vo.setRemark(version.getRemark());
        vo.setUploadUserId(version.getUploadUserId());
        vo.setCreateTime(version.getCreateTime());
        vo.setCurrent(version.getVersionNo() != null && version.getVersionNo().equals(currentNode));
        return vo;
    }
}
