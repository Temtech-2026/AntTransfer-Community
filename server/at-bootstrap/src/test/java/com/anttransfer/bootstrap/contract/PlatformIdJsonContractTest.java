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
package com.anttransfer.bootstrap.contract;

import com.anttransfer.auth.model.vo.AuthVos;
import com.anttransfer.collaboration.model.vo.ChatRecallVO;
import com.anttransfer.collaboration.model.vo.ConversationVO;
import com.anttransfer.collaboration.model.vo.NotifyMessageVO;
import com.anttransfer.collaboration.model.vo.TodoItemVO;
import com.anttransfer.collaboration.model.vo.UnreadCountVO;
import com.anttransfer.collaboration.model.vo.WsConnectedVO;
import com.anttransfer.permission.model.vo.ApprovalRequestVO;
import com.anttransfer.permission.model.vo.AuditLogVO;
import com.anttransfer.permission.model.vo.DeptOptionVO;
import com.anttransfer.permission.model.vo.PermissionMapView;
import com.anttransfer.permission.model.vo.PermissionPointVO;
import com.anttransfer.permission.model.vo.PermissionView;
import com.anttransfer.permission.model.vo.RoleVO;
import com.anttransfer.permission.model.vo.UserVO;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.RecordComponent;
import java.lang.reflect.Type;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 平台级 ID 下发口径契约：对外 VO 的 ID 一律以字符串过线。
 *
 * <p>19 位雪花 ID 超出 JS {@code Number.MAX_SAFE_INTEGER}（2^53-1）。以 JSON number 下发时，
 * 浏览器 {@code JSON.parse} 会静默取整末位——线上表现正是「用户列表里看得到这个人，发起会话
 * 点发送却提示『目标用户不存在或不可用』」：会话的 {@code targetId} 被舍入后再回传后端，
 * 后端按错号的 ID 查人自然查无此人。</p>
 *
 * <p>文件域已有 {@code FileDomainIdJsonContractTest}；本用例把认证域、权限域、协作域的
 * 全部对外 VO 收进同一清单，两道防线：①反射扫描 Long / List&lt;Long&gt; 型 ID 字段必须标注
 * {@code ToStringSerializer}；②真实序列化，断言 ID 是字符串且 19 位一位不少，计数字段仍为数字。</p>
 *
 * <p>新增对外 VO 时登记进 {@link #ROOT_VOS}；嵌套 record 由字段类型递归发现，无需重复登记。</p>
 *
 * @author AntTransfer CE
 */
class PlatformIdJsonContractTest {

    /** 真实形态的 19 位雪花 ID（末位非 0，便于一眼看出去精度）。 */
    private static final long SNOWFLAKE = 1943123456789012345L;

    private static final String SNOWFLAKE_STR = String.valueOf(SNOWFLAKE);

    /** 认证域 / 权限域 / 协作域的对外 VO 根清单；新增 VO 需登记在此。 */
    private static final List<Class<?>> ROOT_VOS = List.of(
            AuthVos.UserSummary.class,
            AuthVos.TokenResponse.class,
            UserVO.class,
            RoleVO.class,
            DeptOptionVO.class,
            PermissionPointVO.class,
            PermissionView.class,
            PermissionMapView.class,
            ApprovalRequestVO.class,
            AuditLogVO.class,
            ConversationVO.class,
            ChatRecallVO.class,
            NotifyMessageVO.class,
            TodoItemVO.class,
            UnreadCountVO.class,
            WsConnectedVO.class
    );

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    @DisplayName("防线①：对外 VO 的 Long 型 ID 字段都以字符串序列化")
    void everyIdFieldIsSerializedAsString() {
        List<String> offenders = new ArrayList<>();
        for (Class<?> vo : collectAllVoTypes()) {
            for (Field field : vo.getDeclaredFields()) {
                if (field.isSynthetic() || !isIdField(field.getName())) {
                    continue;
                }
                if (isLongType(field.getType())) {
                    JsonSerialize annotation = field.getAnnotation(JsonSerialize.class);
                    if (annotation == null || annotation.using() != ToStringSerializer.class) {
                        offenders.add(vo.getSimpleName() + "#" + field.getName());
                    }
                } else if (isLongList(field)) {
                    JsonSerialize annotation = field.getAnnotation(JsonSerialize.class);
                    if (annotation == null || annotation.contentUsing() != ToStringSerializer.class) {
                        offenders.add(vo.getSimpleName() + "#" + field.getName() + "(List<Long>)");
                    }
                }
            }
        }
        assertTrue(offenders.isEmpty(),
                "以下 ID 字段未以字符串下发，浏览器解析时会丢末位精度：" + offenders);
    }

    @Test
    @DisplayName("防线②：序列化后 ID 是字符串且 19 位一位不少")
    void everyIdFieldGoesOutAsExactString() throws Exception {
        for (Class<?> vo : collectAllVoTypes()) {
            Object instance = sample(vo, new HashSet<>());
            JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(instance));
            assertIdFieldsAreExactStrings(json, vo.getSimpleName());
        }
    }

    @Test
    @DisplayName("防线③：计数字段保持数字，不被连带字符串化")
    void countFieldsStayNumeric() throws Exception {
        JsonNode conversation = objectMapper.readTree(objectMapper.writeValueAsString(
                new ConversationVO(1, SNOWFLAKE, "张三", null, SNOWFLAKE, "在吗", 1, SNOWFLAKE,
                        false, null, 3L, 2L)));
        assertTrue(conversation.get("unreadCount").isNumber(), "会话未读数是计数值，应保持数字");
        assertEquals(3L, conversation.get("unreadCount").asLong());
        // 提及未读是同维度的计数值，必须与未读一样保持数字——一旦被连带字符串化，
        // 前端 `mentionUnreadCount > 0` 的比较会在 "2" > 0 上静默成立，反倒更隐蔽
        assertTrue(conversation.get("mentionUnreadCount").isNumber(), "提及未读数是计数值，应保持数字");
        assertEquals(2L, conversation.get("mentionUnreadCount").asLong());

        JsonNode unread = objectMapper.readTree(objectMapper.writeValueAsString(
                new UnreadCountVO(1L, 2L, 3L)));
        assertTrue(unread.get("inbox").isNumber(), "红点数是计数值，应保持数字");
        assertTrue(unread.get("todo").isNumber(), "待办数是计数值，应保持数字");
        assertTrue(unread.get("chat").isNumber(), "会话角标是计数值，应保持数字");
    }

    @Test
    @DisplayName("回归：会话 targetId 字符串过线，回传后端不再查无此人")
    void conversationTargetIdSurvivesRoundTrip() throws Exception {
        ConversationVO vo = new ConversationVO(1, SNOWFLAKE, "李四", null, SNOWFLAKE, "收到", 1,
                SNOWFLAKE, false, null, 0L, 0L);

        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(vo));

        assertTrue(json.get("targetId").isTextual(),
                "targetId 必须是 JSON 字符串；若走 number，前端会把它舍入成另一个用户 ID");
        assertEquals(SNOWFLAKE_STR, json.get("targetId").asText());
        assertEquals(19, json.get("targetId").asText().length(), "19 位必须一位不少");
    }

    /** 递归遍历 JSON：ID 命名（id / *Id / *Ids）的字段必须是精确字符串。 */
    private void assertIdFieldsAreExactStrings(JsonNode node, String path) {
        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                String name = entry.getKey();
                JsonNode value = entry.getValue();
                if (isIdField(name)) {
                    if (value.isArray()) {
                        for (JsonNode element : value) {
                            if (element.isNull()) {
                                continue;
                            }
                            assertTrue(element.isTextual(), path + "." + name + " 数组元素必须是字符串");
                            assertEquals(SNOWFLAKE_STR, element.asText(),
                                    path + "." + name + " 19 位必须一位不少");
                        }
                    } else if (!value.isNull()) {
                        assertTrue(value.isTextual(), path + "." + name + " 必须以字符串下发");
                        assertEquals(SNOWFLAKE_STR, value.asText(), path + "." + name + " 19 位必须一位不少");
                    }
                }
                assertIdFieldsAreExactStrings(value, path + "." + name);
            });
        } else if (node.isArray()) {
            for (int i = 0; i < node.size(); i++) {
                assertIdFieldsAreExactStrings(node.get(i), path + "[" + i + "]");
            }
        }
    }

    /** 按 record 规范构造器造样本：ID 用真实雪花值，计数用小正数，其余留空。 */
    private Object sample(Class<?> recordType, Set<Class<?>> inProgress) throws Exception {
        if (!inProgress.add(recordType)) {
            return null;
        }
        try {
            RecordComponent[] components = recordType.getRecordComponents();
            Class<?>[] parameterTypes = new Class<?>[components.length];
            Object[] arguments = new Object[components.length];
            for (int i = 0; i < components.length; i++) {
                RecordComponent component = components[i];
                parameterTypes[i] = component.getType();
                arguments[i] = sampleValue(component.getName(), component.getType(),
                        component.getGenericType(), inProgress);
            }
            Constructor<?> constructor = recordType.getDeclaredConstructor(parameterTypes);
            constructor.setAccessible(true);
            return constructor.newInstance(arguments);
        } finally {
            inProgress.remove(recordType);
        }
    }

    private Object sampleValue(String name, Class<?> type, Type genericType, Set<Class<?>> inProgress)
            throws Exception {
        if (isIdField(name)) {
            if (isLongType(type)) {
                return SNOWFLAKE;
            }
            if (isLongListGeneric(genericType)) {
                return List.of(SNOWFLAKE);
            }
        }
        if (isLongType(type)) {
            return 7L;
        }
        if (type == int.class || type == Integer.class) {
            return 7;
        }
        if (type == boolean.class || type == Boolean.class) {
            return false;
        }
        if (type == String.class || type == LocalDateTime.class) {
            return null;
        }
        if (List.class.isAssignableFrom(type)) {
            Class<?> element = listElementType(genericType);
            if (element != null && isVoType(element) && !inProgress.contains(element)) {
                return List.of(sample(element, inProgress));
            }
            return List.of();
        }
        if (isVoType(type) && !inProgress.contains(type)) {
            return sample(type, inProgress);
        }
        return null;
    }

    /** 从根清单出发，递归收集字段里出现的全部 VO 类型（覆盖 *.model.vo 下的嵌套 record）。 */
    private static List<Class<?>> collectAllVoTypes() {
        Set<Class<?>> all = new LinkedHashSet<>();
        Deque<Class<?>> queue = new ArrayDeque<>(ROOT_VOS);
        while (!queue.isEmpty()) {
            Class<?> type = queue.poll();
            if (!all.add(type)) {
                continue;
            }
            for (Field field : type.getDeclaredFields()) {
                if (field.isSynthetic()) {
                    continue;
                }
                for (Class<?> candidate : fieldTypes(field)) {
                    if (isVoType(candidate) && !all.contains(candidate)) {
                        queue.add(candidate);
                    }
                }
            }
        }
        return new ArrayList<>(all);
    }

    private static List<Class<?>> fieldTypes(Field field) {
        List<Class<?>> types = new ArrayList<>();
        types.add(field.getType());
        if (field.getGenericType() instanceof ParameterizedType parameterized) {
            for (Type argument : parameterized.getActualTypeArguments()) {
                if (argument instanceof Class<?> clazz) {
                    types.add(clazz);
                }
            }
        }
        return types;
    }

    private static Class<?> listElementType(Type genericType) {
        if (genericType instanceof ParameterizedType parameterized) {
            Type[] arguments = parameterized.getActualTypeArguments();
            if (arguments.length == 1 && arguments[0] instanceof Class<?> clazz) {
                return clazz;
            }
        }
        return null;
    }

    private static boolean isVoType(Class<?> type) {
        return type.isRecord() && type.getPackageName().contains(".model.vo");
    }

    private static boolean isLongType(Class<?> type) {
        return type == Long.class || type == long.class;
    }

    private static boolean isLongList(Field field) {
        return List.class.isAssignableFrom(field.getType())
                && isLongListGeneric(field.getGenericType());
    }

    private static boolean isLongListGeneric(Type type) {
        Class<?> element = listElementType(type);
        return element != null && isLongType(element);
    }

    /** ID 字段命名约定：id 或以 Id / Ids 结尾（parentId / roleIds / chatTargetId ...）。 */
    private static boolean isIdField(String name) {
        return "id".equals(name) || name.endsWith("Id") || name.endsWith("Ids");
    }
}
