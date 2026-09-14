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
package com.anttransfer.transfer;

import com.anttransfer.transfer.model.entity.TransferTask;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;

/**
 * 纯单元测试（不起 Spring 容器）下的 MyBatis-Plus 支持。
 *
 * <p>{@code Wrappers.lambdaQuery()} 需要 {@code TableInfo} 缓存才能把 {@code Entity::getXxx}
 * 反解为列名；该缓存正常由 MyBatis 启动流程写入。Service 单测里 Mapper 被 Mockito 替换，
 * 缓存从未初始化，会在构造条件时抛 {@code can not find lambda cache for this entity}。
 * 此处显式初始化被测实体，保持生产代码继续使用 Lambda 条件构造器（防列名硬编码）。</p>
 *
 * @author AntTransfer CE
 */
public final class MybatisPlusTestSupport {

    private static volatile boolean initialized;

    private MybatisPlusTestSupport() {
    }

    /** 幂等地初始化本模块参与 Lambda 条件构造的实体。 */
    public static synchronized void initTableInfo() {
        if (initialized) {
            return;
        }
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "");
        TableInfoHelper.initTableInfo(assistant, TransferTask.class);
        initialized = true;
    }
}
