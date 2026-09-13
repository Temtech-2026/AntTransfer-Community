# ⚠️ AT-DIFF 待裁决清单（整体完工后逐条关闭）

> 来源：外部计划书与仓库已冻结契约（docs/api/README.md、docs/api/error-codes.md、system-design）
> 之间的实现差异。每项差异的**详细描述与解决方案建议已嵌在代码原位**（下述「代码位置」），
> 本文档仅为索引页，便于评审时快速定位。
> 关闭原则：整体完工前逐条裁决并勾选，完成后删除对应代码内 TODO 块并更新本文档。

## 🔍 快速定位 / 审计

代码内标记统一使用 `TODO[AT-DIFF-xx]` 前缀，可被 IDE 与命令行一键聚合：

```bash
# 审计：代码内【开放】标记（当前 3 处：02/03/05；已办结项 01/04 不含 TODO 前缀）
grep -rn "TODO\[AT-DIFF-" server/

# 按 ID 精确回查某一条的完整描述与方案
grep -rn -A 20 "TODO\[AT-DIFF-03\]" server/

# 发布前红线：确认已清零（输出为空即为关闭）
grep -rn "TODO\[AT-DIFF-" server/ || echo "AT-DIFF 已全部关闭"
```

IDE 提示（任选其一）：
- IntelliJ IDEA / VS Code 内置 TODO 面板默认即收录，输入过滤器 `AT-DIFF` 或
  `AT-DIFF-0[1-9]` 即可只看这九条；
- 也可在代码中右键 → Find Usages 定位到本文档锚点。

> 说明：AT-DIFF-06 / 07 / 08 / 09 为**外发分享主线落地时新识别的口径差异**，AT-DIFF-10 为
> **审计主线落地时新识别的口径差异**，均属「已实现且未阻塞」的登记项（代码内无 `TODO` 标记，
> 仅本文档登记），故上表 grep 计数仍为 3 处（02/03/05）。

> 另：2026-09-14 复核 `docs/prd/README.md` §4.1 后端现状时新识别 **8 项实现缺口**（**非口径差异**，
> 属「§4 要求的动作代码里还没有」），登记在文末「🧱 后端功能缺口登记（GAP-01 ~ GAP-08）」，
> 同样不落 `TODO` 标记、同样按「整体完工后关闭」处理；其中 3 项（共享空间 / 审批端点 / 分片上传）
> 已由 **D-5 / D-11** 覆盖，未重复登记。

