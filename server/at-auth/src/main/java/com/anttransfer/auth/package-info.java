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
 * at-auth 认证鉴权模块。
 *
 * <p>模块职责：负责用户登录态的全生命周期管理——Token 签发与校验、
 * 当前登录用户上下文 {@link com.anttransfer.auth.model.LoginUser}、
 * 接口登录校验注解 {@link com.anttransfer.auth.annotation.RequireLogin}。</p>
 *
 * <p>子包规划（已落地，禁止跨模块引用其他业务包）：</p>
 * <ul>
 *     <li>{@code controller}：登录 / 登出 / 刷新令牌 / 我的信息接口；</li>
 *     <li>{@code service}：认证编排、令牌会话（Redis 白名单 + 纪元缓存）、登录失败计数；</li>
 *     <li>{@code security}：JWT 签发验签、认证过滤器、401/403 统一 Result 输出、安全上下文工具；</li>
 *     <li>{@code config}：SecurityConfig（过滤链与白名单）、AuthProperties（密钥与 TTL）；</li>
 *     <li>{@code model}：LoginUser 身份模型；{@code dto}：请求 / 响应模型；</li>
 *     <li>{@code entity / mapper}：sys_user 认证实体与数据访问。</li>
 * </ul>
 */
package com.anttransfer.auth;
