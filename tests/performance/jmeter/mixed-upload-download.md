# 📊 JMeter 混合上传/下载压测方案（200 并发）

> 目标：用一份可复现的 `.jmx` 方案，把「200 并发混合上传下载」压到 AntTransfer CE 单实例上，
> 同时采集 JVM / 连接池 / Redis / 磁盘四组观测点，回答**瓶颈在哪、是否触发 PRD §§7 指标**。
>
> 本文给的是**方案 + 关键配置 + 断言写法**（用户要的「`.jmx` 思路」），不是逐行 XML 全文；
> 标 ⚠️ 的地方是**动手前必须先处理的闸门**，不处理则压出来的数字没有意义。

---

## 0. 🚨 结论先行：三个必须先处理的闸门

| # | 闸门 | 现状（读代码得出） | 不处理的后果 |
| --- | --- | --- | --- |
| 1 | **下载链路 IP 维度限流** | `GET /files/{id}/content` = `@RateLimit(60s, max=300, key="file-content")`；`POST /files/{id}/ticket` = `max=60`。维度是 `request.getRemoteAddr()`，**阈值是注解常量，yml 覆盖不了** | 单压测机源 IP 被卡在 **5 req/s**，全程收 `4290/429`，压的是限流器不是下载链路 |
| 2 | **单用户进行中任务上限** | `anttransfer.transfer.max-active-tasks: 3`，超出预检直接 `4103` | 200 并发若共用少量账号 → 绝大多数请求在 `precheck` 就被 `4103` 挡掉，上传链路根本没被压到 |
| 3 | **秒传命中会自我稀释压力** | `precheck` 命中已存在 `sha256` 时直接返回 `fileId`，**不产生任何分片流量** | 第 2 轮起同一批文件全部秒传命中，吞吐虚高、压力趋近于 0，结论完全失真 |

**闸门 1 的处置（三选一，按侵入性排序）**：

- **A（推荐，零改码）多源 IP**：压测机绑定多个源 IP / 多台压测机，让每源 IP 都低于 300/min。
  注意 `getRemoteAddr()` **不读 `X-Forwarded-For`**，所以伪造请求头无效，必须是真实多源地址。
- **B（改码，压测环境专用）临时把 `max` 调到 0**：切面把 `max <= 0` 视为不限制，改完重新打包，
  **压测后必须改回**——这是「为压测改生产代码」，须走登记。
- **C（前置反代 + ForwardedHeaderFilter）**：仅在已有该配置时可用，CE 默认没有。

> 📌 闸门 1 的 A 方案与闸门 2 天然契合：**虚拟用户与账号 1:1**（200 线程 = 200 账号），
> 既避开 `max-active-tasks=3`，也让换票限流按用户维度摊开。

---

## 1. 🎯 目标与判据（对齐 PRD，不另立指标）

判据取自 `docs/prd/README.md` §7「非功能需求」，**不要在压测报告里发明新阈值**：

| 指标 | PRD 承诺 | 本次压测怎么测 |
| --- | --- | --- |
| 秒传判定 | 1 GiB 文件 **P95 < 5 s** | `POST /transfers/precheck` 取样器 P95（命中与未命中分开统计） |
| 分片落盘吞吐 | 单实例内网 **≥ 50 MB/s** | `PUT /transfers/{id}/parts/{index}` 的**字节吞吐**（不是 QPS） |
| 列表/详情 API | **P95 < 500 ms** | 混合场景中的元数据取样器（如 `GET /files` 列表） |
| 登录/换令牌 | **P95 < 300 ms** | 仅在令牌预热阶段单独度量，**不混进压测主场景** |
| 并发能力 | 在线会话 ≥ 500；活跃上传任务 ≥ 50 | 200 并发应**不触发 OOM / 线程耗尽**；超出时排队而非崩溃 |
| 令牌吊销 | 生效 ≤ 2 min | 压测期间不做（属功能验证，见后端集成测试） |

⚠️ 判据未覆盖之处**如实在报告里标「无 PRD 判据」**，不要用「看起来还行」代替。

---

## 2. 🧩 场景模型：200 并发怎么混合

