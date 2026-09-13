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

import com.anttransfer.common.security.UserAdminPort.DeptRow;

/**
 * 部门选项视图（调岗目标下拉 / 用户列表过滤）。
 *
 * <p><b>为什么不直接序列化 SPI 的 {@code DeptRow}：</b>SPI 端口是模块间内部契约，
 * 改字段不该牵动对外的 HTTP 契约；且 SPI 行可能带表主内部字段（如 status 的语义、
 * 审计列）。对外只暴露前端真正需要的 id/parentId/name，把两个契约解耦。</p>
 *
 * @param id       部门 ID
 * @param parentId 父部门 ID（0=根）
 * @param name     部门名称
 * @author AntTransfer CE
 */
public record DeptOptionVO(Long id, Long parentId, String name) {

    /** 由表主下发的部门行投影。 */
    public static DeptOptionVO of(DeptRow row) {
        return new DeptOptionVO(row.id(), row.parentId(), row.name());
    }
}
