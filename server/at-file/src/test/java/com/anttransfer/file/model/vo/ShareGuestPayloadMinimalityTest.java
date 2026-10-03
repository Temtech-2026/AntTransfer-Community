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
package com.anttransfer.file.model.vo;

import com.fasterxml.jackson.databind.BeanDescription;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 越权用例 TC-H-09 / TC-H-10「访客侧免登录端点的信息泄露面」的可执行载体。
 *
 * <p>访客链路的调用方<b>没有账号</b>，因此它返回的每个字段都是「无差别公开」的。
 * 这类泄露不会以越权异常的形式暴露——接口本来就该 200，问题在于 200 里多带了什么。
 * 故这里用<b>字段白名单的精确相等</b>把披露面钉死：</p>
 * <ol>
 *   <li><b>新增字段必然失败</b>：白名单是集合相等而非「包含」，任何人往访客 VO 上加字段
 *       都会让本用例变红，必须显式回答「这个字段能不能给未登录访客看」；</li>
 *   <li><b>危险词扫描</b>：即便有人把字段加进了白名单，字段名命中 path / storage / bucket /
 *       secret / extractCode / ownerUserId 等词也直接判失败——存储位置与归属信息不属于访客该知道的任何形态；</li>
 *   <li><b>不允许注解旁路</b>：{@code @JsonAnyGetter} 能绕过字段清单动态塞入任意键，
 *       故显式断言其不存在；同时用 Jackson 的真实属性内省（而非 {@code getDeclaredFields}），
 *       让 {@code @JsonProperty} 改名 / {@code @JsonIgnore} 也纳入同一份契约。</li>
 * </ol>
 *
 * <p>为什么「换票前」与「换票后」要分开看：换票返回的 {@link ShareTicketVO} 出现在
 * <b>提取码校验通过之前</b>的语义位置（票据只覆盖「校验 → 取件」的间隔），
 * 一旦它带上文件名 / 大小，就等于把「这个链接指向什么」免费告诉任何拿到链接的人；
 * 而 {@link SharePayloadVO} 虽然是核销后的载荷，也<b>刻意不带存储路径</b>——
 * 否则访客可绕过票据直连存储后端。</p>
 *
 * <p>纯 POJO 测试，不起 Spring 上下文。</p>
 *
 * @author AntTransfer CE
 */
class ShareGuestPayloadMinimalityTest {

    /** 访客换票返回的票据：只描述「凭证本身」，不含任何文件信息。 */
    private static final Set<String> TICKET_FIELDS = Set.of(
            "ticket", "shareToken", "accessType", "expireAt", "ttlSeconds", "remainingCount");

    /** 核销取件返回的载荷：含取件所需的文件元信息，但不含存储位置与归属。 */
    private static final Set<String> PAYLOAD_FIELDS = Set.of(
            "shareId", "fileId", "fileName", "sizeBytes", "sha256", "contentType",
            "accessType", "contentTicket", "expiresInSeconds");

    /** 未登录调用方绝不该看到的字段名片段（小写匹配）。 */
    private static final List<String> FORBIDDEN_TOKENS = List.of(
            "path", "storage", "bucket", "objectkey", "localpath", "rootpath", "diskpath",
            "secret", "password", "extractcode", "owneruserid", "userid", "salt");

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 用 Jackson 的真实序列化内省取属性名：@JsonProperty / @JsonIgnore 都会被正确反映。 */
    private Set<String> serializedProperties(Class<?> type) {
        BeanDescription description = objectMapper.getSerializationConfig()
                .introspect(objectMapper.constructType(type));
        assertNull(description.findAnyGetter(),
                type.getSimpleName() + " 存在 @JsonAnyGetter，可绕过字段白名单动态塞入任意键");
        return description.findProperties().stream()
                .map(BeanPropertyDefinition::getName)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private void assertNoForbiddenTokens(String voName, Set<String> fields) {
        List<String> offenders = fields.stream()
                .filter(field -> {
                    String lower = field.toLowerCase(Locale.ROOT);
                    return FORBIDDEN_TOKENS.stream().anyMatch(lower::contains);
                })
                .toList();
        assertTrue(offenders.isEmpty(),
                voName + " 出现了存储位置 / 凭证 / 归属类字段，访客侧不应看到：" + offenders);
    }

    @Test
    @DisplayName("TC-H-10 换票返回体：字段集与白名单精确相等，且不含文件元信息")
    void ticketPayload_exposesOnlyCredentialFields() {
        Set<String> fields = serializedProperties(ShareTicketVO.class);

        assertEquals(TICKET_FIELDS, fields,
                "换票发生在提取码校验语义之前，这里多带一个字段就等于免费公开它；"
                        + "如需新增请先确认「未登录访客能否知道」");
        assertNoForbiddenTokens("ShareTicketVO", fields);

        Set<String> fileMetadata = Set.of("fileId", "fileName", "originalName", "sizeBytes", "sha256", "contentType");
        Set<String> leaked = fields.stream().filter(fileMetadata::contains).collect(Collectors.toSet());
        assertTrue(leaked.isEmpty(), "票据里出现了文件元信息，等于向持链接者免费透露「链接指向什么」：" + leaked);
    }

    @Test
    @DisplayName("TC-H-10 核销载荷：字段集与白名单精确相等，且不含存储位置与归属")
    void redeemedPayload_exposesNoStorageLocation() {
        Set<String> fields = serializedProperties(SharePayloadVO.class);

        assertEquals(PAYLOAD_FIELDS, fields,
                "载荷带上了白名单外的字段；存储位置一旦下发，访客可绕过票据直连存储后端");
        assertNoForbiddenTokens("SharePayloadVO", fields);
    }

    @Test
    @DisplayName("TC-H-10 载荷里的 Long 型 ID 必须是字符串（与文件域 ID 口径一致）")
    void payloadIds_goOutAsStrings() {
        Set<String> idFields = serializedProperties(SharePayloadVO.class).stream()
                .filter(name -> "shareId".equals(name) || "fileId".equals(name))
                .collect(Collectors.toSet());

        assertEquals(Set.of("shareId", "fileId"), idFields, "ID 字段名被改名会让前端拿不到取件所需标识");
        // 19 位雪花 ID 若以 number 下发，浏览器 parse 时会丢末位，取件必然查不到
        for (String idField : idFields) {
            assertTrue(hasToStringSerializer(SharePayloadVO.class, idField),
                    idField + " 未标 @JsonSerialize(using = ToStringSerializer.class)，前端会丢精度");
        }
    }

    private boolean hasToStringSerializer(Class<?> type, String fieldName) {
        try {
            var field = type.getDeclaredField(fieldName);
            var annotation = field.getAnnotation(com.fasterxml.jackson.databind.annotation.JsonSerialize.class);
            return annotation != null
                    && annotation.using() == com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class;
        } catch (NoSuchFieldException e) {
            return false;
        }
    }
}