纯下载或纯上传都测不出混合场景的真实瓶颈（争抢连接池、暂存盘 IO、GC 抖动）。
建议按下面的比例分配 **200 个线程**，各自独立线程组，同步起压：

| 线程组 | 线程数 | 业务动作 | 说明 |
| --- | --- | --- | --- |
| `TG-Upload` | 120 | `precheck` → `GET parts` → 并发 `PUT parts`（每用户同时 ≤ 5 片） → `merge` | 主压力来源；**每用户每轮用全新随机内容**（见闸门 3） |
| `TG-Download` | 60 | `POST /files/{id}/ticket` → `GET downloadUrl` | 两步式取件；`downloadUrl` 直接用，不再手工拼 |
| `TG-Meta` | 20 | `GET /files`（列表/详情） | 制造连接池争抢，度量列表 API 的 P95 劣化 |

> 📌 **每用户每片并发 ≤ 5** 是前端侧约定（PRD US-01「并发 ≤ 5 片」）。JMeter 用
> `Loop Controller` + `Synchronizing Timer`，或直接把「5 片」写成一个循环体，避免单用户压出
> 20 个并发分片——那会得到线上不存在的形态。

---

## 3. 🪜 阶梯加压（200 并发分 6 段）

### 3.1 推荐：`Stepping Thread Group`（需 `jpgc-casutg` 插件）

配置表（与插件 GUI 字段一一对应）：

| 字段 | 值 |
| --- | --- |
| This group will start | **200** threads |
| First, wait for | **30** seconds |
| Then start | **20** threads |
| Next, add | **20** threads every **30** seconds，using ramp-up **10** seconds |
| Then hold load for | **300** seconds |
| Finally, stop | **20** threads every **10** seconds |

→ 实际得到 6 段压力：`20 / 40 / 60 / 80 / 100 / 120 / 140 … 200`，
**每段稳定后读一次资源观测点**（§7 表格按段对齐），这样才能画出「并发 ↔ P95 ↔ 堆占用」的拐点。

### 3.2 零插件替代：标准线程组 + 启停延时

不愿装插件就用多个标准 `ThreadGroup`，靠 `ThreadGroup.delay`（启动延时）串起来：

| 组 | num_threads | ramp_time | duration | delay（累计启动时刻） |
| --- | --- | --- | --- | --- |
| `G1` | 40 | 30 | 300 | 0 |
| `G2` | 80 | 30 | 240 | 60 |
| `G3` | 120 | 30 | 180 | 120 |
| `G4` | 160 | 30 | 120 | 180 |
| `G5` | 200 | 30 | 60 | 240 |

标准线程组 XML（可直接粘进 `.jmx` 的 `<hashTree>`）：

```xml
<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="G5-200" enabled="true">
  <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
  <elementProp name="ThreadGroup.main_controller" elementType="LoopController"
               guiclass="LoopControlPanel" testclass="LoopController">
    <boolProp name="LoopController.continue_forever">false</boolProp>
    <stringProp name="LoopController.loops">-1</stringProp>
  </elementProp>
  <stringProp name="ThreadGroup.num_threads">200</stringProp>
  <stringProp name="ThreadGroup.ramp_time">30</stringProp>
  <boolProp name="ThreadGroup.scheduler">true</boolProp>
  <stringProp name="ThreadGroup.duration">60</stringProp>
  <stringProp name="ThreadGroup.delay">240</stringProp>
  <boolProp name="ThreadGroup.same_user_on_next_iteration">true</boolProp>
</ThreadGroup>
```

> ⚠️ **`on_sample_error` 必须是 `continue`**。若设成 `stopthread`，第一波 `4290` 就会把线程杀掉，
> 曲线看起来是「压力上不去」，而不是「被限流」——这是最容易误判的一种假象。

---

## 4. 🔑 令牌与账号参数化

### 4.1 预热：批量登录，产出 `tokens.csv`

⚠️ **不要在压测线程里登录**：登录失败 5 次即锁定 30 min（`1004`），
且登录 P95 < 300 ms 是独立指标。放在 `setUp Thread Group` 或**压测前用脚本离线生成**：

