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
package com.anttransfer.file.util;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * 不可猜测令牌生成工具（分享 token / 一次性票据共用）。
 *
 * <p>要求（红队 [V-03]：分享链接可被枚举 = 数据泄露）：</p>
 * <ul>
 *     <li>必须使用 {@link SecureRandom}（CSPRNG），<b>不得</b>用 {@code UUID.randomUUID()}
 *         的字符串或时间戳拼接；</li>
 *     <li>熵 ≥ 256 bit，使在线枚举在算力上不可行；</li>
 *     <li>URL 安全字母表（Base64URL 无填充），可直接放入路径 / 查询串。</li>
 * </ul>
 *
 * <p>输出长度：32 字节 → 43 个字符（适配 {@code sys_share_link.token varchar(64)}）。</p>
 *
 * @author AntTransfer CE
 */
public final class SecureTokens {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final int TOKEN_BYTES = 32;

    private SecureTokens() {
    }

    /**
     * 生成高熵 URL 安全令牌（43 字符，256 bit 熵）。
     *
     * @return 不透明随机令牌
     */
    public static String randomToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return ENCODER.encodeToString(bytes);
    }
}
