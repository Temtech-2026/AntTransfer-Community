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
package com.anttransfer.permission.controller;

import com.anttransfer.common.permission.RequiresPerm;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 管理面「垂直越权」矩阵：端点级权限点闸门的存在性。
 *
 * <p>水平越权（「这条 fileId 是不是你的」）由各模块的归属校验负责，注解表达不了，
 * 另有专门测试覆盖；本矩阵只回答一个问题：<b>管理面的每个 HTTP 端点，
 * 是否都有一道功能权限闸门，或者被显式登记为「登录即充分」？</b></p>
 *
 * <p>为什么用扫描而不是逐个列举：漏标 {@code @RequiresPerm} 不产生任何编译错误、
 * 不影响本地自测（普通用户路径照样跑通），只会在生产上表现为「普通用户能调管理接口」。
 * 扫描 + 白名单把这种沉默的漏配变成红灯，并且强迫新增端点时对「为何无需权限点」表态。</p>
 *
 * @author AntTransfer CE
 */
@DisplayName("管理面垂直越权矩阵 · 端点权限点闸门")
class ManagementApiPermissionMatrixTest {

    /** 管理面控制器所在包：新增文件会被自动纳入矩阵，无需回改本测试。 */
    private static final String CONTROLLER_PACKAGE = "com.anttransfer.permission.controller";

    /** 映射注解全集，用于把「HTTP 端点」从普通 public 方法里挑出来。 */
    private static final List<Class<? extends Annotation>> MAPPING_ANNOTATIONS = List.of(
            RequestMapping.class, GetMapping.class, PostMapping.class,
            PutMapping.class, DeleteMapping.class, PatchMapping.class);

    /**
     * 刻意不挂权限点的自助端点白名单。
     *
     * <p>每一条都必须回答「为什么登录态本身就是充分条件」。这张表的价值不在于放行，
     * 而在于让「这个端点不需要权限点」成为一个需要写理由、能被 review 的显式决定。</p>
     */
    private static final Map<String, String> SELF_SERVICE_ENDPOINTS = Map.of(
            "PermissionController#myPermissions",
            "前端路由守卫与按钮显隐的自举依赖：若要求权限点，则「要拿到权限点必须先拥有权限点」自相矛盾；"
                    + "只返回调用者自己的快照，不构成越权面",
            "PermissionApplicationController#create",
            "权限申请入口：申请人本就没有目标权限点，入口必须对全体登录用户开放；申请人由登录态推导，不取请求参数",
            "PermissionApplicationController#approve",
            "审批通过：审批资格由审批链与任务归属决定，不是 perm_code 能表达的；服务层按 approver 归属校验",
            "PermissionApplicationController#reject",
            "审批驳回：同 approve，资格来自审批任务归属而非功能权限点",
            "PermissionApplicationController#transfer",
            "转审：接收人合法性由服务层按审批链校验，非 perm_code 可表达",
            "PermissionApplicationController#pending",
            "「待我审批」按 approver_id 过滤，只可能看到自己的待办，无横向泄漏面",
            "PermissionApplicationController#mine",
            "「我发起的」按 applicant_id 过滤，只可能看到自己的申请",
            "PermissionApplicationController#permissionMap",
            "我的权限地图：等价于 myPermissions，只返回调用者自己的授权视图");

    /**
     * 权限点命名空间与路由前缀的对应关系（防止「审计读权限」被塞进管理面角色）。
     *
     * <p>未登记的前缀不做约束——本表只锁已明确归属的两个域。</p>
     */
    private static final Map<String, String> NAMESPACE_BY_BASE_PATH = Map.of(
            "/v1/system", "system:",
            "/v1/roles", "system:",
            "/v1/permission-points", "system:",
            "/v1/audit", "audit:");

    static Stream<Endpoint> endpoints() {
        return Endpoint.all();
    }

    /* ======================== 矩阵自检 ======================== */

    @Test
    @DisplayName("扫描自检：必须真的发现控制器与端点（防止整份断言空跑）")
    void scan_mustDiscoverControllersAndEndpoints() {
        assertThat(controllers())
                .as("包 %s 下必须能扫到 @RestController；扫不到说明扫描口径已失效，"
                        + "后续所有矩阵断言都会在空集合上静默通过", CONTROLLER_PACKAGE)
                .isNotEmpty();
        assertThat(endpoints().toList())
                .as("管理面 HTTP 端点数量异常偏低，疑似扫描口径失效")
                .hasSizeGreaterThan(10);
    }

    /* ======================== 闸门存在性 ======================== */

    @ParameterizedTest(name = "{0}")
    @MethodSource("endpoints")
    void everyEndpoint_mustBeGuardedOrExplicitlyAllowlisted(Endpoint endpoint) {
        RequiresPerm perm = endpoint.effectivePerm();
        if (perm == null) {
            assertThat(SELF_SERVICE_ENDPOINTS)
                    .as("%s 既没有 @RequiresPerm（方法级或类级），也不在自助白名单中 —— 这是一条裸奔端点。"
                            + "若确实登录即充分，请在 SELF_SERVICE_ENDPOINTS 补一条并写明理由", endpoint)
                    .containsKey(endpoint.toString());
            return;
        }
        assertThat(perm.value())
                .as("%s 的 @RequiresPerm 未声明任何权限点", endpoint)
                .isNotEmpty();
        assertThat(perm.value())
                .as("%s 的权限点存在空白项", endpoint)
                .allSatisfy(code -> assertThat(code).isNotBlank());
    }

    /* ======================== 白名单账实一致 ======================== */