```bash
# 生成 N 个账号的令牌（每账号一行：username,accessToken）
: > tokens.csv
for u in $(seq -w 1 200); do
  tok=$(curl -s -X POST http://localhost:8080/api/v1/auth/token \
        -H 'Content-Type: application/json' \
        -d "{\"username\":\"perf$u\",\"password\":\"Perf@123456\"}" \
      | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
  echo "perf$u,$tok" >> tokens.csv
done
```

- 返回体是 `Result<TokenResponse>`，**令牌在 `data.accessToken`**，不是顶层字段；
- access token TTL **30 min**（`anttransfer.auth.access-token-ttl`）→ 压测时长（含阶梯）**超过 25 min 必须分段重跑或提前换发**；
- `tokens.csv` 属凭据文件，**加入 `.gitignore`，不要提交**。

### 4.2 装配：CSV Data Set Config + Header Manager

```xml
<CSVDataSet guiclass="TestBeanGUI" testclass="CSVDataSet" testname="tokens.csv" enabled="true">
  <stringProp name="filename">tokens.csv</stringProp>
  <stringProp name="variableNames">username,accessToken</stringProp>
  <boolProp name="recycle">true</boolProp>
  <boolProp name="stopThread">false</boolProp>
  <stringProp name="shareMode">shareMode.all</stringProp>
</CSVDataSet>

<HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="Bearer" enabled="true">
  <collectionProp name="HeaderManager.headers">
    <elementProp name="Authorization" elementType="Header">
      <stringProp name="Header.name">Authorization</stringProp>
      <stringProp name="Header.value">Bearer ${accessToken}</stringProp>
    </elementProp>
  </collectionProp>
</HeaderManager>
```

- `shareMode.all` + `recycle=true`：200 线程各取一行并循环使用，**保证并发数 = 账号数**；
- Header Manager 挂在**线程组层级**（不要挂在单个取样器上，否则登录请求会被误加过期令牌）。

---

## 5. ⬆️ 上传链路：取样器序列与断言

### 5.1 步骤

| # | 取样器 | 关键参数 | 断言 |
| --- | --- | --- | --- |
| 1 | `POST /api/v1/transfers/precheck` | JSON：`sha256` / `sizeBytes` / `fileName` | `code ∈ {0, 4001}`（见 5.3） |
| 2 | `GET /api/v1/transfers/{id}/parts` | 路径取上一步 `$.data.uploadId` | `code == 0` |
| 3 | `PUT /api/v1/transfers/{id}/parts/{index}` | **multipart**：文件字段 `chunk` + 文本字段 `hash` | `code == 0` |
| 4 | `POST /api/v1/transfers/{id}/merge` | 无 body（或幂等键） | `code ∈ {0, 4002}`；`4002` 时读 `$.data.missing` 续传 |

⚠️ 第 3 步是 **PUT + `multipart/form-data`**：JMeter 里勾选
`Use multipart/form-data`，在 `Files Upload` 页签加文件参数 `chunk`，
在 `Parameters` 页签加文本参数 `hash`。**文件名与 `path` 不要同名混淆**。

### 5.2 分片清单怎么来

- 分片大小取 `$.data.chunkSize`（服务端决定，默认 8 MiB，`max-chunk-count: 1024` 时**可能自动放大分片**）；
- **不要在前端侧写死 8 MiB**：服务端会为守住 `uploaded_indexes varchar(8192)` 而上调分片大小，
  写死会导致片数与服务端不一致 → `4002` 缺片。
- 分片文件建议**预生成**一次（`dd`/`head -c`），避免每轮压测都在 JMeter 内造数据。

### 5.3 ⚠️ `4001` 是 HTTP 200 的业务分支码

`precheck` 未命中秒传时返回 **HTTP 200 + `code=4001`**（秒传未命中：策略 B 仍 200），
`merge` 缺片时是 **HTTP 200 + `code=4002`**。因此：

- **禁止**用「HTTP 状态码 200」做唯一断言——那会把业务失败算成成功；
- 用 JSR223 断言判业务码：

