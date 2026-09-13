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
package com.anttransfer.permission.aspect;

import com.anttransfer.permission.annotation.RequiresPerm;
import com.anttransfer.permission.service.PermissionService;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * {@link RequiresPerm} 注解切面：方法或类级别声明的 perm_code 校验。
 *
 * <p>不满足 → 抛 {@code AuthException(NO_AUTH)}（网关全局异常 → HTTP 403 + code=1003），
 * 前端「提示无权限不跳登录」（策略 D）。注意本注解只做<b>功能权限</b>；
 * 数据范围 / 资源归属请在业务方法内调用 {@code AccessControlService}。</p>
 *
 * @author AntTransfer CE
 */
@Aspect
@Component
public class RequiresPermAspect {

    private final PermissionService permissionService;

    public RequiresPermAspect(PermissionService permissionService) {
        this.permissionService = permissionService;
    }

    /** 方法级声明 */
    @Around("@annotation(requiresPerm)")
    public Object aroundMethod(ProceedingJoinPoint joinPoint, RequiresPerm requiresPerm)
            throws Throwable {
        check(requiresPerm);
        return joinPoint.proceed();
    }

    /** 类级声明（方法级声明存在时让位于方法级，避免重复校验） */
    @Around("@within(requiresPerm)")
    public Object aroundType(ProceedingJoinPoint joinPoint, RequiresPerm requiresPerm)
            throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        if (signature.getMethod().isAnnotationPresent(RequiresPerm.class)) {
            return joinPoint.proceed();
        }
        check(requiresPerm);
        return joinPoint.proceed();
    }

    private void check(RequiresPerm requiresPerm) {
        permissionService.requirePerm(
                Arrays.asList(requiresPerm.value()), requiresPerm.any(), requiresPerm.message());
    }
}
