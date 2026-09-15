# ✅ 完成标准（DoD）核对表

> **核对日期**：2026-09-14
> **核对方式**：仓库实跑 + 配置溯源（非文档推断）——后端 `./mvnw verify`（JDK 21）、前端 `npm test` / `npm run tsc` / `npm run build`。
> **⚠️ 与阶段 DoD 区分**：[`architecture.md` § 🎯 本阶段 DoD 现状对照](../architecture/architecture.md) 管的是**阶段范围 DoD**（功能边界冻结 / 用户故事 / 契约定稿），
> 本文管的是**交付质量 DoD**（冒烟 / 覆盖率 / 压测 / 前端工程化）。两者并行，互不替代。

---

## 📋 清单本体

- [ ] **1.** 冒烟用例集 100% 通过（含管理员建号链路），核心链路无 P0/P1 缺陷
- [ ] **2.** 核心后端模块行覆盖率 ≥ 85%、核心安全逻辑 ≥ 90%，CI 中测试失败即阻断合并
- [ ] **3.** 压测报告有基线数据：目标并发下分片上传/下载 P95 达标、无内存泄漏
- [ ] **4.** 前端关键 Hook/组件有测试，`npm run build` 无类型错误

---

## 🧭 结论速览（2026-09-14）

| # | 标准 | 判定 | 一句话结论 |
| --- | --- | --- | --- |
| 1 | 冒烟用例集 100% 通过 | ❌ **未达成** | 用例集 S01–S17 已定义，但**联调首轮尚未执行**，无通过率数据；仓库内也无法复跑（载体是外部 Apifox 集合） |
| 2 | 覆盖率 ≥ 85% / 安全 ≥ 90% + CI 阻断 | 🟡 **机制已建成 / 门槛未达** | 本次接入 JaCoCo + Codecov + 前端 CI job；实测整体 **36.50%**、安全 **52.86%**，距 85% / 90% 差距显著 |
| 3 | 压测报告有基线数据 | ❌ **未达成** | JMeter / wrk 方案与判定规则齐备，但 k6「尚未接入」、结果记录表为空、未接入 actuator（GAP-04），P95 与内存泄漏**均无数据** |
| 4 | 前端测试 + 构建无类型错误 | ✅ **达成** | 21 个测试文件 / **225 用例全绿**；`tsc --noEmit` 零错误；`max build` 生产构建成功 |

**达成度：1 / 4 达成、1 / 4 机制就绪但门槛未达、2 / 4 未达成。**

---

## 1️⃣ 冒烟用例集 100% 通过（含管理员建号链路） —— ❌ 未达成

### 现状与证据

- 用例集**已定义**：[joint-debug-prep.md](./joint-debug-prep.md) 给出端到端冒烟用例 **S01–S17**（含 **S02 管理员建号链路**），
  但该文档 §5 标题为「**待确认项（联调首轮执行后回填结论）**」——即**首轮执行尚未发生**，通过率无从得出。
- 用例载体是**外部 Apifox 集合**（仓库内仅有 OpenAPI → Apifox 导入指引），因此**无法在本仓库内复跑**该用例集。
- 「核心链路无 P0/P1 缺陷」：仓库内**无缺陷台账**（`.github/ISSUE_TEMPLATE/` 有模板，但无 issue 数据），**不可验证**。

### 间接证据（不等价，仅供判断健康度）

| 证据 | 结果 |
| --- | --- |
| 后端全量 `./mvnw verify`（JDK 21，2026-09-14） | **BUILD SUCCESS**：**383 用例 / 0 失败 / 0 错误 / 0 跳过** |
| 其中 Testcontainers 集成测试（真实 MySQL/Redis + Flyway） | 认证流程 8 例、**分片上传合并 5 例**、分享配额并发 3 例、传输统计 3 例 —— **全部通过** |
| 前端 `npm test` | 225 用例全绿 |

> 说明：这些测试覆盖了冒烟用例集的**部分**链路（如分片上传、认证、分享限额），但**不能替代** Apifox 冒烟用例的端到端结论（用例还覆盖建号、审批、菜单、审计导出等未入库自动化路径）。

### 补齐动作

1. 执行 Apifox 冒烟集合首轮（S01–S17），把结论回填到 `joint-debug-prep.md` §5；
2. 建议同步把**可自动化的 S 用例**沉淀为 `tests/e2e`（Playwright 目前为空壳，见 [tests/e2e/README.md](../../tests/e2e/README.md)），避免每轮人工回归；
3. 缺陷台账建议用 GitHub Issues（模板已就绪）并打 `P0/P1` 标签，使「无 P0/P1」可被机器核验。

