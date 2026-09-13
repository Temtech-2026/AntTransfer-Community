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

import com.anttransfer.file.model.entity.Tag;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 标签 Mapper。
 *
 * @author AntTransfer CE
 */
@Mapper
public interface TagMapper extends BaseMapper<Tag> {

    /**
     * 按「用户 + 标签名」查重（标签在用户内唯一）。
     *
     * <p>{@code owner_user_id} 必须参与条件：不同用户可有同名标签，漏掉它会把别人建的
     * 同名标签判成本人的，导致「明明没建过却提示重复」。</p>
     *
     * @param ownerUserId 标签归属用户 ID
     * @param name        标签名
     * @return 命中的标签；无则返回 null
     */
    @Select("""
            select *
            from sys_tag
            where owner_user_id = #{ownerUserId}
              and name = #{name}
              and deleted = 0
            limit 1
            """)
    Tag findByOwnerAndName(@Param("ownerUserId") Long ownerUserId, @Param("name") String name);
}
