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
package com.anttransfer.permission.model.vo;

import java.util.List;

/**
 * 当前用户权限视图对象（VO）。
 *
 * <p>GET {@code /v1/permission/my} 的接口输出，Phase 5 前端权限引导用：
 * 前端据此渲染路由 / 按钮显隐，与后端 perm_code 一一对应。</p>
 *
 * @param roles     角色编码（ROLE_* 前缀由前端自行加）
 * @param permCodes 放行权限点并集（已剔除显式 Deny 项）
 * @param dataScope 数据范围
 * @author AntTransfer CE
 */
public record PermissionView(List<String> roles, List<String> permCodes, int dataScope) {
}
