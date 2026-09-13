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
package com.anttransfer.file.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

/**
 * 文件历史版本（映射 {@code sys_file_version}，见 sql/V6__file_management.sql）。
 *
 * <p><b>只追加，不覆盖：</b>回滚到旧版本不是「删掉新版本再改指针」，而是把目标版本的
 * {@code fileId} 复制成一条更高的 {@code versionNo}——与 PRD US-13「回滚生成新版本」一致。
 * 这样「谁在什么时候把文件回滚到了哪一版」永久可查；反过来说，回滚本身也会产生新版本，
 * 因此不存在「回滚后历史被抹掉」的情况。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_file_version")
public class FileVersion extends BaseEntity {

    /** 引用条目 ID（逻辑关联 {@code sys_file_node.id}） */
    @TableField("node_id")
    private Long nodeId;

    /** 该版本的物理文件 ID（逻辑关联 {@code sys_file.id}） */
    @TableField("file_id")
    private Long fileId;

    /** 版本号（同一 node 内递增，从 1 开始） */
    @TableField("version_no")
    private Integer versionNo;

    /** 该版本的文件名（重命名前留痕） */
    @TableField("name")
    private String name;

    /** 文件字节数（快照） */
    @TableField("size_bytes")
    private Long sizeBytes;

    /** 内容 SHA-256（快照，用于版本比对） */
    @TableField("sha256")
    private String sha256;

    /** 版本备注（如「回滚到初版」） */
    @TableField("remark")
    private String remark;

    /** 该版本上传 / 产生人（回滚场景为操作人） */
    @TableField("upload_user_id")
    private Long uploadUserId;
}
