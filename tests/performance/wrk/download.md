# ⚡ wrk 下载压测：命令 / Lua（携带 Token） / 结果解读

> 对象：`GET /api/v1/files/{nodeId}/content` —— AntTransfer CE 的流式取件端点（支持 `Range`）。
> 本文给命令、Lua 脚本、结果解读模板，并**先讲清一个会让结果完全失效的前提**。

---

## 0. 🚨 先说结论：wrk 直接压下载接口会得到无意义的数字

| # | 事实（读实现得出） | 对 wrk 压测的影响 |
| --- | --- | --- |
| 1 | `GET /files/{nodeId}/content` 带 `@RateLimit(60s, max=300, key="file-content")`，维度是 `request.getRemoteAddr()` | 单压测机**上限 5 req/s**。`-c 200` 只会换来满屏 `429`，Latency 数据毫无意义 |
| 2 | 下载票据（`?ticket=`）**绑定用户与文件，不绑定 IP** | **多发几张票不能绕过限流**——限流是 IP 维度，与票据数量无关 |
| 3 | 取件端点**免登录**：权限判定在换票阶段（`POST /files/{id}/ticket` 校验 `file:download`） | 「Lua 携带 Token」的正确落点是**换票端点**或受保护接口；取件只需 URL 里的 ticket |
| 4 | `anttransfer.file.global-speed-limit` 默认 `0`（不限），非 0 时**背压限速**（变慢，不报错） | 吞吐偏低时先确认它是不是被配过 |
| 5 | 登录用户票据**可重复使用至过期**（TTL 默认 5 min），不是一次性 | 压测时长 > 5 min 需重新换票，否则后半程全是 `4018` |

**因此 wrk 有两种正确用法**，别混着用：

| 模式 | 前置 | 命令规模 | 回答什么问题 |
| --- | --- | --- | --- |
| **A. 合规基线**（保留限流） | 无需处置 | `-c 2~4` | 限流阈值是否如期生效（`4290`）、单流吞吐是否达 PRD「≥ 50 MB/s」、大文件顺序下载稳定性 |
| **B. 链路容量**（处置限流） | 调大/关闭 `file-content` 的 `max`（注解常量，需改码重打包） | `-c 100~200` | 真实带宽/连接承载上限、内核与线程模型瓶颈 |

⚠️ 模式 B 属「为压测改生产代码」，必须登记并在压测后改回。详见
[JMeter 方案 §0](../jmeter/mixed-upload-download.md) 同样的闸门说明。

> 🖥️ **Windows 注意**：wrk 无官方 Windows 版，需在 WSL2 或 Linux 压测机运行。
> 且 WSL2 走 NAT，**源 IP 是虚拟网卡地址（仍是单一 IP）**，闸门 1 在 WSL 里同样成立。

---

## 1. 🔧 准备：令牌与票据

### 1.1 取 access token（令牌在 `data.accessToken`，返回体是 `Result<TokenResponse>`）

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"username":"perf01","password":"Perf@123456"}' \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
echo "${TOKEN:0:24}..."      # 只打印前缀，避免令牌进终端历史
```

- access token TTL **30 min**（`anttransfer.auth.access-token-ttl`）；压测超时需重取；
- 登录失败 5 次锁定 30 min（`1004`）→ **不要在多线程压测里做登录**。

### 1.2 换下载票据（这一步才需要 Bearer + `file:download`）

```bash
NODE_ID=101
curl -s -X POST "http://localhost:8080/api/v1/files/${NODE_ID}/ticket" \
  -H "Authorization: Bearer ${TOKEN}" \
  | tee ticket.json
# 返回：{"code":0,"data":{"ticket":"...","nodeId":101,"expiresInSeconds":300,
#                        "downloadUrl":"/api/v1/files/101/content?ticket=..."}}
```

`downloadUrl` 是**相对路径**，压测时需补上 host；把它与 host 拼好后可直接交给 wrk。

### 1.3 ⚠️ wrk 不能在脚本里同步发 HTTP 请求

wrk 的 Lua 环境**没有内置 HTTP 客户端**（`init`/`request` 里无法发起并等待一个子请求）。
所以「先换票、再取件」这一串**必须在压测前用 curl 批量做成文件**，Lua 只负责逐行读取：

```bash
# 预生成 N 个取件 URL（同一文件可复用票；此处生成多张票以覆盖 TTL 轮换）
: > urls.txt
for i in $(seq 1 50); do
  curl -s -X POST "http://localhost:8080/api/v1/files/${NODE_ID}/ticket" \
    -H "Authorization: Bearer ${TOKEN}" \
    | sed -n 's/.*"downloadUrl":"\([^"]*\)".*/\1/p' \
    | sed "s|^|http://localhost:8080|" >> urls.txt
