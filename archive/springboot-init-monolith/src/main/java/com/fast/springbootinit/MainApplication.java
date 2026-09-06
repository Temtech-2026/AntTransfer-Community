package com.fast.springbootinit;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 主类（项目启动入口）
 */
// todo 如需开启 Redis，须移除 exclude 中的内容（排除 Redis 自动配置，未配置 Redis 也能正常启动）
@SpringBootApplication(exclude = {RedisAutoConfiguration.class})
// Mapper 接口扫描：自动注册 mybatis-plus 的 Mapper 为 Spring Bean
@MapperScan("com.fast.springbootinit.mapper")
// 开启定时任务：支持 job 包下 @Scheduled 定时任务（如 ES 增量同步）
@EnableScheduling
// 开启 AOP 代理：proxyTargetClass 使用 CGLIB；exposeProxy 允许通过 AopContext 获取当前代理（解决同类内部调用切面失效问题）
@EnableAspectJAutoProxy(proxyTargetClass = true, exposeProxy = true)
public class MainApplication {

    public static void main(String[] args) {
        SpringApplication.run(MainApplication.class, args);
    }

}
