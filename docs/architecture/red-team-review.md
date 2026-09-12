# 🛡️ AntTransfer CE 红队评审报告（设计期 · 越权 / 并发 / 事务边界）

| 项 | 内容 |
| --- | --- |
| 评审类型 | 设计期红队（Red Team）——对**已落地代码 + 设计基线 + DDL** 做对抗性审查 |
| 评审主题 | 越权（对象级/垂直越权、鉴权漏洞面）· 并发（竞态、幂等、锁）· 事务边界（事务失效、长事务、一致性） |
| 版本 / 日期 | v1.0 · 2026-09-06 |
| 对象 | `server/` 8 模块（骨架代码）、`sql/`（V1__schema.sql + V2__init_data.sql；原 V3 已于 2026-09-06 并入 V1）、`docs/prd/README.md`、`docs/architecture/*`、`docs/api/*`、`web/src`（模板） |
| 配套 | 修复方向已同步进 [system-design.md](./system-design.md)；两文档编号互通 |

> 评审方法说明：本系统处于“架构/设计基线已定稿、Controller-Service 尚未实现”的阶段，
> 因此发现分为两类：**已存在缺陷**（代码/DDL/文档可证）与 **To-Be 设计缺陷**
> （将在实现时必然产生漏洞或错误的基线口径）。后者同样按缺陷处理并给出红线。

> 发现编号体系：**V-*** = 越权，**C-*** = 并发，**T-*** = 事务边界，**D-*** = 其他安全顺带；
> 编号与 [system-design](./system-design.md) 正文引用互通（如 `[T-01]`、`[C-01]`），两文档须同步维护。

> **口径提示（2026-09-06 二次重置）**：下述各 [T-xx] / [V-xx] / [C-xx] 提出时点，`sql/V1__schema.sql`
> 尚为旧表族命名（`user` / `permission_grant` / `file_object` / `transfer_record` / `transfer_part` /
> `share` 等，逻辑删除列 `is_delete`）。V1 当日二次重置为 `sys_` 前缀 16 表四族
> （`sys_user` / `sys_dept` / `sys_role` / `sys_permission` / `sys_approval_request` /
> `sys_user_file_permission` / `sys_file` / `sys_upload_task` / `sys_share_link` …，`deleted`，
> 完整演进见 `sql/V1__schema.sql` 文件头）。正文表名保留审查时点命名，处置状态以各条「处置」为准。

## 📊 严重度定义

| 级别 | 含义 | 发布门槛 |
| --- | --- | --- |
| **S0** | 阻断（必然造成数据损坏 / 权限击穿 / 架构返工） | 必须修复后才能进入对应功能开发 |
| **S1** | 高（大概率被利用的越权或并发问题） | 相关 P0 功能发布前必须修复 |
| **S2** | 中（边界条件触发，或运维/合规风险） | 1.0 发布前处理或显式接受风险 |
| **S3** | 低 / 备忘 / 文档勘误 | 随手处理 |

---

# 🚷 主题 A · 越权（V-*）

### [V-01] S1 — 对象级（行级）鉴权无统一机制，按 ID 访问接口将天然水平越权

- **位置**：`at-permission/RequirePermission.java`（仅 `String[] value()` 权限点串）、
  `at-auth/RequireLogin.java`；PRD US-04；[system-design §3.1](./system-design.md)
- **问题**：`@RequirePermission("file:download")` 只能表达“该用户有下载权限点”，
  无法表达“能下载 **fileId=42** 吗”。`file:download` 权限点若按 RBAC 授予全员，
  则任何登录用户可遍历 `GET /api/v1/files/{id}/content`、`transfers/{id}/parts`、
  `applications/{id}`、`shares/{id}` 访问他人资源——**典型的水平越权**。
  文档仅承诺“搜索权限收敛”，未定义文件→空间→成员的归属链校验入口。
- **建议（红线）**：见 [system-design §3.1/3.3](./system-design.md)——统一 `AccessControlService` 做资源级判定；
  所有按 ID 查询/操作先校验“当前用户是资源 Owner/成员/被授权人”。禁止出现
  “先 `selectById(fileId)` 再做业务”而无归属校验的实现；代码评审以该入口为强制门禁。

### [V-02] S1 — 数据范围“本人-本部门-全部”无模型支撑，RBAC 三维度无法落地

- **位置**：PRD US-04（“菜单/操作按钮/数据范围（本人-本部门-全部）三维度”）；
  `sql/V1__schema.sql`（`user` 表无 department 概念）；V3 仅申请/授权表
- **问题**：产品验收要求数据范围维度，但无 `department`/`user.department_id`/`role.data_scope`
  字段，也无组织树。实现时要么丢弃数据范围（违约 US-04），要么拍脑袋加列导致 V1 表反复演进。
