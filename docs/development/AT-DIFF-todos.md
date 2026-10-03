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
> **审计主线落地时新识别的口径差异**，AT-DIFF-11 为**本人资料自助（头像）落地时新登记的
> 端点与帧口径**（含一处白名单放行面的收紧），均属「已实现且未阻塞」的登记项（代码内无 `TODO` 标记，
> 仅本文档登记），故上表 grep 计数仍为 3 处（02/03/05）。

> 另：2026-09-14 复核 `docs/prd/README.md` §4.1 后端现状时新识别 **8 项实现缺口**（**非口径差异**，
> 属「§4 要求的动作代码里还没有」），登记在文末「🧱 后端功能缺口登记（GAP-01 ~ GAP-10）」，
> 同样不落 `TODO` 标记、同样按「整体完工后关闭」处理；其中 3 项（共享空间 / 审批端点 / 分片上传）
> 已由 **D-5 / D-11** 覆盖，未重复登记。
>
> **GAP-09** 为 2026-09-20 落地「文件列表安全状态徽标」时新识别的缺口：
> 前端已按**可选字段**实现（有则显示、无则整条不渲染），故不阻塞、也不影响正确性，
> 仅登记「服务端补齐后即可生效」的字段需求。
>
> **GAP-10** 为 2026-09-29 落地「本人自助换头像」时新识别的缺口：把「个人中心」从
> 「只有头像这一半」补记为「昵称自助仍缺」。
>
> **GAP-08 已于 2026-09-29 关闭**（站内轻 IM 的 @ 提及 + 消息保留 ≥ 30 天两项全量收口，
> 含 `sql/V18__chat_mention_and_retention.sql`；详见文末该条），本节剩余未关闭项为
> GAP-04 ~ GAP-07 / GAP-09 / GAP-10。
>
> **RACE-01** 为 2026-09-29 修复「会话对端备注」并发缺陷（`ChatService#setPeerAlias`，真 MySQL
> 压测暴露）时，对全仓 `catch (DuplicateKeyException` 做同形扫描新识别的登记项。它**既不是口径差异、
> 也不是功能缺口**，而是**代码内部的自相矛盾**：注释承诺「撞键后回查既有行即收敛」，
> 而该承诺在 MySQL 默认 REPEATABLE READ 下不成立。登记在文末「🐞 并发正确性登记（RACE-01）」，
> 同为不落 `TODO` 标记的登记项（grep 计数仍为 3 处）。
> 同日完成排查与修复（4 处，11 个真库并发用例转绿），详见文末该节。
>
> 另：2026-09-29 对**后增 5 语**（`ja-JP` / `ko-KR` / `fr-FR` / `ru-RU` / `es-ES`，各 21 个命名空间）
> 做语言级校对后，新识别 **8 项国际化（i18n）方案层问题**（复数形态缺失、术语表缺失、源文案陈旧、
> 法式排版规范等），登记在文末「🌐 国际化（i18n）登记（I18N-01 ~ I18N-08）」。
> 这 **不是译文错误**——译文错误（含 5 处误译 / 语义丢失）已在当轮校对中修完；
> 登记的是「当前 i18n 机制本身做不到、或需一次全局定调才能改对」的项，
> 同样不落 `TODO` 标记（下述 grep 计数仍为 3 处）。
>
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
| [AT-DIFF-09](#at-diff-09-contentscaninterceptor-落点) | `ContentScanInterceptor` 落点：`at-common` SPI vs CE 暂落 `at-file` | `server/at-common/.../spi/scan/ContentScanInterceptor.java` | ✅ 2026-09-29（按方案 B 上收） |
| [AT-DIFF-10](#at-diff-10-审计写入器同构三份) | 审计写入器同构三份：抽公共实现 vs 保持三份（实体 / Mapper 已共享） | `server/at-permission/.../service/PermissionAuditLogger.java`、`server/at-file/.../service/FileAuditLogger.java` | 📝 已登记（未阻塞） |
| [AT-DIFF-11](#at-diff-11头像双写入口与-profile-帧广播) | 头像双写入口（本人 `/users/me/avatar` ↔ 管理员 `/system/users/{id}/avatar`）与 `PROFILE` 帧全员广播 | `server/at-auth/.../controller/UserSelfController.java`、`server/at-collaboration/.../event/CollaborationEventListener.java` | 📝 已登记（未阻塞） |

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

## AT-DIFF-09：`ContentScanInterceptor` 落点 —— ✅ 已收口（2026-09-29，按方案 B 上收）

- **裁决**：C 组差异化落地时按**方案 B** 收口——接口由 `at-file` 上收至
  **`at-common` 的 SPI 包**（`com.anttransfer.common.spi.scan.ContentScanInterceptor`），
  CE 实现 `SuffixAndKeywordScanInterceptor` 仍留在 `at-file` 并**继续真实生效**（后缀黑名单 +
  文件名敏感词，命中即 4007 并审计），**未**退化为 Noop PASS。
- **触发条件达成**：方案 B 的触发判据是「扫描被多个模块消费」。C 组一次性引入 7 个 SPI 时，
  若 `ContentScanInterceptor` 单独留在 `at-file`，EE 就必须同时依赖 `at-file` 才能实现 DLP，
  与「EE 只依赖 `at-common` 即可实现任一扩展点」的口径冲突；且同期 `VirusScanner` 已按同一
  约定落 `at-common`——两者本就共用「有序管道 + Deny 优先 + fail-closed」语义，分居两处会
  让 EE 接入方对「扫描类接缝在哪」产生二义。
- **原差异（历史记录）**：`architecture.md` §2.1 CE/EE 扩展点表把 `ContentScanInterceptor` 的
  **接口位置**定为 **`at-common` SPI**；CE 实现最初把它落在
  **`at-file` 模块内**（`server/at-file/.../extension/ContentScanInterceptor.java`），
  CE 默认实现为 **`SuffixAndKeywordScanInterceptor`**（后缀黑名单 + 文件名敏感词），而非 Noop PASS。
- **理由**：① 该接口当前**只有一个消费方**（外发分享的内容扫描），未构成跨模块契约，
  过早放 `at-common` 会形成「无消费方的 SPI」；② CE 需要**真实生效**的默认实现——
  若按原表给 Noop PASS，则「后缀黑名单」需求（默认阻断 exe/sh/bat/msi/com/scr）落不了地；
  ③ 职责上它本就是 at-file 的「写入前拦截」策略，与文件域内聚。
- **方案**：
  - **A（CE 初期，已退役）**：CE 阶段保持 at-file 内扩展点（`ContentScanChain` 责任链 + Deny 优先 +
    **fail-closed**：扫描器抛异常按拦截处理）；EE 若需 DLP，可直接提供 `ContentScanInterceptor`
    的 Spring Bean 加入链，无需改业务代码；
  - **B（✅ 2026-09-29 采行）**：接口上移至 `at-common` SPI，**保留** at-file 的 CE 实现
    （`SuffixAndKeywordScanInterceptor`）与责任链语义；EE 只需依赖 `at-common` 即可实现 DLP。
    已同步 `architecture.md` §2.1 / §2.2 / §2.4 与 PRD §8 命名。
- **影响面**：无正确性风险。迁移仅改包位置（`ContentScanChain` / `SuffixAndKeywordScanInterceptor`
  与相关测试改 import），链的 Deny 优先与 fail-closed 行为由既有测试原样守住。

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

## AT-DIFF-11：头像双写入口与 `PROFILE` 帧广播

- **差异 / 新增**：① **头像的写入多出一条与管理员并列的入口** —— `POST /api/v1/users/me/avatar`
  （`at-auth`，**不挂权限点**，目标 ID 恒取令牌 subject、路径里的 `me` 使越权结构上不可达）与既有的
  `POST /api/v1/system/users/{id}/avatar`（`at-permission`，`system:user:update` **+** 数据范围可见性）
  **并列存在，共用同一个 `UserProfileChangedEvent` 与 `PROFILE` 帧**；两条路径**不做**「目标是自己就跳过
  权限校验」的合并——那等于在权限校验器上开一个「参数填自己即放行」的口子（典型越权形状）。
  ② 下行 `PROFILE` 帧的收件人集合为**全员广播**（`WsBroadcaster#broadcast`，`WsDelivery.userId = null`），
  而 `docs/api/README.md` §7 的帧清单此前**从未登记**该帧，本次一并补录（帧表 + 「四个口径要点」）。
- **理由（广播 vs 精确扇出）**：产品口径是「头像一变，所有能看到它的地方立刻换图」——本人多端、
  会话对端、群成员列表、用户管理列表都在展示这张头像。要精确匹配收件人，就得维护一张「谁在关注谁」的
  订阅表，并让它与群成员关系变更保持对账（`PRESENCE` 那套订阅集合语义不同，**不可复用**）；
  而本帧载荷只有 `userId + 头像直出地址`（后者本就是免登录可读的公开路径），
  全员广播的暴露面与「让对方直接访问该 URL」完全相同，且换头像是低频人工动作，不构成放大。
- **安全边界（自动化护栏）**：头像直出读路径 `GET /v1/users/{userId}/avatar` 位于白名单，
  该条目的 ID 段**必须是数字正则** `{userId:[0-9]+}`。改动前的写法是 `*`，而 Spring Security 的
  路径放行**不看 HTTP 方法**，于是写路径 `POST /v1/users/me/avatar` 被同一条匿名放行顺带吃掉，
  「谁能改头像」被静默放宽成匿名可调。回归护栏 `SecurityConfigTest#builtInWhitelist_shouldNotPermitSelfAvatarUpload`：
  **反向断言**写路径不匹配任一白名单条目 **+** **正向断言**数字读路径仍匹配
  （只做反向断言时，把整条白名单删空也能变绿）。
- **兼容性**：滚动发布期间**旧实例**收到 `userId = null` 的 `PROFILE` 帧会按原「按用户扇出」逻辑丢弃，
  表现为「那几端要等下次拉列表 / 会话才刷新」，属**可接受降级**（帧本就是加速通道，
  真值在 `sys_user.avatar_url`）。
- **影响面**：无正确性风险。新增 1 个端点、1 条免登录白名单条目（**收紧而非放宽**）、
  1 个审计动作 `USER_AVATAR_SELF`（与管理员侧 `USER_AVATAR` 分开编码，使审计能区分
  「本人自改」与「管理员改他人」）；对外契约见 `docs/api/README.md` §1 / §5 / §7。

---

## 🧱 后端功能缺口登记（GAP-01 ~ GAP-10）

> **来源**：2026-09-14 以 `server/` 实际代码为准复核 `docs/prd/README.md` §4.1「实现现状核查」时，
> 在**已落地部分中发现的缺口**。与 AT-DIFF 的区别：AT-DIFF 记的是「外部计划书 vs 已冻结契约的口径差异（待裁决）」，
> 本节记的是「§4 要求的动作，代码里还没有」——**不是口径分歧，而是实现缺口**。故本组**不落
> `TODO[AT-DIFF-]` 标记**（位置无唯一锚点，也不属「写法待裁决」），只在本文档登记；
> 文档头部 grep 计数仍为 3 处（02 / 03 / 05）。
>
> **（GAP-11 补记于 2026-10-02）**：来源与上同（§4.1 实现现状核查），但是**做 10 GiB 级上传实跑补证时实测命中**的
> ——入口放行证据来自真跑，非纯静态复核；其「失败态暂存无法回收」部分同时暴露了 `at-transfer` 缺失暂存 TTL 清扫。
>
> **已由现有条目覆盖、本节不重复登记的缺口**（仅交叉引用）：
> - **共享空间 P0 未落地**（`sys_space` 仅骨架实体、无 Controller / Service / 成员角色端点）→ 见 **D-11**
>   （两表结构已落地，待 at-collaboration 四层接管读写）；
> - **审批动作 / 撤销 / 待办 / 我的申请 / 审批规则配置等端点缺失** → 见 **D-5**（进入 Phase 4 前的硬前置）；
> - ~~**分片上传 / 断点续传未落地**（`at-transfer` 未建、无 precheck / parts / merge）~~ **✅ 已于 2026-09-14 落地**
>   （`at-transfer` 五端点 + `TransferTaskService` 编排 + `ChunkStore` + 25 例测试）→ §4.1 表已置 ✅，D-5 上传线随之收口。
>
> **关闭时机**：与 AT-DIFF 一致——上传 / 审批 / 分享三条主线跑通后的加固期逐条改进。
> 其中 ~~**GAP-01 建议提前**（默认 1 MB 会直接挡掉大文件上传验收）~~ **✅ 已随分片上传主线落地（2026-09-14）**，
> ~~**GAP-02 / GAP-03 同批**（账号生命周期动作）~~ **✅ 已于 2026-09-20 同批关闭**
> （自助改密端点 + 停用即时吊销，含 Redis 纪元镜像键回填缺陷修复）。
> ~~**GAP-08**（轻 IM 的 @ 提及 + 消息保留策略）~~ **✅ 已于 2026-09-29 随 B 组（IM 收口）关闭**：
> 「保留期清理」不再等 **D-10**（后者仍在延期登记中），改参照 `at-file` 已上线的
> `FileCleanupScheduler` 同构方案（分布式锁 + 分批 + 幂等）。

| ID | 缺口 | 级别 | 代码现状锚点 |
| --- | --- | --- | --- |
| [GAP-01](#gap-01上传大小上限未配置) | ~~上传上限未配置，沿用 Spring 默认单文件 1 MB~~ **✅ 主要缺口已关闭（2026-09-14）**：`spring.servlet.multipart` 64 MB / 80 MB + `anttransfer.transfer.*` | P0 配置缺口 | `server/at-bootstrap/src/main/resources/application.yml` |
| [GAP-02](#gap-02账号停用未联动吊销会话) | ~~停用账号未吊销在途会话，不满足「2 分钟内失效」~~ **✅ 已关闭（2026-09-20）**：停用同事务 `token_epoch+1` + 提交后清 Redis 镜像键，**当场失效** | P0 验收缺口 | `at-auth/.../service/TokenSessionService.java`、`at-auth/.../service/UserAdminPortAdapter.java` |
| [GAP-03](#gap-03无用户自助改密端点) | ~~无用户自助改密端点（仅管理面重置）~~ **✅ 已关闭（2026-09-20）**：新增 `PUT /api/v1/auth/password` | P0 功能缺口 | `at-auth/.../controller/AuthController.java`、`at-auth/.../security/PasswordPolicy.java` |
| [GAP-04](#gap-04健康检查与优雅启停缺失) | 无健康检查端点、未开优雅启停、compose 中 server 无探针 | P0 部署缺口 | `at-bootstrap/src/main/resources/application.yml`、`docker-compose.yml` |
| [GAP-05](#gap-05三权分立缺角色互斥校验) | 角色互斥无数据层约束 / 服务层校验 | P1 合规缺口 | `at-permission`（`mutex` 全仓零命中） |
| [GAP-06](#gap-06敏感级别缺变更端点与变更审计) | 敏感级别无变更端点、无级别变更审计、无「提级需审批」联动 | P1 合规缺口 | `at-file/.../model/entity/FileNode.java`、`at-permission/.../config/ApprovalProperties.java` |
| [GAP-07](#gap-07全文搜索未建索引) | 检索 `keyword` 走 LIKE 模糊匹配，未建全文索引 | P1 能力 / 性能缺口 | `at-file/.../controller/FileController.java`（`NodeQuery`） |
| [GAP-08](#gap-08轻-im-缺-提及与消息保留策略) | ~~轻 IM 缺 @ 提及与「消息保留 ≥ 30 天」策略~~ **✅ 已关闭（2026-09-29）**：行级 `mentioned` 标记 + `mentionUserIds` 上行 + 会话 `mentionUnreadCount`；`ChatRetentionScheduler` 分批物理清理（下限 30 天） | P1 验收缺口 | `at-collaboration/.../service/ChatService.java`、`.../job/ChatRetentionScheduler.java`、`sql/V18__chat_mention_and_retention.sql` |
| [GAP-09](#gap-09安全徽标所需字段未下发) | 安全徽标所需字段未下发：`watermarkEnabled` / `expireAt` | P1 能力缺口 | `at-file/.../model/vo/FileNodeVO.java`、`web/src/pages/file/components/SecurityBadges.tsx` |
| [GAP-10](#gap-10个人资料自助仅落头像缺改昵称) | 个人资料自助仅落头像：缺「本人改昵称」端点（`PUT /v1/users/me`） | P1 能力缺口 | `server/at-auth/.../controller/UserSelfController.java` |
| [GAP-11](#gap-11分片上传未在入口校验单文件上限) | 分片路径的入口上限（64 GiB）与文件域上限（10 GiB）两套并存且未对齐：10~64 GiB 的文件被受理、全量传完后才在 `merge` 被 4006 拒绝；失败态暂存膨胀到 2 × 文件大小且无回收路径 | P0 验收 / 资源缺口 | `at-transfer/.../service/TransferTaskService.java`（`resolveChunkSize` / `merge`）、`at-file/.../service/FileContentService.java`（`upload`） |

---

### GAP-01：上传大小上限未配置

> **✅ 状态：主要缺口已关闭（2026-09-14）**。已随分片上传主线落地。`application.yml` 现配 `spring.servlet.multipart`
> （`max-file-size=64MB` / `max-request-size=80MB` / `file-size-threshold=0`）与 `anttransfer.transfer.*`
> （默认分片 8 MiB / 单分片上限 64 MiB / 片数上限 1024，超限 4006；单用户进行中任务上限 4103），
> 下文「现象 / 证据 / 影响」均不再成立。**剩余**：环境变量占位、Nginx `client_max_body_size`、前端前置校验。

- **现象**：经 `POST /v1/files`（multipart）上传超过 **1 MB** 的文件会被框架层直接拒绝。
- **证据**：全仓库检索 `spring.servlet.multipart.max-file-size` / `max-request-size` /
  `MultipartConfigElement` / `MultipartProperties` **零命中**；`application.yml` 内无 `spring.servlet.multipart` 段。
- **影响**：Spring Boot 默认 **单文件 1 MB / 单请求 10 MB**，与「大文件上传」目标直接冲突；
  §4 P0「配置管理（文件上限 / 分片 / 令牌时长 / 通知等）」的「文件上限」一项无落点。
  因分片未落地（见 D-5 / §4.1），当前**无任何绕过路径**。
- **回头需完成**：① ~~`application.yml` 补 `spring.servlet.multipart.max-file-size` / `max-request-size`，
  并以**环境变量占位**（如 `${ANTTRANSFER_MAX_FILE_SIZE:2GB}`）落实「上限可配」~~ **✅ 配置已补（环境变量占位待补）**；
  ② 同步 Nginx `client_max_body_size` 与未来 at-gateway 的请求体限制；
  ③ 前端在超限前置校验并提示，避免用户白传。
- **触发时机**：~~**建议提前至分片上传落地前**~~ **✅ 已随分片上传主线落地（2026-09-14）**。

### GAP-02：账号停用未联动吊销会话

> **✅ 状态：已关闭（2026-09-20）**。原「现象 / 证据 / 影响」已不成立，保留作决策留痕。

- ~~**现象**：管理员停用某账号后，该用户持**已有 access token** 仍可继续访问，直至令牌自然过期（TTL 30 min）。~~
- **证据（原）**：
  - `at-permission` 的 `UserAdminService#changeStatus`（权限点 `system:user:status`）只写 `sys_user.status`，
    **未调用任何会话吊销入口**；
  - `TokenSessionService#revokeAll`（DB `token_epoch + 1` 为唯一权威 + 事务提交后清 Redis）仅由 `logout`、
    `refresh` 遇停用、refresh 重放三类路径触发；
  - `JwtAuthenticationFilter` 仅校验签名 / 过期 / `token_epoch`，**不逐请求校验 `sys_user.status`**。
  - **复审补记（2026-09-20，真正的根因）**：即使照方案 A 直接调 `revokeAll` 也不够——`revokeAll` 是
    `REQUIRES_NEW`（为登出 / refresh 重放设计的自提交语义），与管理面「停用 + 审计」事务彼此独立；
    更要命的是「只递增 `token_epoch` 而不清 Redis 纪元镜像键 `at:token:access:{userId}`」时，
    `JwtAuthenticationFilter` 回源会读到**未提交的旧纪元**并**自愈回填**，把刚写下的吊销抹掉，
    最坏拖到 access TTL（30 min）——这才是「2 分钟窗口」的真实来源。
- ~~**影响**：§4 验收「账号停用 / 启用（停用 2 分钟内会话失效）」**不达标**，最坏 30 min。~~
- **已落地**：
  - `TokenSessionService` 新增 `revokeAllInCurrentTransaction(userId)`（`@Transactional(propagation = MANDATORY)`），
    与既有 `revokeAll`（`REQUIRES_NEW`）共用同一个私有方法 `bumpEpochAndEvictAfterCommit`：
    **DB `token_epoch + 1` 为唯一权威 + 事务提交后清 Redis 镜像键**，两者语义差异只在传播行为；
  - Redis 清理放在**事务提交之后**（`afterCommit` 回调）并吞掉异常：`token_epoch + 1` 先提交，
    「清缓存失败」最多退化为窗口期，**不会**把已成功的登出 / 改密翻成 500 或整笔回滚
    （改密回滚 = 用户以为改了其实没改）；
  - `UserAdminPortAdapter#resetPassword / changeStatus(停用) / deleteUser` 统一改调
    `revokeAllInCurrentTransaction`（替换原先内联 / 裸 `bumpTokenEpoch`），**参与管理面同一事务**，
    避免在持 `sys_user` 行锁时另开 `REQUIRES_NEW` 事务自锁；
  - 结果：停用**当场失效**，优于 §4 的「2 分钟内」。
- **交叉引用**：`docs/api/error-codes.md` 的 1005 行与「GAP-02 收口说明」；
  集成回归 `AuthFlowIntegrationTest#disableUser_shouldRevokeSessionsImmediately`（管理员停用后原 access 立即 401 + 1001）。
- **触发时机**：✅ 已随账号生命周期主线（GAP-03 同批）落地。

### GAP-03：无用户自助改密端点

> **✅ 状态：已关闭（2026-09-20）**。原「现象 / 证据 / 影响」已不成立，保留作决策留痕。

- ~~**现象**：用户无法自行修改口令，只能由管理员重置。~~
- **证据（原）**：`AuthController`（`/v1/auth`）仅暴露 `POST /token`、`POST /token/refresh`、`POST /logout`、`GET /me`；
  改密只存在于管理面 `POST /v1/system/users/{id}/reset-password`
  （`UserAdminPortAdapter#resetPassword`，SQL 内联 `token_epoch + 1`）。
- ~~**影响**：§4 P0「本地账号登录 / 注销 / 改密」仅完成登录 / 注销。~~
- **已落地**：`PUT /api/v1/auth/password`（body `{oldPassword, newPassword}`），链路：
  - `AuthService#changePassword`（`@Transactional(rollbackFor = Exception.class)`）按序执行
    「账号状态校验（停用 → 1005）→ 原口令 `matches`（不符 → **1029**）→ `PasswordPolicy`（不合规 → **1030**）→
    `UserAdminPort#updatePassword` → `revokeAllInCurrentTransaction` 全端吊销 → 审计」；
  - `PasswordPolicy`（at-auth）：长度 8~64、须同时含字母与数字、不得含空白、**不得与原口令相同**；
    上限 64 是 BCrypt 72 字节截断的安全边界；
  - 错误码：`1029 OLD_PASSWORD_MISMATCH` / `1030 PASSWORD_POLICY_VIOLATION`，均 HTTP 400 + 策略 E
    （**就地修正，不跳登录**——请求被拒 ≠ 会话失效）；
  - 审计：`OperationLog.ACTION_PASSWORD_CHANGE = "PASSWORD_CHANGE"`，detail 仅记 `username` 与
    `revokedSessions`，**不落任何口令明文 / 摘要**；
  - 前端：`services/auth#changePassword`（成功才清本地令牌）+ `AvatarDropdown` 新增「修改密码」入口
    与二次确认弹窗（旧 / 新 / 确认），i18n 中英齐备；回归护栏 `web/src/services/auth/api.test.ts`。
- **交叉引用**：`docs/api/README.md` §5 端点表与「自助改密结果分两类」说明；
  `docs/prd/README.md` §4.1「本地账号登录 / 注销 / 改密」已置 ✅。
- **触发时机**：✅ 已随账号与安全设置主线（GAP-02 同批）落地。

> ℹ️ **GAP-02 方案 B（`JwtAuthenticationFilter` 逐请求校验 `sys_user.status`，Redis 快照兜底）未实现**，
> 按「不做非必需动作」原则不顺手扩面：当前 A 路径已覆盖全部管理面入口（重置口令 / 停用 / 删除），
> 且「登录与刷新时强校验」兜住了重新认证路径。若后续出现绕过管理面的禁用写入（如直接改库 / DBA 运维），
> 再以独立条目重启方案 B。

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

> **✅ 状态：已关闭（2026-09-29）**。两项验收（@ 提及 / 消息持久化 ≥ 30 天）均有落点，
> 原「现象 / 证据」已不成立，保留作决策留痕。

- ~~**现象**：站内轻 IM 只支持发消息 / 拉历史 / 标记已读（**建群能力已于 2026-09-26 补齐**，
  见 `POST` / `GET /api/v1/chat/groups`；本缺口与其无关，仍是 @ 提及与保留策略两项），无 @ 提及，
  也无消息保留期管理。~~
- ~~**证据**：`at-collaboration` 的 `ChatService` 与 Chat 端点仅覆盖会话与消息收发；无 @ 提及的
  解析 / 通知 / 未读高亮逻辑，亦无归档或清理任务（`@Scheduled` 全仓仅 `PermissionGrantExpireScheduler` 一处，
  与 **D-10** 同源问题）。~~
- **影响**：§4 P1「站内轻 IM（会话与 **@ 提及**）；**消息持久化 ≥ 30 天**」两项验收原无落点；
  消息表将无限增长，与留存策略矛盾。**已解决。**
- **已落地**：
  - **① @ 提及**（`V18__chat_mention_and_retention.sql` 加 `notify_message.mentioned` 列）：
    - **行级标记而非消息级属性**：写扩散下一条群消息落 N 行，`mentioned` 是**每接收人一行**的列。
      这样「有人 @ 我」退化成 `mentioned = 1 and read_status = 0` 的等值查询，
      **不需要解析正文里的昵称**（重名、昵称含空格、正文改字都不会误判）。
    - **上行契约**：`POST /api/v1/chat/messages` 新增可空 `mentionUserIds`（上限 500）。
      服务端在 `ChatService#resolveMentionTargets` 里与**群成员求交集**，
      非成员 / 发送人自己 / 重复项**静默剔除**（不报错、不影响本条发送）——
      点名失败不该让整句话发不出去，而客户端持有的成员名单本来就可能是旧快照。
    - **定向投递**：被点名者那一行走既有的按接收人推送通道（`CHAT` 帧载荷 `NotifyMessageVO.mentioned`），
      不额外写一条站内信 —— 同一句话若在「会话未读」与「站内信未读」各算一次，
      用户会在两个地方看到两份未读，且点任一处都无法同时清掉。（若产品后续要求消息中心留痕，
      须先定未读合并口径再动。）
    - **未读口径**：会话列表新增 `mentionUnreadCount` = 该会话「未读且被点名」的条数，
      **它是 `unreadCount` 的子集，两个数不能相加**（角标数字仍取 `unreadCount`，只在 `> 0` 时染强调色）。
    - **前端**：输入框 `@` 选人（`resolveMentionTrigger` / `filterMentionCandidates` / `insertMention` /
      `pushMention` / `retainActiveMentions`，纯函数可单测）、气泡「有人@我」标记 + 描边、
      会话列表摘要前缀 `[有人@我]`（对齐微信）。
      **生效提及靠正文匹配**（`retainActiveMentions`）：用户删掉 `@昵称` 时该 ID 随之失效，
      不做插入位置跟踪（**这点与 Emoji 的占位符不同** —— 见 `web/src/components/ChatComposer/index.tsx` 的触发判定注释）。
  - **② 保留策略**：`ChatRetentionScheduler`（`anttransfer.collaboration.notify.message-cleanup-cron`，默认 `0 20 4 * * ?`，
    与文件域清理 03:30 错峰）
    → `NotifyMessageService#purgeExpiredChatMessages(cutoff, batchSize)` →
    `NotifyMessageMapper#deleteExpiredChatMessages`（`order by create_time limit` 分批 DELETE，
    **物理删除**：保留期是留存承诺，不是软删除开关）。
    - **30 天下限硬钳制**：`NotifyProperties.MIN_MESSAGE_RETENTION_DAYS = 30`，
      配置小于 30 一律按 30 执行（**不回写配置**，配置里仍显示管理员填的值，便于发现配错）。
    - **并发只允许一个实例清理**：Redis `SETNX at:chat:retention-lock`（TTL 15min，**不主动释放**，
      靠 TTL 兜底，避免实例崩溃后锁永久占用）；**Redis 异常时降级放行**（清理幂等、重复执行无害，
      而「锁坏了就不清理」会让保留期悄悄失效）。
    - 参照的是 **at-file `FileCleanupScheduler`** 而不是 **D-10 的 `AuditArchiveScheduler`**：
      后者至今未落地（`D-10` 仍在延期登记中），前者的「分布式锁 + 分批 + 重试留痕」已经过生产路径验证。
- **交叉引用**：`docs/api/README.md` 的 `CHAT` 帧与 `mentionUserIds` 说明；
  `docs/prd/README.md` §4.1 的 IM 行已置 ✅；回归护栏 `web/src/components/ChatComposer/composer.test.ts`、
  `web/src/hooks/useChatMentionables.test.tsx`、`web/src/services/chat/messages.test.ts`、
  `server/at-collaboration/.../ChatServiceRecallTest.java`。
- **触发时机**：✅ 已随协作主线（Phase 3）落地；**D-10** 的档案归档仍另案待办（本缺口不再等它）。

### GAP-09：安全徽标所需字段未下发

- **现象**：文件列表新增的「安全状态徽标」中，**水印**与**即将失效**两条永远不会亮起；
  回收站也无法给出「距清理还剩几天」。前端已按可选字段实现完毕，缺的只是服务端下发。
- **证据**：
  - `FileNodeVO` 的字段清单为 `id / name / ext / level / sizeBytes / updateTime / folderId /
    parentId / tags / status / recycleTime`，**无** `watermarkEnabled`、**无** `expireAt`
    （前端在 `web/src/services/file/types.ts` 的 `FileNodeSecurityExt` 里声明为可选扩展，
    `securityMarks()` 只在字段为 `true` / 可解析出时间时才产出徽标 —— 有则显示，无则整条不渲染）。
  - 回收站保留期由 `FileProperties.recycleRetentionDays`（默认 30 天，PRD US-09）决定，是**可配置项**，
    CE 没有任何端点把它暴露给前端；因此 `recycleTime` 虽已下发，前端只能算「已停留 N 天」，
    算不出「剩余 N 天」（写死 30 会在管理员改配置后立刻失真）。
- **影响**：不影响正确性，但「安全状态可视化」缺了最要紧的两条信号 —— 水印是机密级文件的核心保护
  （用户需要知道「这份文件流出后能不能溯源」），失效期决定链接何时自己断掉。
  与 **GAP-06** 同根：密级目前只有**标签**，没有**治理动作**。
- **回头需完成**：① `FileNodeVO` 增加可选 `watermarkEnabled`：来源需先定口径（按文件密级策略继承，
  还是按该文件当前生效分享的配置），并与附录 C 已预留的 `WatermarkProvider` 扩展点（见 **D-2**，
  命名待回写）保持一致；② 增加可选 `expireAt`：**先定语义** —— 是「节点自身的有效期」
  还是「该节点上所有生效授权的最近失效时刻」，两者在产品上是不同的事，定完再落字段；
  ③ 三个保留期相关字段（或将保留期本身）下发，或直接下发 `purgeAt` 清理时刻，
  让前端能显示「剩余 N 天」；④ 同步 `docs/api/README.md` 的 FileNode 字段表与前端类型
  （前端已按可选实现，服务端补齐后**无需改前端**）。
- **触发时机**：安全可视化 / 合规加固期，**与 GAP-06（密级变更治理）同批**。

### GAP-10：个人资料自助仅落头像（缺改昵称）

- **现象**：`docs/api/README.md` §1 的前缀表把 `at-auth` 的 `/api/v1/users` 描述为
  「本人资料 / 个人中心改昵称」，但代码里**只有换头像**（`POST /api/v1/users/me/avatar`，
  见 **AT-DIFF-11**）：没有任何「本人改昵称 / 姓名」端点，前端也没有对应的个人中心表单。
- **证据**：
  - `server/at-auth` 的 `UserSelfController` 仅暴露 `/v1/users/me/avatar`（`@RequestMapping("/v1/users/me")` 下唯一方法）；
  - 全仓无「本人自助改资料」入口：`UserAdminPort#updateProfile` 是**管理面**「管理员改他人资料」的写侧，
    走 `system:user:update` **+** 数据范围校验（`AccessControlService#assertResourceVisibleTo`），
    与本人在 `/users/me` 自改不是同一条路径。
- **影响**：不影响现有功能正确性，但「个人中心」在产品口径上只完成了一半——头像能自改、昵称不能；
  用户只能找管理员改显示名，而显示名在会话列表、消息气泡、审批记录、审计日志里到处都是。
- **回头需完成**：① **先定口径**：昵称是否允许用户自改？若允许，是否需唯一性与敏感词 / 长度校验
  （现 `sys_user.nickname` 无唯一约束）；② 落 `PUT /api/v1/users/me`（或 `PATCH`）+ 独立审计动作
  （与 `USER_AVATAR_SELF` 同构另立 `USER_PROFILE_SELF`，以免审计里与管理员侧混淆）；
  ③ 复用 `PROFILE` 帧广播昵称变更：帧载荷需**新增可选字段** `displayName`（新增字段属非破坏性扩展，
  但**必须同步** `docs/api/README.md` §7 与前端 `web/src/services/ws/protocol.ts` 的解析口径）；
  ④ 同步 §1 前缀表与 PRD §4 / §4.1 的表述。
- **触发时机**：个人中心 / 用户体验完善期；建议与「群成员展示名口径」相关需求一并做
  （两者共用同一份展示名回落规则，分两次做必然出现两套口径）。

### GAP-11：分片上传未在入口校验单文件上限

> **状态**：待修（2026-10-02 实跑发现）。**发现方式**：做「10 GiB 级上传实跑补证」时，
> 顺手按 §7「超过上限的文件在上传入口即被拒绝并提示」做边界实测，入口未拒。

- **现象**：上传有两条路径、**两套互不知晓的上限**：
  - **分片路径** `POST /v1/transfers/precheck` 只按自己的天花板判定 —— `max-chunk-size`（64 MiB）×
    `max-chunk-count`（1024）= **64 GiB**。该守卫的真实目的是保护 `uploaded_indexes varchar(8192)`
    （1024 片序列化后 4011 字符，见 PRD §4.1「分片上传 / 断点续传」行 2026-10-02 凭证），**完全不看文件域上限**；
  - **文件域上限** `FileProperties.maxFileSize`（默认 **10 GiB**，`application.yml` 未覆盖）只在
    `FileContentService.upload` 落盘前生效，而分片路径要走到 `merge` 才会经过它；
  - **直传路径** `/v1/files/instant` 也先回「秒传未命中」，同样不以 4006 前置拒绝。
  结果：**10 GiB < 大小 ≤ 64 GiB** 的文件会被受理、**全量传完并完成拼件**后，才在 `merge` 被 4006 拒绝。
- **证据**（2026-10-02 实跑，`sizeBytes=10738466816` = 10 GiB + 1 MiB，默认配置）：
  - **入口放行**：`POST /v1/transfers/precheck` → `http=200` / `code=4001`（`秒传未命中，请按分片上传`）、
    `chunkSize=11534336`（11 MiB，自动放大）、`chunkCount=931`；
  - **全量白传**：931 / 931 片全部 `code=0`，`sentMB=10241`、`elapsed=119s`（≈86 MB/s）、暂存 10241 MB；
  - **迟到的拒绝**：`POST /v1/transfers/{id}/merge` → `http=413` / `code=4006`（`文件大小超出限制`）、
    `elapsed=35s` —— 即**带宽与「拼件 + 服务端重算 SHA-256」都消耗完之后**才失败；
  - **失败态暂存膨胀且无法回收**：任务 `status=4`、`error_msg=文件大小超出限制`；任务目录 = 931 个 `*.part`
    （10241 MB）**+ `merged.bin`（10241 MB）= 20482 MB（2 × 文件大小）**；
    `DELETE /v1/transfers/{uploadId}` → `http=409` / `code=4102`（`当前传输状态不允许该操作`，
    因 `CANCELABLE_STATUSES` 只含 `0/1/2/6`，失败态 `4` 不在内），暂存仍 20482 MB；
    `at-transfer` 全模块 `@Scheduled` **零命中**（无暂存 TTL 清扫）→ 该目录**无任何 API / 定时回收路径**，
    本次由人工删盘回收（20482 MB → 0）。
  - **对照**：同尺寸 `POST /v1/files/instant` 返回 `code=4001`（先判内容是否存在，而非按上限拒绝）。
- **代码锚点**：`TransferTaskService#resolveChunkSize`（守卫只到 `maxChunkSize × maxChunkCount`）→
  `TransferTaskService#merge`（先 `chunkStore.merge` 拼件 + 重算 SHA-256，再 `fileIngestPort.ingest`）→
  `FileIngestAdapter#ingest` → `FileContentService#upload`（第 99-101 行 `sizeBytes > properties.getMaxFileSize()`
  → `FILE_TOO_LARGE`，位置在 `storeContent` 之前）。
- **影响**：① 用户白传最多 64 GiB（带宽 + 暂存盘），§7「超过上限的文件在**上传入口**即被拒绝并提示」在分片路径**不成立**；
  ② 失败态把暂存从 1× 抬到 2× 文件大小且不可回收，叠加「不取消就永久占盘」与「每用户 `max-active-tasks=3`」，
  构成可自伤的暂存盘耗尽路径（单任务实测滞留 20 GiB）；③ **正确性无损**：上限守卫在 `storeContent` 之前，
  内容寻址库不会产生垃圾，`sys_file` 无残留。
- **回头需完成**：① **统一上限口径**：把文件域上限下发给 `at-transfer`（经 SPI / 端口查 `FileProperties.maxFileSize`），
  使 `precheck` 即以 `4006` 拒绝；若产品确认「分片上传可放宽到 64 GiB」，则须让**单一配置源**同时驱动两条路径
  （现在并存两套且无人协调）；② `instantUpload` 同样补上限校验；③ 非完整性失败也要释放 `merged.bin`
  （`merge` 的失败分支当前只在 `FILE_INTEGRITY_ERROR` 时 `deleteTaskDir`）；④ 失败态可回收：或把 `status=4`
  纳入可取消，或落 `TransferStagingCleaner` —— 参照 GAP-08 采用的 `FileCleanupScheduler` 同构方案
  （分布式锁 + 分批 + 幂等）；⑤ 与 **GAP-01 遗留项③**（前端超限前置校验）同批：服务端入口拒得住，前端提示才有依据。
- **触发时机**：与 **GAP-01 遗留项**同批。若近期要上「大文件（> 10 GiB）分片上传」需求，**必须先做 ①**，
  否则该需求会直接撞上 4006（且是在传完之后）。

---

## 🐞 并发正确性登记（RACE-01）

> **来源**：2026-09-29 修复「会话对端备注」并发缺陷时，对全仓 `catch (DuplicateKeyException` 做的
> 一次同形扫描。与 AT-DIFF / GAP 的区别：AT-DIFF 记「外部计划书 vs 已冻结契约的口径差异」，
> GAP 记「PRD §4 要求的动作代码里还没有」；本节记的是**代码内部的自相矛盾**——注释承诺的收敛路径
> 在 MySQL 默认隔离级别下不成立。故同样不落 `TODO[AT-DIFF-]` 标记，只在本文档登记。
>
> **状态**：✅ **已于 2026-09-29 关闭**——4 处全部修复，11 个真库并发用例转绿
> （`ChatSendIdempotencyE2eIntegrationTest` 5 个 + `FileContentRaceE2eIntegrationTest` 6 个）。
> 本节保留为「已识别 → 已验证 → 已修复」的完整记录，供后续加固时作判例。

### RACE-01（已关闭）：「撞键后回查既有行」在 REPEATABLE READ 下读不到对手刚提交的行

- **机理**：`insert` **之前**已有一条 `select`（幂等前置查询），本事务的快照即建立于此刻；
  而对手的事务此时尚未提交。撞键后再用**同一个快照**回查，读到的仍是「没有这一行」，
  于是回查返回 `null`，重复键被原样抛给用户——而「连点保存 / 弱网重发 / 双端同发」
  恰恰就是这条兜底路径存在的唯一理由。MySQL 下单条语句失败不会中止事务（这一点各处注释写对了），
  漏掉的是**快照可见性**这一半。
- **与「会话对端备注」那处的区别**：备注最终改用**当前读**收敛（`UPDATE ... WHERE`，并按其影响行数
  判定真伪）。下列 4 处**不能照搬**该处的另一半做法（去掉 `@Transactional`）——
  它们的事务还承载「写扩散 N 行」「文件行 + 引用计数」的原子性，一旦拆开就会出现半截数据。
- **清单与落地修法**（4 处同形：显式事务 + `insert` 前已查询 + `catch` 内回查为空则抛）：

| # | 位置 | 事务 | insert 前的前置查询 | 落地修法 |
| --- | --- | --- | --- | --- |
| 1 | `at-collaboration` `ChatService#send` | `@Transactional` | `findExisting`（幂等前置） | 回查改走**当前读**：新增 `findExistingForShare`（`limit 1 for share`） |
| 2 | `at-file` `ChatAttachmentService#create` | `@Transactional(rollbackFor)` | `findBySenderAndClientMsgKey` | 回读改走**当前读**：新增 `findBySenderAndClientMsgKeyForShare` |
| 3 | `at-file` `FileNodeService#registerStoredContent` | `@Transactional(rollbackFor)` | `findByContent` | 回查改走**只读独立事务**：`readFreshFileObject`（`REQUIRES_NEW` + `readOnly`） |
| 4 | `at-file` `FileNodeService#acquireContentReference` | `@Transactional(rollbackFor)` | `findByContent` | 同 3（共用 `readFreshFileObject`） |

- **为什么 1 / 2 与 3 / 4 修法不同（修复过程中踩到的第二个坑）**：最初 4 处统一改成当前读
  （`for share`），#1 / #2 转绿，#3 / #4 却变成**死锁**——真库实测
  `Deadlock found when trying to get lock`，卡在 `update sys_file set ref_count = ref_count + 1`。
  根因是**锁升级**：`for share` 在对手行上留下共享锁，而 #3 / #4 的撞键分支**之后还要对同一行
  做 `ref_count + 1`（排他锁）**，多个并发输家同时升级即互相等待。改用 `for update` 不解决问题
  （同一枚共享锁照样要升级），把回查挪进 `REQUIRES_NEW` 只读事务才是出路——**不持锁**，
  既拿到新快照、又不与各自的计数写入纠缠，且只读不改数据，不破坏调用方的原子性
  （`FileVersionService#createVersion` 就处在更大的写事务里）。反过来看，`for share` 之所以在
  #1 / #2 成立，正是因为那两处撞键后**只读不写**（返回既有 VO），不存在升级。
  > 一般规律：**撞键兜底若在同一事务内还要写这一行，就不能用任何加锁读**，只能换新事务拿新快照；
  > 若只读，`for share` 足够。
- **已核对、不属此列**（同样扫到但写法本就正确，勿在后续加固中误改）：
  - `TagService#create`（118）撞键**直接报同名冲突**，本就不回查——用户要的就是这个冲突；
  - `ShareLinkService`（426）/ `TransferTaskService`（384）撞的是随机 token / 任务单号，
  走**换号重试**，不依赖「回查能看到对手的行」。
- **影响**：**非数据损坏**——幂等键真实存在于库里，客户端重试第二次会命中前置查询而成功；
  但会让「弱网重发 / 双端同发」偶发失败，与 4 处注释里承诺的幂等语义直接矛盾
  （其中 `ChatService#send` 的注释原话是「可安全回查既有消息并返回」）。
- **验证方式（已落地）**：两个「真 MySQL（Testcontainers）+ 真 Redis」的端到端用例类，
  断言「并发下无任何请求失败且终态唯一」，而不是只断言「抛出了重复键」：
  - `ChatSendIdempotencyE2eIntegrationTest`：16 线程同 `clientMsgId`（3 轮）断言无失败 + 恰好 2 行；
    另含**隔离级别机理探针**（两条真实连接证明 RR 下普通回查看不到快照之后提交的行、而 `for share`
    看得到）与**顺序重发对照组**（说明该缺陷为何长期不可见）；
  - `FileContentRaceE2eIntegrationTest`：秒传登记 / 内容引用 / 附件授权各 8 线程 × 2 轮，
    断言无失败 + `sys_file` 一行 + `ref_count` 如实累加 + `sys_chat_attachment` 一行。

---

## 🌐 国际化（i18n）登记（I18N-01 ~ I18N-08）

> **来源**：2026-09-29 对**后增 5 语**（`ja-JP` / `ko-KR` / `fr-FR` / `ru-RU` / `es-ES`，各 21 个命名空间）
> 做**语言级校对**时识别。此前只做过机械校验（键集合 / 占位符 / 哨兵残留 / 串语言泄漏），
> 那只保证「结构不坏」，**不保证「译文对」**——本轮补的是后者。
>
> **与前三类的区别**：AT-DIFF 记「外部计划书 vs 已冻结契约的口径差异」，GAP 记「PRD §4 要求的动作代码里还没有」，
> RACE 记「代码内部的自相矛盾」；本节记的是**国际化方案的表达力缺口 + 跨语一致性口径**——
> 不是译错（译错已当轮修完），而是**当前 i18n 机制本身做不到、或需一次全局定调才能改对**的问题。
> 同样不落 `TODO[AT-DIFF-]` 标记，只在本文档登记。
>
> **本次校对已完成的修正（背景，已落地，无需回头处理）**：5 语共 **43 个文件 / 约 182 处**最小 diff，
> 其中 **5 处真错误**（机械探针查不出、只有语言级校对能发现）：
> `ko-KR` 把 *refresh* 误译成「修复」（`새로 고치다`）、权限点选择数语义错位（`rolePerm.selected`）、
> `Approved grants` 误译为「결재 권한」；`fr-FR` `message.type.4` 漏译「即将」（`Lien expiré`）、
> `message.type.9` 语义错译（`Accusé de retrait`）；`es-ES` 登录锁定倒计时丢失「剩余」语义；
> `ja-JP` 残留未汉化英文 `identity`。结构侧**零回归**（键集合 / 占位符与 `zh-CN` 逐键一致）。
>
> **关闭原则**：项目最后完善阶段统一裁决。其中**仅 I18N-01 影响用户可见语法正确性**，
> 其余为一致性 / 覆盖度 / 工具口径问题。**全部不阻塞当前功能与上线**。

### 登记项索引

| ID | 主题 | 影响面 | 状态 |
| --- | --- | --- | --- |
| [I18N-01](#i18n-01多语言复数形态缺失) | 复数形态缺失（无 ICU plural） | ru / fr / es / ko 用户可见语法 | ⏳ 待裁决（唯一影响正确性） |
| [I18N-02](#i18n-02术语表缺失导致跨语口径散乱) | 术语表缺失 → 跨语术语各自为政 | 全部 7 语 | 📝 已登记 |
| [I18N-03](#i18n-03zh-cn-源文案陈旧) | `zh-CN` 源文案陈旧（群组 ID 手输入已移除） | 源 + 7 语 | 📝 已登记 |
| [I18N-04](#i18n-04法式排版规范未落地) | 法式排版（弯撇号 / 不换行空格）未落地 | `fr-FR` 全包 | 📝 已登记 |
| [I18N-05](#i18n-05韩语占位符后助词) | 占位符后助词（받침 未知） | `ko-KR` | 📝 已登记 |
| [I18N-06](#i18n-06校对探针的中日同形词误报) | 探针把中日同形词误判为「漏译」 | 工具口径 | 📝 已登记 |
| [I18N-07](#i18n-07语言覆盖度半成品语言包) | 5 个语言包只有 7 / 21 命名空间 | bn-BD / fa-IR / id-ID / pt-BR / zh-TW | 📝 已登记 |
| [I18N-08](#i18n-08有意保留的英文残留) | 有意保留的英文 / 技术串口径未成文 | 全部 7 语 | 📝 已登记 |

---

### I18N-01：多语言复数形态缺失

- **现象**：语言包是纯 `{count}` 插值，**没有 ICU plural**（`_one` / `_few` / `_many` / `_other` 键）。
  单一模板无法同时覆盖「1」与「多」，`count = 1` 时必然有一档语法错。
- **证据（实际受影响的键）**：
  - `ru-RU` **三形态**（1 / 2–4 / 5+）：`file.share.times`、`chat.attach.limit.times`、
    `shares.create.downloadLimitExtra`（`{count} раз`，2–4 应为 `раза`）；
    `chat.attachCard.remaining`（`Осталось {count} раз`）；
    `component.chunkUpload.progress.chunks`（`{count} частей`，1 应为 `часть`）；
    `chat.new.group.memberHint` / `memberLimit` / `chat.group.invite.hint` / `invite.limit`
    （`{max} человек`，2–4 应为 `человека`）。
  - `fr-FR`：`file.total`（`{total} éléments au total`）、`system.dept.suffix.count` / `suffix.level`、
    `workbench.stat.*.unit`、`component.chunkUpload.busy` / `retried` / `chunks`、
    `permissionMap.grant.expiringSuffix` / `remainDays`、`chat.group.meta`。
  - `es-ES`：`approval.sla.overdue.days` / `hours` / `minutes`、`file.security.expiring.label`、
    `file.recycle.daysAgo`、`chat.attach.expire.days`、`shares.create.expireExtra`、
    `permissionMap.remainDays`、`file.share.presetDays`。
  - `ko-KR`：占位符后助词随 받침 变化（单列见 **I18N-05**）。
- **方案（二选一，需架构裁决）**：
  - **A. 数量不变式**（改动小、零机制变更）：把 `{count} раз` 改为 `раз: {count}` 这类标签式写法，
    俄语用冒号式可规避变格；法语 / 西语则统一中性措辞（如 `Total : {total}`）。
  - **B. 引入 ICU plural**（改动大、最正确）：`{count, plural, one {…} few {…} many {…} other {…}}`，
    需先确认前端 `react-intl` 与 Umi locale 管线对 `one` / `few` 等子键的支持与**回退策略**
    （缺子键时是否会静默回退到 key）。
- **影响**：仅用户可见文案的**语法正确性**，不影响功能与数据。
- **回头动作**：裁决后统一实施，并补一条「复数键存在性」回归护栏。

---

### I18N-02：术语表缺失导致跨语口径散乱

- **现象**：没有权威的 `zh-CN` ↔ `en-US` ↔ 各语**术语表**，5 位语言校对员对同一概念各自定调，
  结果是「**每种语言内部一致，但跨语言不一致**」。
- **具体分歧**：

| 概念 | `zh-CN` 源 | `ja-JP` | `ru-RU` | `es-ES` / `fr-FR` | `en-US` 权威 |
| --- | --- | --- | --- | --- | --- |
| 文件夹 | 目录（源文无「文件夹」） | フォルダ（已统一） | каталог（按源保留） | es: directorio | Folder |
| 密级 | 「密级」与「敏感等级」**源文自身并用** | —— | уровень конфиденциальности | es: nivel de confidencialidad / fr: niveau de confidentialité | confidentiality |
| 备注 | 备注 | メモ（对端私有称呼）vs 備考（备注字段）——**有意区分** | —— | —— | remark / note |
| 昵称 | 昵称 | —— | —— | fr: Pseudonyme（chat）vs Pseudo（账号体系） | nickname |
| 摘要 / hash | 摘要 | —— | —— | es: resumen（upload）vs valor de verificación / hash（component、file） | hash / digest |

- **方案**：新建 `docs/development/i18n-glossary.md`（以 `zh-CN` + `en-US` 为**双权威源**），
  逐条列出「概念 / 权威译法 / 禁用变体 / 依据（对齐 `en-US` 的哪个词）」，
  各语按表回填；并在 `docs/prd/README.md` §7 语言清单处链接该表。
- **注意**：「密级」的分歧**根因在源文**（见 I18N-03）——先定源，再定译。

---

### I18N-03：`zh-CN` 源文案陈旧

- **现象**：`web/src/locales/zh-CN/chat.ts` 的 `chat.list.empty.desc` 仍写
  「点「发起会话」选择同事开始单聊，**或输入群组 ID 发起群聊**」，
  但**手填群组 ID 的通道已从产品中移除**（同文件注释与 `web/src/pages/chat` 的改造记录均指向此）。
- **发现方式**：`ja-JP` 语言校对时对照代码注释发现，并确认 `zh-CN` 源同点位**残留同一句**。
- **为什么不在本次改**：改 `zh-CN` 源会牵动**全部 7 个语言对端**的同一键，
  已超出「校对后增 5 语」的范围；且需先确认产品口径（彻底删除该入口说明，还是保留其他入口）。
- **回头动作**：产品确认后，改 `zh-CN` 源 + 6 个对端语言同点位，并核对 `en-US` 是否同样陈旧。

---

### I18N-04：法式排版规范未落地

- **现象**：`fr-FR` 全部 21 个文件使用**直撇号** `'` 与**普通空格**，
  未使用法式排版的弯撇号 `’` 与标点前**不换行空格**（`« : »`、`« ; »`、`« ! »`、`« ? »`、`« … »`）。
- **规模**：约 **344 处**撇号 + 大量标点空格。
- **为什么不在本次改**：与「每处最小 diff」的校对原则**直接冲突**（会淹没真正的译文修正）；
  且 `en-US` / `zh-CN` 也是同类约定，属**跨语言包样式约定**，需一次全局决策。
- **方案**：作为**独立的格式化任务**执行，并加一条 lint / 单测护栏防止回退。

---

### I18N-05：韩语占位符后助词

- **现象**：韩语助词（`을/를`、`으로/로`）取决于前一字是否有 받침（终声），
  而 `{name}` / `{target}` / `{codes}` 的实际取值**在编写期未知**，单一模板无法正确。
- **受影响键**：`file.recycle.confirmTitle`、`file.destroy.confirmTitle`、`file.restore.done`
  （`"{name}"을`）、`file.move.done`（`"{target}"으로`）、`system.rolePerm.alert.selfLock.desc`（`{codes}를`）。
- **方案**：统一改用**并列式** `을(를)` / `으로(로)`——同文件 `system.role.message.deleted`
  已是 `을(를)` 写法，属**既有先例**；或前端在插值处按终声动态选词（改动大、不推荐）。
- **影响**：轻微语言瑕疵，不影响理解。

---

### I18N-06：校对探针的中日同形词误报

- **现象**：临时校对探针用「值 === `zh-CN` 值 且含汉字」判定漏译，
  对**中日同形同义汉字词**必然误报——`ja-JP` 一次性报出 15 条
  （`操作` / `通知` / `中` / `引用` / `保存` / `方式` / `正常` / `用途` / `成功` 等），
  经逐条核对**全部是合法日语词，非漏译**（旁证：同探针的「简体字形残留」桶为空）。
- **方案**：若要把探针长期留用为 CI 护栏，需二选一：
  - 限定为**简体专有字形**判定（即复用探针里已有的 `SIMPLIFIED_ONLY` 正则），
    放弃「值等于中文」这一粗糙判定；
  - 或维护一份「中日同形词白名单」。
- **注**：探针为**临时文件，已在本次验收后删除**；本项是**下次重建工具时的口径提醒**。

---

### I18N-07：语言覆盖度半成品语言包

- **现象**：`SUPPORTED` 已扩到 **7 种完整语言**（`zh-CN` / `en-US` / `ja-JP` / `ko-KR` / `fr-FR` / `ru-RU` / `es-ES`），
  但 `web/src/locales/` 下仍存在 5 个**只有 7 / 21 个命名空间**的目录：
  `bn-BD` / `fa-IR` / `id-ID` / `pt-BR` / `zh-TW`——均为 Ant Design Pro 脚手架自带的示例语言包，
  未覆盖项目自建的业务命名空间，**缺 14 个命名空间**，缺的键会回退成英文 key 或 `defaultMessage`。
- **影响**：若这 5 个语言**未被 `SUPPORTED` 引入**，则无用户可见影响；
  但目录留着容易被误认为「已支持」。
- **方案（需裁决）**：二选一——**补全**（每语 14 个命名空间，工作量约等于新增 5 语）
  或**从仓库移除目录 / 明确标记为未支持**（推荐后者：成本低且消除误导）。

---

### I18N-08：有意保留的英文残留

- **现象**：探针「疑似未翻译英文」软提示在 5 语中累计出现，经核对**均为有意保留**，
  但没有成文口径：
  - `pages.welcome.hero.title` = `AntTransfer Community Edition` —— **品牌名**，各语一律不译；
  - `upload.mode.octetStream.tag` = `application/octet-stream` —— **MIME 类型**，技术标识，不译；
  - `app.request.http` = `{message} (HTTP {status})` —— 纯技术串（占位符 + 协议名），无需译；
  - `system.userForm.roleOption` = `{name} ({code} · {scope})` —— 纯占位符模板，无自然语言成分。
- **方案**：在 **I18N-02** 的术语表中单列「**禁止翻译清单**」一节，
  让后续所有语言包与探针都按同一口径放行，避免每次校对都重复判断。

---

> **回头检查提醒（项目最后完善阶段）**：本节 8 项的验收顺序建议为
> **I18N-01**（先定机制）→ **I18N-02 / I18N-08**（再定术语与放行口径）→
> **I18N-03 / I18N-04**（再改源与排版）→ **I18N-05 / I18N-06 / I18N-07**（最后收尾）。
> 其中 **I18N-01 与 I18N-02 是其余各项的前置**——先定机制与术语，才不会二次返工。
