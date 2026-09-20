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

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;

/**
 * 口令强度策略：<b>本人自助改密</b>的唯一判定口径。
 *
 * <p>规则（逐条都带具体原因，前端可直接展示）：</p>
 * <ol>
 *     <li>长度 {@value #MIN_LENGTH}~{@value #MAX_LENGTH} 位；</li>
 *     <li>不含空白字符（前后空格、Tab 会让「看着一样」的口令登录失败）；</li>
 *     <li>同时包含字母与数字；</li>
 *     <li>与原口令不同（否则「改密」等于没改，却白白吊销了全部会话）。</li>
 * </ol>
 *
 * <p><b>为什么上限是 64 而不是「不限」：</b>BCrypt 对超过 72 字节的输入会静默截断，
 * 不设上限会让「超长口令」在散列层面失真——用户以为设了 200 位，实际只生效前 72 字节。</p>
 *
 * <p><b>为什么不复用管理面（at-permission）的校验：</b>模块铁律规定 at-permission 仅依赖 at-common，
 * 反向则禁止，故管理面建号 / 重置口令的「8~64 位」下限写在各自 DTO 的 {@code @Size} 上。
 * 两处数值必须保持一致，已登记于 {@code docs/development/AT-DIFF-todos.md}（后续统一到 at-common）。</p>
 *
 * <p>违反策略统一抛 {@link ErrorCode#PASSWORD_POLICY_VIOLATION}（1030，策略 E），
 * 具体原因放在 message 而非另立错误码：对前端而言「新口令不合规」是同一类处理（就地提示 + 保持弹窗）。</p>
 *
 * @author AntTransfer CE
 */
public final class PasswordPolicy {

    /** 口令最短长度（与管理面 DTO 的 {@code @Size(min)} 口径一致） */
    public static final int MIN_LENGTH = 8;

    /** 口令最长长度（BCrypt 72 字节截断线以内的安全上限） */
    public static final int MAX_LENGTH = 64;

    private PasswordPolicy() {
    }

    /**
     * 校验新口令：强度合规且与原口令不同。
     *
     * @param newPassword 新口令（明文，仅在本次调用栈内存在，不得落日志 / 审计）
     * @param oldPassword 原口令（明文；调用方须<b>先</b>完成原口令校验，否则差异判定无意义）
     * @throws BusinessException 1030，message 说明具体违规原因
     */
    public static void assertCompliant(String newPassword, String oldPassword) {
        assertCompliant(newPassword);
        if (newPassword.equals(oldPassword)) {
            throw new BusinessException(ErrorCode.PASSWORD_POLICY_VIOLATION, "新密码不能与原密码相同");
        }
    }

    /**
     * 校验口令本身是否满足强度策略（不涉及原口令）。
     *
     * @throws BusinessException 1030，message 说明具体违规原因
     */
    public static void assertCompliant(String rawPassword) {
        if (rawPassword == null
                || rawPassword.length() < MIN_LENGTH
                || rawPassword.length() > MAX_LENGTH) {
            throw new BusinessException(ErrorCode.PASSWORD_POLICY_VIOLATION,
                    "新密码长度须为 " + MIN_LENGTH + "~" + MAX_LENGTH + " 位");
        }
        if (rawPassword.chars().anyMatch(Character::isWhitespace)) {
            throw new BusinessException(ErrorCode.PASSWORD_POLICY_VIOLATION, "新密码不能包含空格或制表符");
        }
        boolean hasLetter = rawPassword.chars().anyMatch(Character::isLetter);
        boolean hasDigit = rawPassword.chars().anyMatch(Character::isDigit);
        if (!hasLetter || !hasDigit) {
            throw new BusinessException(ErrorCode.PASSWORD_POLICY_VIOLATION, "新密码须同时包含字母与数字");
        }
    }
}
