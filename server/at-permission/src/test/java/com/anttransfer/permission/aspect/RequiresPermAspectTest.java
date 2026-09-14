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

import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.permission.RequiresPerm;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.permission.service.PermissionService;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * {@link RequiresPermAspect} 的鉴权三态矩阵：放行 / 无权限 1003 / 未登录 1001。
 *
 * <p>这里钉的不是「切面写了什么」，而是四条不可退让的边界：</p>
 * <ol>
 *   <li><b>拒绝时目标业务方法绝不允许被执行</b>：切面一旦退化成「先执行再校验」，
 *       写库、发事件这类副作用早已发生，拦截就成了事后追认；</li>
 *   <li>拒绝必须抛 {@link AuthException}（BusinessException 家族）：全局异常处理器
 *       靠 {@code errorCode} 归一状态码，抛别的类型前端只会收到 500；</li>
 *   <li>注解属性（多权限点顺序 / {@code any} / 自定义提示）原样透传，切面不得改写语义；</li>
 *   <li>切面自身必须是 {@code @Aspect} + Spring Bean，且切点同时覆盖方法级与类级——
 *       任一处缺失都会让全站 {@code @RequiresPerm} 静默失效，且不产生任何编译错误。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("权限点切面 · 鉴权三态矩阵")
class RequiresPermAspectTest {

    private static final String BUSINESS_RETURN = "业务返回值";

    @Mock
    private PermissionService permissionService;

    @InjectMocks
    private RequiresPermAspect aspect;

    @Mock
    private ProceedingJoinPoint joinPoint;

    /* ======================== 三态矩阵 ======================== */

