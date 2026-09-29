# ⚙️ 核心用例时序（Use-Case Flows）

> 🎯 三条闭环的系统级时序：**上传主线**（传输引擎）、**权限审批主线**（RBAC 标准流程）与
> **站内通知 / 轻 IM 主线**（2026-09-29 补齐，见 §3）。
> 🔗 关联：[PRD §5](../prd/README.md#5-主用例时序描述文字版)、[API 规范](../api/README.md)、[错误码](../api/error-codes.md)、[架构](./README.md)。
> ✅ 状态：**主线均已落地**（上传 2026-09-14、外发分享 2026-09-13、审批 2026-09-29 复核、
> 站内通知与轻 IM 2026-09-29）。本文件为落地口径的时序基线，实现须与其中步骤、错误码及表结构一致。

## 0️⃣ 📌 阅读约定

- 步骤以「前端 → 服务端」为主视角；`code` 指 `Result.body.code`（业务判据），括号内为 HTTP 状态。
- 表均为 Flyway 新增脚本（`sql/V{n}__*.sql`），**禁止回改已发布脚本**。
- 错误码遵循 `error-codes.md` 分段；审批新增码建议落在 `1xxx` 剩余段（1008 起），见 §2.5。

---

## 1️⃣ ⬆️ 上传主线

**参与模块**：`at-transfer`（任务/分片/合并）、`at-file`（元数据落库）。
**设计要点**：双层 Hash —— ① 整件 SHA-256 = 秒传键（存 `sys_file.sha256`）；② 每分片 SHA-256 = 传输校验。二者职责不同，缺一不可。

### 1.1 时序步骤

| # | 步骤 | 行为 | 正常出口 | 分支 / 错误 |
| --- | --- | --- | --- | --- |
| 1 | 计算全文件 Hash | 前端先对整件算 SHA-256（秒传键），再按 8 MiB 切分并逐片算分片 Hash | 本地完成，附带整件摘要与分片清单进入预检 | — |
| 2 | 秒传检查 | `POST /api/v1/transfers/precheck`，携带 `sha256 + sizeBytes + fileName`；服务端按 `sys_file.sha256(+长度)` 查重 | **命中**：返回既有 `fileId`，秒传完成（P95 < 5 s，US-02），不落新物理副本 | **未命中**：`code=4001`（HTTP 200 分支码），`data` 附 `uploadId / chunkSize / chunkCount`，进入下一步 |
| 3 | 查询已传分片 | `GET /api/v1/transfers/{id}/parts`，返回 `{ received: [已收分片索引], chunkSize }` | 首传 `received=[]` 同样走此入口 → 保证「首传」与「断点续传」共用同一收敛逻辑 | 任务不存在：`4101` |
| 4 | 并发上传分片 | `PUT /api/v1/transfers/{id}/parts/{index}`；并发 ≤ 5、单片 ≤ 8 MiB，逐片校验分片 Hash 后写临时分片（先写 `.tmp` 再原子改名，半个分片不计入已收）；原子累加 `TransferTask.transferredSize` | 全部分片就绪 | 单片失败：`4008`（保留已传分片可续传）；状态冲突：`4102`；超并发/流量：`4103` |
| 5 | 合并 | `POST /api/v1/transfers/{id}/merge`：先 CAS 迁移任务 `1 传输中 → 6 合并中`，随后在**数据库事务外**重组文件（长 IO 不进事务，避免占用连接池与行锁） | 分片齐全，进入合并中 | **缺片**：`4002`（HTTP 200 分支码），`data` 附 `missing: [...]`，回 §1.1-3；源状态非 `1`（非传输中）：`4102` |
| 6 | SHA-256 完整性校验 | 重组后服务端**整件重算** SHA-256，与步骤 1 上报值比对（仍在事务外） | 一致 | **不一致**：`4003`（409），CAS 置任务 `status=4 失败` 并提示重传 |
| 7 | 落库（短事务） | CAS `6 合并中 → 3 已完成` 的**短事务**内写 `sys_file`（`status=0 可用`，含 `sha256`）与 `sys_upload_task`（`status=3 已完成`）；**入库前经 `FileScanPipeline.assertClean`**（`ContentScanInterceptor` 链，见 [`architecture.md` §2.3](./architecture.md)）；事务提交后（`AFTER_COMMIT`）发布 `FileUploadedEvent` 供审计/后续处理管道监听；合并完成另由 `TransferEventPublisher` 发布 `TransferCompletedEvent`（通知域消费，发布失败只留痕） | `code=0`，返回 `fileId` | DB 异常：`5002`（整体回滚，任务保持 `6 合并中`，merge 可幂等重入）；兜底：`5001`；扫描命中：`4007`（拒登记 + 审计，**不删物理内容**） |

**任务状态机**（与 `TransferRecord` Javadoc 一致，实体注释已同步补 `6 合并中`）：
`0 排队 → 1 传输中 ⇄ 2 暂停`、`1 → 6 合并中 → 3 已完成`、`0/1/2/6 → 4 失败（可重试回 0）/ 5 取消`。
状态迁移一律 CAS（`UPDATE ... WHERE id=? AND status=<期望源态>`，影响行数≠1 ⇒ 流程已变化 `4102`），禁止「查-判-改」读改写。合并中断残留于 `6` 时可按同任务幂等重入（临时文件可覆盖，落库短事务为唯一原子点，[红队 T-03](./red-team-review.md)）。

### 1.2 ⏸️ 暂停 / 恢复（意图登记，非服务端闸门）

| # | 步骤 | 行为 | 正常出口 | 分支 / 错误 |
| --- | --- | --- | --- | --- |
| 1 | 用户点「暂停」 | 前端**先 `AbortSignal.abort()` 掐断在途分片请求**（即时止血，不等服务端），本地置 `paused`；随后 `PATCH /api/v1/transfers/{uploadId}`（`action=pause`）作 **best-effort 意图上报** | 本地立即暂停；服务端 CAS `0 排队 / 1 传输中 → 2 暂停` | 上报失败**不阻断**本地暂停（续传时由 `/parts` 对账自愈，见步骤 3） |
| 2 | 暂停期在途分片落库 | 已发出、已到达服务端的分片仍按 CAS 写入，**写入时保持 `2 暂停`、不反推为 `1 传输中`** | 已收分片不丢、进度不倒退 | — |
| 3 | 用户点「继续」 | 前端重走预检 / 对账；若服务端回 `status=2` 且本地未处于 abort 态，补发 `PATCH ... action=resume` | 服务端 CAS `2 暂停 → 0 排队 / 1 传输中`（目标态按已收分片判定） | 已是目标在途态则**幂等成功**，不报错 |
| 4 | 重复 / 非法动作 | 同一动作重复上报；任务已终态；任务处于 `6 合并中` | 重复上报 → 幂等成功 | 终态 `3/4/5` → 按「不存在」`4101`；`6 合并中` → `4102`；`action` 非法 → `2003` |

> 🎯 **设计口径**：暂停是**意图登记**而非服务端闸门——服务端不主动打断在途分片，避免「abort 与落库竞态」制造伪 `4102`；
> 真正止血由前端 `AbortSignal` 完成，服务端只负责记录「用户想停」并在续传时给出正确目标态。
> 因此「暂停」与「取消」语义不同：**暂停保留暂存分片与票据（可续传），取消清理暂存目录（不可续传）**。

### 1.3 现状核对（上传）

| 项 | 现状 | 结论 |
| --- | --- | --- |
| 实体 | `TransferTask`（表 `sys_upload_task`：`status` / `fileSize` / `chunkSize` / `chunkCount` / `uploadedIndexes` / `transferredSize` / `parentId`）、`sys_file_object.sha256` 唯一键已具 | 满足 |
| 错误码 | 4001/4002/4003/4008/4101~4103 已定义 | 满足 |
| API 契约 | `precheck` / `GET parts` / `PUT parts` / `merge` / `DELETE` / **`PATCH`（暂停 / 续传）** 六端点**已落地**（`at-transfer` 的 `TransferController`）；分片字段名 `chunk` / `hash`、索引以路径为准、`received` 回**索引数组**（非计数）、`GET parts` 回任务 `status`，与前端 `uploadApi.ts` 逐字对齐 | ✅ 已落地（2026-09-14；暂停 / 续传 2026-09-20） |
| 分片索引持久化 | `sys_upload_task.uploaded_indexes`（JSON 已传分片索引）已随 2026-09-06 `sql/V1` 二次重置落地；读改写随任务行 `SELECT ... FOR UPDATE` 同事务 | 满足 |
| 双层 Hash | §1.1-1/6 已定义；分片级与整件级 SHA-256 **均由服务端重算**（不信任客户端上报） | 满足 |
| CE/EE 扩展点消费 | 入库前 `FileScanPipeline.assertClean` → `ContentScanInterceptor`（接口在 at-common `spi.scan`，CE 默认 `SuffixAndKeywordScanInterceptor` **真实生效**）；下载侧 `WatermarkProvider`、存储读写织入 `CryptoCodec`（`CodecResource`） | ✅ 已落地（2026-09-29） |

---

## 2️⃣ 🔐 权限审批主线（RBAC 标准流程）

**参与模块**：`at-permission`（申请/审批/授权判定，主）、`at-auth`（当前用户/审批人身份）、`at-collaboration`（资源归属与通知域监听）、`at-common`（审计事件/`AuditSink` 扩展点）。

**申请单要素**：`apply_type`（ACCESS/DOWNLOAD/EDIT/SHARE）+ `resource`（`resource_type`/`resource_id`）+ `purpose`（目的/理由）+ `desired_expire_at`（拟授权到期时刻，默认申请 24 h，批复可调整）。

### 2.1 📡 领域事件（进程内 `ApplicationEventPublisher`，事务提交后发布）

| 事件 | 发布方 | 监听方 / 效果 |
| --- | --- | --- |
| `PermissionApplicationSubmittedEvent` | at-permission | 路由到审批人**待办 + 站内通知**；写审计 |
| `PermissionGrantEvent` | at-permission（审批通过，事务提交后） | ① 通知申请人 ② 写审计（**授权记录在审批事务内写入，见 §2.3-5；事件不承载关键写**） |
| `PermissionExpiredEvent` | at-permission（到期回收任务，PermissionGrantExpireScheduler） | 撤销授权状态；写审计；通知申请人（可选） |
| `FileUploadedEvent` | at-file | 审计/后续处理管道（复用 PRD §8 管道 Hook） |
| `TransferCompletedEvent` | at-transfer（合并成功，**事务提交后**） | at-collaboration 通知域监听 → 传输完成站内提醒（`NotifyType 8`）；**发布失败只留痕**，已落库的传输结果不回滚 |

> 💡 模块化单体进程内事件即可；将来外发 MQ/异步化不改变事件语义（仅换通道），属扩展点。

### 2.2 🗄️ 数据表（Flyway 脚本已落地）

> 📌 权威 DDL 见 [sql/V1__schema.sql](../../../sql/V1__schema.sql)（审批与授权族：`sys_approval_request` /
> `sys_approval_node` / `sys_user_file_permission`，2026-09-06 二次重置并收敛原 V3 语义），
> 本文档不再整段复制 DDL，以防双源漂移。要点：申请单 `uk_application_no` 单号唯一、
> `idx_applicant_resource` 支撑活动态判重；授权表 `grant_source`（1-角色继承 / 2-审批获得）、
> `expire_at` 时效与 `idx_user_expire(user_id,status,expire_at)` / `idx_expire(status,expire_at)` 回收扫描。

**判定合并**：资源是否可访问 = **角色静态权限**（RBAC，at-permission 现状） ∪ **生效授权**（`sys_user_file_permission` 中 `status=1 且 expire_at > now`）。两路都拒绝才返回 `1003 NO_AUTH` 并引导申请。

### 2.3 📋 时序步骤

| # | 步骤 | 行为 | 正常出口 | 分支 / 错误 |
| --- | --- | --- | --- | --- |
| 1 | 无权限访问 | 用户访问/下载未授权资源，权限判定拒绝 | 页面展示 `1003`（403），并给出「申请访问」入口 | — |
| 2 | 提交申请 | `POST /api/v1/permission/applications`，提交申请要素：`apply_type + resource(resource_type/resource_id) + purpose + desired_expire_at`；级别自动带出 | 生成 `status=0` 申请单 | 参数非法：`2xxx`；级别与目标不符：`2005` |
| 3 | 冲突校验 | 系统校验：同人同资源**已有生效授权** → 提示直接可用；**已有进行中申请** → 提示勿重复 | 无冲突，放行 | 命中生效授权：`1008`（HTTP 200 流程提示）；命中在审申请：`1009`（HTTP 200 流程提示） |
| 4 | 通知审批人 | 提交成功事件路由到资源 Owner（或配置的安全管理员）的**待办 + 站内通知**（US-08）；无审批人兜底路由安全管理员 | 审批人收到待办 | — |
| 5 | 审批（事务内含授权写入） | 审批人对申请执行三选一：**通过**（可改授权期限）/**驳回**（必填理由）/**转审**（reassign 给可审批该资源的其他审批人）。通过时在**同一事务**内完成：CAS 申请单 `0 待审 → 1 通过`（记录当前登录审批人/意见）+ 写入 `sys_user_file_permission`（`status=1`、`grant_source=2 审批获得`、`expire_at` 按批复期限） | 事务提交 → 授权即刻生效（与 RBAC 静态权限合并），进入步骤 6 | 驳回 → 写审计并通知申请人；转审 → 更新 approver 并回到步骤 4；转审目标无效（无审批权/不存在）：`1010`；状态非待审 / 非本人待办（CAS 未命中）：流程已变化（`4102` 语义） |
| 6 | 发布 `PermissionGrantEvent` | 审批事务**提交成功后**（`AFTER_COMMIT`）发布，事件载荷含 `grantId / userId / resourceId / expireAt` | 事件送达监听方 | — |
| 7 | 通知申请人（事件副作用） | 监听 `PermissionGrantEvent` → 站内通知「审批通过」，含可访问时间窗口；写审计 | 申请人获知并可直接访问 | 事件丢失/宕机：授权已随事务落库不受影响，通知属非关键路径（按需补偿） |
| 8 | 到期自动回收 | 定时任务（PermissionGrantExpireScheduler，每小时）扫描 `expire_at <= now` 的生效授权 → CAS 置 `status=2 回收`、记 `revoke_at`，事务提交后发布 `PermissionExpiredEvent`；回收后再次访问命中步骤 1 | 授权自动失效，全程审计 | — |

**申请状态机**：`0 待审 → 1 通过 / 2 驳回 / 3 转审(改指审批人，回到待审) / 4 撤销`。
**授权状态机**：`1 生效 → 2 到期回收 / 3 撤销`（不可逆，回收即终态）。

> ⚠️ **一致性注（事务边界，[红队 T-02](./red-team-review.md)）**：审批通过 = 「申请单 CAS `0→1` + 写入
> `sys_user_file_permission(status=1)`」在**同一本地事务**提交，授权记录随事务生效，不依赖事件；
> `PermissionGrantEvent` 仅作 `AFTER_COMMIT` 的非关键副作用（通知/审计）。审批人身份一律由服务端
> 从登录态推导并 CAS 到当前待审记录，禁止信任请求体中的审批人/被审批人参数（转审目标须为对该资源
> 有审批权且非申请人的用户）。

### 2.4 ⏰ 到期回收与撤销

- **自动回收**：定时任务 + `idx_expire (status, expire_at)` 索引扫描，回收是幂等写（重复触发无害），回收事件防重。
- **主动撤销**：安全管理员/审批人可提前撤销授权 → `status=3`，等同到期回收路径（US-05/§6 关键产品规则）。
- 授权不留空档（[红队 T-02](./red-team-review.md)）：授权随审批事务提交，不依赖事件；访问判定读
  `status=1 AND expire_at>now` 为单条原子查询，到期回收为单条原子 `UPDATE ... WHERE status=1 AND expire_at<=now`，判定与回收无竞态窗口。
- 访问判定只在**请求入口执行一次**即放行在途操作：已开始的下载/访问不因授权到期或回收而中断
  （在途不打断，与常规下载器语义一致，[红队 C-03](./red-team-review.md)）。

### 2.5 📌 现状核对（审批）与待办

| 项 | 现状（PRD/骨架） | 本次对齐动作 |
| --- | --- | --- |
| 申请四要素 +「类型」 | PRD 原缺 `type` | PRD US-05 已同步（§3） |
| 冲突校验（1008/1009） | 无 | `1008 GRANT_ALREADY_ACTIVE` / `1009 APPLICATION_DUPLICATE` / `1010 REASSIGN_INVALID` 已写入 `ErrorCode.java` 与 `error-codes.md`（1xxx 段） |
| 转审（reassign） | PRD 原仅通过/驳回 | PRD US-05 / §5 用例 B 已同步；语义与 `1010` 已定义 |
| `PermissionGrantEvent` | 无 | 本文件 §2.1/2.3-6；落地于 at-permission，通知域监听 |
| `sys_approval_request` / `sys_user_file_permission` 表 | 骨架期无 | Flyway 脚本 `sql/V1__schema.sql`（2026-09-06 二次重置，收敛原 V3 语义）已落地（§2.2） |
| 到期自动回收 | PRD 仅语义 | 本文件 §2.3-8 / §2.4 调度口径 |

---

## 3️⃣ 🔔 站内通知与轻 IM 主线（2026-09-29 补齐）

**参与模块**：`at-collaboration`（站内信 / 会话与消息，主）、`at-transfer`（传输完成事件）、
`at-file`（外发链接到期提醒、取件回执）、`at-common`（`NotifyType` / `NotificationCommand`）。

### 3.1 📣 通知类型与投递口径

| # | 类型 | 触发方 | 未读 / 待办 |
| --- | --- | --- | --- |
| 4 | 外发链接**到期前**提醒 | at-file `ShareExpireNotifyScheduler`（cron 默认每小时第 25 分）+ `ShareLinkMapper#selectExpiringActive` | 计入未读；不进待办 |
| 8 | 传输完成提醒 | at-transfer `TransferEventPublisher`（合并成功、**事务提交后**） | 计入未读；不进待办 |
| 9 | 取件回执 `SHARE_ACCESSED` | at-file `ShareAccessService#redeem` 成功后回推**链接创建者** | 计入未读；**不进待办**（`isInbox()` 与未读 SQL 同口径，`sql/V17`） |

> 📌 **一致性口径**：通知一律**与业务同事务**落 `sys_notify_message`（`P-3` / [红队 PRD-07](./red-team-review.md)），
> 事件与定时任务只负责异步推送 / 邮件，**发送失败不反向阻塞业务事务**（传输完成提醒发布失败只留痕）。
> **取件回执**是免登录访客场景下，创建者唯一能感知「链接真的被用过」的通道（此前只能自行翻取件审计）；
> **到期前提醒**的幂等为「Redis 占位键 + `existsForBiz` 兜底」两层，**发送失败会释放占位键**以便下轮重试；
> **提取码锁定提醒**仅在计数**恰好跨过阈值**时发出一次，避免脚本连打把创建者收件箱刷满。

### 3.2 💬 轻 IM 的 @ 提及

| # | 步骤 | 行为 | 正常出口 | 分支 / 错误 |
| --- | --- | --- | --- | --- |
| 1 | 发送带提及的消息 | `POST /api/v1/chat/messages` 新增可空 `mentionUserIds`（≤ 500 项） | 服务端与**群成员求交集**后按行落 `mentioned`（**每接收人一行**） | 非成员 / 发送人自己 / 重复项**静默剔除**——客户端持有的成员名单可能本就是旧快照，点名失败不该让整句话发不出去 |
| 2 | 定向投递 | 被点名者那一行走既有按接收人推送通道（`CHAT` 帧 `NotifyMessageVO.mentioned=true`，发送人恒 `false`） | 被点名者收到提醒 | **不额外写站内信**：同一句话若在「会话未读」与「站内信未读」各算一次，点任一处都清不掉另一处 |
| 3 | 会话未读 | 会话列表 `ConversationVO.mentionUnreadCount` = 该会话「未读且被点名」条数 | 角标数字仍取 `unreadCount`，仅在 `> 0` 时染强调色 | **`mentionUnreadCount` 是 `unreadCount` 的子集，两个数不能相加** |

> 📌 **为何按「行」记而非按「条」记**：群消息是写扩散的（一条消息落 N 行），故 `mentioned` 是**每接收人一行**
> 的标记而非消息级属性——于是「有人 @ 我」退化成 `mentioned = 1 and read_status = 0` 的等值查询，
> **完全不需要解析正文里的昵称**（重名、昵称含空格、正文改字都不会误判）。
> 前端**生效提及靠正文匹配**（用户删掉 `@昵称` 即失效），不跟踪插入位置。

### 3.3 🗄️ 消息保留 ≥ 30 天

`ChatRetentionScheduler`（`anttransfer.collaboration.notify.message-cleanup-cron`，默认 `0 20 4 * * ?`，
与文件域清理 **03:30 错峰**）→ `NotifyMessageService#purgeExpiredChatMessages` →
`NotifyMessageMapper#deleteExpiredChatMessages`（`order by create_time limit` **分批物理删除**）：

- **30 天下限硬钳制**：`NotifyProperties.MIN_MESSAGE_RETENTION_DAYS = 30`，配置小于 30 一律按 30 执行，
  **不回写配置**（配置里仍显示管理员填的值，便于发现配错）；
- **只允许一个实例清理**：Redis `SETNX at:chat:retention-lock`（TTL 15 min，**不主动释放**，实例崩溃靠 TTL 兜底）；
  **Redis 异常时降级放行**——清理幂等、重复执行无害，而「锁坏了就不清理」会让保留期悄悄失效；
- 参照 at-file 的 `FileCleanupScheduler` 而非 **D-10** 的 `AuditArchiveScheduler`（后者至今未落地）。

---

## 4️⃣ 🔗 关联文档

- 📋 产品口径与验收：`docs/prd/README.md`（§3 US-01/02/05、§5 用例 A/B、§6 关键产品规则）
- 🔌 HTTP 契约与错误码：`docs/api/README.md`、`docs/api/error-codes.md`
- 🏗️ 模块边界与铁律：`docs/architecture/README.md`
