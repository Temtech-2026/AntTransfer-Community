# 🚀 性能测试

本目录用于存放性能/压测脚本与方案，重点场景：

- 🔐 登录鉴权 QPS / 并发用户
- 🔄 传输任务高频轮询进度（进度查询接口）
- 📦 大文件上传（分片上传在断点续传场景下的稳定性）
- ⬇️ 下载取件吞吐（带宽 / 连接数上限）
- 🗄️ 数据库连接池与 Redis 缓存命中瓶颈

## 📁 已落地方案

| 方案 | 位置 | 回答什么问题 |
| --- | --- | --- |
| 📊 JMeter 混合上传/下载（200 并发） | [`jmeter/mixed-upload-download.md`](./jmeter/mixed-upload-download.md) | 混合业务链路的拐点与瓶颈定位；含 JVM / 连接池 / Redis / 磁盘四组观测点与记录表格 |
| ⚡ wrk 下载接口 | [`wrk/download.md`](./wrk/download.md) | 取件端点（`GET /api/v1/files/{id}/content`）的吞吐与带宽上限；含携带 Token 的 Lua 写法与结果解读模板 |

## 🔧 计划选型

- 📊 工具：[k6](https://k6.io/)（脚本化压测，支持断言与阈值）——尚未接入
- 🗂️ 结构：`tests/performance/scripts/*.js` + 阈值输出

## ⏰ 何时接入

后端核心链路（`at-transfer` 断点续传）具备可运行原型后开始基线压测。

## ⚠️ 压测前必读：三个闸门

动手前请先读 [JMeter 方案](./jmeter/mixed-upload-download.md) 的「§0 结论先行：三个必须先处理的闸门」，
以下任一项未处置，压测数字即无意义：

1. **下载链路 IP 维度限流**：`file-content` = 300 req/min **per IP**、`file-ticket` = 60 req/min，
   阈值是**注解常量**（yml 覆盖不了），维度取 `getRemoteAddr()`（伪造 `X-Forwarded-For` 无效）；
2. **单用户进行中任务上限**：`max-active-tasks: 3`，超出预检直接 `4103` → 压测账号数须等于虚拟用户数；
3. **秒传命中自我稀释压力**：每轮上传必须换内容，否则第 2 轮起全是秒传命中，压力归零。

> 📌 观测点采集命令见 [JMeter 方案](./jmeter/mixed-upload-download.md) 的「§8 压测期间同步采集的四组观测点」。
> 本项目**未接入 actuator / micrometer**（GAP-04），故无 `/actuator/metrics` 可用。

## 🔐 产物与凭据

`tokens.txt` / `urls.txt` / `*.jtl` / `obs/` / `report/` 属压测产物，**不入库**（见 `.gitignore`）。
其中 `tokens.txt` 含 access token，属凭据文件，**严禁提交**。
