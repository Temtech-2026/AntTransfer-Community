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
package com.anttransfer.common.spi.identity;

/**
 * 一次登录凭据提交——{@link IdentityProvider} 的入参。
 *
 * <p>只承载「用户是谁 + 凭什么证明」，不承载锁定计数、验证码、设备指纹等平台策略：
 * 那些属于登录编排（{@code AuthService}），换身份源也不该变。</p>
 *
 * @param username    登录名（调用方已完成 trim；可能为 null，由实现自行判定为无效凭据）
 * @param rawPassword 明文口令（CE 本地认证使用；SSO 场景为 null，实现不应假设其非空）
 * @author AntTransfer CE
 */
public record AuthenticationRequest(String username, String rawPassword) {
}
