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
package com.anttransfer.auth.repository;

import com.anttransfer.auth.model.entity.SysDept;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 部门 Mapper（只读使用）。
 *
 * <p>继承 {@code BaseMapper} 即获得按主键查询与条件查询（自动追加 {@code deleted = 0}），
 * 足以支撑「调岗目标下拉」与「目标部门合法性校验」两处；CE 不提供部门 CRUD，
 * 故不额外声明写方法——不存在的写入口比「写入口存在但没人该用」更安全。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface DeptMapper extends BaseMapper<SysDept> {
}
