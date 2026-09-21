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

import com.anttransfer.file.model.entity.PackTask;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 打包任务视图对象。
 *
 * <p>任务 ID 为 19 位雪花 ID，须以字符串过线（理由见 {@link FileNodeVO}），
 * 否则前端拿被取整的 ID 轮询任务状态 / 取产物会查不到任务。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class PackTaskVO {

    /** 任务 ID */
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    /** 任务编号（对外展示 / 排障用） */
    private String taskNo;

    /** 状态：0-排队中 1-打包中 2-已完成 3-失败 4-已过期 */
    private Integer status;

    /** 文件数 */
    private Integer fileCount;

    /** 合计字节数 */
    private Long totalBytes;

    /** 任务级限速（字节/秒，空=不限） */
    private Long speedLimit;

    /** 产物文件名 */
    private String productName;

    /** 产物字节数 */
    private Long productSize;

    /** 产物过期时间 */
    private LocalDateTime expireTime;

    /** 完成时间 */
    private LocalDateTime finishTime;

    /** 失败原因（仅失败态非空） */
    private String errorMsg;

    /** 创建时间 */
    private LocalDateTime createTime;

    /**
     * 由实体转换。
     */
    public static PackTaskVO of(PackTask task) {
        PackTaskVO vo = new PackTaskVO();
        vo.setId(task.getId());
        vo.setTaskNo(task.getTaskNo());
        vo.setStatus(task.getStatus());
        vo.setFileCount(task.getFileCount());
        vo.setTotalBytes(task.getTotalBytes());
        vo.setSpeedLimit(task.getSpeedLimit());
        vo.setProductName(task.getProductName());
        vo.setProductSize(task.getProductSize());
        vo.setExpireTime(task.getExpireTime());
        vo.setFinishTime(task.getFinishTime());
        vo.setErrorMsg(task.getErrorMsg());
        vo.setCreateTime(task.getCreateTime());
        return vo;
    }
}