- **建议**：V4 脚本一次性引入 `department`、`user.department_id`、`role.data_scope`
  （本人/本部门/全部枚举）；列表类查询统一由“权限切面拼数据范围条件”收敛，禁止各 Service 自行拼。
- **处置（2026-09-06）**：已关闭——`department`（ancestors 物化路径）/`user.department_id`/
  `role.data_scope` 随 `sql/V1__schema.sql` 全量重置落地；「列表查询数据范围由权限切面统一拼装」
  约束不变，实现期执行。

### [V-03] S1 — 审批人身份若信任请求参数，可“自己审批自己 / 扮演审批人 / 任意转审”

- **位置**：use-case-flows §2.3 步骤 5（通过/驳回/转审）；`permission_application.approver_id` 字段；
  `ErrorCode.REASSIGN_INVALID(1010)`
- **问题**：若审批接口以请求体携带 `approverId`/`reassignTo` 进行“更新”，
  攻击者只需构造 `PATCH applications/{id}`：① 把 `approver_id` 改成自己（或直接审批自己的申请单）
  ——**自审自批通过，临时授权即刻到手**；② 转审目标任意指定，1010 校验若只查“用户存在”
  而不查“该用户对该资源有审批权”，则把一个无权用户变成审批人。
  另外：`applicant` 同时是空间 Owner 的情况（自己申请自己的资源）需定义为非法或自动通过，需明确。
- **建议（红线）**：审批接口**不接受审批人参数**；`approver_id` 由服务端从当前登录态推导，
  且必须等于申请单当前 `approver_id`（CAS `WHERE id=? AND status=0 AND approver_id=<当前人>`）；
  转审目标须满足：不是申请人 + 是该资源合法审批人（Owner/对应安全管理员）+ 存在；
  禁止审批人等于申请人（自批）——服务端显式拒绝并记审计。

### [V-04] S1 — 敏感级别无数据落点，“高级资源默认拦截”无法实现 → 存在默认放行风险

- **位置**：`FileObject`/`CollaborationSpace` 实体与规划表均无 `level` 列；V3 仅在
  `permission_application`/`permission_grant` 上出现 `level`
- **问题**：PRD US-05 要求“文件默认继承空间级别；高级资源任何非申请通道不得预览/下载”。
  访问判定需要“资源 level”来决定是否必须命中申请授权；没有 level 数据，
  最容易的偷懒实现是“没查到授权就按普通 RBAC 放行”，恰好满足不了“默认拒绝高级资源”。
  且“文件继承空间”要求 `file_object.space_id` 可反查——该列亦缺失。
- **建议**：V4 落 `space.level`、`file_object.space_id`、`file_object.level`（可空=继承）；
  访问判定按“显式等级文件级 > 继承空间级 > 低”解析，全部收敛在 AccessControlService。
- **处置（2026-09-06）**：文件侧已解决——`sys_file.level`/`space_id` 随 V1（sys_ 二次重置）落地；
  `space.level` 与 `collaboration_space` 表族随 at-collaboration 待建（保持开放）；
  文件级「默认拒绝高级资源」判定收敛在 AccessControlService，实现期执行。

### [V-05] S1 — 三权分立互斥只有产品话术，无数据层约束，易被“顺手多勾一个角色”击穿

- **位置**：PRD US-06（“互斥规则在数据层约束”）；V3/规划无互斥承载
- **问题**：若互斥只在 UI 或 Service 一段 if 里，任何绕过（批量导入、管理接口、并发）都可能
  让同一账号同时具备 `system_admin` + `security_admin`，授权与审计闭环被同一个人闭合。
- **建议**：① 服务层：角色变更事务内校验互斥组；② 数据层：管理角色互斥写成
  “互斥组表/常量 + user_role 变更前后都校验 + 唯一约束兜底（如 `user_role(role_group_id)`）”，
  不依赖“只能一段代码校验”。
- **处置（2026-09-06）**：部分——内置角色集随 `sql/V2__init_data.sql` 定稿为
  SUPER_ADMIN / AUDITOR / DEPT_ADMIN / USER（原三权细分职能并入 SUPER_ADMIN，AUDITOR 仍只读审计、
  写操作一律被权限点拒绝）；V1 `role.built_in` 承载内置标记，但管理角色互斥的数据层约束
  仍按建议 ② 留待 at-permission 实现期落地；保持开放。

### [V-06] S1 — 鉴权默认“裸奔”，注解漏标即放行；需默认 DENY + 集中白名单

