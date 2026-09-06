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
package com.anttransfer.bootstrap.mybatis;

import com.anttransfer.common.entity.BaseEntity;
import com.anttransfer.common.mybatis.CurrentUserProvider;
import org.apache.ibatis.reflection.MetaObject;
import org.apache.ibatis.reflection.SystemMetaObject;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link FillMetaObjectHandler} 测试：公共字段填充规则与「非空不覆盖」幂等语义。
 */
class FillMetaObjectHandlerTest {

    private static final long USER_ID = 1001L;

    private static ObjectProvider<CurrentUserProvider> providerOf(Long userId) {
        DefaultListableBeanFactory beanFactory = new DefaultListableBeanFactory();
        beanFactory.registerSingleton("currentUserProvider", (CurrentUserProvider) () -> userId);
        return beanFactory.getBeanProvider(CurrentUserProvider.class);
    }

    private static ObjectProvider<CurrentUserProvider> emptyProvider() {
        return new DefaultListableBeanFactory().getBeanProvider(CurrentUserProvider.class);
    }

    @Test
    void insertFill_shouldFillCreateTimeUpdateTimeAndDeleted() {
        FillMetaObjectHandler handler = new FillMetaObjectHandler(providerOf(USER_ID));
        TestEntity entity = new TestEntity();

        handler.insertFill(SystemMetaObject.forObject(entity));

        assertNotNull(entity.getCreateTime());
        assertNotNull(entity.getUpdateTime());
        assertEquals(0, entity.getDeleted());
        assertEquals(USER_ID, entity.getCreateBy());
        assertEquals(USER_ID, entity.getUpdateBy());
    }

    @Test
    void insertFill_shouldNotOverwriteExistingValues() {
        FillMetaObjectHandler handler = new FillMetaObjectHandler(providerOf(USER_ID));
        TestEntity entity = new TestEntity();
        LocalDateTime fixed = LocalDateTime.of(2026, 1, 1, 0, 0);
        entity.setCreateTime(fixed);
        entity.setCreateBy(9L);

        handler.insertFill(SystemMetaObject.forObject(entity));

        assertEquals(fixed, entity.getCreateTime());
        assertEquals(9L, entity.getCreateBy());
    }

    @Test
    void insertFill_shouldSkipOperatorWhenNoLoginContext() {
        FillMetaObjectHandler handler = new FillMetaObjectHandler(emptyProvider());
        TestEntity entity = new TestEntity();

        handler.insertFill(SystemMetaObject.forObject(entity));

        assertNotNull(entity.getCreateTime());
        assertNull(entity.getCreateBy());
        assertNull(entity.getUpdateBy());
    }

    @Test
    void updateFill_shouldAlwaysRefreshUpdateTime() {
        FillMetaObjectHandler handler = new FillMetaObjectHandler(providerOf(USER_ID));
        TestEntity entity = new TestEntity();
        LocalDateTime stale = LocalDateTime.of(2020, 1, 1, 0, 0);
        entity.setUpdateTime(stale);
        entity.setUpdateBy(7L);
        MetaObject metaObject = SystemMetaObject.forObject(entity);

        handler.updateFill(metaObject);

        assertTrue(entity.getUpdateTime().isAfter(stale));
        assertEquals(USER_ID, entity.getUpdateBy());
    }

    @Test
    void fill_shouldIgnoreEntityWithoutTargetFields() {
        FillMetaObjectHandler handler = new FillMetaObjectHandler(providerOf(USER_ID));
        PlainEntity entity = new PlainEntity();

        handler.insertFill(SystemMetaObject.forObject(entity));

        assertNull(entity.getName());
    }

    /** 测试用实体：继承 BaseEntity，具备全部公共字段 */
    static class TestEntity extends BaseEntity {

        private static final long serialVersionUID = 1L;
    }

    /** 测试用实体：不含公共字段，验证填充器不会因字段缺失报错 */
    static class PlainEntity {

        private String name;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }
}
