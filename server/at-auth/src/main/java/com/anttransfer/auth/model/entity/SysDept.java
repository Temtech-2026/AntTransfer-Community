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
package com.anttransfer.auth.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

/**
 * 树形部门（sys_dept）。
 *
 * <p><b>为什么在 at-auth 而不是别处：</b>sys_dept 与 sys_user 同属权限族主数据，
 * 且 RBAC 数据范围「本部门及以下」的判定输入就是 {@code sys_user.dept_id} +
 * 本表 {@link #ancestors}——两者必须由同一模块持有，否则子树查询会跨模块读对方表。</p>
 *
 * <p>CE 不提供部门 CRUD（PRD 未纳入），本实体只服务于：① 用户「调岗」目标下拉；
 * ② 数据范围子树过滤（见 {@code UserMapper#selectAdminPage}）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_dept")
public class SysDept extends BaseEntity {

    /** 父部门 ID（0=根部门） */
    @TableField("parent_id")
    private Long parentId;

    /** 部门名称 */
    private String name;

    /** 祖先链路径，如 {@code /0/12/34/}；子树查询与数据范围过滤的唯一依据 */
    private String ancestors;

    /** 部门负责人用户 ID（CE 未启用，预留） */
    @TableField("leader_user_id")
    private Long leaderUserId;

    /** 排序号（升序） */
    @TableField("sort_no")
    private Integer sortNo;

    /** 状态：0-停用 1-启用 */
    private Integer status;

    /** 状态：停用 */
    public static final int STATUS_DISABLED = 0;
    /** 状态：启用 */
    public static final int STATUS_ENABLED = 1;
}
