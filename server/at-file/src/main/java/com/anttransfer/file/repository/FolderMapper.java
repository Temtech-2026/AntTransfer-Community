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

import com.anttransfer.file.model.entity.Folder;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 目录 Mapper：除通用 CRUD 外，集中承载物化路径带来的三个原子操作。
 *
 * <p>这几个操作都必须在 SQL 层面一次完成（而不是「查出来、循环改、批量写回」）：
 * 整树搬迁一旦中途失败，子树的 path 会与 parent_id 脱节，之后所有前缀查询都会给出错误结果。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface FolderMapper extends BaseMapper<Folder> {

    /**
     * 查某目录的整棵子树（含自身），用于删除时的级联入站与移动时的成环检测。
     *
     * <p>前缀匹配走 {@code idx_owner_path}；必须带 {@code owner_user_id}，否则会跨用户
     * 命中他人同名路径的目录（越权读）。</p>
     *
     * @param ownerUserId 归属用户 ID
     * @param pathPrefix  子树根路径（形如 {@code /1/8/}，以 / 结尾）
     * @return 子树内全部未删除目录
     */
    @Select("""
            select *
            from sys_folder
            where owner_user_id = #{ownerUserId}
              and path like concat(#{pathPrefix}, '%')
              and deleted = 0
            """)
    List<Folder> findSubtree(@Param("ownerUserId") Long ownerUserId,
                             @Param("pathPrefix") String pathPrefix);

    /**
     * 整树搬迁：把子树内所有目录的 path 前缀由 {@code oldPrefix} 换成 {@code newPrefix}。
     *
     * <p>用 {@code substring} 拼接而非 {@code replace()}：{@code replace} 会命中路径中间
     * 任何位置出现的相同片段（如把 {@code /1/11/} 里的 {@code /1/} 也替换掉，污染兄弟分支），
     * 而前缀截断只作用于确定的头部。{@code depthDelta} 同步调整深度，供最大嵌套限制复核。</p>
     *
     * @return 影响行数（= 子树目录数）
     */
    @Update("""
            update sys_folder
            set path = concat(#{newPrefix}, substring(path, length(#{oldPrefix}) + 1)),
                depth = depth + #{depthDelta},
                update_time = now()
            where owner_user_id = #{ownerUserId}
              and path like concat(#{oldPrefix}, '%')
              and deleted = 0
            """)
    int replaceSubtreePath(@Param("ownerUserId") Long ownerUserId,
                           @Param("oldPrefix") String oldPrefix,
                           @Param("newPrefix") String newPrefix,
                           @Param("depthDelta") int depthDelta);

    /**
     * 物理清空某目录的直接子目录名集合（仅取 name，用于「同层重名」批量校验）。
     *
     * @param ownerUserId 归属用户 ID
     * @param parentId    父目录 ID
     * @return 未删除子目录名列表
     */
    @Select("""
            select name
            from sys_folder
            where owner_user_id = #{ownerUserId}
              and parent_id = #{parentId}
              and deleted = 0
            """)
    List<String> listChildNames(@Param("ownerUserId") Long ownerUserId,
                                @Param("parentId") Long parentId);
}
