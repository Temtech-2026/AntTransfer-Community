package com.fast.springbootinit.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis Plus 配置：注册分页插件。注意：MyBatis Plus 3.5.9+ 的 PaginationInnerInterceptor
 * 已拆分为独立的 mybatis-plus-jsqlparser 模块，pom.xml 必须引入该依赖，否则启动报错
 */
@Configuration
@MapperScan("com.fast.springbootinit.mapper")
public class MyBatisPlusConfig {

    /**
     * 拦截器配置：注册 MyBatis Plus 插件（分页等），
     * 业务代码使用 Page 对象分页查询时自动生效
     *
     * @return
     */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        // 分页插件
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}