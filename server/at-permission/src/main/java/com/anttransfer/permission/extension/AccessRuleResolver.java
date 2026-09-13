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
package com.anttransfer.permission.extension;

/**
 * ABAC 规则解析扩展点（CE/EE 边界，P1）。
 *
 * <p>CE 只保留扩展点、不内置任何时间 / IP 规则；EE 提供实现并注册为 Spring Bean 后，
 * {@link AccessRuleResolverChain} 会自动装配，无需改动权限校验主流程。</p>
 *
 * <p><b>约定：</b></p>
 * <ul>
 *     <li>{@link #supports} 负责按规则类型路由，返回 {@code false} 时本解析器不参与判定；</li>
 *     <li>{@link #evaluate} 只做只读判定，不得产生副作用；</li>
 *     <li>多个解析器同时命中时 <b>Deny 优先</b>（详见 {@link AccessRuleResolverChain}）。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
public interface AccessRuleResolver {

    /**
     * 是否处理该上下文（按规则类型路由）。
     */
    boolean supports(AccessRuleContext context);

    /**
     * 判定规则；实现不得返回 {@code null}。
     */
    AccessRuleDecision evaluate(AccessRuleContext context);
}
