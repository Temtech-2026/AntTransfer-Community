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

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 敏感数据脱敏器：把「绝不记录口令 / 令牌 / 提取码」从<b>约定</b>变成<b>机制</b>。
 *
 * <p><b>为什么需要它：</b>现有三个审计写入器（{@code PermissionAuditLogger} /
 * {@code FileAuditLogger} / {@code ShareAuditLogger}）都在 javadoc 里承诺「detail 已脱敏」，
 * 但脱敏动作全靠「写的人记得别 put 进去」。这类靠自觉防住的边界，一次疏忽就是明文口令
 * 永久留档（append-only 表，删不掉）。本类把判据收敛成「按键名自动脱敏」，
 * 让 {@code detail} 在序列化前的最后一步被机械清洗。</p>
 *
 * <p><b>为什么整棵子树替换而不是逐个叶子：</b>一个键被判为敏感时，其值可能是
 * Map / List / 数组（如 {@code tokens: ["a","b"]}）。逐个叶子替换会漏掉未来新增的嵌套形态；
 * 整棵子树替换为 {@code ***} 是 fail-closed。</p>
 *
 * @author AntTransfer CE
 */
public final class SensitiveDataMasker {

    /** 全遮占位（不保留长度——长度本身对低熵提取码就是信息）。 */
    public static final String MASK = "***";

    /** 递归深度上限：防环状引用与深嵌套导致栈溢出。 */
    public static final int MAX_DEPTH = 6;

    /** 键名归一后<b>精确</b>命中即全遮（短词歧义大，只认精确匹配，避免 statusCode 被误伤）。 */
    private static final Set<String> EXACT_KEYS = Set.of(
            "pwd", "code", "pin", "otp", "jti", "sign", "signature", "captcha", "credential", "nonce");

    /** 键名归一后<b>包含</b>即全遮（长词足够无歧义）。 */
    private static final Set<String> CONTAINS_KEYS = Set.of(
            "password", "passwd", "secret", "token", "apikey", "accesskey", "privatekey",
            "authorization", "cookie", "sessionid", "sharecode", "extractcode", "verifycode");

    /** 部分保留的键（可读性优先）。 */
    private static final Set<String> EMAIL_KEYS = Set.of("email", "mail", "useremail", "contactemail");
    private static final Set<String> PHONE_KEYS = Set.of("phone", "mobile", "tel", "telephone", "phonenumber");
    private static final Set<String> ID_CARD_KEYS = Set.of("idcard", "idno", "idnumber", "identitycard");

    /** 「看起来是纯数字」——用于避免 csvCell 之类的场景把负数误判为公式（本类暂未使用）。 */
    private static final Pattern PLAIN_NUMBER = Pattern.compile("-?\\d+(\\.\\d+)?");

    private SensitiveDataMasker() {
    }

    /** 全遮：非空一律 {@link #MASK}，空 / null 原样返回（区分「没有值」与「值被遮」）。 */
    public static String maskFully(String value) {
        return (value == null || value.isEmpty()) ? value : MASK;
    }

    /**
     * 令牌部分保留：{@code 前 4 + **** + 后 4}，短令牌整体全遮。
     *
     * <p>仅用于排障场景（如「这条失败记录是哪个令牌签发的」需能对上前后缀）；
     * 若调用方不需要对应关系，应直接用 {@link #maskFully(String)}。</p>
     */
    public static String maskToken(String token) {
        if (token == null || token.isEmpty()) {
            return token;
        }
        if (token.length() < 12) {
            return MASK;
        }
        return token.substring(0, 4) + "****" + token.substring(token.length() - 4);
    }

    /** 邮箱：保留首字符与域名，{@code a***@example.com}。 */
    public static String maskEmail(String email) {
        if (email == null || email.isEmpty()) {
            return email;
        }
        int at = email.indexOf('@');
        if (at <= 0 || at == email.length() - 1) {
            return MASK;
        }
        String local = email.substring(0, at);
        String head = local.length() <= 1 ? "" : local.substring(0, 1);
        return head + MASK + email.substring(at);
    }

