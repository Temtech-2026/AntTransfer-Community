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
 * <p>建议子包规划（骨架阶段可按需逐步补齐，禁止跨模块引用其他业务包）：</p>
 * <ul>
 *     <li>{@code controller}：登录 / 注册 / 登出 / 刷新 Token 接口（依赖 spring-web）；</li>
 *     <li>{@code service}：认证核心逻辑（jwt 签发、校验、会话管理）；</li>
 *     <li>{@code model}：LoginUser 等传输 / 身份模型；</li>
 *     <li>{@code annotation}：RequireLogin 等切面注解；</li>
 *     <li>{@code mapper / entity}：如需持久化账号数据时自行维护。</li>
 * </ul>
 */
package com.anttransfer.auth;
