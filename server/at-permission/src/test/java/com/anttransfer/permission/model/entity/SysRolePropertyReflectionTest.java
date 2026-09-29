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
package com.anttransfer.permission.model.entity;

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
 * {@link SysRole} 的 JavaBeans 属性反射回归证据。
 *
 * <p>与 {@code NotifyMessage} 同源的坑：{@code builtIn} 是 {@code Integer} 字段，
 * Lombok 生成 {@code getBuiltIn()}；手写的 {@code isBuiltIn()} 会让 JavaBeans 属性
 * {@code builtIn} 出现类型互不兼容的双 getter，MyBatis 反射取值抛
 * {@code ReflectionException}（"Illegal overloaded getter method with ambiguous type"）。
 * 角色分页 / 更新 / 删除都会因此失败，故单列用例守住。</p>
 *
 * @author AntTransfer CE
 */
class SysRolePropertyReflectionTest {

    @Test
    @DisplayName("全部实体属性都必须能被 MyBatis 反射读取（含 builtIn）")
    void allProperties_shouldBeReadableByMyBatisReflection() {
        SysRole role = new SysRole();
        role.setBuiltIn(SysRole.BUILT_IN);
        MetaObject metaObject = SystemMetaObject.forObject(role);

        assertThat(metaObject.getValue("builtIn")).isEqualTo(SysRole.BUILT_IN);

        for (String name : propertyNamesOf(SysRole.class)) {
            assertThatCode(() -> metaObject.getValue(name))
                    .as("属性 %s 必须能被 MyBatis 反射读取，否则参数绑定会抛 ReflectionException", name)
                    .doesNotThrowAnyException();
        }
    }

    @Test
    @DisplayName("isBuiltInRole() 语义：只有 BUILT_IN 才算内置，null 视为非内置")
    void isBuiltInRole_shouldBeTrueOnlyForBuiltIn() {
        SysRole role = new SysRole();
        assertThat(role.isBuiltInRole()).isFalse();

        role.setBuiltIn(SysRole.NOT_BUILT_IN);
        assertThat(role.isBuiltInRole()).isFalse();

        role.setBuiltIn(SysRole.BUILT_IN);
        assertThat(role.isBuiltInRole()).isTrue();
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
