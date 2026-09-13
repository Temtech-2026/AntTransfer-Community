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

import com.anttransfer.file.model.entity.FileNode;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * 文件引用条目 Mapper。
 *
 * <p>列表筛选 / 排序这类「条件组合爆炸」的查询留在 Service 用 QueryWrapper 构造
 * （列名不落字符串，天然免注入）；本接口只收「写法固定但必须原子」的几条：
 * 到期扫描、级联状态迁移、引用统计。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface FileNodeMapper extends BaseMapper<FileNode> {

    /**
     * 扫描一批已过保留期的回收站条目（供定时清理物理回收）。
     *
     * <p>走 {@code idx_owner_recycle(owner_user_id, status, recycle_time)} 的最左前缀不成立，
     * 因为这里刻意<b>不带 owner_user_id</b>——清理是系统级任务，要跨用户扫描；
     * 索引仍可用后两列做范围扫描，配合 {@code limit} 分批，避免一次性锁太多行。</p>
     *
     * @param deadline 保留期截止时刻（{@code now - retentionDays}）
     * @param limit    单批上限
     * @return 到期条目（按进入回收站时间正序，先到期的先清）
     */
    @Select("""
            select *
            from sys_file_node
            where status = 1
              and deleted = 0
              and recycle_time is not null
              and recycle_time < #{deadline}
            order by recycle_time
            limit #{limit}
            """)
    List<FileNode> findExpiredRecycle(@Param("deadline") LocalDateTime deadline,
                                      @Param("limit") int limit);

    /**
     * 统计指向某物理文件的<b>未彻底销毁</b>引用条目数（正常 + 回收站都算）。
     *
     * <p>用于清理前的复核：只有该值确实为 0 且 {@code sys_file.ref_count} 也为 0 时才回收物理数据。
     * 两个计数分别来自「引用表实际行数」与「物理表自增计数」，交叉验证可以暴露计数漂移
     * （例如某次异常导致某条路径没减计数），避免误删仍被引用的内容。</p>
     *
     * @param fileId 物理文件 ID
     * @return 未销毁引用数
     */
    @Select("select count(1) from sys_file_node where file_id = #{fileId} and deleted = 0")
    long countLiveRefs(@Param("fileId") Long fileId);

    /**
     * 查询该用户是否已存在同一内容的未删除条目（用于秒传的「本用户视角」命中判定）。
     *
     * @param ownerUserId 归属用户 ID
     * @param sha256      内容 SHA-256
     * @param sizeBytes   文件字节数
     * @return 命中的条目；无则返回 null
     */
    @Select("""
            select *
            from sys_file_node
            where owner_user_id = #{ownerUserId}
              and sha256 = #{sha256}
              and size_bytes = #{sizeBytes}
              and deleted = 0
            limit 1
            """)
    FileNode findByOwnerContent(@Param("ownerUserId") Long ownerUserId,
                                @Param("sha256") String sha256,
                                @Param("sizeBytes") Long sizeBytes);

    /**
     * 批量把指定目录下的全部未删除条目（含回收站条目）置为指定状态。
     *
     * <p>删除目录时用它把子孙目录里的文件一并请进回收站；{@code deleted} 不在此处置位
     * ——这正是「删除目录 ≠ 销毁文件」的落点：文件仍可还原，只是暂时失去目录归属。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param folderIds   目录 ID 集合（非空）
     * @param status      目标状态（1=回收站）
     * @param recycleTime 入站时间
     * @param recycleBy   操作人
     * @return 影响行数
     */
    @Update("""
            <script>
            update sys_file_node
            set status = #{status},
                recycle_time = #{recycleTime},
                recycle_by = #{recycleBy},
                update_time = now()
            where owner_user_id = #{ownerUserId}
              and deleted = 0
              and status = 0
              and folder_id in
              <foreach collection="folderIds" item="fid" open="(" separator="," close=")">#{fid}</foreach>
            </script>
            """)
    int moveFolderItemsToRecycle(@Param("ownerUserId") Long ownerUserId,
                                 @Param("folderIds") Collection<Long> folderIds,
                                 @Param("status") int status,
                                 @Param("recycleTime") LocalDateTime recycleTime,
                                 @Param("recycleBy") Long recycleBy);

    /**
     * 统计指定目录集合下仍在正常态的文件数（删除目录前的「是否为空」提示）。
     *
     * @param ownerUserId 归属用户 ID
     * @param folderIds   目录 ID 集合（非空）
     * @return 文件数
     */
    @Select("""
            <script>
            select count(1)
            from sys_file_node
            where owner_user_id = #{ownerUserId}
              and deleted = 0
              and status = 0
              and folder_id in
              <foreach collection="folderIds" item="fid" open="(" separator="," close=")">#{fid}</foreach>
            </script>
            """)
    long countActiveInFolders(@Param("ownerUserId") Long ownerUserId,
                              @Param("folderIds") Collection<Long> folderIds);
}
