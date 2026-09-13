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

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 管理员重置用户口令入参。
 *
 * <p>对应 {@code POST /api/v1/system/users/{id}/reset-password}
 * （需 {@code system:user:reset-password}）。</p>
 *
 * <p>管理员重置不是「修改自己的口令」：禁止对自己调用（走个人中心的自助改密，
 * 需校验原口令），否则就成了绕过原口令校验的提权旁路。重置成功后在途会话全部失效。</p>
 *
 * @param newPassword 新口令（明文，8~64 位）
 * @author AntTransfer CE
 */
public record UserResetPasswordDTO(

        @NotBlank(message = "新口令不能为空")
        @Size(min = 8, max = 64, message = "口令长度须为 8~64 位")
        String newPassword) {
}