---

## 2️⃣ 覆盖率 ≥ 85% / 安全 ≥ 90% + CI 失败即阻断 —— 🟡 机制已建成，门槛未达

### 本次接入内容（改了什么）

| 位置 | 变更 |
| --- | --- |
| [pom.xml](../../pom.xml)（父工程） | 新增 `jacoco.version=0.8.15`；`jacoco-maven-plugin` 三个执行：`prepare-agent`（探针）、`report`（verify 产出 HTML/XML/CSV）、**`check`（规则：模块整体行覆盖率 ≥ 85% + 安全类 ≥ 90%）** |
| [.github/workflows/ci.yml](../../.github/workflows/ci.yml) | ① 打开原本 `if: false` 的覆盖率步骤，改为 `codecov/codecov-action@v7` 上传各模块 `jacoco.xml`；② **新增 `frontend` job**：`npm ci` → `npm test` → `npm run tsc` → `npm run build` |
| [codecov.yml](../../codecov.yml)（新增，根目录） | 后端**防回归下限**（project target 36%、threshold 1%，回归即红）+ patch 覆盖率公示；并声明 `web/**` 等不计入 |

> 📌 覆盖率判定规则（JaCoCo 语义）：**85% 按模块（BUNDLE）逐一判定**，**90% 按类（CLASS）逐一判定**（类名含 `.security.`）。
> ⚠️ **`check` 当前为 report-only**：`<haltOnFailure>false</haltOnFailure>` —— verify 会**打印判定明细但不阻断构建**。
> 原因见下方「门槛未达」：直接硬门禁会让 **CI 永久红灯、阻断所有合并**。**达标后删除该行即变为硬门禁**（`pom.xml` 中已就地标注 ⛔）。

### 覆盖率实测基线（2026-09-14，`./mvnw verify` 后统计 `target/site/jacoco/jacoco.csv`）

| 模块 | 行覆盖率 | 已覆盖行 | 总行数 |
| --- | --- | --- | --- |
| `at-permission` | 80.64% | 1166 | 1446 |
| `at-bootstrap` | 83.70% | 113 | 135 |
| `at-common` | 65.14% | 114 | 175 |
| `at-transfer` | 62.18% | 240 | 386 |
| `at-auth` | 29.79% | 129 | 433 |
| `at-gateway` | 23.39% | 51 | 218 |
| `at-file` | **3.30%** | 79 | 2391 |
| `at-collaboration` | 无数据 | — | — |
| **全部模块** | **36.50%** | **1892** | **5184** |

| 安全范围（包名含 `security`，行维度） | 覆盖率 | 已覆盖 / 总行 |
| --- | --- | --- |
| `at-transfer.security` | 83.33% | 5 / 6 |
| `at-permission.security` | 80.00% | 4 / 5 |
| `at-file.security` | 71.79% | 28 / 39 |
| `at-auth.security` | 48.54% | 83 / 171 |
| `at-common.security` | 0.00% | 0 / 6 |
| **安全合计** | **52.86%** | **120 / 227** |

> `at-collaboration` 无数据：该模块当前**无测试执行**，JaCoCo 因缺少 `jacoco.exec` 而跳过报告与判定
> —— 属「尚未被测」而非「通过」，补测试后会自动纳入门禁。

### 差距与达标路径（按性价比排序）

1. **`at-file`（3.3% / 1893 未覆盖行）是最大缺口**：`com.anttransfer.file.service` 单包 1893 行未覆盖（分片上传服务层），
   `controller` / `storage` / `util` / `job` / `model.vo` 全为 0%。这是抬升整体覆盖率**唯一的关键路径**。
2. `at-gateway` 23.4%：`filter`（0/31）、`error`（0/79）、`ratelimit`（0/34）、`config`（0/23）——这些是**横切安全逻辑**，应优先补。
3. `at-auth` 29.8%：`auth.service` 17.91%（36/201）、`auth.config` 14.89%（7/47）——登录/令牌主链路。
4. 剩余模块已接近目标（permission 80.6% / bootstrap 83.7%），小幅补齐即可越过 85%。
5. 达到目标后：删除 `pom.xml` 中的 `<haltOnFailure>false</haltOnFailure>`，并把 `codecov.yml` 的 project target 由 36% 上调至 85%。

