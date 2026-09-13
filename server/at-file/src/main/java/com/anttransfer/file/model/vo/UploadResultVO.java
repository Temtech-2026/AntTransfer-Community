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

import lombok.Getter;
import lombok.Setter;

/**
 * 上传 / 秒传结果视图对象。
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class UploadResultVO {

    /** 文件条目 ID。 */
    private Long nodeId;

    /** 物理文件 ID。 */
    private Long fileId;

    /** 文件名。 */
    private String name;

    /** 是否命中秒传（true=未传输字节，仅建引用）。 */
    private boolean instant;

    /** 建引用后的物理文件引用计数（排查去重是否生效）。 */
    private Integer refCount;

    /** 条目版本号。 */
    private Integer versionNo;

    /** 字节数。 */
    private Long sizeBytes;

    /** 内容 SHA-256。 */
    private String sha256;
}
