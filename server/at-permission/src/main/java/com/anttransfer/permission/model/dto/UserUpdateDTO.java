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
import jakarta.validation.constraints.Size;

/**
 * 编辑用户入参（资料 + 调岗）。
 *
 * <p>对应 {@code PUT /api/v1/system/users/{id}}（需 {@code system:user:update}）。</p>
 *
 * <p><b>为什么调岗并入本接口：</b>调岗改的就是 {@code sys_user.dept_id} 这一个资料字段，
 * 但它有安全副作用——调岗后必须触发「权限重评估」回收该用户审批类授权
 * （避免带着原部门的授权去新部门）。副作用由服务层统一挂在该字段变更上，
 * 前端只需提交资料；单独再开一个接口反而给了「只改部门不触发重评估」的旁路。</p>
 *
 * <p>不含账号名（不可改）、不含口令（独立接口）、不含状态（独立接口）、不含角色（独立接口）。</p>
 *
 * @param nickname 昵称 / 姓名
 * @param email    邮箱（可空）
 * @param mobile   手机号（可空）
 * @param deptId   所属部门（可空=解除部门分配；与原值不同即视为调岗）
 * @param remark   备注（可空）
 * @author AntTransfer CE
 */
public record UserUpdateDTO(

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
        String remark) {
}