done
wc -l urls.txt
```

> ⚠️ 票据 TTL 5 min：这段预热必须在压测开始前 **5 分钟内**完成，否则票已过期（`4018`）。

---

## 2. 💻 命令

### 2.1 模式 A：合规基线（保留限流）

```bash
# 2 连接、4 线程、跑 60s，输出延迟分布；应全程 2xx 且无 429
wrk -t4 -c2 -d60s --latency --timeout 30s \
    "http://localhost:8080/api/v1/files/101/content?ticket=${TICKET}"

# 验证限流阈值：用 10 连接刻意超限，观察是否出现 429（Non-2xx 计数上升）
wrk -t4 -c10 -d30s --latency \
    "http://localhost:8080/api/v1/files/101/content?ticket=${TICKET}"
```

### 2.2 模式 B：链路容量（已处置限流）

```bash
# 200 连接压带宽上限；务必用 --latency 拿分位，-d 建议 ≥ 120s 跨过预热
wrk -t8 -c200 -d180s --latency --timeout 30s \
    -s lua/file-content.lua -- urls.txt
```

参数取舍：

| 参数 | 建议 | 原因 |
| --- | --- | --- |
| `-t` | = 压测机 CPU 核数（8 核用 8） | 超过核数只会增加调度开销 |
| `-c` | 模式 A 取 2~4；模式 B 取 100~200 | 受闸门 1 限制，不是越大越好 |
| `-d` | ≥ 120s（含预热）；票据场景 ≤ 4 min | 跨过 JIT/缓存预热；且不超过票据 TTL |
| `--latency` | **必加** | 不加只有均值，看不出 P95/P99 |
| `--timeout` | 30s | 大文件下载慢，默认超时太短会误记 socket error |
| `-s lua/…` | 需要多票轮换时加 | 单票场景直接压 URL 更省开销 |

> 📌 **文件要够大**：若文件只有几百 KB，吞吐会被内核页缓存和 loopback 带宽顶满，
> 测出来的是「内存速度」。压带宽请用 **≥ 100 MB** 的文件；压连接数请用**同一张大文件**。

---

## 3. 🧩 Lua 脚本

### 3.1 `lua/bearer.lua` —— 携带 Bearer Token（压换票端点或任意受保护接口）

```lua
-- 用途：给每个请求注入 Authorization: Bearer <token>，并支持多令牌轮转。
-- 用法：wrk -t8 -c200 -d120s -s lua/bearer.lua -- tokens.txt
--       tokens.txt 每行一个 access token（一行一账号，避免单账号成为热点）
--
-- 为什么不在 request() 里做 IO：request() 每请求都执行，
-- 在里面读文件/拼字符串会成为压测机自身瓶颈，务必在 init() 一次性读完。

local tokens = {}
local tid = 0
local cursor = 1

-- setup() 在每个工作线程启动前于主状态调用一次：给线程编号，用于错开令牌起点
local threadSeq = 0
function setup(thread)
  threadSeq = threadSeq + 1
  thread:set("tid", threadSeq)
end

