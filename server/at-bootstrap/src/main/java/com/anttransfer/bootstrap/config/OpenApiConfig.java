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
package com.anttransfer.bootstrap.config;

import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI / Swagger UI 增强配置（在线调试受保护接口的钥匙）。
 *
 * <p>声明 {@code Authorization: Bearer <accessToken>} 安全方案：Swagger UI 右上角
 * Authorize 输入登录返回的 access token 后，即可在线调试所有受保护接口
 * （401/403 也能在 UI 上直接复现）。</p>
 *
 * <p>说明：生产 profile 仍由 {@code springdoc.api-docs.enabled=false} 关闭文档暴露；
 * 本配置只影响文档描述，不改变任何鉴权逻辑。</p>
 *
 * @author AntTransfer CE
 */
@Configuration
@SecurityScheme(
        name = OpenApiConfig.SECURITY_SCHEME,
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT",
        description = "登录 POST /api/v1/auth/token 返回的 accessToken（前缀 Bearer 可省略）")
public class OpenApiConfig {

    /** Bearer 安全方案名（Swagger Authorize 按钮展示用） */
    public static final String SECURITY_SCHEME = "bearerAuth";

    /**
     * 构建 OpenAPI 元信息，并对所有接口挂载 Bearer 安全要求（免登录白名单接口服务端仍放行）。
     */
    @Bean
    public OpenAPI antTransferOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("AntTransfer CE API")
                        .description("安全文件传输与权限管控平台（Community Edition）——统一契约见 docs/api/README.md")
                        .version("1.0.0"))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME));
    }

    /* ============================ 接口分组 ============================ */

    /*
     * 分组规则：按 at-* 模块切分（包路径即模块边界，与架构铁律一一对应），
     * Swagger UI 右上角下拉切换，避免全量接口堆在一页难以定位。
     *
     * 组名前缀两位数仅用于控制 UI 下拉框的排列顺序（springdoc 按组名字典序输出）；
     * 模块内尚无 Controller 时该组显示为空，补齐 Controller 后自动归组，
     * 新增业务模块只需在此追加一组，不改动本类其余结构。
     *
     * 各组均继承 antTransferOpenApi() 的元信息与全局 Bearer 安全方案，
     * 因此组内接口在 UI 上同样可用 Authorize 按钮在线调试。
     *
     * 注意：springdoc 要求每个分组至少给出 packagesToScan / pathsToMatch / 自定义器之一，
     * 三者全空会在启动时抛 IllegalStateException（编译期无法发现），
     * 故「全部接口」组也必须显式指定应用根包。
     */

    /** 全部接口：扫描应用根包，便于跨模块整体检索与联调 */
    @Bean
    public GroupedOpenApi allApiGroup() {
        return GroupedOpenApi.builder()
                .group("00-全部接口")
                .packagesToScan("com.anttransfer")
                .build();
    }

    /** 认证授权（at-auth）：登录 / 刷新 / 登出 / 当前用户 */
    @Bean
    public GroupedOpenApi authApiGroup() {
        return moduleGroup("01-认证授权", "com.anttransfer.auth.controller");
    }

    /** 权限管理（at-permission）：RBAC 权限点 / 角色 / 授权与申请 */
    @Bean
    public GroupedOpenApi permissionApiGroup() {
        return moduleGroup("02-权限管理", "com.anttransfer.permission.controller");
    }

    /** 传输任务（at-transfer）：任务调度 / 断点续传 / 进度 */
    @Bean
    public GroupedOpenApi transferApiGroup() {
        return moduleGroup("03-传输任务", "com.anttransfer.transfer.controller");
    }

    /** 文件存储（at-file）：上传 / 秒传 / 分片 / 下载 */
    @Bean
    public GroupedOpenApi fileApiGroup() {
        return moduleGroup("04-文件存储", "com.anttransfer.file.controller");
    }

    /** 协作共享（at-collaboration）：协作空间 / 外发分享 */
    @Bean
    public GroupedOpenApi collaborationApiGroup() {
        return moduleGroup("05-协作共享", "com.anttransfer.collaboration.controller");
    }

    /**
     * 按「组名 + 模块 Controller 包路径」构建分组。
     *
     * @param name           组名（前缀数字控制 UI 下拉框排列顺序）
     * @param packagesToScan 该模块 Controller 所在包（包路径即模块边界）
     */
    private GroupedOpenApi moduleGroup(String name, String... packagesToScan) {
        return GroupedOpenApi.builder()
                .group(name)
                .packagesToScan(packagesToScan)
                .build();
    }
}