- **位置**：`RequireLogin`/`RequirePermission` 为“业务自觉标注”模式（Javadoc），
  当前**无拦截器/AOP 实现**（骨架）；api/README §5 白名单端点散落两处（auth/token、refresh、分享下载）
- **问题**：一旦业务 Controller 大量出现，任何“忘记标 `@RequireLogin`”的接口自动变公开接口
  （信息泄露/越权）。红线：把“默认必须校验”做成平台行为而不是开发纪律。
- **建议**：鉴权拦截器对 `/api/**` 默认要求登录（除集中白名单），`@RequireLogin`/`@RequirePermission`
  仅用于声明更细要求；白名单单一文件维护并加“新增端点默认非白名单”的评审提醒；
  新增免登录端点（如分享下载）必须走审批白名单变更流程。

### [V-07] S1 — 外发分享的创建与治理权限若只做“能建链接”，等于把任意文件外传

- **位置**：PRD US-03 / 用例 A；分享实体尚未建表
- **问题**：若 `POST /api/v1/shares` 只校验“登录”而不校验“发起人对源文件的访问/下载权限”，
  普通用户可为**任意文件**（含其无权下载的敏感文件）生成外发链接并发送给外部——
  权限闭环被分享通道旁路。同理，撤销/锁定查询接口若不限创建者/安全管理员，
  任何知道 shareId 的用户可撤销他人分享（DoS/篡改）。
- **建议（红线）**：创建分享前对源文件执行与“下载”等价的 AccessControl；
  分享 token 使用高熵不透明随机串（如 UUIDv4/24B+），禁止自增/可猜测；
  管理操作（撤销/查询/重置提取码）强制校验 `share.owner_user_id` 或安全管理员角色；
  下载通道不携带/不回显原文件存储信息（API README 已约定）。

### [V-08] S2 — 前端令牌存储未定：localStorage 存 access token = XSS 即会话劫持

- **位置**：`web/` 模板态（Ant Design Pro），登录态存储方式未定；
  docs/api/README §7 注明 requestErrorConfig 仍为模板
- **问题**：本项目是文件协作平台，XSS 面来自富文本/文件名回显/分享链接参数回显。
  若 access token 放 localStorage，任意 XSS 可直接盗 token 调用 API（含下载），等效越权。
- **建议**：access token 存内存（刷新/重新登录恢复）或短时效 httpOnly cookie；
  refresh token 走 httpOnly + Secure + SameSite cookie（配 CSRF 防护）而非 localStorage；
  前端渲染一律转义（React 默认）+ CSP 收敛；文件名/分享码等回显做编码。

---

# ⚡ 主题 B · 并发（C-*）

### [C-01] S1 — 权限申请冲突判重非原子：双击/双标签可制造重复申请单

- **位置**：`permission_application` DDL——`idx_applicant_resource(applicant_id, resource_type, resource_id, status)`
  为普通索引**非唯一**；use-case-flows §2.3 步骤 3（1008/1009）
- **问题**：两次并发请求都先“查无在审申请/无生效授权”，随后都插入成功 → 两条 `status=0` 申请单，
  审批人看到重复待办、审批两次产出两条授权。因“驳回后可再次申请”业务合法，不能简单把
  `(applicant,resource,type,status)` 建唯一（历史驳回会与新申请同状态不同行、或状态复用冲突）。
- **建议**：给表增加活动态单飞列，例如 `dedupe_key`（活动态=`md5(applicant_id|resource_type|resource_id|apply_type)`，
  进入终态后置 NULL）+ 该列唯一索引；插入时携带 `INSERT ... ON DUPLICATE KEY` 感知 1009。
  或申请入口用 Redis `SETNX(at:apply:{uid}:{res}, 1, EX=xx)` 前置判重（DB 唯一约束仍为最终防线）。

### [C-02] S1 — 审批“通过/驳回/转审/撤销”并发：重复审批、状态漂移、重复授权

- **位置**：use-case-flows §2.3 步骤 5；申请状态机 0→1/2/3/4
- **问题**：同一申请单可能被“当前审批人”与“转审后的审批人”（或兜底安全管理员、超管运维）
  同时操作；若实现为 `updateById` 直改，后写覆盖先写 → 驳回后被通过（越权授予）。
- **建议（红线）**：所有审批动作执行 CAS：
  `UPDATE permission_application SET status=<目标>, opinion=?, approver_id=<当前审批人>
   WHERE id=? AND status=0 AND approver_id=<当前审批人>`；
  影响行数≠1 ⇒ 抛 4102/明确冲突（流程已变化），并提示前端刷新。事件/通知以提交后唯一一次为准（防重键）。

### [C-03] S1 — 授权到期回收与访问判定：需要明确“在途下载不中断”语义并防误杀

