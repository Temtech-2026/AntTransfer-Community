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
package com.anttransfer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * AntTransfer CE 启动类。
 *
 * <p>职责：模块化单体（Modular Monolith）的聚合启动入口——
 * {@code scanBasePackages = "com.anttransfer"} 会扫描全部 at-* 模块包，
 * 使各模块的 {@code @RestController / @Service / @Configuration / @Component}
 * 统一注册到同一 Spring 容器，形成“代码隔离、运行一体”的单体应用。</p>
 *
 * <p>架构说明：</p>
 * <ul>
 *     <li>启动时依赖 {@code at-bootstrap} 模块聚合的所有 at-* 依赖；</li>
 *     <li>各模块数据访问接口统一放在 {@code repository} 包（数据访问层），
 *         并使用 MyBatis-Plus 的 {@code @Mapper} 注解，由 MyBatis-Plus 自动扫描装配
 *         （无需在此配置全局 {@code @MapperScan}）；如后续确有集中扫描诉求，可在本类追加：
 *         {@code @MapperScan("com.anttransfer.**.repository")} 并配合接口过滤；</li>
 *     <li>配置按 profile（dev / prod）拆分，见 {@code src/main/resources/application*.yml}，
 *         数据库与缓存连接均使用环境变量占位，便于容器化部署。</li>
 * </ul>
 *
 * <p>启动命令：先在仓库根执行 {@code ./mvnw -DskipTests -pl server/at-bootstrap -am install}
 * （装依赖模块到本地仓库），再执行 {@code ./mvnw -pl server/at-bootstrap spring-boot:run}。
 * 启动段禁止加 {@code -am}：spring-boot:run 属 CLI goal，会作用到根聚合 POM
 * （无 main class）导致构建失败；等价入口为 {@code make run}。或直接
 * {@code java -jar server/at-bootstrap/target/at-bootstrap-1.0.0-SNAPSHOT.jar}</p>
 *
 * @author AntTransfer CE
 */
@SpringBootApplication(scanBasePackages = "com.anttransfer")
public class AntTransferApplication {

    public static void main(String[] args) {
        SpringApplication.run(AntTransferApplication.class, args);
    }
}
