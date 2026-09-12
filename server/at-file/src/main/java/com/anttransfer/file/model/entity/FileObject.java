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
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 文件元数据实体（骨架）。
 *
 * <p>职责：映射 {@code sys_file} 表，记录文件的元信息与存储位置
 * （不存放文件字节本身，字节内容位于 storageType 指向的存储后端）。
 * 继承 {@link BaseEntity} 自动获得公共字段。</p>
 *
 * <p>秒传设计：上传前先提交 sha256 摘要，命中相同摘要直接复用既有文件并快速返回 fileId；
 * 分片 / 断点续传可依赖 fileId + 分片号推进（分片清单后续在子表扩展）。</p>
 *
 * @author AntTransfer CE
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_file")
public class FileObject extends BaseEntity {

    /** 原始文件名（含扩展名，用于下载时回显） */
    @TableField("original_name")
    private String originalName;

    /** 存储类型：1-本地磁盘 2-对象存储（S3/OSS/COS）（骨架 Integer，可升级为枚举映射） */
    @TableField("storage_type")
    private Integer storageType;

    /** 桶 / 存储空间名称（对象存储场景） */
    @TableField("bucket_name")
    private String bucketName;

    /** 对象键（对象存储场景，如 uploads/2026/09/xx.bin） */
    @TableField("object_key")
    private String objectKey;

    /** 本地存储相对路径（本地磁盘场景） */
    @TableField("storage_path")
    private String storagePath;

    /** 对外访问 URL（可选，存储后端直链） */
    @TableField("url")
    private String url;

    /** 文件 MIME 类型 */
    @TableField("content_type")
    private String contentType;

    /** 文件大小（字节） */
    @TableField("size_bytes")
    private Long sizeBytes;

    /** 文件内容 SHA-256（秒传去重依据，建议全小写 hex） */
    @TableField("sha256")
    private String sha256;

    /** 上传人用户 ID（来自 at-auth 的登录上下文） */
    @TableField("upload_user_id")
    private Long uploadUserId;

    /** 文件状态：0-已上传可用 1-上传中 2-不可用/已下线（与 sql/V1__schema.sql 对齐；
     * 删除语义统一走 deleted 逻辑删除，不用 status 表达） */
    @TableField("status")
    private Integer status;
}
