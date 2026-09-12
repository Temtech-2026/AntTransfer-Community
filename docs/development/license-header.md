# 📜 许可证与版权声明规范（License & Copyright）

本仓库以 **Apache License 2.0** 开源。本文说明两类标准写法：根目录 `LICENSE` 文件、源码文件版权头。

> 🔗 校验：`./mvnw spotless:check`（`verify` 阶段自动执行）；自动补齐：`./mvnw spotless:apply`。

## 1️⃣ `LICENSE` 文件

- 📄 文件名固定为 `LICENSE`（无扩展名），置于仓库根目录 —— GitHub 会自动识别并在仓库页展示许可标识；
- 📖 内容为 Apache 2.0 官方全文**逐字保留**，包括文末 `APPENDIX: How to apply the Apache License to your work`；
- 🚫 **不要**在正文中插入项目名、年份或版权行 —— 正文（含 APPENDIX）是固定法律文本，改动会令文本失真、并使 GitHub / SPDX 自动识别异常；
- ✅ 版权归属写在**源码文件头**、`README.md` 的 License 章节，以及（可选）`NOTICE` 文件中。

**与 `NOTICE` 的关系**：Apache 2.0 第 4(d) 条规定，分发时若原作品附带 `NOTICE` 文件则须一并保留其内容。本仓库当前不含 `NOTICE`；若后续引入带 `NOTICE` 的第三方 Apache-2.0 组件，需在根目录新增 `NOTICE` 汇总声明。

**第三方代码**：`web/` 源自 Ant Design Pro 模板（MIT），授权声明保留在 `web/LICENSE`，与 Apache-2.0 并存且不冲突。修改上游文件时不要删除其原有头部。

## 2️⃣ 源码文件头（license header）

### Java 标准模板

置于文件首行，且必须在 `package` 声明**之前**：

```java
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
package com.anttransfer.common.result;
```

> ⚠️ 该模板与父工程 `pom.xml` 中 Spotless 的 `licenseHeader.content` **逐字一致**，两者必须同步修改，否则校验必然失败。

### 书写要点

| 要点 | 规范 |
| --- | --- |
| 版权行 | `Copyright (c) 2026 AntTransfer Community Contributors` |
| 年份 | 取文件**首次创建年份**，后续修改无需逐年更新 |
| 持有者 | 统一署名 `AntTransfer Community Contributors`（社区集体），不写个人姓名或公司名 |
| 空行 | 版权行与 `Licensed under...`、`You may obtain...` 与 `Unless required...` 之间各保留一个 ` *` 空行 |
| 缩进 | 每行前缀为 ` * `（星号前一个空格）；首行 `/*` 与末行 ` */` 顶格 |
| 位置 | 必须在 `package` 之前，不得与类 Javadoc 混排 |

### 其他文件类型的注释语法

| 类型 | 语法 | 位置 | 说明 |
| --- | --- | --- | --- |
| `.java` | `/* ... */` | `package` 之前 | **Spotless 强制校验** |
| `.xml`（`pom.xml` 等） | `<!-- ... -->` | XML 声明之后 | 约定 |
| `.yml` / `.yaml` | `# ...` | 文件首行 | 约定 |
| `.ts` / `.tsx` / `.js` | `/* ... */` 或 `// ...` | 文件首行 | `web/` 模板文件保留其原头部 |
| `.sql` | `-- ...` | 文件首行 | 禁止回改已发布的 Flyway 脚本 |
| `.sh` | `# ...` | shebang 行之后 | 约定 |

> 📌 当前 Spotless **仅作用于 Java**（`src/main/java/**/*.java`、`src/test/java/**/*.java`），其余类型属团队约定，由 PR 评审把关。

## 3️⃣ 新增与维护流程

1. 新建 Java 文件后执行 `./mvnw spotless:apply` 自动补齐头部；
2. 提交前执行 `./mvnw spotless:check`（或 `make check`）确认通过；
3. `./mvnw verify` / `package` 会自动触发校验，缺失头部将导致**构建失败**；
4. 如需变更年份或持有者命名，必须**同步修改** `pom.xml` 的 `licenseHeader.content` 与既有文件头。

## ❓ 常见问题

- **`package-info.java` 也要加吗？** 要。只要位于 `src/main|test/java` 下的 `.java` 文件，一律需要。
- **能写年份区间（如 2026-2027）吗？** 可以，但需同步修改 `pom.xml` 模板 —— Spotless 按模板逐字比对，不一致即报错。本仓库当前为单一年份。
- **能直接改 `LICENSE` 加自己的名字吗？** 不建议。署名请写在源文件头或 `NOTICE`，`LICENSE` 保持官方全文。

## 🔗 相关

- [LICENSE](../../LICENSE) · [CONTRIBUTING.md](../../CONTRIBUTING.md) · [SECURITY.md](../../SECURITY.md)
- [开发指南](./README.md)
