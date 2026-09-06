// @modified 2026-08-26 技术栈升级：Spring Boot 3.5.14 + JDK 21（javax 迁移 jakarta）
package com.fast.springbootinit.manager;

import jakarta.annotation.Resource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Cos 操作测试
 */
@SpringBootTest
class CosManagerTest {

    @Resource
    private CosManager cosManager;

    @Test
    void putObject() {
        cosManager.putObject("test", "test.json");
    }
}