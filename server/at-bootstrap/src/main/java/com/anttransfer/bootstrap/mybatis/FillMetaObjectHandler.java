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

import com.anttransfer.common.mybatis.CurrentUserProvider;
import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import org.apache.ibatis.reflection.MetaObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * MyBatis-Plus 公共字段自动填充器（装配在 at-bootstrap——唯一可运行模块）。
 *
 * <p>填充规则（对应 {@code BaseEntity} 的 {@code @TableField(fill = ...)} 声明）：</p>
 *
 * <table border="1">
 *     <caption>填充矩阵</caption>
 *     <tr><th>字段</th><th>INSERT</th><th>UPDATE</th><th>说明</th></tr>
 *     <tr><td>createTime</td><td>填充（为空时）</td><td>—</td><td>应用时钟写入</td></tr>
 *     <tr><td>updateTime</td><td>填充</td><td>覆盖</td><td>应用时钟写入，每次更新必刷</td></tr>
 *     <tr><td>createBy / updateBy</td><td>填充（有登录态时）</td><td>updateBy 覆盖</td><td>取自 {@link CurrentUserProvider}</td></tr>
 *     <tr><td>deleted</td><td>填 0</td><td>—</td><td>兜底，避免依赖数据库默认值</td></tr>
 * </table>
 *
 * <p><b>时钟口径</b>：时间一律由应用写入 {@link LocalDateTime#now()}，
 * 不依赖数据库 {@code DEFAULT CURRENT_TIMESTAMP ON UPDATE}，
 * 避免“双写方 + 跨时钟源”导致授权过期判定漂移
 * （见 {@code docs/architecture/red-team-review.md} [T-08]）。</p>
 *
 * <p><b>幂等</b>：仅在字段无值时填充创建类字段，保证重试 / 显式赋值不被覆盖；
 * 更新时间则无条件覆盖。</p>
 *
 * <p><b>依赖方向</b>：{@link CurrentUserProvider} 接口定义在 {@code at-common}
 * （供 {@code at-auth} 实现并注入），本填充器只依赖接口、不依赖实现，
 * 避免 at-bootstrap 与业务模块的装配顺序耦合。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class FillMetaObjectHandler implements MetaObjectHandler {

    private static final Logger log = LoggerFactory.getLogger(FillMetaObjectHandler.class);

    private static final String CREATE_TIME = "createTime";
    private static final String UPDATE_TIME = "updateTime";
    private static final String CREATE_BY = "createBy";
    private static final String UPDATE_BY = "updateBy";
    private static final String DELETED = "deleted";

    /** 逻辑删除初始值：0-未删除（与 application.yml 的 logic-not-delete-value 一致） */
    private static final int NOT_DELETED = 0;

    /**
     * 当前登录用户来源（可选 Bean）：at-auth 实现前为 null，此时跳过操作人填充。
     */
    private final ObjectProvider<CurrentUserProvider> currentUserProvider;

    public FillMetaObjectHandler(ObjectProvider<CurrentUserProvider> currentUserProvider) {
        this.currentUserProvider = currentUserProvider;
    }

    @Override
    public void insertFill(MetaObject metaObject) {
        if (metaObject == null) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        fillIfAbsent(metaObject, CREATE_TIME, now);
        fillIfAbsent(metaObject, UPDATE_TIME, now);
        fillIfAbsent(metaObject, DELETED, NOT_DELETED);

        Long userId = currentUserId();
        if (userId != null) {
            fillIfAbsent(metaObject, CREATE_BY, userId);
            fillIfAbsent(metaObject, UPDATE_BY, userId);
        }
    }

    @Override
    public void updateFill(MetaObject metaObject) {
        if (metaObject == null) {
            return;
        }
        setFieldValByName(UPDATE_TIME, LocalDateTime.now(), metaObject);
        Long userId = currentUserId();
        if (userId != null) {
            setFieldValByName(UPDATE_BY, userId, metaObject);
        }
    }

    /**
     * 仅当字段存在、可写且当前无值时填充（保护显式赋值与重试语义）。
     */
    private void fillIfAbsent(MetaObject metaObject, String field, Object value) {
        if (metaObject == null || value == null) {
            return;
        }
        if (!metaObject.hasSetter(field)) {
            return;
        }
        if (metaObject.getValue(field) != null) {
            return;
        }
        metaObject.setValue(field, value);
    }

    /**
     * 取当前登录用户 ID；无提供者、无登录态或解析异常时返回 null（填充失败不得阻断业务写入）。
     */
    private Long currentUserId() {
        if (currentUserProvider == null) {
            return null;
        }
        CurrentUserProvider provider = currentUserProvider.getIfAvailable();
        if (provider == null) {
            return null;
        }
        try {
            return provider.currentUserId();
        } catch (Exception e) {
            log.debug("获取当前登录用户失败，跳过 createBy/updateBy 填充", e);
            return null;
        }
    }
}