- **位置**：use-case-flows §2.3 步骤 9 / §2.4（称“无竞态窗口”）
- **问题**：访问判定 `status=1 AND expire_at>now` 单查是原子的（正确）；
  但**已开始的下载**在授权恰好到期时是否中断？若流式校验贯穿整个下载过程，
  大文件下载中回收会切断在途传输；若不校验，则存在“到期后仍在下载”的窗口。
  另有回收定时任务与访问并发：回收先 UPDATE 后新访问自然拒绝，顺序安全。真正要定的是语义。
- **建议**：明确 **“授权校验只在请求入口做一次，在途下载/上传不因到期中断”**（与多数下载器语义一致），
  并写入 use-case-flows 与测试用例；回收只处理 DB 状态，不打断已打开流。

### [C-04] S2 — 到期回收定时任务：需幂等 + 多副本防重入

- **位置**：use-case-flows §2.4（“回收是幂等写”）
- **问题**：回收本身幂等（CAS 条件更新），但**事件/通知**若不防重，重复触发会重复通知申请人；
  且基线“单机 Compose”，一旦多副本/多实例部署，多个定时器并发扫同一批授权——DB CAS 幂等可兜底，
  但需明确调度锁（`ShedLock` 或 DB `SELECT ... FOR UPDATE` 的批处理游标）。
- **建议**：回收批处理采用一条原子 UPDATE + 影响行数返回再发事件；部署多副本前引入调度锁；
  事件带 `application_id` 幂等键，监听侧去重。

### [C-05] S1 — refresh token 轮换与重放检测的实现难度被低估，易做成“永远有效的登录”

- **位置**：PRD US-07（轮换 + 同 RT 二次使用吊销全部会话）；无 at-auth 实现
- **问题**：若 RT 只做 JWT 无状态签名验证（无服务端状态），则无法实现“一次使用即失效”
  与“被盗重放吊销”——这正是双令牌安全性的核心承诺。骨架尚无任何 Token 存储设计落地。
- **建议**：RT 必须落 Redis 白名单（键 `at:token:refresh:{userId}`，值=最新 refresh 指纹）并**原子轮换**
  （Lua：`GETDEL` 后比对，匹配才 `SET` 新值）；检测到复用旧值 ⇒ bump 会话纪元
  （`sys_user.token_epoch + 1`）并 DEL RT / 失效 AT，要求重新登录；
  相关实现要点与 access 吊销模型（DB 权威纪元，见 [system-design §2](./system-design.md)）。

### [C-06] S1 — 传输任务状态迁移与分片进度更新：读-改-写与并发累加必须禁止

- **位置**：`TransferRecord.status/transferredSize`；use-case-flows §1.1 步骤 4/5
- **问题**：① 前端“开始/暂停/取消/合并”与“分片到达”并发：若 Service 层 `select→if→update`，
  两个请求同时读到 `status=1`，一个置 3 已完成、另一个仍可置 5 已取消——终态被覆盖；
  ② `transferredSize` 若用“查当前值+1+回写”，≤5 并发分片必然丢计数（进度跳变，违反 US-01 验收）；
  ③ 原状态机没有“合并中”，merge 的长处理期间状态仍是“传输中”，前端可再次触发 merge/取消。
- **建议（红线）**：全部迁移走 CAS（`UPDATE ... WHERE id=? AND status=<期望源态>`，行数≠1⇒4102）；
  状态机补 `6 合并中`（[system-design §5.1](./system-design.md)）；进度条由 `transfer_part` 聚合派生或
  `transferred_size = transferred_size + ?` 原子累加，禁止读改写。

### [C-07] S1 — 秒传/合并的并发去重：同文件同时上传会物理双份或唯一约束撞车

- **位置**：PRD US-02（“同一文件只上传一次，不得重复落盘”）；`FileObject.sha256` 无唯一约束
- **问题**：两个用户（或同用户双会话）同时上传同 SHA-256 文件：① 若不做任何唯一约束，两次
  merge 都成功 → 物理存两份，违约 US-02；② 若粗暴建 `(sha256,size_bytes)` 唯一索引，
  “上传中(status=1)”与“可用(status=0)”同哈希共存即冲突，正常业务被 500。
- **建议**：秒传键以独立唯一载体实现，例如去重表
  `file_dedupe(sha256 char(64), size_bytes bigint, file_id bigint, unique(sha256,size_bytes))`
  与 `file_object` 分离；merge 完成时以 `INSERT ... ON DUPLICATE KEY` 幂等收敛：已存在则
  复用既有 `file_id`，本地新副本进孤儿清理（T-04）或立即回收。

### [C-08] S1 — 外发下载“次数上限”非原子扣减会超卖；提取码错误计数非原子会漏锁

