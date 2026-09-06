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
}
