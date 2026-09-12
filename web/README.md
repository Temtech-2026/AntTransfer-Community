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

### ⚠️ 待联调：`/api` 开发代理链路（未验证，联调时处理）

开发态所有 `/api/**` 请求都依赖 dev server 代理，该链路**尚未在前后端齐备的环境下实测**，先挂账留待联调处理。

配置侧已核对一致，**不是配置缺陷**：

| 环节 | 位置 | 事实 |
| --- | --- | --- |
| 代理取值 | `config/config.ts:84` | `proxy[UMI_ENV]`；`npm run dev`（`cross-env UMI_ENV=dev MOCK=none`）→ `proxy.dev` |
| 代理目标 | `config/proxy.ts:14-20` | `/api/` → `http://localhost:8080`，**刻意不配 `pathRewrite`** |
| 路径拼接 | `at-bootstrap/application.yml:17` | `server.servlet.context-path: /api` + 控制器 `/v1/...` = `/api/v1/...` |
| 前端请求 | `src/requestErrorConfig.ts:37` | `REFRESH_URL = '/api/v1/auth/token/refresh'`，已带 `/api` 前缀 |

即 `/api/v1/...` 转发后恰好落在后端 `/api` context-path 下，**前缀不可再加也不可删**。

联调时需注意两点：

1. `npm run dev` 带 **`MOCK=none`**，mock 已关闭；后端不在 8080 时 `/api` 必然失败——需先 `make dev-up`（MySQL/Redis）再 `make run`（后端 8080）。
2. 代理**只对 dev server 生效**：`npm run preview` / `build` 产物不走 `proxy.ts`，此时 `src/app.tsx:193` 的 `baseURL` 会切到官方 demo 域名，属预期行为，勿误判为代理故障。

**待办**：联调时实测 `POST /api/v1/auth/token` 返回 200 即关闭本项；若失败，按 CORS（`anttransfer.cors.allowed-origin-patterns`）→ 路径拼接 → 后端白名单顺序排查。

## ⚙️ 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 本地开发（`UMI_ENV=dev`，关闭 mock） |
| `npm run build` | 生产构建，产物输出 `dist/` |
| `npm run preview` | 预览构建产物（默认 8000 端口） |
| `npm run lint` | Biome 代码检查 + TypeScript 类型检查 |
| `npm run tsc` | TypeScript 类型检查 |
| `npm run test` | Vitest 单元测试 |
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
│   ├── components/    # 全局公共组件
│   ├── pages/         # 页面（当前为官方模板示例，按领域逐步替换）
│   ├── services/      # 接口请求封装（建议按后端 at-* 领域划分）
│   └── app.tsx        # 应用入口（运行时配置）
├── mock/              # 本地 mock（dev 已关闭，按需开启）
├── public/            # 静态资源（含 loading 脚本）
└── package.json
```

## 🔗 与后端模块的映射

| 页面规划（src/pages） | 后端模块 | 说明 |
| --- | --- | --- |
| 登录 / 账号 | `at-auth` | `/api/auth/**` |
| 传输任务 | `at-transfer` | `/api/transfer/**` |
| 权限 / 角色 | `at-permission` | `/api/permission/**` |
| 文件 | `at-file` | `/api/file/**` |
| 协作空间 | `at-collaboration` | `/api/collaboration/**` |

> 📌 当前页面为 Ant Design Pro 官方示例，业务页面将随后端接口落地逐步替换。

## 📄 来源与许可

本工程由官方 [ant-design/ant-design-pro](https://github.com/ant-design/ant-design-pro) v6.0.3 模板初始化。
`LICENSE`（MIT）为本目录模板代码的授权声明；仓库整体许可见根目录 `LICENSE`（Apache-2.0）。