    static Stream<Arguments> gateMatrixCases() {
        return Stream.of(
                arguments("已授权 → 放行并返回业务结果", null, true),
                arguments("已登录但无权限 → 1003 拦截", ErrorCode.NO_AUTH, false),
                arguments("未登录 / 登录态失效 → 1001 拦截", ErrorCode.NOT_LOGIN, false));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("gateMatrixCases")
    void gateMatrix(String scene, ErrorCode rejection, boolean shouldProceed) throws Throwable {
        RequiresPerm perm = permOf("annotatedFileShare");
        if (rejection == null) {
            when(joinPoint.proceed()).thenReturn(BUSINESS_RETURN);
        } else {
            doThrow(new AuthException(rejection))
                    .when(permissionService).requirePerm(anyList(), anyBoolean(), anyString());
        }

        if (shouldProceed) {
            assertThat(aspect.aroundMethod(joinPoint, perm)).isEqualTo(BUSINESS_RETURN);
            verify(joinPoint).proceed();
        } else {
            assertThatThrownBy(() -> aspect.aroundMethod(joinPoint, perm))
                    .as("拒绝必须抛 BusinessException 家族，否则全局异常处理器拿不到 errorCode")
                    .isInstanceOfSatisfying(AuthException.class,
                            e -> assertThat(e.getErrorCode()).isEqualTo(rejection));
            verify(joinPoint, never()).proceed();
        }
    }

    /* ======================== 注解属性透传 ======================== */

    @Test
    @DisplayName("注解属性原样透传：多权限点顺序、any 标志、自定义提示")
    void check_shouldPassAnnotationAttributesVerbatim() throws Throwable {
        when(joinPoint.proceed()).thenReturn(BUSINESS_RETURN);

        aspect.aroundMethod(joinPoint, permOf("annotatedAnyOf"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> perms = ArgumentCaptor.forClass(List.class);
        verify(permissionService).requirePerm(perms.capture(), eq(true), eq("需编辑或版本权限"));
        assertThat(perms.getValue())
                .as("权限点顺序需与注解声明一致，便于日志排查")
                .containsExactly("file:edit", "file:version");
    }

    @Test
    @DisplayName("单权限点：默认 any=false（须全部满足），提示为空串")
    void check_shouldDefaultAnyFalseAndEmptyMessage() throws Throwable {
        when(joinPoint.proceed()).thenReturn(BUSINESS_RETURN);

        aspect.aroundMethod(joinPoint, permOf("annotatedFileShare"));

        verify(permissionService).requirePerm(List.of("file:share"), false, "");
    }

    /* ======================== 类级声明 ======================== */

    @Test
    @DisplayName("类级声明：方法自身无注解时按类级权限点校验")
    void aroundType_shouldCheckClassLevelPerm_whenMethodHasNoOwnAnnotation() throws Throwable {
        givenSignatureOf(ClassLevelFixture.class, "plain");
        when(joinPoint.proceed()).thenReturn(BUSINESS_RETURN);

        assertThat(aspect.aroundType(joinPoint, ClassLevelFixture.class.getAnnotation(RequiresPerm.class)))
                .isEqualTo(BUSINESS_RETURN);
        verify(permissionService).requirePerm(List.of("system:user:list"), false, "");
    }

    @Test
    @DisplayName("类级让位于方法级：同一调用不得被校验两次")
    void aroundType_shouldYieldToMethodLevelAnnotation() throws Throwable {
        givenSignatureOf(ClassLevelFixture.class, "ownPerm");
        when(joinPoint.proceed()).thenReturn(BUSINESS_RETURN);

        aspect.aroundType(joinPoint, ClassLevelFixture.class.getAnnotation(RequiresPerm.class));

        verifyNoInteractions(permissionService);
        verify(joinPoint).proceed();
    }

    /* ======================== 切面注册契约 ======================== */

    @Test
    @DisplayName("切面必须同时是 @Aspect 与 Spring Bean：少一个就全站静默失效")
    void aspect_mustStayRegisteredAsAspectAndSpringBean() {
        assertThat(RequiresPermAspect.class.isAnnotationPresent(Aspect.class))
                .as("@Aspect 缺失 → 切面不会被织入，@RequiresPerm 全部变成文档")
                .isTrue();
        assertThat(RequiresPermAspect.class.isAnnotationPresent(Component.class))
                .as("@Component 缺失 → 切面不进容器，全站权限校验静默失效且无编译错误")
                .isTrue();
    }

    @Test
    @DisplayName("切点必须同时覆盖方法级与类级，漏一个就有整片端点裸奔")
    void advicePointcuts_mustCoverBothMethodAndTypeLevel() throws NoSuchMethodException {
        Method methodAdvice = RequiresPermAspect.class.getDeclaredMethod(
                "aroundMethod", ProceedingJoinPoint.class, RequiresPerm.class);
        Method typeAdvice = RequiresPermAspect.class.getDeclaredMethod(
                "aroundType", ProceedingJoinPoint.class, RequiresPerm.class);

        assertThat(methodAdvice.getAnnotation(Around.class).value())
                .as("方法级切点")
                .isEqualTo("@annotation(requiresPerm)");
        assertThat(typeAdvice.getAnnotation(Around.class).value())
                .as("类级切点")
                .isEqualTo("@within(requiresPerm)");
    }

    /* ======================== 夹具 ======================== */

    /** 注解夹具：读取真实注解实例，避免手写 {@code RequiresPerm} 实现导致断言跑在假对象上。 */
    static RequiresPerm permOf(String methodName) {
        try {
            Method method = RequiresPermAspectTest.class.getDeclaredMethod(methodName);
            RequiresPerm perm = method.getAnnotation(RequiresPerm.class);
            assertThat(perm).as("夹具方法 %s 必须标注 @RequiresPerm", methodName).isNotNull();
            return perm;
        } catch (NoSuchMethodException e) {
            throw new IllegalStateException("注解夹具方法缺失：" + methodName, e);
        }
    }

    private void givenSignatureOf(Class<?> owner, String methodName) throws NoSuchMethodException {
        MethodSignature signature = mock(MethodSignature.class);
        when(joinPoint.getSignature()).thenReturn(signature);
        when(signature.getMethod()).thenReturn(owner.getDeclaredMethod(methodName));
    }

    @RequiresPerm("file:share")
    private void annotatedFileShare() {
    }

    @RequiresPerm(value = {"file:edit", "file:version"}, any = true, message = "需编辑或版本权限")
    private void annotatedAnyOf() {
    }

    /** 类级声明夹具。 */
    @RequiresPerm("system:user:list")
    static class ClassLevelFixture {

        /** 无自身注解 → 应走类级校验。 */
        void plain() {
        }

        /** 有自身注解 → 类级须让位，避免重复校验。 */
        @RequiresPerm("system:user:create")
        void ownPerm() {
        }
    }
}
