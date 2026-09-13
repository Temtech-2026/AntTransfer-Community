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

import com.anttransfer.file.model.entity.FileVersion;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 历史版本 Mapper。
 *
 * <p>刻意不在此提供「删除超量版本」的 SQL：版本数量天然很小（默认保留 10 版），
 * 由 Service 查出列表后在内存中裁剪即可，SQL 里塞 limit offset 反而更难读。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface FileVersionMapper extends BaseMapper<FileVersion> {

    /**
     * 取某条目的当前最大版本号（新版本号 = 返回值 + 1）。
     *
     * <p>{@code coalesce(...,0)} 覆盖「条目刚创建、还没有任何版本记录」的情形——
     * 若返回 null 交给上层判空，会迫使每个调用点都写一次空值分支。</p>
     *
     * @param nodeId 引用条目 ID
     * @return 最大版本号；无版本记录返回 0
     */
    @Select("""
            select coalesce(max(version_no), 0)
            from sys_file_version
            where node_id = #{nodeId}
              and deleted = 0
            """)
    int selectMaxVersionNo(@Param("nodeId") Long nodeId);

    /**
     * 取某条目的历史版本（新→旧）。
     *
     * <p>用 {@code limit} 而不是在应用层截断：历史版本可能被 {@code versionKeepCount} 之外的手工
     * 干预或历史数据灌到很多，让数据库只返回需要的行，比全量捞回来再丢弃稳当。</p>
     */
    @Select("""
            select *
            from sys_file_version
            where node_id = #{nodeId}
              and deleted = 0
            order by version_no desc
            limit #{limit}
            """)
    List<FileVersion> findByNodeId(@Param("nodeId") Long nodeId, @Param("limit") int limit);

    @Select("""
            select *
            from sys_file_version
            where node_id = #{nodeId}
              and version_no = #{versionNo}
              and deleted = 0
            limit 1
            """)
    FileVersion findByNodeAndVersion(@Param("nodeId") Long nodeId, @Param("versionNo") Integer versionNo);

    /**
     * 统计某份物理内容仍被多少条存活历史版本引用。
     *
     * <p>这是物理回收门禁的第三道闸：历史版本只记元数据、不占 {@code sys_file.ref_count}，
     * 若只看引用计数就回收，版本列表里那些「看起来还在」的条目会全部变成取不到内容的死链。</p>
     */
    @Select("""
            select count(1)
            from sys_file_version
            where file_id = #{fileId}
              and deleted = 0
            """)
    long countLiveVersions(@Param("fileId") Long fileId);

    /**
     * 逻辑删除某条目的全部历史版本（条目被彻底销毁 / 到期清理时调用）。
     *
     * <p>版本行归属于条目，条目都没了就不该再有谁去读它们。更要紧的是：只要它们还存在，
     * 上面的 {@link #countLiveVersions} 就会一直认为内容有人持有，物理字节永远回收不掉——
     * 于是「删了文件但磁盘不降」这种问题会在上线很久之后才被人发现。</p>
     */
    @Update("""
            update sys_file_version
            set deleted = 1,
                update_time = now()
            where node_id = #{nodeId}
              and deleted = 0
            """)
    int deleteByNodeId(@Param("nodeId") Long nodeId);

    /** 逻辑删除单条历史版本（超出保留版本数时裁剪）。 */
    @Update("""
            update sys_file_version
            set deleted = 1,
                update_time = now()
            where id = #{id}
              and deleted = 0
            """)
    int deleteLogically(@Param("id") Long id);
}
