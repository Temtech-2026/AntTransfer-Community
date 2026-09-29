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
package com.anttransfer.collaboration.model.entity;

import org.apache.ibatis.reflection.MetaObject;
import org.apache.ibatis.reflection.SystemMetaObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * {@link NotifyMessage} 的 JavaBeans 属性反射回归证据（对应 5002「数据库访问异常」根因）。
 *
 * <p><b>钉住的问题：</b>{@code mentioned} 是 {@code Integer} 字段，Lombok 会生成
 * {@code getMentioned()}；若再手写一个同属性名的 {@code isMentioned()}（boolean），
 * MyBatis 的 {@code Reflector} 会把属性 {@code mentioned} 判为「非法重载的 getter（类型有歧义）」，
 * 于是<b>任何一次消息 INSERT 的参数绑定</b>都抛 {@code ReflectionException}，
 * 被全局异常处理器归一成 5002。这个故障不依赖数据、不依赖配置，
 * 只要实体存在双 getter 就必然发生——所以必须由用例而非人工评审来守。</p>
 *
 * <p><b>为什么遍历字段而不是只断言 {@code mentioned}：</b>同一类错误可以在任何
 * {@code Integer}/{@code boolean} 字段上重演（例如未来新增 {@code Integer pinned}
 * 再加 {@code isPinned()}）。遍历全部（含继承）非静态字段，等于给整张表属性做了全量体检。</p>
 *
 * @author AntTransfer CE
 */
class NotifyMessagePropertyReflectionTest {

    @Test
    @DisplayName("全部实体属性都必须能被 MyBatis 反射读取（含 mentioned）")
    void allProperties_shouldBeReadableByMyBatisReflection() {
        NotifyMessage message = new NotifyMessage();
        message.setMentioned(NotifyMessage.MENTION_YES);
        MetaObject metaObject = SystemMetaObject.forObject(message);

        assertThat(metaObject.getValue("mentioned")).isEqualTo(NotifyMessage.MENTION_YES);

        for (String name : propertyNamesOf(NotifyMessage.class)) {
            assertThatCode(() -> metaObject.getValue(name))
                    .as("属性 %s 必须能被 MyBatis 反射读取，否则参数绑定会抛 ReflectionException", name)
                    .doesNotThrowAnyException();
        }
    }

    @Test
    @DisplayName("isRecipientMentioned() 语义：只有 MENTION_YES 才算被点名，null 视为未点名")
    void isRecipientMentioned_shouldBeTrueOnlyForMentionYes() {
        NotifyMessage message = new NotifyMessage();
        assertThat(message.isRecipientMentioned()).isFalse();

        message.setMentioned(NotifyMessage.MENTION_NONE);
        assertThat(message.isRecipientMentioned()).isFalse();

        message.setMentioned(NotifyMessage.MENTION_YES);
        assertThat(message.isRecipientMentioned()).isTrue();
    }

    private static List<String> propertyNamesOf(Class<?> type) {
        List<String> names = new ArrayList<>();
        for (Class<?> current = type; current != null && current != Object.class; current = current.getSuperclass()) {
            for (Field field : current.getDeclaredFields()) {
                if (!Modifier.isStatic(field.getModifiers())) {
                    names.add(field.getName());
                }
            }
        }
        return names;
    }
}
