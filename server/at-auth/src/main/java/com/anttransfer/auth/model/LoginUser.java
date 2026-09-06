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
package com.anttransfer.auth.model;

import lombok.Data;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 当前登录用户上下文（骨架）。
 *
 * <p>职责：承载一次请求中已认证用户的身份摘要信息。由 at-auth 模块
 * （登录校验切面 / 拦截器）在请求开始时解析 Token 填充，
 * 业务侧通过 ThreadLocal 或参数注入获取，避免层层透传 userId。</p>
 *
 * <p>注意：此处仅保存“身份摘要”，不承载用户详细信息（如密码等），
 * 详细信息由各自业务模块按需查询。</p>
 *
 * @author AntTransfer CE
 */
@Data
public class LoginUser implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 用户主键 ID */
    private Long id;

    /** 登录账号（唯一） */
    private String username;

    /** 昵称 */
    private String nickname;

    /** 头像地址 */
    private String avatarUrl;

    /** 角色编码集合（权限点判定由 at-permission 模块负责） */
    private List<String> roles = new ArrayList<>();
}
