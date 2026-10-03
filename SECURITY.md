# 🔒 安全策略（Security Policy）

AntTransfer Community 重视安全问题，感谢你负责任地披露漏洞 🙏。
*We appreciate responsible disclosure — English key points are at the end of this document.*

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

报告时建议包含（缺项不影响受理，但会拖慢评估）：

- 受影响的版本 / 提交（如 `master@1a2b3c4d`）与部署方式（compose / 手动部署）；
- 漏洞类型与影响面：能否未登录触发、是否需要管理员权限、影响哪些数据；
- 最小可复现步骤或 PoC（请附**脱敏后**的请求 / 日志）；
- 若有临时缓解措施（配置关闭、权限收紧、网关拦截），也请一并说明。

## ⏱️ 我们如何处理

1. ⏱️ **48 小时内确认收悉并评估影响范围**——这是本项目**唯一**的时限口径；
2. 🧭 依严重程度与可行性拟定修复方案，**修复时间表与报告人协商确定**。本项目**不承诺固定的修复时限**（不存在「高危 72 小时内修复」这类 SLA 承诺），请不要以固定天数作为对外披露或发布的前提条件；
3. 🔄 在私密渠道与报告人同步进展；必要时先给出缓解措施（配置项 / 临时补丁），再发正式修复版本；
4. 🎉 修复并发布后，在 CHANGELOG / Security Advisory 中致谢（如报告者愿意署名）。

**关于公开披露**：请在修复版本发布、或双方协商一致后再公开细节，避免在修复窗口内被利用。

## 🧭 哪些属于安全问题（举例）

- 认证与令牌：绕过登录、令牌泄漏 / 重放、刷新链路越权；
- 越权：水平 / 垂直越权，外发链接绕过提取码、有效期或次数限制；
- 注入与文件：SQL / 命令注入，路径穿越与任意文件读写，压缩包解析（zip slip）；
- SSRF、存储型 XSS、敏感信息泄漏（密钥入库、日志打印口令）；
- 高危依赖漏洞（CVSS ≥ 7）与容器 / 编排配置缺陷（如以 root 运行、端口误暴露到公网）。

> 一般性缺陷（界面错乱、功能不可用、性能问题）请走普通 Issue，不必走私密渠道。

## 🛠️ 安全开发约定

- 🔑 生产部署密码等敏感信息一律通过环境变量注入，禁止硬编码与提交密钥文件（见 `.gitignore`）；
- 🚫 生产 profile 默认关闭 Swagger / OpenAPI 文档暴露；
- 👤 容器以非 root（uid/gid 10001）运行，数据目录属主与之对齐（见根 `Dockerfile` 注释）；
- 🔄 依赖升级跟随 Spring Boot 官方安全公告，关键漏洞即时跟进；CI 侧已接入 Dependency-Check（CVSS ≥ 7 失败）、`npm audit`（生产依赖 high 失败）与 gitleaks（历史密钥），见 `docs/security/ci安全扫描.md`。

## 🌐 English Key Points

- **Report privately** via GitHub Security Advisory (repo → `Security` → `Report a vulnerability`) or email `temtech2026@163.com`. Do **not** open a public issue or PR for a vulnerability.
- **We acknowledge receipt and assess impact within 48 hours.** The remediation timeline is agreed with the reporter — **no fixed remediation deadline is promised** (e.g. there is no "critical within 72 hours" SLA).
- Please include the affected version/commit, impact, minimal reproduction (sanitized), and any known mitigation.
- Coordinate public disclosure with the maintainers: after a fix is released, or by mutual agreement.
- Supported: `master`. Secrets must be supplied via environment variables; Swagger/OpenAPI stays disabled in production.