- **位置**：PRD US-03（默认 10 次、错 5 次锁 30 min）；`share` 表未建
- **问题**：并发第 10/11 次下载若“先查 used<10 再 used+1 写回”，两个请求都通过检查 →
  实际下载 11 次仍只算 10（超卖窗口）；提取码校验失败计数若“读-写”，并发 5 次错误可绕过锁定。
- **建议（红线）**：次数扣减用单条原子
  `UPDATE share SET downloaded_count=downloaded_count+1 WHERE id=? AND downloaded_count<download_limit`（行数=1 才继续发流）；
  错误计数用 Redis `INCR`+`EXPIRE`（滑动窗口计数）；分享字段 `download_limit/download_used/error_count/locked_until` 入 V4 DDL。

### [C-09] S2 — 取消/暂停与分片写入并发：需要“写后状态检查 + 残留清理”双保险

- **位置**：use-case-flows §1.1 步骤 4；状态机含 5 已取消
- **问题**：分片 PUT 与取消并发时，分片校验通过、状态检查通过后、写盘前用户取消——
  迟到的分片仍落盘；若无后续清理，临时分片 24 h 后靠定时任务清即可（容忍），
  但若合并/删除逻辑与迟到的分片碰撞则需保证不误判“分片齐全”。
- **建议**：分片写入后再次核对任务非终态（终态则丢弃+标记孤儿）；merge 只认
  `transfer_part` 与任务状态双一致；孤儿分片统一由清理任务按任务创建时间回收。

### [C-10] S2 — 上传并发上限（≤5/任务、活动任务 ≤50）无实现载体

- **位置**：PRD §7 并发基线；`TRANSFER_LIMIT_EXCEEDED(4103,429)`
- **问题**：429 语义已定义但无限流组件落地；若不加控制，单用户可开上百连接并发传分片，
  拖垮连接池/磁盘 IO（违反“超限排队而非崩溃”）。
- **建议**：at-transfer 入口做 Redis 计数或本地令牌桶（每任务 ≤5 片在途、活动任务 ≤50），
  溢出抛 4103；多实例时计数放 Redis，单实例可本地实现并预留 Redis 切换。

---

# 🧱 主题 C · 事务边界（T-*）

### [T-01] S0 — 跨模块写编排没有事务载体：上传主线“写 file_object + transfer_record”与依赖铁律冲突

- **位置**：use-case-flows §1.1 步骤 7（at-transfer+at-file 双模块落库）；
  根 `pom.xml` 铁律 1（at-* 禁止互相依赖）
- **问题**：若遵守“at-transfer 不得依赖 at-file”，则“建 file_object + 改 transfer_record +
  标 part 状态”无法放进一个事务方法——拆两个事务则出现“文件元数据已建但任务仍传输中”
  或“任务已完成但无文件记录”的中间态（下次 merge 重试可能重复建 file_object）。
  若破坏铁律直接依赖，模块边界形同虚设。
- **建议（S0 阻塞项）**：采用 **SPI 依赖倒置**（[system-design §1.2](./system-design.md)）：
  在 at-common（或 at-file 的 `api` 子包）定义文件仓储**接口**，at-file 实现之；
  at-transfer 的编排 Service 注入接口并在**同一事务**内完成双表写入。评审门禁：跨模块写
  必须出现在“编排者”服务的一个 `@Transactional` 内；禁止“先写成功再另发事件补写”。

### [T-02] S0 — use-case-flows §2.3 步骤 6/7 自相矛盾：“事件后写授权表”与“授权不留空档”不可能同时成立

- **位置**：use-case-flows §2.3 步骤 6（事务提交后发布事件）→ 步骤 7（监听方写授权表）；
  同文 §2.4“授权不留空档……与访问判定无竞态”
- **问题**：若授权记录**在审批事务之外**（由事件监听方写），则：① 事务提交成功但监听写库失败/
  应用随后宕机 → 审批状态=通过但 `permission_grant` 缺失 → 申请人以为有权限却被拒；
  ② 监听重复执行（重试）→ 重复授权行；③ “无空档”断言不成立。这是把“写关键业务状态”放在
  “非关键事件路径”上的典型设计错误。
- **建议（S0，需修订 use-case-flows §2.3）**：授权写入（`application.status=1` 与
  `permission_grant` 插入）**必须在同一审批事务内完成**；`PermissionGrantEvent` 仅在
  `AFTER_COMMIT` 发布，负载仅承载通知/审计等非关键副作用（接收方失败不影响授权事实）。
  本项与 [C-03] 的“无空档”语义共同构成审批闭环的一致性基线，已写入 [system-design §5.2](./system-design.md)。

