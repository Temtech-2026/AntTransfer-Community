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

/**
 * CE / EE 差异化扩展点（Service Provider Interface）——社区版与商业版之间的<b>唯一</b>接缝。
 *
 * <h2>放这里的理由</h2>
 * <p>这些接口过去散落在 {@code at-file} / {@code at-permission} 的 {@code extension} 包中，
 * 虽然模块间已无循环依赖，但企业版实现为了「实现一个接口」仍需依赖 {@code at-file} / {@code at-permission}
 * 的完整实现包（含存储、实体、internal 细节）。上收至 {@code at-common} 后，EE 只需依赖
 * {@code at-common} 即可实现全部扩展点，CE 的实现细节对 EE 不可见。</p>
 *
 * <h2>子包导航</h2>
 * <ul>
 *     <li>{@code identity} —— 身份提供方（本地账号 / LDAP / OIDC / 企业 IM）</li>
 *     <li>{@code scan} —— 入库病毒扫描 + 外发内容扫描（DLP）</li>
 *     <li>{@code crypto} —— 存储编解码（KMS 信封加密的唯一插入点）</li>
 *     <li>{@code watermark} —— 下载水印（明水印 / 盲水印）</li>
 *     <li>{@code approval} —— 审批节点解析（单级 / 多级 / 会签 / 动态）</li>
 *     <li>{@code transport} —— 传输协议策略（HTTP / QUIC）</li>
 * </ul>
 *
 * <h2>装配约定（强制）</h2>
 * <ol>
 *     <li><b>禁止特性开关</b>：不得出现 {@code if (eeEnabled)} / {@code if (license.isEnterprise())} 之类的运行时分支。
 *         能力差异只能通过「Bean 是否存在」表达——CE 提供默认实现（{@code @ConditionalOnMissingBean}），
 *         EE 覆盖定义。任何新增的扩展点都必须同时补上 CE 默认 Bean，保证不配置也能启动。</li>
 *     <li><b>有序管道</b>：同类多实现用 {@code @Order} + 聚合器（{@code ...Chain} / {@code ...Pipeline}）串行执行，
 *         不把 {@code List} 注入到业务类里自行遍历。</li>
 *     <li><b>拒绝语义</b>：闸门类扩展点用「返回结论对象」表达拒绝（Deny 优先），不抛业务异常，
 *         以便主链路统一落审计后转错误码。</li>
 *     <li><b>默认实现必须可观测</b>：CE 直通实现（{@code Noop*} / {@code Plain*}）不得静默改变字节流、
 *         不得吞错，且必须能被单测断言「接入前后行为一致」。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
package com.anttransfer.common.spi;
