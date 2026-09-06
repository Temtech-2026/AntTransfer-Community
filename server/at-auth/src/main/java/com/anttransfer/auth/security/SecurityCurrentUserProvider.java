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
package com.anttransfer.auth.security;

import com.anttransfer.auth.model.LoginUser;
import com.anttransfer.common.mybatis.CurrentUserProvider;
import org.springframework.stereotype.Component;

/**
 * at-common {@link CurrentUserProvider} SPI 的认证实现：
 * 使 MyBatis-Plus 公共字段自动填充器（at-bootstrap FillMetaObjectHandler）
 * 能写入 createBy / updateBy。
 *
 * <p>依赖方向正确：接口在 at-common，at-auth 实现并注入；
 * at-bootstrap 的填充器只依赖接口（依赖倒置，见 at-common mybatis 包规约）。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class SecurityCurrentUserProvider implements CurrentUserProvider {

    @Override
    public Long currentUserId() {
        return SecurityUtils.getOptionalLoginUser().map(LoginUser::getId).orElse(null);
    }
}