### 「CI 中测试失败即阻断合并」

- 机制侧**已具备**：`backend` job 执行 `./mvnw -B -ntp verify`，测试失败 / Spotless 违规 / （达标后的）覆盖率不达标都会让该 job 变红；`frontend` job 同理。
- 但「**阻断合并**」还需**仓库侧设置**：把 `Backend (Maven verify)` 与 `Frontend (Vitest + Build)` 配置为 **required status checks**（分支保护）。
  **该设置不在仓库内**（`.github/` 无分支保护配置文件），属待完成的仓库设置项，需在 GitHub 仓库 Settings 中手工开启。

### ⚠️ 本地行尾误判（勿当成 CI 失败）+ 它掩盖的 14 处真违规

Windows 本机执行 `./mvnw verify` 时，Spotless 会因 **39 个 Java 文件**工作区换行符为 **LF** 而报格式违规
（Spotless 默认按 `PLATFORM` 取换行符，Windows = CRLF；分布：at-transfer 24 / at-permission 6 / at-common 3 /
at-bootstrap 2 / at-file 2 / at-auth 1 / at-gateway 1）。这 39 个不能一概而论，须分两类处理：

| 类别 | 数量 | 判据 | Linux CI |
| --- | --- | --- | --- |
| 纯行尾误判（工作区 LF） | 25 | `git ls-files --eol` 索引为 LF，Linux 的 `PLATFORM` 换行符亦为 LF | **不会红** |
| license header 残缺 | 14 | 与平台无关 | **必然红** |

- **25 个纯行尾**：本地执行一次 `./mvnw spotless:apply` 把工作区转成 CRLF 即可消除，且 `git add -n .` **不会**暂存它们
  （`core.autocrlf=true` 下 CRLF 会被规范化回 LF，与索引一致 —— `git status` 显示的 `M` 是假象）。
- **14 个 header 残缺**（全在 `at-transfer`，随 `794f1ee` 2026-09-14 引入）：header 只有
  `* Licensed under the Apache License, Version 2.0.` 一行，缺 Apache-2.0 完整正文。涉及
  `config/TransferProperties.java`、`controller/TransferController.java`、`model/dto/{MergeRequest,PrecheckRequest}.java`、
  `model/entity/TransferTask.java`、`model/vo/{ChunkPartsVO,MergeResultVO,PartUploadedVO,PrecheckResultVO}.java`、
  `repository/TransferTaskMapper.java`、`service/{ChunkIndexes,ChunkStore,TransferTaskService,TransferTaskStateStore}.java`
  —— 必须 `spotless:apply` 补全后**提交**；第 1 节证据表那次 BUILD SUCCESS 对这 14 个文件不成立。

> ⚠️ `-Dspotless.check.skip=true` 会**同时**跳过换行符与 header 检查，只能用于「已确认是 25 个纯行尾」的场景，
> **不可当常规做法**（它会掩盖上面 14 个真违规）。正确顺序：`./mvnw spotless:apply` → `./mvnw -B -ntp verify`。
>
> 📝 本段 2026-09-15 复核更正：原记录称「Spotless 会因 3 个文件…… 故 CI 不会红」，实测工作区 LF 的文件为 **39 个**
> （at-common 那 3 个只是构建最先撞上的），且其中 14 个与平台无关、CI 必然红。

---

## 3️⃣ 压测报告有基线数据（P95 达标、无内存泄漏） —— ❌ 未达成

### 现状与证据

- 方案齐备：[tests/performance/README.md](../../tests/performance/README.md) + `jmeter/mixed-upload-download.md`、`wrk/download.md`
  —— 含目标并发、阈值口径、判定规则（`Non-2xx ≠ 0 先修数据再谈性能`）、压测期间四组观测点采集命令。
- **结果为空**：`wrk/download.md` §4.3 的表标题即「结果记录表（模板）」，**未回填任何轮次数据**。
- **k6 尚未接入**（README「计划选型」明示）→ 无脚本化阈值断言能力。
- **无埋点**：`tests/performance` 明确记载「本项目未接入 actuator / micrometer（**GAP-04**），故无 `/actuator/metrics`」，
  内存与 GC 只能靠 `jcmd` / `jstat` 手工采集 → 「无内存泄漏」**无长稳数据支撑**。
