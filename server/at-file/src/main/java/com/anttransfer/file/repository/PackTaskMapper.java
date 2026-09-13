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
package com.anttransfer.file.repository;

import com.anttransfer.file.model.entity.PackTask;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 打包任务 Mapper：并发准入、过期扫描、状态 CAS。
 *
 * @author AntTransfer CE
 */
@Mapper
public interface PackTaskMapper extends BaseMapper<PackTask> {

    /**
     * 统计用户进行中（排队 + 打包中）的任务数，用于并发上限准入判定。
     *
     * @param userId 用户 ID
     * @return 进行中任务数
     */
    @Select("""
            select count(1)
            from sys_pack_task
            where user_id = #{userId}
              and status in (0, 1)
              and deleted = 0
            """)
    long countActive(@Param("userId") Long userId);

    /**
     * 扫描一批已到期的已完成产物（供定时清理）。
     *
     * @param limit 单批上限
     * @return 到期任务
     */
    @Select("""
            select *
            from sys_pack_task
            where status = 2
              and deleted = 0
              and expire_time is not null
              and expire_time < now()
            order by expire_time
            limit #{limit}
            """)
    List<PackTask> findExpiredProducts(@Param("limit") int limit);

    /**
     * 扫描长时间停留在「排队中 / 打包中」的僵尸任务（供定时清理判失败）。
     *
     * <p><b>为什么需要它：</b>打包靠进程内线程池执行。若提交时线程池已满、或进程恰好在执行前重启，
     * 任务行会永远停在 {@code status=0}——既不会过期（过期清理只扫 {@code status=2}），
     * 也不会结束，还会一直占着「每用户并发上限」的名额，最终把该用户彻底堵死。</p>
     *
     * @param cutoff 判定阈值：{@code update_time} 早于该时刻即视为僵尸
     * @param limit  单批上限
     * @return 僵尸任务
     */
    @Select("""
            select *
            from sys_pack_task
            where status in (0, 1)
              and deleted = 0
              and update_time < #{cutoff}
            order by id
            limit #{limit}
            """)
    List<PackTask> findStaleActive(@Param("cutoff") LocalDateTime cutoff, @Param("limit") int limit);

    /**
     * 状态 CAS 迁移：仅当当前状态等于 {@code from} 时才推进到 {@code to}。
     *
     * <p>存在的意义是挡住两类并发：① 清理任务把「刚刚完成」的任务改成已过期；
     * ② 用户重复点「重新打包」导致同一任务被两个线程同时跑。若不用 CAS，
     * 后写者会静默覆盖前者的产物路径，磁盘上留下孤儿文件。</p>
     *
     * @return 影响行数（1=迁移成功；0=状态已被他人改变，调用方应放弃本次操作）
     */
    @Update("""
            update sys_pack_task
            set status = #{to},
                update_time = now()
            where id = #{id}
              and status = #{from}
              and deleted = 0
            """)
    int casStatus(@Param("id") Long id,
                  @Param("from") int from,
                  @Param("to") int to);

    /**
     * 标记任务完成并落产物信息（同样是 CAS：只有「打包中」的任务才能被标记完成）。
     *
     * @param id           任务 ID
     * @param productName  产物文件名
     * @param productPath  产物相对路径
     * @param productSize  产物字节数
     * @param expireTime   产物过期时间
     * @return 影响行数（0=任务已被清理 / 取消，产物应删除而不是留在磁盘）
     */
    @Update("""
            update sys_pack_task
            set status = 2,
                product_name = #{productName},
                product_path = #{productPath},
                product_size = #{productSize},
                expire_time = #{expireTime},
                finish_time = now(),
                update_time = now()
            where id = #{id}
              and status = 1
              and deleted = 0
            """)
    int markDone(@Param("id") Long id,
                 @Param("productName") String productName,
                 @Param("productPath") String productPath,
                 @Param("productSize") Long productSize,
                 @Param("expireTime") LocalDateTime expireTime);

    /**
     * 标记任务失败并记录原因（排队 / 打包中均可转失败）。
     *
     * @return 影响行数
     */
    @Update("""
            update sys_pack_task
            set status = 3,
                error_msg = #{errorMsg},
                finish_time = now(),
                update_time = now()
            where id = #{id}
              and status in (0, 1)
              and deleted = 0
            """)
    int markFailed(@Param("id") Long id, @Param("errorMsg") String errorMsg);

    /**
     * 标记产物已过期并清空产物路径（产物文件由调用方删除）。
     *
     * @return 影响行数
     */
    @Update("""
            update sys_pack_task
            set status = 4,
                product_path = null,
                update_time = now()
            where id = #{id}
              and status = 2
              and deleted = 0
            """)
    int markExpired(@Param("id") Long id);
}
