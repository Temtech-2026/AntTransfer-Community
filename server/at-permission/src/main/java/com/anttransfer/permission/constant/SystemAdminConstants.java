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
package com.anttransfer.permission.constant;

import java.util.Set;

/**
 * 系统管理面（用户 / 角色）常量：内置角色、权限点编码、受保护账号。
 *
 * <p><b>为什么集中一处：</b>内置角色码与 system:* 权限点编码同时被 V9 迁移脚本、
 * 服务层红线（AUDITOR 锁定、内置角色保护、防自锁）与前端权限地图引用。
 * 字符串若散落在 Service 里，改一处漏一处就会让某条红线静默失效——
 * 例如 AUDITOR 角色码写错一个字母，「权限锁定只读」的守卫就再也命中不了。</p>
 *
 * <p>常量取值与 {@code sql/V2__init_data.sql} / {@code sql/V9__system_admin_permission_points.sql}
 * 一一对应；脚本侧是唯一事实源，本类只做编译期别名，不得出现脚本中不存在的编码。</p>
 *
 * @author AntTransfer CE
 */
public final class SystemAdminConstants {

    private SystemAdminConstants() {
    }

    /* ======================== 内置角色 ======================== */

    /** 内置角色：超级管理员（拥有全部 system:* 权限点，防自锁的锚点） */
    public static final String ROLE_SUPER_ADMIN = "SUPER_ADMIN";

    /** 内置角色：审计员（权限集锁定只读，三权分立的锚点） */
    public static final String ROLE_AUDITOR = "AUDITOR";

    /** 内置角色：部门管理员 */
    public static final String ROLE_DEPT_ADMIN = "DEPT_ADMIN";

    /** 内置角色：普通用户 */
    public static final String ROLE_USER = "USER";

    /** 全部内置角色编码（内置角色禁止删除） */
    public static final Set<String> BUILT_IN_ROLE_CODES =
            Set.of(ROLE_SUPER_ADMIN, ROLE_AUDITOR, ROLE_DEPT_ADMIN, ROLE_USER);

    /* ======================== 权限点 ======================== */

    /** 系统管理菜单根权限点编码（type=1） */
    public static final String SYSTEM_MENU_CODE = "system";

    /** 系统管理面权限点前缀 */
    public static final String SYSTEM_PERM_PREFIX = "system:";

    public static final String PERM_USER_LIST = "system:user:list";
    public static final String PERM_USER_CREATE = "system:user:create";
    public static final String PERM_USER_UPDATE = "system:user:update";
    public static final String PERM_USER_RESET_PASSWORD = "system:user:reset-password";
    public static final String PERM_USER_STATUS = "system:user:status";
    public static final String PERM_USER_ASSIGN_ROLE = "system:user:assign-role";
    public static final String PERM_USER_DELETE = "system:user:delete";

    public static final String PERM_ROLE_LIST = "system:role:list";
    public static final String PERM_ROLE_CREATE = "system:role:create";
    public static final String PERM_ROLE_UPDATE = "system:role:update";
    public static final String PERM_ROLE_DELETE = "system:role:delete";
    public static final String PERM_ROLE_ASSIGN_PERM = "system:role:assign-perm";

    /* ======================== 审计（跨模块，无 system: 前缀） ======================== */

    /**
     * 审计日志只读权限点（查询 + 导出共用）。
     *
     * <p><b>为什么不是 {@code system:} 前缀：</b>该点在 {@code sql/V2__init_data.sql}（id=120）
     * 定义于顶级菜单 {@code audit}（id=101）之下，编码即 {@code audit:log:read}，
     * 是内置 {@link #ROLE_AUDITOR} 唯一持有的权限点，故不能归入系统管理面的 {@code system:}
     * 命名空间（否则超管授权矩阵、前端权限地图、AUDITOR 锁定红线三处都会对不上）。
     * 与其它常量同一约定：脚本侧是唯一事实源，本类只做编译期别名。</p>
     */
    public static final String PERM_AUDIT_LOG_READ = "audit:log:read";

    /**
     * 防自锁必须保留的最小「管理能力」权限点集合。
     *
     * <p>不允许这些点被从 {@link #ROLE_SUPER_ADMIN} 中移除——一旦移除，
     * 超级管理员将无法再把它们授回（没有 assign-perm 就改不了任何角色的权限集），
     * 系统进入不可逆的锁死状态。</p>
     */
    public static final Set<String> SUPER_ADMIN_REQUIRED_PERMS =
            Set.of(PERM_ROLE_ASSIGN_PERM, PERM_USER_LIST, PERM_USER_ASSIGN_ROLE);

    /* ======================== 受保护账号 ======================== */

    /**
     * 受保护账号的登录名（V2 初始化的唯一管理入口 admin）。
     *
     * <p>禁止对其停用 / 删除 / 摘除 SUPER_ADMIN 角色：这是「防自锁」在账号维度的对偶——
     * 权限矩阵改坏了还能登回来修，管理入口账号被停掉就只能改库了。</p>
     */
    public static final String PROTECTED_USERNAME = "admin";

    /* ======================== 分页 ======================== */

    /** 分页上界（API 契约 §9：单页最大 100，防大页拖库） */
    public static final long MAX_PAGE_SIZE = 100L;
}