- 代码级仅有间接痕迹（CHANGELOG 记录过限流桶清理的真实泄漏修复、`FileCleanupScheduler` 定时清理），但**不构成压测结论**。

### 补齐动作

1. 用现有 JMeter / wrk 脚本跑**一轮**目标并发（分片上传 + 下载），把 P50/P95/P99、`Req/Sec`、`Non-2xx` 完整回填结果表；
2. `jstat -gcutil` / `jcmd GC.heap_info` 按 §8 采集命令做**长稳观测**（建议 ≥ 2 h），出具堆曲线与 FULL GC 次数结论；
3. 建议先补 **GAP-04**（actuator + micrometer）再复测，否则观测成本高且不精确；
4. k6 脚本化（阈值断言）可在 CI 或夜间任务中跑，避免人工回归。

---

## 4️⃣ 前端关键 Hook/组件有测试 + `npm run build` 无类型错误 —— ✅ 达成

### 证据（2026-09-14 实跑）

| 项目 | 命令 | 结果 |
| --- | --- | --- |
| 单元/组件测试 | `npm test` | **21 个测试文件 / 225 用例全部通过** |
| 类型检查 | `npm run tsc`（`tsc --noEmit`） | **零错误** |
| 生产构建 | `npm run build`（`max build`） | **成功**（产出 `web/dist`） |

关键 Hook/组件覆盖（示例，非全量）：

- `src/hooks/useChunkUpload.test.tsx` —— 分片上传主 Hook（秒传预检 / 断点续传 / 并发与重试）
- `src/components/ChunkUpload*/**` —— 分片上传控制器与 UI 组件（纯 TS 引擎与 React 解耦，可测性强）
- `src/pages/file/**`、`src/pages/permission/approval/**` —— 文件列表与审批页
- `src/utils/result.ts` + `requestErrorConfig` —— 统一返回体与错误码策略（含 `1003` 策略 D 红线用例）
- `ws-client`、`access`/`menu` 权限渲染、`app.test.tsx` 等

### 唯一保留项

该三项校验**本次已纳入 CI**（新增 `frontend` job），但需仓库侧把该 job 设为 **required status check** 才具备「阻断」效力（同第 2 节）。

---

## 🔁 复现命令（本地）

```bash
# 后端：全量验证（含测试 + Spotless + JaCoCo report/check）
JAVA_HOME=<jdk-21> ./mvnw -B -ntp verify
# Windows 本机若报 Spotless 行尾违规（见第 2 节说明）：先修工作区，再验证
JAVA_HOME=<jdk-21> ./mvnw -B -ntp spotless:apply
JAVA_HOME=<jdk-21> ./mvnw -B -ntp verify
# 应急（会同时跳过 license header 检查、可能掩盖真违规，见第 2 节）：
# JAVA_HOME=<jdk-21> ./mvnw -B -ntp verify -Dspotless.check.skip=true

# 覆盖率报告位置（各模块）
#   server/<module>/target/site/jacoco/index.html   （HTML）
#   server/<module>/target/site/jacoco/jacoco.xml   （Codecov 上传源）
#   server/<module>/target/site/jacoco/jacoco.csv   （便于汇总统计）

# 前端
cd web && npm test && npm run tsc && npm run build
```

---

## 📌 待办清单（按优先级）

| 优先级 | 事项 | 关联标准 | 负责面 |
| --- | --- | --- | --- |
| P0 | 执行 Apifox 冒烟集合（S01–S17）并回填 `joint-debug-prep.md` §5 | 1 | 测试 / 联调 |
| P0 | GitHub 仓库设置 required status checks（backend + frontend） | 2 | 仓库管理员 |
| P1 | 补齐 `at-file` 服务层测试（1893 行未覆盖，整体覆盖率关键路径） | 2 | 后端 |
| P1 | 补 `at-gateway` filter / error / ratelimit 横切逻辑测试 | 2 | 后端 |
| P1 | 跑一轮 JMeter/wrk 基线并回填结果表；做 ≥ 2 h 长稳内存观测 | 3 | 测试 / 运维 |
| P2 | 删除 `pom.xml` 的 `haltOnFailure=false`，`codecov.yml` target 上调至 85% | 2 | 后端 |
| P2 | 接入 actuator + micrometer（GAP-04），降低压测观测成本 | 3 | 后端 |
| P2 | 把可自动化冒烟用例沉淀到 `tests/e2e`（Playwright） | 1 | 测试 |
