<!-- markdownlint-disable MD041 -->
<!--
  提交前请先读 CONTRIBUTING.md（分支命名 / 提交信息 / 自测命令 / Review 口径）。
  不适用的条目请删除，不要留空占位；Reviewer 会按本清单逐条核对。
  ⚠️ 本模板仅在 GitHub 自动套用；Gitee 主仓库请按同样结构手工填写。
-->

## 📋 变更说明 / Summary

<!-- 讲清「为什么改」与「改了什么」，不要复述 diff。 -->

- 动机 / 背景：
- 主要改动：
- 涉及模块：<!-- 如 at-file / at-auth / web / sql / deploy / docs -->
- 变更类型：<!-- feat / fix / docs / refactor / test / chore，与提交信息一致 -->

## 🔗 关联 Issue / Related Issues

<!-- 用 Closes #123 让合并后自动关闭；无关联 Issue 请写明背景。 -->

Closes #

## 🧪 自测清单 / Self-check

<!-- 覆盖率判定当前为「只打印不阻断」（pom.xml 中 haltOnFailure=false），门槛未达标不会让 CI 变红 -->

- [ ] 后端 `./mvnw -B -ntp verify` 通过（测试 + Spotless 许可证头 + JaCoCo 报告/判定）
- [ ] 后端 新增/修改的 Java 文件已带 Apache-2.0 文件头（`./mvnw spotless:apply` 可自动补）
- [ ] 后端 如涉及启动链路，已本地实跑（`make run` 或 `docker compose up -d --build`）验证
- [ ] 前端 `cd web && npm run lint` 通过（Biome lint + `tsc --noEmit`）
- [ ] 前端 `npm test` 通过；新增行为已附 Vitest 用例
- [ ] 前端 `npm run build` 通过；UI 变更已附截图或录屏
- [ ] 数据库 只新增 `sql/V{n}__xxx.sql`，未改写已发布脚本，且在空库上验证过迁移
- [ ] 安全 无密钥入库（gitleaks）；依赖升级已评估公告 / CVE（dependency-check / `npm audit --omit=dev`）
- [ ] 架构 未破坏「架构铁律」（业务/接入层 → `at-common`；`at-common` 不反向依赖）

## 📚 文档更新确认 / Docs

- [ ] 已按需同步下列文档（不适用请勾选后在括号内注明原因）
  - [ ] `docs/`：架构 / API / 开发 / 部署（按影响面选择）
  - [ ] `CHANGELOG.md`：用户可见变更已在 `[Unreleased]` 下按 Keep a Changelog 体例补条目
  - [ ] `.env.example` 与部署文档：新增或改名的环境变量已同步
- [ ] 本 PR 无需更新文档（原因：）

## ⚠️ 破坏性变更 / Breaking Changes

<!-- 无则写「无」。有则说明：影响谁、如何迁移、是否需要 CHANGELOG 的 Changed/Removed 段。 -->

无

## ✅ Review 期望 / Review

<!--
  一般改动至少 1 人 Approve；核心模块（at-common / at-auth / at-permission / at-file /
  sql/ / Dockerfile 与 docker-compose*.yml / .github/workflows/）需 2 人，见 CONTRIBUTING.md。
  CI 未通过时请勿请求 Review。
-->
