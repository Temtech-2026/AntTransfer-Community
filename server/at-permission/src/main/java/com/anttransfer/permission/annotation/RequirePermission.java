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
package com.anttransfer.permission.annotation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 权限校验注解（骨架期遗留，已由 {@link com.anttransfer.common.permission.RequiresPerm} 取代）。
 *
 * @deprecated 请改用 {@link com.anttransfer.common.permission.RequiresPerm}：携带精确 perm_code 语义（多角色并集 / Deny 优先），
 * 由 {@code RequiresPermAspect} 统一执行并返回 1003 NO_AUTH。
 * @author AntTransfer CE
 */
@Deprecated
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequirePermission {

    /**
     * 所需权限点编码（多个为“与”关系，即全部满足）。
     */
    String[] value();

    /**
     * 校验失败时的提示文案。
     */
    String message() default "无操作权限";
}