```groovy
// JSR223 Assertion (Groovy) — 挂在 precheck 取样器下
def body = prev.getResponseDataAsString()
if (body == null || body.isEmpty()) {
    AssertionResult.setFailure(true)
    AssertionResult.setFailureMessage("空响应体")
    return
}
def json = new groovy.json.JsonSlurper().parseText(body)
if (!(json.code in [0, 4001])) {          // 0=命中, 4001=未命中（正常分支）
    AssertionResult.setFailure(true)
    AssertionResult.setFailureMessage(
        "业务码异常 code=${json.code} message=${json.message} traceId=${json.traceId}")
}
```

### 5.4 让每轮都真实上传（闸门 3 的落地）

秒传命中会让压力归零，所以 `TG-Upload` 每轮迭代必须**换内容**：

- 方案：预生成 **N 份内容互不相同**的分片集（如 200 份），每轮取一份 → 保证 `sha256` 未命中；
- 若要顺带度量秒传性能（P95 < 5 s），**单独加一个只压 `precheck` 的线程组**并复用同一 `sha256`，
  把「秒传命中」与「真实上传」两组数据**分开统计**，不要混在同一张聚合表里。

---

## 6. ⬇️ 下载链路：两步式取件

### 6.1 步骤

| # | 取样器 | 鉴权 | 断言 |
| --- | --- | --- | --- |
| 1 | `POST /api/v1/files/{nodeId}/ticket` | `Authorization: Bearer ${accessToken}` + `file:download` | `code == 0` |
| 2 | `GET ${downloadUrl}` | **免登录**（票据在 URL query 里） | HTTP 200 + **`Content-Length` 与源文件大小一致** |

关键点（都来自实现，不是推测）：

- `downloadUrl` 是**相对路径** `/api/v1/files/{nodeId}/content?ticket=...`，需在 JMeter 里补 host；
- 取件端点**不做 `@RequiresPerm`**：权限判定被前移到换票阶段（浏览器原生下载无法携带 Authorization 头），
  所以**不要给第 2 步加 Bearer 头**，加了也不影响结果，但会让压测模型与线上不符；
- **登录用户票据是「可重复使用至过期」，不是一次性**：TTL 默认 **5 min**
  （`anttransfer.file.download-ticket-ttl`）。因此：
  - ✅ 同一张票可以在 TTL 内反复取件 → 适合压测；
  - ⚠️ 压测时长超 5 min 必须**周期性重新换票**（在 `TG-Download` 里加
    `Runtime Controller` 或按迭代计数换票），否则后半程全是 `4018`（票据无效）。
- **必须断言 `Content-Length`**：这条链路是流式下发，连接被中途掐断时 JMeter 仍可能记 200，
  只有长度对不上才暴露「半截文件」；
- 若 `anttransfer.file.global-speed-limit` 非 0，下载会被**背压限速（变慢，不报错）**，
  压测前确认它是 0，否则吞吐数字反映的是限速器。

---

## 7. 📈 汇总指标与非 GUI 执行

```bash
jmeter -n -t mixed-200.jmx -l result.jtl -e -o report/
```

`report/index.html` 里必须逐项交代的指标：

| 指标 | 看什么 | 常见误判 |
| --- | --- | --- |
| **Error %** | 按 `code` 分组，不只看 HTTP 码 | `4290`（限流）、`4103`（配额）、`4018`（票据）含义完全不同，混在一起看不出根因 |
| **P95 / P99** | 按**线程组分别**看 | 只看 Total 的 P95 会被元数据请求稀释 |
| **Throughput（req/s）** | 上传/下载/元数据分开 | 上传的「吞吐」应换算成 **MB/s**（PRD 是 ≥ 50 MB/s） |
| **Bytes throughput** | 与网卡上限比对 | 若 `Download` 组 Bytes 很小但 req/s 很高 → 压的是错误响应 |
| **Active Threads 曲线** | 是否按阶梯上升 | 阶梯上不去 = 被 `stopthread` 或限流打掉 |
| **Response Times Over Time** | 拐点出现在哪一段 | 拐点段 → 对应 §8 观测表的瓶颈定位 |
| **Latency vs Connect Time** | Connect 占比高 → 连接池/监听队列问题 | 别只盯 Latency |

