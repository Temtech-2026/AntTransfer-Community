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

import com.anttransfer.permission.model.entity.SysPermission;

import java.util.ArrayList;
import java.util.List;

/**
 * 权限点树节点视图（角色授权弹窗的勾选数据源）。
 *
 * @param id       权限点 ID
 * @param permCode 权限点编码
 * @param permName 权限点名称
 * @param type     维度：1-菜单 2-操作 3-数据范围
 * @param parentId 父权限点 ID（0=根）
 * @param sortNo   排序号
 * @param children 子节点
 * @author AntTransfer CE
 */
public record PermissionPointVO(
        Long id,
        String permCode,
        String permName,
        Integer type,
        Long parentId,
        Integer sortNo,
        List<PermissionPointVO> children) {

    /** 由实体构造叶子节点（children 为空列表，避免前端 null 判断）。 */
    public static PermissionPointVO of(SysPermission permission) {
        return new PermissionPointVO(
                permission.getId(),
                permission.getPermCode(),
                permission.getPermName(),
                permission.getType(),
                permission.getParentId(),
                permission.getSortNo(),
                new ArrayList<>());
    }
}
