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
package com.anttransfer.permission.model;

import java.util.Set;

/**
 * 审批域字面量常量与合法性校验（与 sql/V1__schema.sql 列注释一一对齐）。
 *
 * <p>避免散落魔法字符串：申请类型、资源类型、敏感等级三组枚举值集中于此。</p>
 *
 * @author AntTransfer CE
 */
public final class ApprovalEnums {

    private ApprovalEnums() {
    }

    /* ---------------- 申请类型 apply_type（= 授权动作 grant_type 语义） ---------------- */

    public static final String APPLY_ACCESS = "ACCESS";
    public static final String APPLY_DOWNLOAD = "DOWNLOAD";
    public static final String APPLY_EDIT = "EDIT";
    public static final String APPLY_SHARE = "SHARE";

    /** 合法申请类型集合 */
    public static final Set<String> APPLY_TYPES =
            Set.of(APPLY_ACCESS, APPLY_DOWNLOAD, APPLY_EDIT, APPLY_SHARE);

    /* ---------------- 资源类型 resource_type ---------------- */

    public static final String RESOURCE_FILE = "FILE";
    public static final String RESOURCE_SPACE = "SPACE";
    public static final String RESOURCE_GROUP = "GROUP";

    /** 合法资源类型集合（CE 默认 FILE） */
    public static final Set<String> RESOURCE_TYPES =
            Set.of(RESOURCE_FILE, RESOURCE_SPACE, RESOURCE_GROUP);

    /* ---------------- 敏感等级 level ---------------- */

    public static final int LEVEL_LOW = 1;
    public static final int LEVEL_MEDIUM = 2;
    public static final int LEVEL_HIGH = 3;

    /** 合法性：申请类型是否受支持 */
    public static boolean isValidApplyType(String applyType) {
        return applyType != null && APPLY_TYPES.contains(applyType);
    }

    /** 合法性：资源类型是否受支持 */
    public static boolean isValidResourceType(String resourceType) {
        return resourceType != null && RESOURCE_TYPES.contains(resourceType);
    }

    /** 归一化敏感等级：null / 越界一律按 LOW（最低 SLA 压力，不放大权限） */
    public static int normalizeLevel(Integer level) {
        if (level == null || level < LEVEL_LOW || level > LEVEL_HIGH) {
            return LEVEL_LOW;
        }
        return level;
    }
}
