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

import com.anttransfer.file.model.entity.FileNode;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 文件条目视图对象（列表 / 回收站 / 详情共用）。
 *
 * <p><b>ID 一律以字符串过线</b>：条目 ID / 物理文件 ID / 目录 ID 均为 19 位雪花 ID，
 * 超出 JS {@code Number.MAX_SAFE_INTEGER}（2^53-1）。若按 JSON number 下发，浏览器解析时
 * 末位会被静默取整，前端再拿它拼 {@code /v1/files/{nodeId}/preview}、{@code /ticket}
 * 等路径就查不到节点（表现为「列表能看到、预览下载却失败」）。
 * 上传域（{@code PrecheckResultVO} / {@code MergeResultVO}）已按同一口径处理，此处对齐。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class FileNodeVO {

    /** 条目 ID（用户侧「文件 ID」即此值，非物理文件 ID） */
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    /** 物理文件 ID（秒传 / 去重排查用，不对外承担业务语义） */
    @JsonSerialize(using = ToStringSerializer.class)
    private Long fileId;

    /** 所在目录 ID（0=根） */
    @JsonSerialize(using = ToStringSerializer.class)
    private Long folderId;

    /** 文件名 */
    private String name;

    /** 扩展名（小写无点） */
    private String ext;

    /** MIME 类型 */
    private String contentType;

    /** 字节数 */
    private Long sizeBytes;

    /** 内容 SHA-256 */
    private String sha256;

    /** 密级 */
    private Integer level;

    /** 当前版本号 */
    private Integer versionNo;

    /** 状态：0-正常 1-回收站 */
    private Integer status;

    /** 移入回收站时间（正常态为 null）；前端据此展示剩余保留天数 */
    private LocalDateTime recycleTime;

    /** 上传人 */
    @JsonSerialize(using = ToStringSerializer.class)
    private Long uploadUserId;

    /** 创建时间 */
    private LocalDateTime createTime;

    /** 最近更新时间 */
    private LocalDateTime updateTime;

    /** 标签列表（空数组而非 null） */
    private List<TagVO> tags = new ArrayList<>();

    /**
     * 由实体转换（不含标签）。
     */
    public static FileNodeVO of(FileNode node) {
        FileNodeVO vo = new FileNodeVO();
        vo.setId(node.getId());
        vo.setFileId(node.getFileId());
        vo.setFolderId(node.getFolderId());
        vo.setName(node.getName());
        vo.setExt(node.getExt());
        vo.setContentType(node.getContentType());
        vo.setSizeBytes(node.getSizeBytes());
        vo.setSha256(node.getSha256());
        vo.setLevel(node.getLevel());
        vo.setVersionNo(node.getVersionNo());
        vo.setStatus(node.getStatus());
        vo.setRecycleTime(node.getRecycleTime());
        vo.setUploadUserId(node.getUploadUserId());
        vo.setCreateTime(node.getCreateTime());
        vo.setUpdateTime(node.getUpdateTime());
        return vo;
    }
}
