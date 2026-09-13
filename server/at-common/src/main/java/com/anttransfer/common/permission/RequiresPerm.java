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
package com.anttransfer.common.permission;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 接口权限点注解：声明调用者必须具备的 perm_code（与 sys_permission 全量枚举一一对应）。
 *
 * <p><b>为何位于 at-common：</b>架构铁律禁止业务模块互相依赖，而功能权限点需要被
 * 所有业务模块声明（如 at-file 的 {@code file:share}）。若注解留在 at-permission，
 * 各业务模块就必须编译期依赖 at-permission。故将「注解契约」抽到共享内核 at-common，
 * 「校验实现」仍留在 at-permission（{@code RequiresPermAspect} + {@code PermissionService}）；
 * 与 {@link com.anttransfer.common.security.AuthenticatedUser} 同一处理方式。</p>
 *
 * <p>判定语义（由 at-permission 的 {@code RequiresPermAspect} 执行）：</p>
 * <ul>
 *     <li>权限来源 = 该用户多角色授权的 <b>并集</b>（含显式 Deny 项时 Deny 优先）；</li>
 *     <li>不满足 → 抛 {@code AuthException(NO_AUTH)}，经全局异常处理统一 403 + code=1003；</li>
 *     <li>仅做<b>功能权限</b>声明；<b>数据范围 / 资源归属</b>校验须在业务方法内调用
 *         {@code AccessControlService}（防水平越权，注解无法表达“某个 fileId 是否属于你”）。</li>
 * </ul>
 *
 * <p>用法：</p>
 * <pre>{@code
 *   @RequiresPerm("file:share")
 *   @PostMapping ...
 *
 *   @RequiresPerm(value = {"file:edit", "file:version"}, any = true)  // 满足其一即可
 * }</pre>
 *
 * @author AntTransfer CE
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequiresPerm {

    /**
     * 所需权限点编码（可多个）；默认“满足全部”，{@link #any()}=true 时“满足其一”。
     */
    String[] value();

    /**
     * 多个权限点时是否“满足其一即放行”（false = 须全部满足）。
     */
    boolean any() default false;

    /**
     * 自定义无权限提示；为空使用错误码默认文案。
     */
    String message() default "";
}
