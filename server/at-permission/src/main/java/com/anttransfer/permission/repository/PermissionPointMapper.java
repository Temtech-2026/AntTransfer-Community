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
package com.anttransfer.permission.repository;

import com.anttransfer.permission.model.entity.SysPermission;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 权限点只读 Mapper（sys_permission）。
 *
 * <p>CE 不提供权限点 CRUD：权限点是迁移脚本写入的全量枚举。本 Mapper 仅用于
 * ① 授权弹窗加载权限点树；② 校验提交的 permissionIds 确实存在。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface PermissionPointMapper extends BaseMapper<SysPermission> {
}
