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
package com.anttransfer.permission.mapper;

import com.anttransfer.permission.entity.PermissionGrant;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 临时授权 Mapper。
 *
 * <p>到期回收扫描依赖表索引 {@code idx_user_expire(user_id,status,expire_at)} /
 * {@code idx_expire(status,expire_at)}（见 sql/V1__schema.sql），查询按
 * {@code status=1 AND expire_at<=now} 命中索引最左前缀，无需全表扫。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface PermissionGrantMapper extends BaseMapper<PermissionGrant> {
}
