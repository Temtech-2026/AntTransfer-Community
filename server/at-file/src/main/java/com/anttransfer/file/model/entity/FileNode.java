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

import java.time.LocalDateTime;

/**
 * 文件引用条目（映射 {@code sys_file_node}，见 sql/V6__file_management.sql）。
 *
 * <p><b>为什么与 {@link FileObject} 分成两张表：</b>{@code sys_file} 是物理层（一个 sha256 一行，
 * 内容去重），本类才是「用户可见的一个文件」。名字、目录、敏感级别、回收站状态都按引用独立——
 * 两个用户上传同一份内容时，物理层只有一行、引用层有两行，各自改名互不影响。</p>
 *
 * <p><b>{@code status} 与 {@code deleted} 不是一回事：</b>{@code status=1} 是回收站（可还原，
 * 物理文件仍在），{@code deleted=1} 是彻底销毁 / 到期清理（物理文件已被回收）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_file_node")
public class FileNode extends BaseEntity {

    /** 条目状态：正常 */
    public static final int STATUS_NORMAL = 0;

    /** 条目状态：回收站（可还原） */
    public static final int STATUS_RECYCLE = 1;

    /** 物理文件 ID（逻辑关联 {@code sys_file.id}） */
    @TableField("file_id")
    private Long fileId;

    /** 归属用户 ID——防水平越权的唯一依据，所有查询必须带此条件 */
    @TableField("owner_user_id")
    private Long ownerUserId;

    /** 所在目录 ID（0=根目录） */
    @TableField("folder_id")
    private Long folderId;

    /** 文件显示名（重命名只影响本引用） */
    @TableField("name")
    private String name;

    /** 扩展名（小写无点；用于类型筛选与预览 / 缩略图判定） */
    @TableField("ext")
    private String ext;

    /** MIME 类型（冗余自 sys_file） */
    @TableField("content_type")
    private String contentType;

    /** 文件字节数（冗余自 sys_file，列表免联表） */
    @TableField("size_bytes")
    private Long sizeBytes;

    /** 内容 SHA-256（冗余自 sys_file） */
    @TableField("sha256")
    private String sha256;

    /** 敏感级别：1-低 2-中 3-高（按引用独立，可高于物理文件默认级别） */
    @TableField("level")
    private Integer level;

    /** 当前版本号（回滚生成新版本号而非覆盖） */
    @TableField("version_no")
    private Integer versionNo;

    /** 条目状态：0-正常 1-回收站 */
    @TableField("status")
    private Integer status;

    /** 移入回收站时间（保留期计时起点） */
    @TableField("recycle_time")
    private LocalDateTime recycleTime;

    /** 执行删除的用户 ID（回收站回显） */
    @TableField("recycle_by")
    private Long recycleBy;

    /** 上传人用户 ID（搜索「上传者」依据，可与 owner 不同） */
    @TableField("upload_user_id")
    private Long uploadUserId;

    /** 归属项目 / 群组 ID（null=个人文件） */
    @TableField("group_id")
    private Long groupId;

    /** 归属协作空间 ID（预留，null=个人文件） */
    @TableField("space_id")
    private Long spaceId;

    /** 是否在回收站中 */
    public boolean inRecycle() {
        return status != null && status == STATUS_RECYCLE;
    }
}