### [T-03] S0 — 文件合并/重组（IO、GB 级）不得放进 DB 事务：长事务与事务内做 IO

- **位置**：use-case-flows §1.1 步骤 5/6（重组+整件 SHA-256）；状态机
- **问题**：若“merge 服务”整体加 `@Transactional`，重组 10 GiB 分片 + 重算 SHA-256 期间
  持有数据库连接与行锁数分钟：连接池打满（池仅 20）、binlog/undo 膨胀、影响所有其他接口
  ——同时与“取消”互锁。
- **建议（红线）**：DB 事务只包裹“**状态迁移 + 元数据落库**”的短操作；
  重组/校验 IO 放事务外，通过 CAS 先进 `6 合并中`（[T-01]/[C-06] 状态机）占位，
  IO 完成后一条短事务 `UPDATE ... SET status=3` + 落 `file_object`；失败则回 `4 失败` 可重试；
  重复 merge 由 CAS 拒绝。**评审门禁：任何 `@Transactional` 方法体内禁止文件流与远程调用。**

### [T-04] S2 — 存储介质与 DB 元数据无法同原子：孤儿文件/分片与秒传副本回收需补偿机制

- **位置**：at-file 存储层（本地/对象存储）；PRD §7 可用性口径
- **问题**：分片写盘成功但任务记录/part 表失败 → 孤儿临时分片（已有 24h 保留策略）；merge
  落库失败但重组文件已在磁盘 → 孤儿整件；秒传冲突（[C-07]）产生的多余物理副本。
  若不做回收：磁盘被孤儿占满；若回收太激进：误删在途数据。
- **建议**：按“创建时间 + 无活跃任务”两条件清理；对象存储键设计支持前缀扫描
  （`uploads/{yyyy}/{mm}/{taskId}/...` 便于清 key）；清理任务与文件操作不要求同事务，
  但删除前必须复核 `transfer_record`/`file_object` 引用（防删在用的）。

### [T-05] S1 — 审计写入的事务边界与“不可篡改、留存 ≥6 个月”的实现路径缺失

- **位置**：PRD US-06/§7（审计不可改删、留存 180 天可配）；`AuditSink` 仅为扩展点话术
- **问题**：① 审计与业务是否同事务？同事务则审计失败回滚业务（可用性风险）；不同事务则业务成功
  但审计丢（合规违约）；② “不可修改/删除”若无实现约束（服务不提供审计 update/delete 通道、
  DB 账号无 DML 权限），基本只能靠纪律；③ 留存 180 天意味着必须有删除/归档任务——与“不可删除”需并存解释。
- **建议**：审计写采用 **AFTER_COMMIT 异步 + 落库失败重试/告警**（审计可缺失性低于业务，但必须有
  补偿队列）；审计表对应用服务只暴露 insert/select；归档任务=导出（对象存储/CSV）+ 物理删除，
  审计日志只增（append-only），物理删除仅限归档组件使用受限账号执行；`AuditSink` 作为 SPI 预留 ES。

### [T-06] S2 — AFTER_COMMIT 事件投递无可靠性保障：通知“必达类”会丢

- **位置**：use-case-flows §2.1 领域事件；PRD US-08（审批待办为必达类型）
- **问题**：`@TransactionalEventListener(AFTER_COMMIT)` 后监听方异步处理，进程崩溃即丢事件；
  审批通过但申请人永远收不到通知。通知虽非授权关键路径，但属 US-08 验收项。
- **建议**：通知/待办落一张 `notification`（或 outbox）表并在**业务事务内**一并写入
  （与业务同原子，代价小），事件仅触发“异步推送/邮件”；多端已读同步用 CAS，不产生重复待办。

### [T-07] S2 — V1 `user` 表遗留自增主键与 camelCase，与新规约冲突且可枚举 ID 放大遍历面

- **位置**：`sql/V1__schema.sql`（`user.id bigint auto_increment`、`userAccount` 等 camelCase）
  vs `BaseEntity`（ASSIGN_ID 雪花）+ V3 snake_case 规约
- **问题**：① at-auth 若用 MP + `BaseEntity` 写 user 表，全局 `id-type: assign_id` 与表自增语义打架；
  ② 自增 ID 可顺序枚举，登录/注册接口若泄露用户 ID，横向遍历成本为零；
  ③ 一张表两种命名风格，`map-underscore-to-camel-case` 对 camelCase 列反而要显式 `@TableField`。
- **建议**：V4 对 `user` 表做演进迁移：主键改雪花语义（停止自增用法，存量自增行保留）、
  列更名 snake_case（或 as-is 显式映射并冻结）；脚手架 `post/post_thumb/post_favour` 无业务占用，
  明确下线/冻结，避免新代码误用。
