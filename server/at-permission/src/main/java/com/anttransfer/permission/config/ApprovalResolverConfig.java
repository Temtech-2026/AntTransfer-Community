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
package com.anttransfer.permission.config;

import com.anttransfer.common.spi.approval.ApprovalNodeResolver;
import com.anttransfer.permission.extension.SingleNodeApprovalResolver;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * CE 审批扩展点默认装配。
 *
 * <p>{@code @ConditionalOnMissingBean} 保证 EE 一旦提供自己的 {@link ApprovalNodeResolver}
 * （多级 / 会签 / 动态解析），CE 单节点实现自动让位，<b>无需修改业务代码或删除本类</b>——
 * 这是 CE/EE 分离在审批域的落地点。</p>
 *
 * @author AntTransfer CE
 */
@Configuration(proxyBeanMethods = false)
public class ApprovalResolverConfig {

    /** CE 默认：单节点审批人解析（资源属主 → 兜底安全管理员） */
    @Bean
    @ConditionalOnMissingBean(ApprovalNodeResolver.class)
    public ApprovalNodeResolver singleNodeApprovalResolver(ApprovalProperties properties) {
        return new SingleNodeApprovalResolver(properties);
    }
}
