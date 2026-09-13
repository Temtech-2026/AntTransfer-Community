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

import com.anttransfer.file.model.dto.NodeTagRow;
import com.anttransfer.file.model.entity.FileTag;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.Collection;
import java.util.List;

/**
 * 文件标签关联 Mapper。
 *
 * @author AntTransfer CE
 */
@Mapper
public interface FileTagMapper extends BaseMapper<FileTag> {

    /**
     * 取某用户下打了指定标签的全部条目 ID，供「按标签筛选」下推为 {@code in} 条件。
     *
     * <p>把标签条件先收敛成 ID 集合、再与主列表查询组合，好处是主查询不必因标签而 join
     * （join 会让分页的 count 与数据查询都得复写一遍标签条件，容易两边不一致）。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param tagId       标签 ID
     * @return 条目 ID 列表（可能为空，调用方须按「空集合 = 无结果」处理而非忽略条件）
     */
    @Select("""
            select node_id
            from sys_file_tag
            where owner_user_id = #{ownerUserId}
              and tag_id = #{tagId}
              and deleted = 0
            """)
    List<Long> findNodeIdsByTag(@Param("ownerUserId") Long ownerUserId, @Param("tagId") Long tagId);

    /**
     * 批量回显多个条目上的标签（列表页一次查完，避免逐行 N+1）。
     *
     * @param nodeIds 条目 ID 集合（非空；调用方需在为空时短路，否则 SQL 语法错误）
     * @return 条目-标签投影行
     */
    @Select("""
            <script>
            select ft.node_id as nodeId, t.id as tagId, t.name as name, t.color as color
            from sys_file_tag ft
            join sys_tag t on t.id = ft.tag_id and t.deleted = 0
            where ft.deleted = 0
              and ft.node_id in
              <foreach collection="nodeIds" item="nid" open="(" separator="," close=")">#{nid}</foreach>
            </script>
            """)
    List<NodeTagRow> findTagsByNodeIds(@Param("nodeIds") Collection<Long> nodeIds);

    /**
     * 统计某标签当前关联的有效条目数（删除标签前的影响面提示）。
     *
     * @param tagId 标签 ID
     * @return 关联数
     */
    @Select("select count(1) from sys_file_tag where tag_id = #{tagId} and deleted = 0")
    long countByTag(@Param("tagId") Long tagId);

    /**
     * 多标签筛选（<b>AND 语义</b>）：返回同时命中全部标签的条目 ID。
     *
     * <p><b>为什么是 AND 而不是 OR：</b>用户勾选第二个标签时的预期几乎总是「把范围缩小」——
     * 标签是分类漏斗，不是并列的检索词。若取 OR，每多勾一个标签结果只会越滚越大，
     * 用户就只能靠反复取消勾选来逼近目标，这与勾选的直觉完全相反。需要并集时应当
     * 分多次查询，而不是把两种语义塞进同一个参数。</p>
     *
     * <p>实现上先按 {@code tag_id in (...)} 收窄再 {@code having count(distinct tag_id) = N}
     * 断言「N 个标签一个都没少」。用 {@code distinct} 是因为同一对 (node, tag) 理论上
     * 可能因历史数据留下重复行，不去重会把「只命中一个标签」误判成命中多个。</p>
     */
    @Select("""
            <script>
            select node_id
            from sys_file_tag
            where owner_user_id = #{ownerUserId}
              and deleted = 0
              and tag_id in
              <foreach collection="tagIds" item="tid" open="(" separator="," close=")">#{tid}</foreach>
            group by node_id
            having count(distinct tag_id) = #{expected}
            </script>
            """)
    List<Long> findNodeIdsByTags(@Param("ownerUserId") Long ownerUserId,
                                 @Param("tagIds") Collection<Long> tagIds,
                                 @Param("expected") int expected);

    /** 清空某条目的全部标签（重新打标签时先整体覆盖，避免遗留过期关联）。 */
    @Update("""
            update sys_file_tag
            set deleted = 1,
                update_time = now()
            where node_id = #{nodeId}
              and deleted = 0
            """)
    int deleteByNodeId(@Param("nodeId") Long nodeId);

    /**
     * 清空某标签的全部关联（删除标签时调用）。
     *
     * <p><b>为什么删标签必须连带清关联：</b>按标签筛选走的是 {@code sys_file_tag.tag_id}，
     * 不 join {@code sys_tag}——若只逻辑删除标签行而留下关联，被删标签的 ID 一旦被复用，
     * 旧关联会「诈尸」到新标签上；即便不复用，「按已删标签的 ID 查」仍能查出文件，
     * 形成越删越多结果的怪象。</p>
     *
     * @param tagId 标签 ID
     * @return 影响行数
     */
    @Update("""
            update sys_file_tag
            set deleted = 1,
                update_time = now()
            where tag_id = #{tagId}
              and deleted = 0
            """)
    int deleteByTagId(@Param("tagId") Long tagId);
}