- **处置（2026-09-06）**：已关闭——`sql/V1__schema.sql` 二次重置：旧表族（含 `user`）废弃，
  `sys_user` 为雪花主键 + snake_case（username/password_hash/…），逻辑删除 `deleted`；
  脚手架 `post/post_thumb/post_favour` 已从 V1 移除。

### [T-08] S2 — 时间写入者与时钟口径未统一：update_time 双写方 + 授权过期判定跨时钟源

- **位置**：`BaseEntity.updateTime`（FieldFill.INSERT_UPDATE，应用写）vs V1 DDL
  `on update CURRENT_TIMESTAMP`（DB 写）；JDBC `serverTimezone=Asia/Shanghai`、容器 `TZ=Asia/Shanghai`
- **问题**：同一列两个写入方并存（应用填充与 DB on-update 都会生效，语义混乱、难以排查）；
  `permission_grant.expire_at` 若由应用 `LocalDateTime.now()` 生成、回收判定用 DB `now()`，
  二者同机房通常一致，但容器时区/主机时区错配或 DST 场景会漂移 → 提前回收或延迟回收。
- **建议**：统一“DB 权威时钟”：审计/时间戳保留 DB `DEFAULT CURRENT_TIMESTAMP`（去掉
  `on update` 或统一由应用填充，**二选一**）；授权到期比较一律用 SQL 侧
  `expire_at <= NOW()`（应用只传阈值参数），杜绝双时钟。

### [T-09] S2 — 事务内禁止远程调用/Redis 关键写，双写顺序需成文

- **位置**：at-file 对象存储、Redis 会话（at-auth）、限流（at-transfer）
- **问题**：把对象存储 PUT/Redis 操作放进 DB 事务，会出现“事务回滚但远端已生效”或
  “DB 提交成功但 Redis 写失败”的不一致；基线“DB 为主、Redis 为加速”须细化到编码红线。
- **建议**：事务内只允许 DB 访问；Redis 写入放事务后或做成可容忍丢失的加速缓存；
  需要强一致的双写场景（令牌吊销）明确“先 DB 后 Redis + 补偿清理任务”或
  “以 DB 状态为准、Redis 丢失自愈”。

---

# 🧰 主题 D · 其他安全顺带发现（D-*，非本次主题但临近）

### [D-01] S2 — CORS 全放开 + allowCredentials 的组合在生产是越权放大器

- **位置**：`at-gateway/GatewayWebConfig.java`（`allowedOriginPatterns("*")` + `allowCredentials(true)`）
- **问题**：任意站点可带凭证跨域读取本服务响应（若登录态走 Cookie 则直接 CSRF/跨域读取面）。
  当前 dev 语义可接受，但 Javadoc 已注明需收敛——须在发布前做成配置项白名单。
- **建议**：prod 从配置读 `cors.allowed-origins`；凭 Cookie 场景同源部署优先（反代同域），
  需跨域时显式白名单，不匹配的 Origin 一律不返回 CORS 头。

### [D-02] S2 — X-Trace-Id 入站未清洗：MDC/日志注入与审计关联污染

- **位置**：`at-gateway/filter/TraceIdFilter.java`（直接透传请求头 `X-Trace-Id` 进 MDC）
- **问题**：恶意客户端可携带含换行/控制字符/超长字符串的 traceId，污染日志行、伪造跨用户
  审计关联（用受害者的 traceId 批量请求制造“关联”干扰取证）。
- **建议**：入站 traceId 白名单校验：`[A-Za-z0-9-]{1,64}`，不合法即忽略并重生成（不拒绝请求）。

### [D-03] S1 — 登录防爆破/账号锁定/限流（1005/429）只有错误码，无机制

- **位置**：`ACCOUNT_LOCKED(1005)`、`SHARE_LOCKED(4011)`、`TRANSFER_LIMIT_EXCEEDED(4103)`
- **问题**：登录接口是暴力破解与密码喷洒的天然目标；提取码 5 次锁定若只在前端判断等于没有。
- **建议**：登录/refresh 做 IP+账号维度 Redis 计数（如 5 次/分钟临时禁 + 阈值后账号锁定）；
  与 [C-08] 提取码锁定、[C-10] 上传限流共用一个限流工具（Redis 原子计数）。

### [D-04] S3 — 初始凭据与散列策略未定：`root/123456` 默认值只允许在 dev

- **位置**：`application.yml`（DB_PASSWORD 默认 123456）、docker-compose 默认值、PRD §7（TLS）
- **问题**：默认口令+明文默认值在“复制配置即上线”场景是灾难；密码散列算法未定。
- **建议**：密码一律 BCrypt（cost≥10）；compose 提供 `.env.example` 强制占位并在 prod
  文档置顶“修改默认口令”；对外网部署强制反代 TLS（PRD §7 已述，落地在部署脚本检查）。

