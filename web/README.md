# 🎨 AntTransfer CE — 前端（web）

AntTransfer Community Edition 的前端工程，基于 **Ant Design Pro v6**（Umi Max + React 19 + TypeScript + Ant Design）。

## 📋 环境要求

- 🟢 Node.js ≥ 22（模板 `engines` 强制）；npm 10+

## 🚀 快速开始

```bash
# 1️⃣ 安装依赖
npm install

# 2️⃣ 本地开发（默认 http://localhost:8000）
npm run dev
```

> 🔗 前后端联调：`config/proxy.ts` 已把 `/api/` 代理到 `http://localhost:8080`
> （后端 `at-bootstrap`），请先启动后端再访问页面。

### 🔗 `/api` 开发代理链路（已回归）

开发态所有 `/api/**` 请求都依赖 dev server 代理。该链路已于 **2026-09-29** 在前后端齐备的环境下实测通过（见本节末「状态」）；下表为配置侧核对结论——**本就不是配置缺陷**，故日后若代理失败，请按状态段的排查顺序定位，而非怀疑前缀写法：

| 环节 | 位置 | 事实 |
| --- | --- | --- |
| 代理取值 | `config/config.ts:84` | `proxy[UMI_ENV]`；`npm run dev`（`cross-env UMI_ENV=dev MOCK=none`）→ `proxy.dev` |
| 代理目标 | `config/proxy.ts:14-20` | `/api/` → `http://localhost:8080`，**刻意不配 `pathRewrite`** |
| 路径拼接 | `at-bootstrap/application.yml:17` | `server.servlet.context-path: /api` + 控制器 `/v1/...` = `/api/v1/...` |
| 前端请求 | `src/requestErrorConfig.ts:37` | `REFRESH_URL = '/api/v1/auth/token/refresh'`，已带 `/api` 前缀 |

即 `/api/v1/...` 转发后恰好落在后端 `/api` context-path 下，**前缀不可再加也不可删**。

实测确认的两处易踩点（均与配置无关）：

1. `npm run dev` 带 **`MOCK=none`**，mock 已关闭；后端不在 8080 时 `/api` 必然失败——需先 `make dev-up`（MySQL/Redis）再 `make run`（后端 8080）。
2. 代理**只对 dev server 生效**：`npm run preview` / `build` 产物不走 `proxy.ts`，此时 `src/app.tsx:193` 的 `baseURL` 会切到官方 demo 域名，属预期行为，勿误判为代理故障。

**状态（2026-09-29 实测）**：本地 dev 代理链路与后端 `/api/v1/**` 已按同一前缀回归（前端测试 **73 文件 / 828 例（09-29）→ 78 文件 / 1093 例（10-03）** 全绿，含请求层与错误码策略分流断言；代理链路本身的人工联调最近一次仍为 09-29）；若代理失败，仍按 CORS（`anttransfer.cors.allowed-origin-patterns`）→ 路径拼接 → 后端白名单顺序排查。

## ⚙️ 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 本地开发（`UMI_ENV=dev`，关闭 mock） |
| `npm run build` | 生产构建，产物输出 `dist/` |
| `npm run preview` | 预览构建产物（默认 8000 端口） |
| `npm run lint` | Biome 代码检查 + TypeScript 类型检查 |
| `npm run tsc` | TypeScript 类型检查 |
| `npm run test` | Vitest 单元测试（全量，**73 文件 / 828 例（09-29）→ 78 文件 / 1093 例（10-03）**） |
| `npm run test:coverage` | 同上 + v8 覆盖率报告 |
| `npm run test:watch` / `npm run test:ui` | 监听模式 / 可视化 UI |
| `npm run openapi` | 从 OpenAPI 生成接口服务（需先配置 schema 来源） |

## 🗂️ 目录导航

```
web/
├── config/            # Umi Max 配置（路由 / 代理 / 主题 / 插件）
│   ├── config.ts      # 主配置（入口）
│   ├── routes.ts      # 路由表
│   ├── proxy.ts       # 本地开发代理（/api -> 后端 8080）
│   └── defaultSettings.ts  # 布局主题设置
├── src/
│   ├── components/    # 全局公共组件（含轻 IM：ChatComposer / ChatDrawer / ChatGroupPanel）
│   ├── hooks/         # 复用 Hook（useChunkUpload / useChatMentionables 等）
│   ├── pages/         # 业务页面（登录 / 工作台 / 文件 / 分享 / 会话 / 消息中心 / 审计 / 权限地图）
│   ├── services/      # 接口请求封装（按后端领域划分：auth / file / transfer / chat / notify / permission）
│   └── app.tsx        # 应用入口（运行时配置）
├── mock/              # 本地 mock（dev 已关闭，按需开启）
├── public/            # 静态资源（含 loading 脚本）
└── package.json
```

## 🔗 与后端模块的映射

| 页面（src/pages） | 后端模块 | 实际前缀 |
| --- | --- | --- |
| 登录 / 个人中心 / 消息中心 | `at-auth` · `at-collaboration` | `/api/v1/auth/**`、`/api/v1/users/me/**`、`/api/v1/notifications/**` |
| 工作台 | `at-transfer` · `at-permission` | `/api/v1/transfers/statistics`、`/api/v1/todos/**` |
| 传输任务 | `at-transfer` | `/api/v1/transfers/**` |
| 文件 / 分享管理 | `at-file` | `/api/v1/files/**`、`/api/v1/folders/**`、`/api/v1/shares/**` |
| 会话（轻 IM，含 `@` 提及） | `at-collaboration` | `/api/v1/chat/**` + `/api/ws/notify`（下行帧） |
| 权限 / 角色 / 审批 / 审计 / 权限地图 | `at-permission` | `/api/v1/permission/**`、`/api/v1/roles/**`、`/api/v1/system/users/**`、`/api/v1/audit/**` |

> 📌 上表前缀是 `server.servlet.context-path: /api` + 控制器 `/v1/...` 的**拼接结果**，与本地代理一一对应（见上文「代理链路」）。
> 业务页面已按领域落地，服务层统一在 `src/services/<领域>/`；模板示例 `src/services/ant-design-pro/**` 已于 2026-10-01 删除。

## 📄 来源与许可

本工程由官方 [ant-design/ant-design-pro](https://github.com/ant-design/ant-design-pro) v6.0.3 模板初始化。
`LICENSE`（MIT）为本目录模板代码的授权声明；仓库整体许可见根目录 `LICENSE`（Apache-2.0）。
