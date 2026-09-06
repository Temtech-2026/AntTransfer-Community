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
 * 权限校验注解（骨架）。
 *
 * <p>职责：标注在 Controller 方法 / 类上，声明访问所需权限点（可多个）。
 * 由 at-permission 模块的 AOP 切面解析当前用户角色/权限集合完成判定；
 * 无权限时抛 {@link com.anttransfer.common.exception.BusinessException}
 * （对应 {@code ErrorCode.NO_AUTH}）。</p>
 *
 * <p>权限点命名约定：{@code 资源:操作}，例如：</p>
 * <pre>{@code
 *   @RequirePermission("transfer:create")   // 需“创建传输任务”权限
 *   @RequirePermission(value = {"file:download", "file:preview"}, message = "无文件访问权限")
 * }</pre>
 *
 * @author AntTransfer CE
 */
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
