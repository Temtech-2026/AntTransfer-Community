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
package com.anttransfer.permission.model.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 创建用户入参。
 *
 * <p>对应 {@code POST /api/v1/system/users}（需 {@code system:user:create}）。
 * 口令为明文，散列在表主 at-auth 内完成（见 {@code UserAdminPort}）；</p>
 *
 * @param username  登录账号（3~64 位字母数字下划线点横线）
 * @param password  初始口令（明文，8~64 位）
 * @param nickname  昵称 / 姓名
 * @param email     邮箱（可空，非空时应用层去重）
 * @param mobile    手机号（可空）
 * @param deptId    所属部门（可空=未分配）
 * @param remark    备注（可空）
 * @param roleIds   初始角色 ID 集合（可空=不分配角色）
 * @author AntTransfer CE
 */
public record UserCreateDTO(

        @NotBlank(message = "登录账号不能为空")
        @Pattern(regexp = "^[A-Za-z0-9_.-]{3,64}$",
                message = "登录账号须为 3~64 位字母/数字/下划线/点/横线")
        String username,

        @NotBlank(message = "初始口令不能为空")
        @Size(min = 8, max = 64, message = "口令长度须为 8~64 位")
        String password,

        @NotBlank(message = "昵称不能为空")
        @Size(max = 64, message = "昵称不超过 64 字符")
        String nickname,

        @Email(message = "邮箱格式不正确")
        @Size(max = 128, message = "邮箱不超过 128 字符")
        String email,

        @Size(max = 32, message = "手机号不超过 32 字符")
        String mobile,

        Long deptId,

        @Size(max = 255, message = "备注不超过 255 字符")
        String remark,

        List<Long> roleIds) {
}
