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
package com.anttransfer.transfer.repository;

import com.anttransfer.transfer.model.entity.TransferTask;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 分片上传任务 Mapper。
 *
 * @author AntTransfer CE
 */
@Mapper
public interface TransferTaskMapper extends BaseMapper<TransferTask> {

    /**
     * 行级锁定读取任务，用于「已收分片索引」的并发安全累加。
     *
     * <p>客户端会并发补传多个分片，{@code uploaded_indexes} 是「读—改—写」语义，
     * 必须用 {@code FOR UPDATE} 串行化；否则后写的索引集会覆盖前一个
     * （表现为进度倒退、续传时反复重传同一批分片）。</p>
     *
     * @param id 任务 ID（=uploadId）
     * @return 任务；不存在返回 {@code null}
     */
    @Select("select * from sys_upload_task where id = #{id} and deleted = 0 for update")
    TransferTask selectForUpdate(@Param("id") Long id);
}