> 📌 单机 JMeter 起 200 线程本身可能成为瓶颈：先跑一次**空场景/健康检查端点**，
> 确认压测机自己 CPU、GC、网络都还有余量，再压业务。

---

## 8. 🔬 压测期间同步采集的四组观测点

> ⚠️ **前提**：本项目**未接入 actuator / micrometer**（`management.*` 全仓库零命中，属已知缺口 GAP-04），
> 所以**没有 `/actuator/metrics` 可用**。下面给的是当前就能跑的命令。

### 8.1 JVM：合并堆内存与 GC 次数/停顿

```bash
# ① 每秒一行：YGC/FGC 次数、各代占用、GC 耗时占比（含老年代合并堆视角）
jstat -gcutil <pid> 1000 | tee gcutil.log

# ② 合并堆总量（年轻代 + 老年代 = 堆上限，判断是否接近 OOM）
jcmd <pid> GC.heap_info

# ③ 推荐：启动时就开 GC 日志，压测后离线算停顿分布（P95/P99 停顿）
#    JVM 参数：-Xlog:gc*,gc+heap=info:file=logs/gc.log:time,uptime,level,tags:filecount=5,filesize=50M
```

看什么：**FGC 次数是否在某个阶梯段开始单调增长**（= 堆不够 / 有大对象滞留），
以及 **GC 停顿是否侵蚀 P99**。合并堆内存 = `-Xmx` 下 Young + Old 的实时占用，别只盯 Old。

### 8.2 Hikari 连接池占用

```bash
# 方式 A（推荐）：JMX 读 MBean（需在压测环境开启）
#   application.yml: spring.datasource.hikari.register-mbeans: true
#   然后 jconsole / jmxterm 读 com.zaxxer.hikari:type=Pool (HikariPool-1)
#   关注：ActiveConnections / IdleConnections / ThreadsAwaitingConnection / ConnectionTimeout
```

```yaml
# 方式 B（零额外工具）：临时打开 Hikari 统计日志（每 30s 打印 pool stats）
logging:
  level:
    com.zaxxer.hikari: DEBUG
```

⚠️ **关键**：`connectionTimeout` 默认 **30 s**。**活跃连接打满时，前 30 秒不会报错，
只会变慢**——表现为 P95 阶梯式抬升而非错误率上升。所以「连接池打满」的**唯一可靠信号是
`ThreadsAwaitingConnection > 0`**，光看错误率会漏掉。合并（`merge`）与秒传都是 DB 密集操作，
是本项的主要施压者。

### 8.3 Redis 命中率

```bash
# 压测前打点
redis-cli INFO stats | findstr keyspace        # hits / misses 基线
redis-cli INFO clients | findstr connected     # connected_clients / blocked_clients

# 压测后打点，命中率 = Δhits / (Δhits + Δmisses)
redis-cli INFO stats | findstr keyspace
redis-cli SLOWLOG GET 10                       # 是否有 > slowlog-log-slower-than 的慢命令
redis-cli INFO memory | findstr used_memory_human
```

本项目的热点键：`at:file:ticket:`（下载票据，读多写少）、`at:perm:`（权限缓存）、
`at:auth:access:`（会话纪元，**每个请求都要比对**）。命中率跌破 95% 通常意味着权限缓存被击穿。

### 8.4 磁盘 IO（容易被忽略的第四组）

`spring.servlet.multipart.file-size-threshold: 0` 意味着**每个分片都落临时文件**
（先写 `.tmp` 再原子改名），合并还要整体重算 SHA-256 读一遍 —— 磁盘是混合场景的真实瓶颈之一。

```bash
# Linux
iostat -x 1 60 | tee iostat.log      # 关注 %util、await、w/s
# Windows（PowerShell / cmd 皆可）
typeperf "\LogicalDisk(_Total)\Disk Bytes/sec" "\LogicalDisk(_Total)\Disk Reads/sec" -sc 60
```

### 8.5 采集脚本骨架（Windows cmd）

