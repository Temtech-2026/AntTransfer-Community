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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 文件域 ID 下发口径契约：<b>ID 一律以字符串过线</b>。
 *
 * <p>19 位雪花 ID 超出 JS {@code Number.MAX_SAFE_INTEGER}（2^53-1）。若按 JSON number 下发，
 * 浏览器 {@code JSON.parse} 时末位会被静默取整，前端再拿它去拼
 * {@code /v1/files/{nodeId}/preview}、{@code /v1/files/{nodeId}/ticket} 这类路径就查不到节点
 * ——线上表现正是「列表里能看到刚上传的文件，点预览 / 下载却失败」。</p>
 *
 * <p>上传域（{@code PrecheckResultVO} / {@code MergeResultVO}）早已按字符串下发；本用例把文件域
 * 钉在同一口径上，两道防线：</p>
 * <ol>
 *   <li>反射扫描全部对外 VO：{@code Long} 型 ID 字段必须标 {@link JsonSerialize} +
 *       {@link ToStringSerializer}，防止新增 VO / 新增字段漏标；</li>
 *   <li>真实序列化一次：断言 JSON 原文里 ID 是字符串且 19 位一位不少，
 *       同时确认体积等计数字段仍是数字（别顺手一起字符串化）。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
class FileDomainIdJsonContractTest {

    /** 真实形态的 19 位雪花 ID（末位非 0，便于一眼看出去精度）。 */
    private static final long SNOWFLAKE = 1943123456789012345L;

    /** 文件域全部对外 VO；新增 VO 需登记在此，否则防线 ① 覆盖不到。 */
    private static final List<Class<?>> FILE_DOMAIN_VOS = List.of(
            FileNodeVO.class,
            FolderVO.class,
            TagVO.class,
            PreviewVO.class,
            DownloadTicketVO.class,
            UploadResultVO.class,
            FileVersionVO.class,
            ShareLinkVO.class,
            SharePayloadVO.class,
            ShareTicketVO.class,
            PackTaskVO.class
    );

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("防线①：所有 Long 型 ID 字段都以字符串序列化")
    void everyIdFieldIsSerializedAsString() {
        List<String> offenders = new ArrayList<>();
        for (Class<?> vo : FILE_DOMAIN_VOS) {
            for (Field field : vo.getDeclaredFields()) {
                if (!isLongType(field) || !isIdField(field.getName())) {
                    continue;
                }
                JsonSerialize annotation = field.getAnnotation(JsonSerialize.class);
                if (annotation == null || annotation.using() != ToStringSerializer.class) {
                    offenders.add(vo.getSimpleName() + "#" + field.getName());
                }
            }
        }
        assertTrue(offenders.isEmpty(),
                "以下 ID 字段未以字符串下发，浏览器解析时会丢末位精度：" + offenders);
    }

    @Test
    @DisplayName("防线②：序列化后 ID 是字符串且一位不少，计数字段仍是数字")
    void fileNodeIdGoesOutAsExactString() throws Exception {
        FileNodeVO vo = new FileNodeVO();
        vo.setId(SNOWFLAKE);
        vo.setFileId(SNOWFLAKE);
        vo.setFolderId(0L);
        vo.setName("报告.pdf");
        vo.setSizeBytes(2048L);

        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(vo));

        assertTrue(json.get("id").isTextual(), "条目 ID 必须是 JSON 字符串，否则前端会丢精度");
        assertEquals(String.valueOf(SNOWFLAKE), json.get("id").asText());
        assertEquals(19, json.get("id").asText().length(),
                "19 位必须一位不少；若走了 number，这里会是被取整的值");

        assertTrue(json.get("sizeBytes").isNumber(),
                "字节数是计数值，应保持数字，不能被连带字符串化");
        assertEquals(2048L, json.get("sizeBytes").asLong());
    }

    /** 是否为 Long / long 字段（Java 里 ID 两种写法都可能出现，都要盯）。 */
    private static boolean isLongType(Field field) {
        return field.getType() == Long.class || field.getType() == long.class;
    }

    /** ID 字段命名约定：{@code id} 或以 {@code Id} 结尾（nodeId / fileId / uploadUserId ...）。 */
    private static boolean isIdField(String name) {
        return "id".equals(name) || name.endsWith("Id");
    }
}
