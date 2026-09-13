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
 * ABAC 规则解析结论（{@link AccessRuleResolver} 的返回值）。
 *
 * <p>三值语义：</p>
 * <ul>
 *     <li>{@link #ALLOW}：规则明确放行（如命中时间窗 / IP 白名单）；</li>
 *     <li>{@link #DENY}：规则明确拒绝（<b>Deny 优先</b>，一旦出现即拒绝，覆盖其他 ALLOW）；</li>
 *     <li>{@link #ABSTAIN}：本规则不表态，交由其他规则或默认策略决定。</li>
 * </ul>
 *
 * <p>CE 默认不注册任何 {@link AccessRuleResolver}，链解析恒为 {@link #ABSTAIN}（等价放行），
 * 因此该扩展点在 CE 为纯占位；EE 可注册时间窗 / IP 白名单等动态规则解析器。</p>
 *
 * @author AntTransfer CE
 */
public enum AccessRuleDecision {

    /** 放行 */
    ALLOW,

    /** 拒绝（Deny 优先） */
    DENY,

    /** 不表态 */
    ABSTAIN
}