```cmd
:: 每个阶梯段前执行一次，各段日志分开存
set PID=12345
jstat -gcutil %PID% 1000 > obs\seg2-gcutil.log
jcmd %PID% GC.heap_info > obs\seg2-heap.txt
redis-cli INFO stats > obs\seg2-redis-stats.txt
redis-cli INFO clients > obs\seg2-redis-clients.txt
```

---

## 9. 📋 记录表格（模板，直接填）

### 9.1 配置快照（不给这张表，数据无法复现）

| 项 | 值 |
| --- | --- |
| 被测版本 / Commit | |
| 部署形态（Compose / 单机 / 容器限额） | |
| `-Xmx` / 堆参数 / GC 器 | |
| CPU / 内存 / 磁盘类型 | |
| MySQL `max_connections` / Hikari `maximumPoolSize` | |
| Redis 单实例 / 集群，`maxmemory` | |
| 限流处置方式（A 多源 IP / B 调 `max`） | |
| `max-active-tasks` / `global-speed-limit` / `download-ticket-ttl` | |
| 分片大小 / 文件大小 / 轮次内容是否唯一 | |
| JMeter 线程数与混合比 | |
| 压测机规格（避免压测机先崩） | |

### 9.2 阶梯分段结果（每段一行，与 §3 的段对齐）

| 段 | 并发 | 段时长 | 采样窗口 | Upload req/s | Upload MB/s | Download MB/s | Meta P95 (ms) | Error % | 4290 | 4103 | 4018 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 20 | 5 min | 稳定后 60 s | | | | | | | | |
| 2 | 40 | 5 min | 稳定后 60 s | | | | | | | | |
| 3 | 60 | 5 min | 稳定后 60 s | | | | | | | | |
| … | … | | | | | | | | | | |
| N | 200 | 5 min | 稳定后 60 s | | | | | | | | |

### 9.3 资源观测（与 9.2 的段号一一对应，这是定位瓶颈的核心表）

| 段 | 并发 | 老年代占用 | YGC 次数/停顿时长 | FGC 次数 | 堆最大占用 | Hikari Active | Hikari 等待线程 | 连接超时数 | Redis 命中率 | Redis connected | 磁盘 util% | 磁盘 MB/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 20 | | | | | | | | | | | |
| 2 | 40 | | | | | | | | | | | |
| … | | | | | | | | | | | | |

### 9.4 瓶颈判定与结论

| 项 | 结论 | 证据（哪张表哪一行） |
| --- | --- | --- |
| 拐点在并发多少？ | | 9.2 中第一个 P95 突增段 / 9.3 中该段资源突增项 |
| 首要瓶颈（JVM / 连接池 / Redis / 磁盘 / 网络 / 限流） | | |
| 是否达到 PRD 指标（逐项列 §1 表格） | | |
| 失败请求的码分布与根因 | | `4290` 限流 / `4103` 配额 / `4018` 票据 / `5002` DB |
| 未达标的下一步动作 | | 需给出**可验证的**动作，而非「再观察」 |

### 9.5 归档

- `result.jtl`、`report/`、GC 日志、`obs/*.log`、`tokens.csv`（**脱敏后**）统一归档到压测记录目录；
- 一次压测 = 一个目录，命名含日期与 commit 短哈希，便于回查。

---

## 10. ✅ 执行前自检清单

- [ ] 闸门 1：限流已处置（多源 IP 或临时调 `max`），并记录处置方式
- [ ] 闸门 2：账号数 = 线程数，且每账号进行中任务数 < `max-active-tasks`
- [ ] 闸门 3：每轮上传内容唯一；秒传命中组单独统计
- [ ] `tokens.csv` 已生成且在 `.gitignore` 中；压测时长未超 access token TTL
- [ ] 下载票据在 TTL 内会周期性换发
- [ ] `global-speed-limit` 确认为 0（或已按预期纳入解释）
- [ ] `-Xlog:gc*` 已开启，`jstat`/`redis-cli` 采集脚本已就位
- [ ] 先跑 1 段小并发基线，确认压测机自身不是瓶颈
- [ ] 压测数据已与环境隔离（库/Redis/存储目录），避免污染开发数据
