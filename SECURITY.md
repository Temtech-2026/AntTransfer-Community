# 🔒 安全策略（Security Policy）

AntTransfer Community 重视安全问题，感谢你负责任地披露漏洞 🙏。

## ✅ 受支持的版本

| 版本 | 支持状态 |
| --- | --- |
| master 分支（开发中） | ✅ 持续修复 |
| 1.0.x（尚未正式发布） | ⚠️ 发布后支持 |

> 📌 正式发布策略将在首个稳定版本（1.0.0）问世后补充。

## 📮 报告漏洞

> 🚫 **请不要**在公开渠道（Issue、讨论区、PR）中暴露安全漏洞细节。

推荐途径（二选一）：

1. **GitHub Security Advisory（推荐）**：仓库 → `Security` → `Report a vulnerability`，按模板填写，可附复现步骤与受影响版本；
2. **邮件联系维护者**：`temtech2026@163.com`。

收到报告后我们会：

1. ⏱️ 48 小时内确认收悉并评估影响范围；
2. 🤝 与报告者协作确认修复方案与时间表；
3. 🎉 修复并发布后，在 CHANGELOG / Security Advisory 中致谢（如报告者愿意署名）。

## 🛠️ 安全开发约定

- 🔑 生产部署密码等敏感信息一律通过环境变量注入，禁止硬编码与提交密钥文件（见 `.gitignore`）；
- 🚫 生产 profile 默认关闭 Swagger / OpenAPI 文档暴露；
- 🔄 依赖升级跟随 Spring Boot 官方安全公告，关键漏洞即时跟进。