    /** 手机号：保留前 3 后 4，{@code 138****8000}。 */
    public static String maskPhone(String phone) {
        if (phone == null || phone.isEmpty()) {
            return phone;
        }
        if (phone.length() < 7) {
            return MASK;
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }

    /** 身份证：保留前 6 后 4。 */
    public static String maskIdCard(String idCard) {
        if (idCard == null || idCard.isEmpty()) {
            return idCard;
        }
        if (idCard.length() < 11) {
            return MASK;
        }
        return idCard.substring(0, 6) + "********" + idCard.substring(idCard.length() - 4);
    }

    /**
     * 按键名选择脱敏策略（审计 detail 的入口）。
     *
     * @param key   字段名（大小写 / 下划线 / 连字符不敏感）
     * @param value 字段值
     * @return 脱敏后的值
     */
    public static String maskByName(String key, String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        String normalized = normalizeKey(key);
        if (isFullySensitive(normalized)) {
            return maskFully(value);
        }
        if (containsAny(normalized, EMAIL_KEYS)) {
            return maskEmail(value);
        }
        if (containsAny(normalized, PHONE_KEYS)) {
            return maskPhone(value);
        }
        if (containsAny(normalized, ID_CARD_KEYS)) {
            return maskIdCard(value);
        }
        return value;
    }

    /** 键名是否属「必须全遮」类。 */
    public static boolean isFullySensitive(String key) {
        String normalized = normalizeKey(key);
        if (EXACT_KEYS.contains(normalized)) {
            return true;
        }
        for (String token : CONTAINS_KEYS) {
            if (normalized.contains(token)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 递归脱敏一个 Map（不改入参，返回新 Map）。
     *
     * @param source 原始 map（可为 null）
     * @return 脱敏后的 LinkedHashMap；入参为 null 时返回空 map
     */
    public static Map<String, Object> maskMap(Map<String, Object> source) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (source == null) {
            return result;
        }
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            String key = entry.getKey();
            if (isFullySensitive(key)) {
                result.put(key, MASK);
                continue;
            }
            if (containsAny(normalizeKey(key), EMAIL_KEYS)) {
                result.put(key, maskByName(key, asText(entry.getValue())));
                continue;
            }
            result.put(key, maskValue(entry.getValue(), 1));
        }
        return result;
    }

    /**
     * 递归脱敏任意值（Map / Collection / 数组 / 标量）。
     *
     * @param value 原始值
     * @param depth 当前深度（外部调用传 1）
     * @return 脱敏后的等价结构
     */
    public static Object maskValue(Object value, int depth) {
        if (value == null || depth > MAX_DEPTH) {
            return value;
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> nested = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                Object nestedValue = entry.getValue();
                if (isFullySensitive(key)) {
                    nested.put(key, MASK);
                } else {
                    nested.put(key, maskValue(nestedValue, depth + 1));
                }
            }
            return nested;
        }
        if (value instanceof Collection<?> collection) {
            List<Object> masked = new ArrayList<>(collection.size());
            for (Object element : collection) {
                masked.add(maskValue(element, depth + 1));
            }
            return masked;
        }
        if (value.getClass().isArray()) {
            Object[] array = (Object[]) value;
            List<Object> masked = new ArrayList<>(array.length);
            for (Object element : array) {
                masked.add(maskValue(element, depth + 1));
            }
            return masked;
        }
        return value;
    }

    /** 键名归一：小写 + 去掉下划线 / 连字符 / 空格。 */
    private static String normalizeKey(String key) {
        if (key == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(key.length());
        for (int i = 0; i < key.length(); i++) {
            char c = key.charAt(i);
            if (c == '_' || c == '-' || c == ' ') {
                continue;
            }
            sb.append(Character.toLowerCase(c));
        }
        return sb.toString();
    }

    private static boolean containsAny(String normalizedKey, Set<String> candidates) {
        for (String candidate : candidates) {
            if (normalizedKey.contains(candidate)) {
                return true;
            }
        }
        return false;
    }

    private static String asText(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    /** 供未来「值本身就是数字」判定使用（当前保留以固定行为，避免误伤负数字段）。 */
    static boolean isPlainNumber(String value) {
        return value != null && PLAIN_NUMBER.matcher(value).matches();
    }
}