### [D-05] S3 — 文档勘误：`ResultUtils` 不存在 / 时序文档待修订

- **位置**：architecture/README §横切（“`ResultUtils` 快速构造”）；实际 at-common 仅 `Result` 静态工厂；
  use-case-flows §2.3 步骤 6/7 待按 [T-02] 修订
- **建议**：随 [T-02] 修订一并更新两处文档引用，消除误导。

---

# 🏁 结论与发布门禁

## 📋 汇总

| 主题 | S0 | S1 | S2 | S3 |
| --- | --- | --- | --- | --- |
| 越权 | — | V-01~V-07 | V-08 | — |
| 并发 | — | C-01/C-02/C-03/C-05/C-06/C-07/C-08 | C-04/C-09/C-10 | — |
| 事务边界 | T-01/T-02/T-03 | T-05/T-06 | T-04/T-07/T-08/T-09 | — |
| 其他顺带 | — | D-03 | D-01/D-02 | D-04/D-05 |

## 🚦 发布门禁（Gate）

1. **任一 P0 功能开发前**：关闭 T-01（跨模块编排事务）、T-03（事务内禁 IO）；
2. **审批闭环开发前**：T-02（授权写表入审批事务）修订 use-case-flows；
3. **鉴权体系上线前**：V-06（默认 DENY 拦截器 + 白名单）、V-01（对象级鉴权入口）；
4. **P0 整体发布前**：V-05（三权互斥数据约束）、V-03（审批身份服务端推导）、C-01（申请判重唯一化）、
   C-08（次数/计数原子）、D-01（CORS 白名单）、D-02（traceId 清洗）、D-03（登录限流）；
5. **代码评审红线速查**：读改写禁用（P-1）、`@Transactional` 内禁 IO/远程（P-2/T-03）、
   跨模块写必须同事务编排（T-01）、状态迁移一律 CAS 行数校验（C-06）、
   按 ID 资源访问必须过 AccessControlService（V-01）。

## 🔁 需要回改的既有文档/基线清单

| 文件 | 修改项 | 关联 |
| --- | --- | --- |
| `docs/architecture/use-case-flows.md` | §2.3 步骤 6/7：授权写表移入审批事务，事件仅承载通知/审计 | T-02 |
| `docs/architecture/use-case-flows.md` | §1.1 状态机补 `6 合并中`；§2.4“无空档”注释补“入口判定一次、在途不中断” | C-06/C-03 |
| `docs/architecture/README.md` | “ResultUtils”→`Result` 静态工厂 | D-05 |
| `docs/development/README.md` | “ResultUtils.success/error”→`Result.ok/fail`（同类勘误，一并修正） | D-05 |
| `server/at-transfer/.../TransferRecord.java` | Javadoc/字段注释状态机补 `6 合并中`（与文档保持同步） | C-06/T-03 |
| `docs/architecture/system-design.md` | §2.1~2.3：access 吊销重构为“DB `sys_user.token_epoch` 权威 + Redis 缓存 / 白名单”（废除逐 jti 黑名单 `at:deny`）；refresh 键定稿 `at:token:refresh:{userId}` | C-05 |
| `docs/architecture/system-design.md` | §5.3 + 新增 §7.1：分享次数 DB 原子裁决 + Redis 前置配额闸；Redis Key 规划表落地（镜像 at-common `RedisKeyConstants`） | C-08 |
| `server/at-common/.../RedisKeyConstants.java` | 新增：`at:` 前缀 Key/TTL 常量 + 键工厂方法（2026-09-06，会话吊销纪元 / 前置配额闸语义随 C-05/C-08 定稿） | C-05/C-08 |

> 上表前三项及随附的同类勘误/实体注释同步已于 **2026-09-06 回写完成**。
> 2026-09-06 追加：认证吊销与分享次数口径随 at-common `RedisKeyConstants` 定稿一并回写
> （system-design §2 / §5.3 / §7.1 与 red-team [C-05] / [C-08]）；`sys_user.token_epoch`
> 增列迁移在 at-auth 会话实现时随 Flyway V3 提供。
> `sql/` 表族已于同日全量重置为 V1（18 表），原「V4 待写」的表/列多已落地
> （见 [system-design §4.1 表族地图](./system-design.md) 状态列）；内置角色 / 权限点等
> 枚举主数据随 `V2__init_data.sql`（2026-09-06）初始化。

> 本报告为设计期红队，随实现进度应**按模块迭代复评**（尤其认证与审批落地后），
> 并将新增发现追加到对应章节。
