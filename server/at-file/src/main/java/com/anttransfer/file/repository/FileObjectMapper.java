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

import com.anttransfer.file.model.entity.FileObject;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 物理文件 Mapper：外发分享创建 / 取件需要读文件归属、文件名与存储位置；
 * 文件管理域还需要「按内容寻址 + 引用计数增减 + 归零物理回收」三组操作。
 *
 * <p><b>为什么这里绕开 MyBatis-Plus 的 {@code @TableLogic} 手写 SQL：</b>
 * {@code sys_file} 上有唯一键 {@code uk_sha256_size(sha256, size_bytes)} 且<b>不含 deleted</b>。
 * 若物理回收时沿用逻辑删除，那一行会永久占住唯一键，导致「同一份内容删掉后再上传」
 * 直接撞唯一约束失败——这是把缓存层当成业务表来删的必然代价。故内容寻址相关的读写
 * 一律显式手写：查询要看得到（或刻意看不到）已删行、回收必须是真删除。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface FileObjectMapper extends BaseMapper<FileObject> {

    /**
     * 按内容寻址查物理文件（键：sha256 + size_bytes），<b>忽略逻辑删除标记</b>。
     *
     * <p>走唯一索引 {@code uk_sha256_size}，O(1)。忽略 deleted 是为了兼容「历史遗留的
     * 已逻辑删除行」：先复用其存储位置，避免同一份内容在磁盘上留下两份副本。</p>
     *
     * @param sha256    文件内容 SHA-256（小写 hex）
     * @param sizeBytes 文件字节数
     * @return 命中的物理文件；未命中返回 null
     */
    @Select("""
            select *
            from sys_file
            where sha256 = #{sha256}
              and size_bytes = #{sizeBytes}
            limit 1
            """)
    FileObject findByContent(@Param("sha256") String sha256, @Param("sizeBytes") Long sizeBytes);

    /**
     * 引用计数 +1（秒传命中）。
     *
     * <p>刻意不用「先查再写」：并发上传同一份内容时，两条线程都会命中同一行，
     * 原子自增才能保证计数不丢——这正是引用计数只能靠数据库自增、不能靠应用层累加的原因。</p>
     *
     * @param id 物理文件 ID
     * @return 影响行数（1=成功）
     */
    @Update("update sys_file set ref_count = ref_count + 1, update_time = now() where id = #{id}")
    int increaseRefCount(@Param("id") Long id);

    /**
     * 引用计数 -1（回收站到期清理 / 彻底销毁各调用一次）。
     *
     * <p>带 {@code ref_count > 0} 守卫：计数绝不减成负数——一旦为负，后续「归零判定」就永远
     * 不成立，物理文件将再也不被回收（静默磁盘泄漏），比报错严重得多。</p>
     *
     * @param id 物理文件 ID
     * @return 影响行数（0=计数已为 0，调用方应记警告）
     */
    @Update("update sys_file set ref_count = ref_count - 1, update_time = now() "
            + "where id = #{id} and ref_count > 0")
    int decreaseRefCount(@Param("id") Long id);

    /**
     * 读取当前引用计数（用于判断是否已归零）。
     *
     * @param id 物理文件 ID
     * @return 引用计数；行不存在返回 null
     */
    @Select("select ref_count from sys_file where id = #{id}")
    Integer selectRefCount(@Param("id") Long id);

    /**
     * 复活一条曾被逻辑删除的物理文件行（{@code findByContent} 命中已删行时调用）。
     *
     * @param id 物理文件 ID
     * @return 影响行数
     */
    @Update("update sys_file set deleted = 0, status = 0, update_time = now() where id = #{id}")
    int revive(@Param("id") Long id);

    /**
     * 物理删除物理文件行（引用归零后的最终回收）。
     *
     * <p><b>必须真删</b>：该行的唯一键 {@code uk_sha256_size} 不含 deleted，逻辑删除会让
     * 「同一份内容再次上传」永久失败。物理层是内容寻址的缓存，审计价值由
     * {@code sys_operation_log} 与 {@code sys_file_node} 承担，此处删行不丢审计。</p>
     *
     * @param id 物理文件 ID
     * @return 影响行数
     */
    @Delete("delete from sys_file where id = #{id}")
    int deletePhysically(@Param("id") Long id);
}
