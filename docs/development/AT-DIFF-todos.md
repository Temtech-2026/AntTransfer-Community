# ⚠️ AT-DIFF 待裁决清单（整体完工后逐条关闭）

> 来源：外部计划书与仓库已冻结契约（docs/api/README.md、docs/api/error-codes.md、system-design）
> 之间的实现差异。每项差异的**详细描述与解决方案建议已嵌在代码原位**（下述「代码位置」），
> 本文档仅为索引页，便于评审时快速定位。
> 关闭原则：整体完工前逐条裁决并勾选，完成后删除对应代码内 TODO 块并更新本文档。

## 🔍 快速定位 / 审计

代码内标记统一使用 `TODO[AT-DIFF-xx]` 前缀，可被 IDE 与命令行一键聚合：

```bash
# 审计：代码内【开放】标记（当前 4 处：01/02/03/05；已办结项 04 不含 TODO 前缀）
grep -rn "TODO\[AT-DIFF-" server/

# 按 ID 精确回查某一条的完整描述与方案
grep -rn -A 20 "TODO\[AT-DIFF-03\]" server/

# 发布前红线：确认已清零（输出为空即为关闭）
grep -rn "TODO\[AT-DIFF-" server/ || echo "AT-DIFF 已全部关闭"
```

IDE 提示（任选其一）：
- IntelliJ IDEA / VS Code 内置 TODO 面板默认即收录，输入过滤器 `AT-DIFF` 或
  `AT-DIFF-0[1-5]` 即可只看这五条；
- 也可在代码中右键 → Find Usages 定位到本文档锚点。

> 发布门禁建议：进入版本收尾前，将「TODO[AT-DIFF- 为 0」纳入 checklist
> （对应 docs/deployment/README.md 上线清单），防止带未裁决口径发版。

## 索引

| ID | 主题 | 代码位置 | 状态 |
| --- | --- | --- | --- |
| [AT-DIFF-01](#at-diff-01-accessdenied--1003-vs-1004) | AccessDenied 错误码映射：外部计划 1003/403 vs 契约 1004/403 | `server/at-gateway/.../exception/GlobalExceptionHandler.java` | ⏳ 待裁决 |
| [AT-DIFF-02](#at-diff-02-filter-内加载权限-vs-惰性解析) | 认证过滤器是否加载权限集合（Filter 内 vs @RequiresPerm 惰性） | `server/at-auth/.../security/JwtAuthenticationFilter.java` | ⏳ 待裁决 |
| [AT-DIFF-03](#at-diff-03-部门数据范围-mybatis-拦截器) | 部门数据范围：MyBatis 拦截器注入 vs AccessControlService 行级守卫 | `server/at-permission/.../service/AccessControlService.java` | ⏳ 待裁决 |
| ~~AT-DIFF-04~~ | ~~HTTP 层集成测试缺失~~ → **已落地** | `server/at-bootstrap/src/test/java/com/anttransfer/it/AuthFlowIntegrationTest.java` | ✅ 2026-09-07 |
| [AT-DIFF-05](#at-diff-05-认证接口命名) | 认证端点命名：`/auth/login` vs `POST /api/v1/auth/token` | `server/at-auth/.../controller/AuthController.java` | ⏳ 待裁决 |

---

## AT-DIFF-01：AccessDenied → 1003 vs 1004

- **差异**：外部计划书要求 `AccessDeniedException → 1003/403`；本仓库已冻结契约
  `docs/api/error-codes.md` 定义 `1003 = TOKEN_INVALID 且 HTTP 401`（前端策略 C 会跳登录），
  权限不足应为 `1004 NO_AUTH / 403`（策略 D，提示但不引导登录）。
- **现状**：拒绝类统一映射 **1004/403**——`GlobalExceptionHandler`、at-auth
  `RestAccessDeniedHandler`、at-permission `@RequiresPerm` 切面、前端 `utils/result.ts` 四方一致。
- **方案**：
  - **A（推荐）**：维持 1004，语义正确、改动为零；
  - **B**：对齐外部计划改 1003 → 需同步 `ErrorCode`、error-codes.md、at-auth 两个 handler、
    前端 `STRATEGY_BY_CODE`（1003 需从 C 迁到 D），易踩 401/403 语义混淆。

## AT-DIFF-02：Filter 内加载权限 vs 惰性解析

- **差异**：外部计划要求 `JwtAuthenticationFilter` 验签后即加载权限集合（多角色并集 + Deny 优先）
  写入 SecurityContext；现实现为**惰性解析**——`@RequiresPerm` 切面触发
  `PermissionService` → `at:perm:{userId}` Redis 缓存（30min，miss 回源 DB，变更 invalidate）。
  原因：模块铁律（at-auth 不能依赖 at-permission），且权限不进 JWT 保证角色变更即时生效（US-04）。
- **方案**：
  - **A（推荐）**：维持惰性解析；
  - **B**：at-common 定义 `PermissionAuthorityProvider` SPI（at-permission 实现、at-auth 注入），
    Filter 在写 SecurityContext 前拉取一次角色/权限，需新增 SPI + 缓存失效联动。

## AT-DIFF-03：部门数据范围 MyBatis 拦截器

- **差异**：外部计划要求「部门管理员只能查本部门」由 MyBatis 拦截器自动注入范围条件；
  现实现为 `AccessControlService` **行级守卫**（本人 / 全部 / 本部门及以下
  `sys_dept.ancestors` 子树判定），列表查询仍需业务层显式带范围。
- **方案（代码内已给设计）**：`@DataScope(tableAlias)` 注解 + MyBatis `InnerInterceptor`
  在列表/分页查询时按 `dataScope` 追加条件（`f.dept_id=?` / `ancestors LIKE` 子树 /
  `f.create_by=当前用户`）；限定受控场景防漏 join/UNION 别名；点查仍走行级守卫，两者并存。

## AT-DIFF-04：HTTP 层 JUnit5 集成测试 —— ✅ 已完成（2026-09-07）

- **落地**：`server/at-bootstrap/src/test/java/com/anttransfer/it/AuthFlowIntegrationTest.java`
  （`@SpringBootTest(RANDOM_PORT)` + TestRestTemplate + **Testcontainers** 自动拉起 MySQL 8.4 与
  Redis 7，`disabledWithoutDocker=true` 无 Docker 时跳过），8 例全绿：
  登录双 token(0) / 无 token 401(1001) / SUPER_ADMIN 200 / AUDITOR 无权限 403(1004) /
  AUDITOR 写接口 403(1004) / 登出后旧 token 401(1001) / refresh 复用打击 401(1003) /
  错误密码 401(1007)。
- **运行**：`./mvnw -pl server/at-bootstrap -am -Dtest=AuthFlowIntegrationTest test`
  （需 Docker；镜像源异常时加 `-D... ` 或环境变量 `TESTCONTAINERS_RYUK_DISABLED=true` 跳过 ryuk）。
- 测试账号（AUDITOR）仅在容器化实例内临时插入，随容器销毁，不污染迁移数据。

## AT-DIFF-05：认证接口命名

- **差异**：外部计划 `/auth/login`、`/auth/refresh`；仓库契约
  `POST /api/v1/auth/token`（登录）、`POST /api/v1/auth/token/refresh`（刷新）。
- **现状**：按仓库契约实现（前端 `requestErrorConfig`、Security 白名单、error-codes 均对齐）。
- **方案**：
  - **A（推荐）**：维持 `/v1/auth/token*`；
  - **B**：改 `/auth/login` 命名属破坏性路径变更（API 契约 §9），需同步白名单、
    api README、前端 `REFRESH_URL` 或加兼容映射。
