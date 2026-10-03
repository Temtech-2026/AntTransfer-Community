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
package com.anttransfer.file;

import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.file.model.entity.FileObject;
import com.anttransfer.file.model.entity.Folder;
import com.anttransfer.file.model.entity.PackTask;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;

/**
 * 纯单元测试（不起 Spring 容器）下的 MyBatis-Plus 支持。
 *
 * <p>{@code Wrappers.lambdaUpdate()/lambdaQuery()} 需要 {@code TableInfo} 缓存才能把
 * {@code Entity::getXxx} 反解为列名；该缓存正常由 MyBatis 启动流程写入。Service 单测里
 * Mapper 被 Mockito 替换，缓存从未初始化，会在构造条件时抛
 * {@code can not find lambda cache for this entity}。</p>
 *
 * <p><b>为什么必须显式初始化，而不能靠「用例刚好没走到那一行」</b>：越权用例的关键断言
 * 恰恰是「残留的 owner 条件还在不在」——例如
 * {@code FileNodeService#recycle} 与 {@code #emptyRecycle} 的 SQL 必须同时带
 * {@code owner_user_id}。若缓存缺失导致这些方法直接抛异常，用例会在
 * 「条件还没构造出来」时就失败，掩盖真正要保护的语义。此处显式初始化本模块
 * 参与 Lambda 条件构造的实体，使生产代码保持 Lambda 条件构造器（防列名硬编码）
 * 且测试可脱离容器运行。</p>
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
        // 回收站链路（moveToRecycle / batchMoveToRecycle / emptyRecycle）全部在 FileNode 上构造 Lambda 条件
        TableInfoHelper.initTableInfo(assistant, FileNode.class);
        TableInfoHelper.initTableInfo(assistant, FileObject.class);
        TableInfoHelper.initTableInfo(assistant, Folder.class);
        TableInfoHelper.initTableInfo(assistant, PackTask.class);
        initialized = true;
    }
}
