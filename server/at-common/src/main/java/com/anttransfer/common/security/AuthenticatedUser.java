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
package com.anttransfer.common.security;

/**
 * 已认证主体契约（存于 Spring SecurityContext 的 principal 的最小公共视图）。
 *
 * <p>存在原因：架构铁律禁止业务模块互相依赖——at-auth 构造的 principal
 * （{@code at.auth.model.LoginUser}）无法被 at-permission 直接 import。
 * 因此把「只读身份摘要」抽到 at-common 作共享契约：签发方（at-auth）让登录用户实现本接口，
 * 消费方（at-permission 等）只依赖本接口从 SecurityContext 读取当前用户，不产生模块耦合。</p>
 *
 * @author AntTransfer CE
 */
public interface AuthenticatedUser {

    /**
     * 用户主键 ID。
     */
    Long getId();

    /**
     * 登录账号。
     */
    String getUsername();

    /**
     * 昵称 / 姓名（可能为空）。
     */
    String getNickname();
}
