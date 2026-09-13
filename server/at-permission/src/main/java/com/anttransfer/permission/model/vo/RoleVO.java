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

import com.anttransfer.permission.model.entity.SysRole;

import java.time.LocalDateTime;

/**
 * 角色列表 / 详情视图。
 *
 * <p>{@code builtIn} 交给前端用于禁用「删除」按钮（服务端仍会兜底返回 1020）；
 * {@code auditorLocked} 由服务端直接下发，避免前端硬编码 AUDITOR 这个角色码——
 * 三权分立的红线不该只活在前端 if 里。</p>
 *
 * @param id            角色 ID
 * @param code          角色编码
 * @param name          角色名称
 * @param dataScope     数据范围：1-本人 2-本部门及以下 3-全部
 * @param builtIn       是否内置（1-是，禁止删除）
 * @param auditorLocked 权限集是否锁定只读（AUDITOR 为 true）
 * @param remark        备注
 * @param createTime    创建时间
 * @author AntTransfer CE
 */
public record RoleVO(
        Long id,
        String code,
        String name,
        Integer dataScope,
        Integer builtIn,
        boolean auditorLocked,
        String remark,
        LocalDateTime createTime) {

    /**
     * 由实体投影为视图。
     *
     * @param role          角色实体
     * @param auditorLocked 是否为锁定权限集的审计员角色
     */
    public static RoleVO of(SysRole role, boolean auditorLocked) {
        return new RoleVO(
                role.getId(),
                role.getCode(),
                role.getName(),
                role.getDataScope(),
                role.getBuiltIn(),
                auditorLocked,
                role.getRemark(),
                role.getCreateTime());
    }
}