    @Test
    @DisplayName("白名单不得存在失效条目（端点已删或已补权限点）")
    void allowlist_mustNotContainStaleEntries() {
        Set<String> discovered = endpoints().map(Endpoint::toString).collect(Collectors.toSet());

        assertThat(SELF_SERVICE_ENDPOINTS.keySet())
                .as("白名单里的每个端点都必须真实存在，失效条目会让矩阵出现「看门狗空转」")
                .allSatisfy(key -> assertThat(discovered).contains(key));
        assertThat(SELF_SERVICE_ENDPOINTS.values())
                .as("白名单每一条都必须写明为何无需权限点")
                .allSatisfy(reason -> assertThat(reason).isNotBlank());
    }

    @Test
    @DisplayName("白名单条目不得同时挂权限点（账实不符会让后续 reader 误判）")
    void allowlistedEndpoint_mustNotBeGuardedSimultaneously() {
        endpoints().filter(e -> SELF_SERVICE_ENDPOINTS.containsKey(e.toString()))
                .forEach(e -> assertThat(e.effectivePerm())
                        .as("%s 已在自助白名单中却又挂了 @RequiresPerm：要么删注解，要么从白名单移除", e)
                        .isNull());
    }

    /* ======================== 权限点卫生 ======================== */

    @Test
    @DisplayName("any=true 必须配多个权限点，否则该 flag 是误导")
    void anyFlag_mustBePairedWithMultiplePerms() {
        endpoints().forEach(endpoint -> {
            RequiresPerm perm = endpoint.effectivePerm();
            if (perm != null && perm.any()) {
                assertThat(perm.value())
                        .as("%s 使用 any=true 表示「满足其一」，但只声明了一个权限点，"
                                + "语义等价于 any=false，应删掉该 flag", endpoint)
                        .hasSizeGreaterThan(1);
            }
        });
    }

    @Test
    @DisplayName("权限点不得使用通配，否则整份矩阵可被一条 * 绕过")
    void perms_mustNotUseWildcards() {
        endpoints().forEach(endpoint -> {
            RequiresPerm perm = endpoint.effectivePerm();
            if (perm != null) {
                assertThat(perm.value())
                        .as("%s 使用了通配权限点，会绕过矩阵与 RBAC 枚举校验", endpoint)
                        .allSatisfy(code -> assertThat(code).doesNotContain("*"));
            }
        });
    }

    @Test
    @DisplayName("命名空间不得串味：系统管理面须 system:，审计面须 audit:")
    void perms_mustNotCrossNamespace() {
        endpoints().forEach(endpoint -> {
            String expectedPrefix = NAMESPACE_BY_BASE_PATH.get(endpoint.basePath());
            RequiresPerm perm = endpoint.effectivePerm();
            if (expectedPrefix == null || perm == null) {
                return;
            }
            assertThat(perm.value())
                    .as("%s（%s）的权限点必须落在 %s 命名空间：跨域授权会把审计读权限带进管理面角色",
                            endpoint, endpoint.basePath(), expectedPrefix)
                    .allSatisfy(code -> assertThat(code).startsWith(expectedPrefix));
        });
    }

    /* ======================== 发现逻辑 ======================== */

    private static List<Class<?>> controllers() {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        return scanner.findCandidateComponents(CONTROLLER_PACKAGE).stream()
                .map(BeanDefinition::getBeanClassName)
                // 显式类型见证：loadClass 返回 Class<?>，若交给推导，ECJ 会把通配捕获成
                // Class<capture#N-of ?>，导致 toList() 无法赋给 List<Class<?>>（javac 则能通过）。
                // 两个编译器口径不一致时，IDE 后台构建会往 target/test-classes 写入带
                // "Unresolved compilation problem" 的坏 class，Maven 增量编译又会跳过重编，
                // 最终由 surefire 在运行期抛错——故此处显式固定为 Class<?>。
                .<Class<?>>map(ManagementApiPermissionMatrixTest::loadClass)
                .sorted(Comparator.comparing(Class::getSimpleName))
                .toList();
    }

    private static Class<?> loadClass(String className) {
        try {
            return Class.forName(className);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("扫描到的控制器类无法加载：" + className, e);
        }
    }

    /** 一个 HTTP 端点：控制器 + 处理方法。 */
    record Endpoint(Class<?> controller, Method method) {

        static Stream<Endpoint> all() {
            return controllers().stream()
                    .flatMap(controller -> Arrays.stream(controller.getDeclaredMethods())
                            .filter(m -> !m.isSynthetic() && !m.isBridge())
                            .filter(Endpoint::hasMapping)
                            .map(method -> new Endpoint(controller, method)));
        }

        private static boolean hasMapping(Method method) {
            return MAPPING_ANNOTATIONS.stream().anyMatch(method::isAnnotationPresent);
        }

        /** 注解就近优先：方法级覆盖类级，与切面「类级让位方法级」的语义一致。 */
        RequiresPerm effectivePerm() {
            RequiresPerm onMethod = method.getAnnotation(RequiresPerm.class);
            return onMethod != null ? onMethod : controller.getAnnotation(RequiresPerm.class);
        }

        /** 控制器级路由前缀，如 {@code /v1/audit}。 */
        String basePath() {
            RequestMapping mapping = controller.getAnnotation(RequestMapping.class);
            return (mapping != null && mapping.value().length > 0) ? mapping.value()[0] : "";
        }

        @Override
        public String toString() {
            return controller.getSimpleName() + "#" + method.getName();
        }
    }
}
