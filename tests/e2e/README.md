# 🧪 E2E 测试（规划中）

本目录用于存放端到端测试，覆盖「用户可见」的关键链路：

- 👤 账号：注册 → 登录 → 退出
- 📤 传输：创建任务 → 上传 → 进度 → 完成
- 🤝 协作：创建空间 → 邀请 → 分享链接访问

## 🔧 计划选型

- 🎭 工具：[Playwright](https://playwright.dev/)（Web E2E）
- 🗂️ 结构：`tests/e2e/specs/`（按领域组织场景）+ `tests/e2e/fixtures/`（数据/登录态）

## ⏰ 何时接入

在 `web/` 前端首个可运行页面与后端核心接口稳定后启用。

> 📌 当前为空目录（`..gitkeep` 占位），相关讨论见 [docs/development](../../docs/development/README.md) 测试策略。