function init(args)
  tid = thread:get("tid") or 1
  local path = args ~= "" and args or "tokens.txt"
  for line in io.lines(path) do
    line = line:match("^%s*(.-)%s*$")      -- 去首尾空白
    if line ~= "" then
      tokens[#tokens + 1] = line
    end
  end
  if #tokens == 0 then
    error("tokens.txt 为空或不可读：" .. path)
  end
  cursor = ((tid - 1) % #tokens) + 1        -- 各线程从不同令牌起步
end

function request()
  -- 轮转令牌：分摊单账号的限流与权限缓存热键
  wrk.headers["Authorization"] = "Bearer " .. tokens[cursor]
  cursor = cursor % #tokens + 1
  wrk.headers["Content-Type"] = "application/json"
  return wrk.format("POST", "/api/v1/files/101/ticket")
end

function done(summary, latency, requests)
  io.write(string.format(
    "[thread %d] req=%d err=%d non2xx=%d p50=%.1fms p95=%.1fms p99=%.1fms\n",
    tid, requests, summary.errors.status + summary.errors.connect
        + summary.errors.read + summary.errors.write + summary.errors.timeout,
    summary.errors.status,
    latency:percentile(50) / 1000, latency:percentile(95) / 1000,
    latency:percentile(99) / 1000))
end
```

### 3.2 `lua/file-content.lua` —— 压取件端点（多票轮换，免登录）

```lua
-- 用途：从文件逐行读取「已拼好 host 的取件 URL」，每个请求取一条（票据轮换）。
-- 用法：wrk -t8 -c200 -d180s --latency -s lua/file-content.lua -- urls.txt
--
-- 注意：本脚本不注入 Authorization —— 取件端点免登录，
-- 鉴权信息在 URL 的 ?ticket= 里，权限判定已在换票阶段完成。

local urls = {}
local tid = 0
local cursor = 1
local ok, bad, other = 0, 0, 0

local threadSeq = 0
function setup(thread)
  threadSeq = threadSeq + 1
  thread:set("tid", threadSeq)
end

function init(args)
  tid = thread:get("tid") or 1
  local path = args ~= "" and args or "urls.txt"
  for line in io.lines(path) do
    line = line:match("^%s*(.-)%s*$")
    if line ~= "" then
      urls[#urls + 1] = line
    end
  end
  if #urls == 0 then
    error("urls.txt 为空或不可读：" .. path)
  end
  cursor = ((tid - 1) % #urls) + 1
end

function request()
  local url = urls[cursor]
  cursor = cursor % #urls + 1
  -- 支持 Range：按 1 MiB 分段取件，可用来压「多段并发 + 续传」路径
  wrk.headers["Range"] = "bytes=0-1048575"
  return "GET " .. url:match("^https?://[^/]+(/.*)$") .. " HTTP/1.1\r\n" ..
         "Host: " .. url:match("^https?://([^/]+)") .. "\r\n" ..
         "Range: bytes=0-1048575\r\n\r\n"
end

function response(status)
  if status == 200 or status == 206 then
    ok = ok + 1
  elseif status == 429 then
    bad = bad + 1          -- 限流：闸门 1 未处置的典型信号
  else
    other = other + 1      -- 401/403/4018：票据过期或不匹配
  end
end

function done(summary, latency, requests)
  io.write(string.format(
    "[thread %d] 2xx=%d 429=%d other=%d | p95=%.1fms p99=%.1fms\n",
    tid, ok, bad, other,
    latency:percentile(95) / 1000, latency:percentile(99) / 1000))
end
```

### 3.3 ⚠️ `response()` 会拖慢吞吐

一旦定义了 `response()`，wrk 需要把**响应体读进来**才能回调，压大文件时这部分开销不可忽略。
所以：

- **纯吞吐测试（模式 B）不要定义 `response()`**，直接压 URL 即可；
- 需要状态码分布时，用**较小的文件**或接受该开销，并意识到吞吐数字偏保守。

---

## 4. 📖 结果解读模板

### 4.1 逐字段解读

```
Running 3m test @ http://localhost:8080/api/v1/files/101/content?ticket=...
  8 threads and 200 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency   412.31ms  128.02ms   1.20s    76.18%
    Req/Sec    35.42     12.71     80.00    68.00%
  Latency Distribution          ← 仅 --latency 时出现
     50%  380.11ms
     75%  470.22ms
     90%  590.44ms
     99%  1.05s
  84210 requests in 3.00m, 42.10GB read
  Socket errors: connect 0, read 0, write 0, timeout 0
Non-2xx or 3xx responses: 12
Requests/sec:    467.83
Transfer/sec:    239.52MB
```

| 字段 | 该看什么 | 异常信号与根因 |
| --- | --- | --- |
| `Latency Avg/Stdev` | 均值只能作参考 | `Stdev` 接近 `Avg` → 延迟两极分化（部分请求被限流/排队） |
| `Latency Distribution` | **P95/P99 才是承诺口径** | P99 ≫ P95 → 长尾，通常是连接池等待或 GC |
| `Req/Sec` | 与小文件对照 | **大文件下载时 req/s 低是正常的**，别拿它当吞吐 |
| `Socket errors` | 必须全 0 | `connect` > 0 → 监听队列/端口耗尽；`timeout` > 0 → 提高 `--timeout` 或服务端背压 |
| `Non-2xx or 3xx` | **必须是 0** | 见 §4.2 对照表——这一列非 0 时，下面所有吞吐数字都不可信 |
| `Transfer/sec` | 与网卡/磁盘上限对比 | 若 `Transfer/sec` 很小而 `Req/Sec` 很高 → 压的是错误响应体 |
| `requests in …, …GB read` | 总流量是否合理 | 与「文件大小 × 请求数」对不上 → 响应被截断 |

### 4.2 `Non-2xx` 对照表（本项目的真实码值）

| HTTP | 业务码 | 含义 | 压测侧动作 |
| --- | --- | --- | --- |
| 429 | **4290** | 接口级限流（`file-content` 300/min **per IP**） | 闸门 1 未处置；改多源 IP 或临时调 `max` |
| 401 | **4018** | 下载票据无效（过期 / 非本人 / 与文件不匹配） | 票据超 5 min TTL，需重新换票 |
| 401 | 1002 | access token 过期 | 超 30 min，需重取令牌 |
| 403 | 1003 | 无权限（换票阶段 `file:download` 不足） | 换票账号权限配置问题 |
| 404 | 4xxx | 条目不存在 / 已销毁 | 换一个真实存在的 `nodeId` |

> 📌 **判定规则**：`Non-2xx` 非 0 时，**先修数据再谈性能**；把带错误的吞吐当结论是最常见的压测事故。

### 4.3 结果记录表（模板）

| 轮次 | 模式 | `-t` | `-c` | `-d` | 文件大小 | Req/Sec | Transfer/sec | P50 | P95 | P99 | Non-2xx (429/4018) | Socket err (conn/read/write/timeout) | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | A 合规 | 4 | 2 | 60s | 128 MB | | | | | | | | 验证限流未触发 |
| 2 | A 合规 | 4 | 10 | 30s | 128 MB | | | | | | | | 刻意超限，验 4290 |
| 3 | B 容量 | 8 | 50 | 120s | 128 MB | | | | | | | | 阶梯找拐点 |
| 4 | B 容量 | 8 | 200 | 180s | 128 MB | | | | | | | | 目标规模 |

配套观测（与压测同步打点，命令见 [JMeter 方案 §8](../jmeter/mixed-upload-download.md)）：
网卡出向带宽、`jstat -gcutil`、磁盘 `%util`、`redis-cli INFO stats`。
**wrk 的 `Transfer/sec` 必须与网卡观测相互印证**——两者对不上，说明瓶颈在压测机或网络路径，而非服务端。

### 4.4 判定与结论（填这张表才算压完）

| 项 | 结论 | 证据 |
| --- | --- | --- |
| 是否达到 PRD「分片落盘 ≥ 50 MB/s / 列表 P95 < 500 ms」相关判据 | | `Transfer/sec` 与 P95 |
| 拐点连接数（吞吐不再随 `-c` 增长） | | 轮次对比表 |
| 首要瓶颈：网卡 / 磁盘 IO / JVM GC / 连接池 / 限流 | | 与资源观测交叉印证 |
| `Non-2xx` 是否已清零 | | §4.2 对照 |
| 未达标项的下一步动作（可验证） | | |

---

## 5. ✅ 执行前自检

- [ ] 闸门 1 已处置或**明确选择模式 A**（保留限流做合规基线）
- [ ] 压测文件 ≥ 100 MB（否则测的是页缓存速度）
- [ ] `global-speed-limit` 已确认（默认 0）
- [ ] 票据在 5 min TTL 内；压测时长未超 TTL，否则加多票轮换
- [ ] 令牌 TTL 30 min 内；`tokens.txt`/`urls.txt` 已加入 `.gitignore`
- [ ] 已先跑一轮小并发，确认 `Non-2xx = 0` 再放大
- [ ] 压测环境与开发数据隔离
