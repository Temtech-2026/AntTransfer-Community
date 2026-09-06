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
package com.anttransfer.auth.annotation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 登录校验注解（骨架）。
 *
 * <p>职责：标注在 Controller 方法或类上，表示该接口需要“已登录”才可访问。
 * 具体校验逻辑由 at-auth 模块提供的 AOP 切面 / 拦截器实现
 * （校验失败统一抛 {@link com.anttransfer.common.exception.BusinessException}，
 * 对应 {@code ErrorCode.NOT_LOGIN}）。</p>
 *
 * <p>用法示例：</p>
 * <pre>{@code
 *   @RequireLogin            // 仅要求登录
 *   @PostMapping("/logout") ...
 *
 *   @RequireLogin(requireAdmin = true)   // 要求登录且为管理员
 * }</pre>
 *
 * <p>扩展方向：后续可将角色要求、资源 ID 校验等拆分为独立注解
 * （参考 at-permission 模块的 {@code RequirePermission}）。</p>
 *
 * @author AntTransfer CE
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequireLogin {

    /**
     * 是否要求管理员角色（骨架属性，后续可演化为角色编码集合）。
     */
    boolean requireAdmin() default false;
}
