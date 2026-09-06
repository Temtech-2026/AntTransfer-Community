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
package com.anttransfer.common.mybatis;

/**
 * 当前登录用户 SPI（供 MyBatis-Plus 自动填充 {@code create_by / update_by} 使用）。
 *
 * <p>存在原因：架构铁律规定 {@code at-common} 不得反向依赖任何 {@code at-*} 业务模块，
 * 因此共享内核无法直接读取 {@code at-auth} 的登录态。这里采用<b>依赖倒置</b>——
 * 由 {@code at-common} 声明接口，{@code at-auth} 实现并注册为 Spring Bean，
 * 填充器通过 {@code ObjectProvider} 可选注入：未接入时（如定时任务、系统内部写入）
 * 自动跳过操作人填充，不影响主流程。</p>
 *
 * <p>实现方约定（at-auth）：</p>
 * <ul>
 *     <li>从当前请求上下文 / Token 解析登录用户；</li>
 *     <li>无登录态或匿名访问时返回 {@code null}（由调用方决定跳过，禁止抛异常）；</li>
 *     <li>必须是无状态、线程安全实现。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
public interface CurrentUserProvider {

    /**
     * 当前登录用户 ID。
     *
     * @return 用户 ID；无登录态 / 系统内部调用时返回 {@code null}
     */
    Long currentUserId();
}
