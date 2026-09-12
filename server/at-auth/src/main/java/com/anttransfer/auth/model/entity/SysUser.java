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
package com.anttransfer.auth.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 系统用户（sys_user）。
 *
 * <p>仅承载认证所需字段；RBAC 角色通过 {@code sys_user_role} / {@code sys_role} 关联
 * （登录与「我的信息」时查询，不随 JWT 携带，保证角色变更即时生效——PRD US-04）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_user")
public class SysUser extends BaseEntity {

    /** 登录账号（唯一） */
    private String username;

    /** 密码散列（BCrypt cost=10） */
    @TableField("password_hash")
    private String passwordHash;

    /** 昵称 / 姓名 */
    private String nickname;

    /** 头像地址 */
    @TableField("avatar_url")
    private String avatarUrl;

    /** 邮箱 */
    private String email;

    /** 账号状态：0-正常 1-禁用（1006） 2-锁定（1005） */
    private Integer status;

    /** 最近登录时间 */
    @TableField("last_login_time")
    private LocalDateTime lastLoginTime;

    /** 会话吊销纪元：全端吊销 +1；access token 携带 ver claim 与之比对（system-design §2.3） */
    @TableField("token_epoch")
    private Long tokenEpoch;

    /** 账号状态：正常 */
    public static final int STATUS_NORMAL = 0;
    /** 账号状态：禁用 */
    public static final int STATUS_DISABLED = 1;
    /** 账号状态：锁定 */
    public static final int STATUS_LOCKED = 2;
}
