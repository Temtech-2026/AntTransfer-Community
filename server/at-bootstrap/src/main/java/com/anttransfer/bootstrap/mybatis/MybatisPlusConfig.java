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

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis-Plus 全局配置（装配在 at-bootstrap——唯一可运行模块）。
 *
 * <p><b>为何不在 at-common</b>：本类是 Spring 装配（依赖 {@code spring-boot-starter-jdbc} 与
 * MyBatis-Plus starter），若放在共享内核会把 JDBC / Spring 传递依赖强加给所有业务模块，
 * 并使 at-common 从「纯内核」退化为「基础设施模块」。故内核只保留
 * {@code mybatis-plus-annotation}（实体注解）与 {@code mybatis-plus-core}（{@code IPage} 类型），
 * 全部 Spring 装配集中在本模块，随 {@code @SpringBootApplication(scanBasePackages = "com.anttransfer")}
 * 自动生效。</p>
 *
 * <p>职责：</p>
 * <ol>
 *     <li><b>分页插件</b>：注册 {@link PaginationInnerInterceptor}，使 {@code Page<T>} 分页查询生效，
 *         并统一限制单页上限，防止 {@code pageSize=999999} 打爆内存；</li>
 *     <li><b>自动填充</b>：由 {@link FillMetaObjectHandler} 承担，见同包实现；</li>
 *     <li><b>逻辑删除</b>：由本模块 {@code application.yml} 的
 *         {@code mybatis-plus.global-config.db-config.logic-delete-field: deleted}
 *         与 {@link com.anttransfer.common.entity.BaseEntity} 的 {@code @TableLogic}
 *         共同保证——查询自动追加 {@code deleted = 0}，删除转为 {@code UPDATE ... SET deleted = 1}。</li>
 * </ol>
 *
 * <p>数据库方言：默认 MySQL，PostgreSQL 部署时设置
 * {@code anttransfer.persistence.db-type=POSTGRE_SQL} 即可切换（见 application-pg.yml）。</p>
 *
 * @author AntTransfer CE
 */
@Configuration
public class MybatisPlusConfig {

    /**
     * 单页最大条数：对齐 API 契约 {@code docs/api/README.md} §3
     * （{@code pageSize} 默认 20、最大 100）。
     */
    public static final long MAX_PAGE_SIZE = 100L;

    /**
     * 分页插件：唯一 {@code MybatisPlusInterceptor} 实例，后续新增拦截器
     * （如防止全表更新删除）继续 {@code addInnerInterceptor} 即可。
     *
     * @param dbType 数据库方言，配置键 {@code anttransfer.persistence.db-type}，默认 MYSQL
     */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor(
            @Value("${anttransfer.persistence.db-type:MYSQL}") DbType dbType) {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();

        PaginationInnerInterceptor paginationInterceptor = new PaginationInnerInterceptor(dbType);
        // 超过上限自动收敛到 100，而不是抛错（前端契约：pageSize 最大 100）
        paginationInterceptor.setMaxLimit(MAX_PAGE_SIZE);
        // 页码溢出（current 超过最大页）返回空列表，不回退到首页，避免前端分页错乱
        paginationInterceptor.setOverflow(false);

        interceptor.addInnerInterceptor(paginationInterceptor);
        return interceptor;
    }
}