> 发布门禁建议：进入版本收尾前，将「TODO[AT-DIFF- 为 0」纳入 checklist
> （对应 docs/deployment/README.md 上线清单），防止带未裁决口径发版。

## 索引

| ID | 主题 | 代码位置 | 状态 |
| --- | --- | --- | --- |
| [AT-DIFF-01](#at-diff-01-accessdenied--1003-vs-1004) | AccessDenied 错误码映射：外部计划 1003/403 vs 契约 1004/403 | `server/at-gateway/.../exception/GlobalExceptionHandler.java` | ✅ 2026-09-13 |
| [AT-DIFF-02](#at-diff-02-filter-内加载权限-vs-惰性解析) | 认证过滤器是否加载权限集合（Filter 内 vs @RequiresPerm 惰性） | `server/at-auth/.../security/JwtAuthenticationFilter.java` | ⏳ 待裁决 |
| [AT-DIFF-03](#at-diff-03-部门数据范围-mybatis-拦截器) | 部门数据范围：MyBatis 拦截器注入 vs AccessControlService 行级守卫 | `server/at-permission/.../service/AccessControlService.java` | ⏳ 待裁决 |
| ~~AT-DIFF-04~~ | ~~HTTP 层集成测试缺失~~ → **已落地** | `server/at-bootstrap/src/test/java/com/anttransfer/it/AuthFlowIntegrationTest.java` | ✅ 2026-09-07 |
| [AT-DIFF-05](#at-diff-05-认证接口命名) | 认证端点命名：`/auth/login` vs `POST /api/v1/auth/token` | `server/at-auth/.../controller/AuthController.java` | ⏳ 待裁决 |
| [AT-DIFF-06](#at-diff-06-外发分享模块归属) | 外发分享模块归属：规划 `at-collaboration` vs 实际 `at-file` | `server/at-file/.../controller/ShareController.java`、`ShareAccessController.java` | 📝 已登记（未阻塞） |
| [AT-DIFF-07](#at-diff-07-一次性票据-redis-键新增) | 新增 Redis 键 `at:share:ticket:`（一次性票据，GETDEL） | `server/at-common/.../constant/RedisKeyConstants.java`、`server/at-file/.../service/ShareTicketService.java` | 📝 已登记（已同步 §7.1） |
| [AT-DIFF-08](#at-diff-08-4004-语义扩展票据失效) | `4004` 语义扩展：是否承载「一次性票据失效」 | `server/at-file/.../service/ShareAccessService.java`、`docs/api/error-codes.md` | 📝 已登记（未阻塞） |
| [AT-DIFF-09](#at-diff-09-contentscaninterceptor-落点) | `ContentScanInterceptor` 落点：`at-common` SPI vs CE 暂落 `at-file` | `server/at-file/.../extension/ContentScanInterceptor.java` | 📝 已登记（未阻塞） |
| [AT-DIFF-10](#at-diff-10-审计写入器同构三份) | 审计写入器同构三份：抽公共实现 vs 保持三份（实体 / Mapper 已共享） | `server/at-permission/.../service/PermissionAuditLogger.java`、`server/at-file/.../service/FileAuditLogger.java` | 📝 已登记（未阻塞） |

---

## AT-DIFF-01：AccessDenied → 1003 vs 1004 —— ✅ 已裁决（2026-09-13）

- **差异**：外部计划书要求 `AccessDeniedException → 1003/403`；原冻结契约
  `docs/api/error-codes.md` 定义 `1003 = TOKEN_INVALID 且 HTTP 401`（前端策略 C 会跳登录），
  权限不足原为 `1004 NO_AUTH / 403`（策略 D，提示但不引导登录）。
- **裁决**：采纳外部计划书口径 —— **权限不足统一 `NO_AUTH = 1003 / 403`（策略 D）**；
  原 `1003 TOKEN_INVALID(401)` 后移至 **1006**。1xxx 段最终排序：
  `1001 未登录 / 1002 Token 过期 / 1003 无权限 / 1004 账号锁定 / 1005 账号禁用 / 1006 Token 无效 / 1007 账号或密码错误`。
- **落地**：已同步 `ErrorCode` 枚举、`docs/api/error-codes.md`（附录 B 增补迁移表）、at-auth
  `RestAuthenticationEntryPoint` / `RestAccessDeniedHandler`、at-permission `@RequiresPerm` 注解与切面、
  at-gateway `GlobalExceptionHandler`、前端 `web/src/utils/result.ts` 策略表及双向单测；
  代码内 `TODO[AT-DIFF-01]` 已移除。
- **破坏性**：是。1xxx 编号调整属破坏性契约变更，已在 `CHANGELOG.md` 与 `error-codes.md`
  附录 B「第二次调整」声明，旧编号不得再对外使用。

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
  登录双 token(0) / 无 token 401(1001) / SUPER_ADMIN 200 / AUDITOR 无权限 403(1003) /
  AUDITOR 写接口 403(1003) / 登出后旧 token 401(1001) / refresh 复用打击 401(1006) /
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

---

> 以下 **AT-DIFF-06 / 07 / 08** 为 2026-09-13 落地「外发分享主线」时新识别的口径差异。
> 三者均**已按推荐方案实现且不阻塞**，代码内**不留 `TODO` 标记**（仅本文档登记），
> 待范围评审（D-6）或 at-collaboration 落地时一并关闭。

## AT-DIFF-06：外发分享模块归属

- **差异**：`system-design` §4.1 表族地图（`sys_share_link` → at-collaboration）与 §5.3 标题
  均把外发分享归 **at-collaboration**；`docs/api/README.md` §1 前缀表亦把 `/api/v1/shares`
  列在 at-collaboration 名下。本次按需求把整条主线落 **at-file**。
- **现状**：`ShareController` / `ShareAccessController` / `ShareLinkService` / `ShareAccessService` /
  `ShareTicketService` / `ContentScanChain` 全部位于 `server/at-file/**`。
  **理由（技术性）**：分享的每次判定都强依赖「文件是否存在 / 是否可读」与 `sys_file` 元数据，
  落在 at-file 可让「行级归属校验（`owner_user_id`）+ 文件可读性 + 内容扫描 + 审计」在同一模块内闭环；
  反之若落 at-collaboration，则需 at-collaboration → at-file 的**反向依赖**，直接违反模块依赖铁律
  （§1.2：业务模块互不依赖，只能经 SPI 依赖倒置）。
- **方案**：
  - **A（推荐，已实施）**：承认 CE 阶段外发分享属「文件外发」能力，随 at-file 落；
    `system-design` §5.3 标题与 §8 实现清单、`api/README.md` §1 前缀表均已回写并标注本条差异；
  - **B（EE / 后续）**：待 at-collaboration 的空间与成员模型（`sys_space` / `sys_group_member`）落地后，
    若产品上要求「分享挂在空间维度」，可把**编排层**上移——在 at-common 新增
    `FileLookupPort` SPI（at-file 实现），at-collaboration 据此反查文件，届时 §4.1 表族地图
    归属列回填为 at-collaboration。
- **影响面**：无正确性风险；仅文档归属口径与 `sys_share_link` 的「控制模块」标注待后续对齐。

## AT-DIFF-07：一次性票据 Redis 键新增

- **差异**：`system-design` §7.1 原 Key 规划表仅含 `at:share:count:{token}` 与 `at:share:lock:{token}`；
  CE 实现新增 **`at:share:ticket:{ticket}`**（String = 票据载荷 JSON，TTL 5 min，**`GETDEL` 取用即焚**），
  且**票据不落库**——与 §5.3 原描述的「下载校验后直接发流」相比，CE 采用**两步式取件**
  （`verify` 换票 → `redeem` 核销）。
- **理由**：把「校验提取码」与「消耗下载额度」解耦，避免「换了票但没取件」白吃一次额度；
  同时票据是纯短时可丢弃凭证，落库会增加写放大与清理负担。
- **已同步**：`system-design` §7.1 已补录该键行、「语义红线」注已把票据列为 Redis 单写键
  （丢失即失效需重换，**不破坏数据正确性**——配额仍以 DB 为准）；`RedisKeyConstants` 提供
  `SHARE_TICKET_PREFIX` / `SHARE_TICKET_TTL_SECONDS` / `shareTicketKey(ticket)` 工厂方法。
- **方案**：
  - **A（推荐，已实施）**：承认该键落定；TTL 取「校验 → 取件」间隔的最小可用值（默认 5 min）；
  - **B**：若合规要求「取件凭证可追溯」，需新建 `sys_share_ticket` 表——**不推荐**：
    一次性凭证留痕收益低，且与「取用即焚」的防重放设计直接冲突（可追溯需保留已用票据）。

## AT-DIFF-08：`4004` 语义扩展（票据失效）

- **差异**：`docs/api/error-codes.md` 定义 `4004 SHARE_EXPIRED_OR_LIMIT`（HTTP 410，策略 F）
  仅覆盖「链接超期 / 下载次数耗尽」；实现中「**一次性票据不存在 / 已被取用 / 已过期**」
  也复用 `4004` 返回。
- **理由**：票据失效与链接失效对访客是**同一处置**（重新换票或放弃），错误码分策略需保持一致；
  新增 `4013 TICKET_INVALID` 只会让前端多一个分支，却不带来任何差异化 UI 行为。
  （伪造 / 串用票据另按 `4005 FILE_NOT_FOUND` 等既有判据拦截，不靠本码区分。）
- **方案**：
  - **A（推荐，已实施）**：保持复用 4004，并在 `error-codes.md` 4004 行「触发场景」补注
    「或一次性取件票据失效（重复使用 / 过期 / 伪造）」；前端仍按 F 类（410）处置；
  - **B**：新增 `4013 TICKET_INVALID`——**不推荐**（无处置差异，纯增加前端分支与契约面）。

## AT-DIFF-09：`ContentScanInterceptor` 落点

- **差异**：`architecture.md` §2.1 CE/EE 扩展点表把 `ContentScanInterceptor` 的**接口位置**定为
  **`at-common` SPI**（并预留 CE 实现名 `NoopContentScanInterceptor`）；CE 实现把它落在
  **`at-file` 模块内**（`server/at-file/.../extension/ContentScanInterceptor.java`），
  CE 默认实现为 **`SuffixAndKeywordScanInterceptor`**（后缀黑名单 + 文件名敏感词），而非 Noop PASS。
- **理由**：① 该接口当前**只有一个消费方**（外发分享的内容扫描），未构成跨模块契约，
  过早放 `at-common` 会形成「无消费方的 SPI」；② CE 需要**真实生效**的默认实现——
  若按原表给 Noop PASS，则「后缀黑名单」需求（默认阻断 exe/sh/bat/msi/com/scr）落不了地；
  ③ 职责上它本就是 at-file 的「写入前拦截」策略，与文件域内聚。
- **方案**：
  - **A（推荐，已实施）**：CE 阶段保持 at-file 内扩展点（`ContentScanChain` 责任链 + Deny 优先 +
    **fail-closed**：扫描器抛异常按拦截处理）；EE 若需 DLP，可直接提供 `ContentScanInterceptor`
    的 Spring Bean 加入链，无需改业务代码；
    `architecture.md` §2.1 已就地标注「CE 暂落 at-file」与本条链接；
  - **B（EE / 跨模块时）**：当扫描被**多个模块**消费（如上传、协作空间、分享同时需要）时，
    再把接口上移到 `at-common` SPI 并保留 at-file 的 CE 实现，届时同步 §2.1 与 §2.4 映射表。
- **影响面**：无正确性风险；仅「SPI 归属位置」与「CE 实现命名」两处文档口径待后续对齐。

## AT-DIFF-10：审计写入器同构三份（`PermissionAuditLogger` ↔ `FileAuditLogger` / `ShareAuditLogger`）

- **差异**：审计需求要求 FILE / SHARE / PERMISSION 三域都写 `sys_operation_log`。落地时
  **实体与 Mapper 已下沉 `at-common`**（`com.anttransfer.common.audit`），但**写入器仍是三份同构代码**
  （at-file 的 `FileAuditLogger` / `ShareAuditLogger`、at-permission 的 `PermissionAuditLogger`）。
- **理由**：写入器需要 `HttpServletRequest`（取 UA / 真实 IP）、Jackson（序列化 detail）、
  `PlatformTransactionManager`（失败走 `REQUIRES_NEW`）三项 web / 事务能力；而 `at-common` 的依赖面
  被刻意压到「mybatis-plus 注解 + slf4j + lombok」（见 `server/at-common/pom.xml` 注释），
  无法承载；抽到任一业务模块又违反「at-permission 仅依赖 at-common」的模块铁律。
  故**共享的是实体与 Mapper，而非写入器**——三份同构属有意为之的取舍，不是遗漏。
- **方案**：
  - **A（推荐，已实施）**：保持三份同构写入器；`OperationLog` 的动作 / 域 / 对象 / 结果常量集中一处，
    保证三份写入器写出的 `module` / `action` / `target_type` / `result` 取值一致
    （否则同一动作在三处写出不同编码，审计检索按 `action` 精确过滤会漏记录）；
    新增审计域时按同构模板复制，并在本表登记；
  - **B（EE 或写入器数量 ≥ 4 时）**：把写入器上移到一个**新增的轻量模块**（如 `at-audit`，
    仅依赖 at-common + spring-web + Jackson），或在 at-common 引入 `spring-web`（可选依赖 + `@ConditionalOnClass`）
    后承载共享写入器；届时同步本文档与 `docs/architecture/system-design.md` 表族地图。
- **影响面**：无正确性风险；仅「写入器代码重复度」一处内部实现口径待后续收敛。

---

## 🧱 后端功能缺口登记（GAP-01 ~ GAP-08）

> **来源**：2026-09-14 以 `server/` 实际代码为准复核 `docs/prd/README.md` §4.1「实现现状核查」时，
> 在**已落地部分中发现的缺口**。与 AT-DIFF 的区别：AT-DIFF 记的是「外部计划书 vs 已冻结契约的口径差异（待裁决）」，
> 本节记的是「§4 要求的动作，代码里还没有」——**不是口径分歧，而是实现缺口**。故本组**不落
> `TODO[AT-DIFF-]` 标记**（位置无唯一锚点，也不属「写法待裁决」），只在本文档登记；
> 文档头部 grep 计数仍为 3 处（02 / 03 / 05）。
>
> **已由现有条目覆盖、本节不重复登记的缺口**（仅交叉引用）：
> - **共享空间 P0 未落地**（`sys_space` 仅骨架实体、无 Controller / Service / 成员角色端点）→ 见 **D-11**
>   （两表结构已落地，待 at-collaboration 四层接管读写）；
> - **审批动作 / 撤销 / 待办 / 我的申请 / 审批规则配置等端点缺失** → 见 **D-5**（进入 Phase 4 前的硬前置）；
> - **分片上传 / 断点续传未落地**（`at-transfer` 未建、无 precheck / parts / merge）→ 见 §4.1 表（⬜）与 **D-5**。
>
> **关闭时机**：与 AT-DIFF 一致——上传 / 审批 / 分享三条主线跑通后的加固期逐条改进。
> 其中 **GAP-01 建议提前**（默认 1 MB 会直接挡掉大文件上传验收），**GAP-02 / GAP-03 同批**（账号生命周期动作）。

| ID | 缺口 | 级别 | 代码现状锚点 |
| --- | --- | --- | --- |
| [GAP-01](#gap-01上传大小上限未配置) | 上传上限未配置，沿用 Spring 默认单文件 1 MB | P0 配置缺口（**建议提前**） | `server/at-bootstrap/src/main/resources/application.yml` |
| [GAP-02](#gap-02账号停用未联动吊销会话) | 停用账号未吊销在途会话，不满足「2 分钟内失效」 | P0 验收缺口 | `at-permission/.../service/UserAdminService.java`、`at-auth/.../security/JwtAuthenticationFilter.java` |
| [GAP-03](#gap-03无用户自助改密端点) | 无用户自助改密端点（仅管理面重置） | P0 功能缺口 | `at-auth/.../controller/AuthController.java` |
| [GAP-04](#gap-04健康检查与优雅启停缺失) | 无健康检查端点、未开优雅启停、compose 中 server 无探针 | P0 部署缺口 | `at-bootstrap/src/main/resources/application.yml`、`docker-compose.yml` |
| [GAP-05](#gap-05三权分立缺角色互斥校验) | 角色互斥无数据层约束 / 服务层校验 | P1 合规缺口 | `at-permission`（`mutex` 全仓零命中） |
| [GAP-06](#gap-06敏感级别缺变更端点与变更审计) | 敏感级别无变更端点、无级别变更审计、无「提级需审批」联动 | P1 合规缺口 | `at-file/.../model/entity/FileNode.java`、`at-permission/.../config/ApprovalProperties.java` |
| [GAP-07](#gap-07全文搜索未建索引) | 检索 `keyword` 走 LIKE 模糊匹配，未建全文索引 | P1 能力 / 性能缺口 | `at-file/.../controller/FileController.java`（`NodeQuery`） |
| [GAP-08](#gap-08轻-im-缺-提及与消息保留策略) | 轻 IM 缺 @ 提及与「消息保留 ≥ 30 天」策略 | P1 验收缺口 | `at-collaboration/.../service/ChatService.java` |

---

### GAP-01：上传大小上限未配置

- **现象**：经 `POST /v1/files`（multipart）上传超过 **1 MB** 的文件会被框架层直接拒绝。
- **证据**：全仓库检索 `spring.servlet.multipart.max-file-size` / `max-request-size` /
  `MultipartConfigElement` / `MultipartProperties` **零命中**；`application.yml` 内无 `spring.servlet.multipart` 段。
- **影响**：Spring Boot 默认 **单文件 1 MB / 单请求 10 MB**，与「大文件上传」目标直接冲突；
  §4 P0「配置管理（文件上限 / 分片 / 令牌时长 / 通知等）」的「文件上限」一项无落点。
  因分片未落地（见 D-5 / §4.1），当前**无任何绕过路径**。
- **回头需完成**：① `application.yml` 补 `spring.servlet.multipart.max-file-size` / `max-request-size`，
  并以**环境变量占位**（如 `${ANTTRANSFER_MAX_FILE_SIZE:2GB}`）落实「上限可配」；
  ② 同步 Nginx `client_max_body_size` 与未来 at-gateway 的请求体限制；
  ③ 前端在超限前置校验并提示，避免用户白传。
- **触发时机**：**建议提前至分片上传落地前**——本组唯一「直接导致功能不可用」的项。

### GAP-02：账号停用未联动吊销会话

- **现象**：管理员停用某账号后，该用户持**已有 access token** 仍可继续访问，直至令牌自然过期（TTL 30 min）。
- **证据**：
  - `at-permission` 的 `UserAdminService#changeStatus`（权限点 `system:user:status`）只写 `sys_user.status`，
    **未调用任何会话吊销入口**；
  - `TokenSessionService#revokeAll`（DB `token_epoch + 1` 为唯一权威 + 事务提交后清 Redis）仅由 `logout`、
    `refresh` 遇停用、refresh 重放三类路径触发；
  - `JwtAuthenticationFilter` 仅校验签名 / 过期 / `token_epoch`，**不逐请求校验 `sys_user.status`**。
- **影响**：§4 验收「账号停用 / 启用（停用 2 分钟内会话失效）」**不达标**，最坏 30 min；
  窗口期内被停用账号仍可读写其权限内资源（离职 / 违规处置场景敏感）。
- **回头需完成**（可叠加）：
  - **A（推荐，即时吊销）**：`changeStatus` 在停用时经 **`UserAdminPort` 扩展方法**触发吊销
    （实现落 at-auth、接口留 at-common，守住「at-permission 不反向依赖 at-auth」的模块边界）；
  - **B（兜底，逐请求校验）**：`JwtAuthenticationFilter` 增加用户状态校验（走 Redis 快照，避免每请求打 DB），
    并把停用状态写入该快照，使绕过 A 的路径失效。
- **触发时机**：账号治理加固期；与 **GAP-03** 同批。

### GAP-03：无用户自助改密端点

- **现象**：用户无法自行修改口令，只能由管理员重置。
- **证据**：`AuthController`（`/v1/auth`）仅暴露 `POST /token`、`POST /token/refresh`、`POST /logout`、`GET /me`；
  改密只存在于管理面 `POST /v1/system/users/{id}/reset-password`
  （`UserAdminPortAdapter#resetPassword`，SQL 内联 `token_epoch + 1`）。
- **影响**：§4 P0「本地账号登录 / 注销 / 改密」仅完成登录 / 注销。**「改密后全端令牌吊销」语义已具备**
  （重置路径已带 `token_epoch + 1`），缺的是用户自助入口——「首次登录强制改密」「口令到期更换」
  「疑似泄露自救」等场景无法闭环。
- **回头需完成**：新增 `PUT /v1/auth/password`（校验旧口令 + 强度策略 + 复用 `token_epoch + 1` 全端吊销 +
  审计「谁修改了自己的口令」）；同步 `docs/api/README.md` 端点表与 `docs/development/frontend-permission-map.md`，
  前端补设置页入口与二次确认。
- **触发时机**：账号与安全设置主线；与 **GAP-02** 同批。

### GAP-04：健康检查与优雅启停缺失

- **现象**：无健康检查端点，未开启优雅启停，compose 中 `server` 服务无探针。
- **证据**：`at-bootstrap/src/main/resources/` 下 `management.*` / `endpoints` / `actuator` **零命中**；
  `application.yml` 无 `server.shutdown=graceful`；`docker-compose.yml` 仅对 `mysql` / `redis` 配
  `healthcheck`，`server` 服务无探针。
- **影响**：§4 P0「健康检查 / 优雅启停」未落地——① 编排 / K8s 无就绪与存活判据
  （`depends_on: service_healthy` 覆盖不到后端）；② 重启 / 缩容时在途请求与**正在写盘的上传**被硬切断
  （默认 `immediate`）。
- **回头需完成**：① 引入 `spring-boot-starter-actuator` 并暴露 `/actuator/health`
  （细分 `liveness` / `readiness`，readiness 纳入 DB / Redis 探针）；② `server.shutdown: graceful`
  + `spring.lifecycle.timeout-per-shutdown-phase`；③ `docker-compose.yml` 为 `server` 补 `healthcheck`
  （注意 `context-path=/api`，探针地址为 `/api/actuator/health`）。
- **触发时机**：部署加固 / 上线清单完善时（Phase 3~4）。

### GAP-05：三权分立缺角色互斥校验

- **现象**：内置角色（系统管理员 / 安全管理员 / 审计管理员）之间的**互斥关系无任何强制**，
  同一人可同时持有互斥角色。
- **证据**：`at-permission` 全仓检索 `mutex` **零命中**；已实现的是「内置角色受保护不可删改」与「防自锁」
  （不允许把自己踢出管理角色）两条锚点，但无「角色组合校验」。
- **影响**：§4 P0「三权分立」的关键口径（角色互斥）缺数据层与服务层双保险。§4.1 已将该项判为 🟡，
  但「互斥」属审计口径的**实质性**要求，非风格问题。
- **回头需完成**：① 定义互斥矩阵（数据层：`sys_role` 增互斥组标识，或建 `sys_role_mutex` 关系表）；
  ② 服务层在「角色分配」「用户授权」两处校验互斥，命中即 `1003 / 403`（策略 D）并写审计；
  ③ 补单元 / 集成测试（含「已有互斥角色再授予」的拒绝路径）。
- **触发时机**：权限合规加固期（Phase 3 后）；若 EE 化需提交安全评审，则**不得晚于该评审**。

### GAP-06：敏感级别缺变更端点与变更审计

- **现象**：文件的敏感级别只在落库时确定，之后**没有任何途径调整**，也没有「谁把级别从低改成高」的记录。
- **证据**：`FileNode.level`（1 低 / 2 中 / 3 高，按引用独立、可高于物理文件默认级）存在，
  `NodeQuery.level` 支持按级别过滤；但 `FileController` 无级别更新端点（仅 `rename` / `move` / `copy` / 删除类动作），
  `OperationLog` 的动作字典中**无级别变更项**。
- **影响**：§4 P0「敏感级别（低 / 中 / 高）与审批规则配置」中，「单级可配」的规则端点已由 **D-5** 覆盖，
  但**级别本身的变更与审计、以及「提级需审批」的强制联动**仍缺位——级别当前只是「上传时的标签」，
  不构成可治理的合规约束。
- **回头需完成**：① 新增级别变更端点（`PATCH /v1/files/{nodeId}/level`，或并入元数据更新），
  **提级走审批、降级留痕**；② `OperationLog` 增加级别变更动作常量并由审计写入器落地；
  ③ 明确「已审批通过的授权在提级后是否失效」的规则（建议失效并触发复审）。
- **触发时机**：审批 / 合规主线加固期；**与 D-5 的「审批规则配置」同批收口**。

### GAP-07：全文搜索未建索引

- **现象**：文件检索的 `keyword` 为 `LIKE` 模糊匹配，非全文检索。
- **证据**：`FileController#page` 的 `NodeQuery`（`folderId / keyword / ext / level / size 区间 / 时间区间 / tagId / sort`）
  中 `keyword` 走 LIKE；全仓无 MySQL 全文索引（`FULLTEXT`）定义，也无外部检索引擎接入。
- **影响**：§4 P1「标签 / **全文**与标签搜索」的「全文」一项未满足；数据量增长后 `LIKE '%kw%'`
  无法走索引，检索性能随行数线性劣化。
- **回头需完成**：① 明确「全文」口径（仅 `sys_file_node` 的 `name`，还是需抽取文件内容 / 正文）；
  ② 若仅名称，可用 `FULLTEXT` + ngram 解析器建索引；若需内容检索，评估外部引擎（ES / Meilisearch）
  与 EE 化边界；③ 同步 `docs/prd/README.md` §4.1 的 P1 表述与 API 文档的检索语义。
- **触发时机**：检索体验优化期（数据量或用户反馈触发）。

### GAP-08：轻 IM 缺 @ 提及与消息保留策略

- **现象**：站内轻 IM 只支持发消息 / 拉历史 / 标记已读，无 @ 提及，也无消息保留期管理。
- **证据**：`at-collaboration` 的 `ChatService` 与 Chat 端点仅覆盖会话与消息收发；无 @ 提及的
  解析 / 通知 / 未读高亮逻辑，亦无归档或清理任务（`@Scheduled` 全仓仅 `PermissionGrantExpireScheduler` 一处，
  与 **D-10** 同源问题）。
- **影响**：§4 P1「站内轻 IM（会话与 **@ 提及**）；**消息持久化 ≥ 30 天**」两项验收无落点；
  消息表将无限增长，与留存策略矛盾。
- **回头需完成**：① @ 提及：消息体识别提及对象 → 生成定向通知（复用 `NotifyService`）→ 会话内未读高亮；
  ② 保留策略：明确「≥ 30 天」的下限与归档 / 清理动作（可复用 **D-10** 的 `AuditArchiveScheduler`
  同构方案与分布式锁要求）。
- **触发时机**：协作主线（Phase 3，at-collaboration 落地）时；清理任务与 **D-10** 同批。
