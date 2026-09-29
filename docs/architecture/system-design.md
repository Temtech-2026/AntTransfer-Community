# 🏗️ AntTransfer CE 系统设计文档

| 项 | 内容 |
| --- | --- |
| 版本 / 状态 | v0.1-draft · 随红队评审（`red-team-review.md`）同步修订；CE/EE 扩展点与站内通知 / 轻 IM 已落地（2026-09-29 复核） |
| 日期 | 2026-09-06（2026-09-29 复核更新 §1.2 / §1.3 / §4.1 / §5.1 / §5.3 / §7 / §7.1 / §8） |
| 产品口径 | [PRD](../prd/README.md)（v0.1-draft） |
| 覆盖范围 | 模块化单体 `server/` 8 个 `at-*` 模块 + `web/`（React 19 / Ant Design Pro v6）；MySQL 8 / Redis 7 / Flyway |
| 文档关系 | 本文件是**技术设计基线**（实现蓝图）；[架构 README](./README.md) 为总览；[use-case-flows](./use-case-flows.md) 为两条主线的时序口径；[API](../api/README.md) / [error-codes](../api/error-codes.md) 为接口契约。凡涉及“越权 / 并发 / 事务边界”的实现必须通过 [红队评审清单](./red-team-review.md) 的门禁项 |

> 阅读提示：设计基线与已落地实现并存。正文“设计目标（To-Be）”与“现状（As-Is）”分开描述，
> 落地以 To-Be 为准；现状核对见 §8——**截至 2026-09-29，上传 / 审批 / 外发分享 / 站内通知 / 轻 IM
> 主线均已落地**，本节只保留尚未实现的部分。

---

## 1. 🧭 总体架构

### 1.1 运行形态与部署拓扑

模块化单体：**单进程 / 单库 / 单 Redis**，`at-bootstrap` 聚合全部 at-* 模块并独占
`spring-boot-maven-plugin`（唯一可执行 fat jar）。部署形态为 Docker Compose
（MySQL + Redis + server，前端可选），单机目标可用性 ≥ 99.9%。

```
web/ (React) ── HTTP /api/*（开发期代理联调，生产经反代 TLS）
        │
   at-bootstrap（启动聚合 + Spring Boot 装配，scanBasePackages=com.anttransfer）
   ├── at-gateway        接入横切：全局异常 / CORS / TraceId 过滤器
   ├── at-auth           认证：登录、双令牌、会话上下文 LoginUser
   ├── at-transfer       传输：任务、分片、合并、进度状态机
   ├── at-file           文件：sys_file 元数据、存储抽象（本地/对象存储）
   ├── at-permission     权限：RBAC、权限点、申请-审批-授权（grant）
   ├── at-collaboration  协作：共享空间、外发链接、站内通知域
   └── at-common         共享内核：Result / ErrorCode / BaseEntity / TraceUtils
                          ▲ 数据：MySQL（Flyway sql/） + Redis（登录态/限流/通知角标）
```

### 1.2 模块边界与依赖铁律

（来源：根 `pom.xml` 头部注释、[架构 README](./README.md)）

1. 业务模块（at-auth / at-transfer / at-permission / at-file / at-collaboration）与 at-gateway
   **禁止互相依赖**，只允许依赖 at-common；
2. at-common 禁止反向依赖任何 at-* 模块；
3. 版本统一在父工程 `properties` + `dependencyManagement` 锁定（Spring Boot 3.5.14 parent）；
4. 模块内跨表操作在服务层编排，避免模块间实体直接耦合。

**关键缺口（评审驱动，须在实现前补齐，见 [T-01]）**：铁律 1 使 at-transfer 无法直接调用
at-file 的落库服务，但 use-case-flows §1 上传主线明确“写 sys_file + sys_upload_task”
需要跨 at-file / at-transfer 编排。拟定规则：

- 各模块对外暴露**接口形态**（如 `at-file` 提供 `FileRepository` / `FileIngestPort`，由模块内实现，
  并随模块注册进容器），编排模块只面向接口，**禁止 import 他模块的 `service` / `mapper`
  实现类**——即“依赖倒置取代依赖铁律的直接例外”；
- **接口位置（2026-09-29 收紧）**：**CE/EE 扩展点的 7 个 SPI 统一定义在 at-common 的
  `com.anttransfer.common.spi` 子包**（`identity` / `scan` / `crypto` / `watermark` / `approval` /
  `transport`，见 [architecture.md §2.2 / §2.3](./architecture.md)）——EE 只需依赖 at-common 即可实现
  **任一**扩展点，不必反向依赖某个业务模块；模块**私有的跨模块协作端口**（如 at-file 的
  `FileIngestPort`）则留在各自模块的 `spi` / `api` 子包内。两者用途不同，**勿混谈**；
- 跨模块数据库写操作必须落在**同一个本地事务**中编排（同库），不允许拆成两个
  “先写 A 表再写 B 表”的独立事务。

### 1.3 模块内包规约（各业务模块统一）

```
controller   # 仅做参数绑定与鉴权注解，不写业务
service      # 业务 + @Transactional 边界（公共入口）
spi/api      # 模块私有对外端口（如 at-file 的 FileIngestPort）；CE/EE 扩展点已统一上收 at-common 的 common.spi
mapper       # MyBatis-Plus Mapper（@Mapper 自动扫描，无需 @MapperScan）
entity       # 对应表实体（继承 BaseEntity）
model        # DTO / VO / 上下文
```

## 2. 🔐 认证与会话（To-Be，at-auth）

### 2.1 双令牌模型（US-07）

| 令牌 | 有效期（默认） | 载体 | 存储 |
| --- | --- | --- | --- |
| access token | 30 min | JWT（`jjwt 0.12.6`，HS256，**secret 走环境变量**）；claims 含 `sub=userId / jti / iat / exp / ver=签发时 token_epoch` | **无状态验签 + 会话吊销纪元**：验签后比对 `ver` 与 `at:token:access:{userId}` 缓存的 epoch（§2.3） |
| refresh token | 7 d | 随机不透明串（≥ 256 bit，非 JWT） | **Redis 白名单**（`at:token:refresh:{userId}`，值 = 最新 refresh 指纹），原子轮换 + 复用检测（§2.2） |

**会话策略（明示取舍）**：refresh 白名单为**每用户单值**——同账号新登录覆盖旧值
（顶替刷新权），旧端 access 最长存活至自身 30 min 过期且无法再续期，即“单会话 + 至多
30 min 登出拖尾”；按会话粒度多端共存不在本期范围（PRD Won't，§8）。

**模型选型说明（评审演进，2026-09-06 定稿）**：早期口径“纯无状态 JWT + 逐 jti 黑名单”
在“仅凭 userId 批量吊销（改密 / 停用 / 全端下线）”时无法枚举活跃 jti，落地有缺口；
纯 Redis 白名单会话则把鉴权关键判定全部押在 Redis（抖动 / 清空即全体下线，违背 P-8）。
最终采用 **DB 权威纪元 + Redis 缓存 / 白名单 + JWT 无状态验签** 的混合模型（§2.3）：
吊销正确性以 DB `sys_user.token_epoch` 为唯一权威，Redis 仅缓存加速且丢失可回源自愈，
access 鉴权仍以无状态验签为第一道闸。

### 2.2 刷新与重放检测

- refresh 换新做**原子轮换**：Lua 脚本 `GETDEL` 取出旧指纹 → 与请求携带值比对一致才
  `SET` 新指纹（旧 refresh 一次即失效，防并发双刷换出双令牌对）；
- 旧指纹**比对失败 = 该 refresh 已被使用过** ⇒ 判定被盗重放（[C-05]）：事务内
  `UPDATE sys_user SET token_epoch = token_epoch + 1`，并 DEL `at:token:refresh:{userId}`
  与失效 `at:token:access:{userId}` ⇒ 该用户全部已签发 access/refresh 即刻失效，要求重新登录；
- 改密 / 注销 / 停用 走同一“bump 会话纪元”通道（§2.3），access 与 refresh 同步失效。

### 2.3 吊销（权威在 DB，Redis 仅加速）

**权威状态 = `sys_user.token_epoch`（bigint NOT NULL DEFAULT 0，随 at-auth 会话实现以
Flyway V3 增列）**。登录签发 access 时把当前 `token_epoch` 写入 JWT `ver` claim；任何
**全端吊销事件**（改密 / 主动注销 / 账号停用禁用 / 安全事件 / refresh 重放打击）在同一
DB 事务内执行 `token_epoch = token_epoch + 1`，并主动失效两个 Redis key：

- `at:token:refresh:{userId}`：删除 refresh 白名单（refresh 立即不可用）；
- `at:token:access:{userId}`：DEL 该键缓存（DB 权威值已 +1，丢失/过期回源自愈），
  TTL 30 min 仅作兜底。

**access 鉴权路径**：验签（签名 + exp）→ 读 `at:token:access:{userId}` 取 epoch 与 JWT
`ver` 比对；缓存 miss 回源 `sys_user.token_epoch` 并回填（Redis 抖动 / 清空不阻断鉴权，
**也不绕过吊销**）→ DB `status`/`deleted` 低频校验兜底（本地短缓存 + TTL）。比对不通过
⇒ 视为已吊销（1001 / 1002），前端静默用 refresh 换新；refresh 亦失效则强制重新登录。

**账号停用**：状态变更事务内同步 bump 纪元（即时生效，优于 PRD“吊销 ≤ 2 min”指标）；
后台批扫（≤ 2 min，PRD §7）仅作恢复后的二次兜底确认，不依赖 Redis 黑名单。
安全性质：吊销正确性**不存在只有 Redis 的关键判定**（P-8）——Redis 丢失至多导致
“多查一次 DB 回源”，不会出现“吊销被绕过 / 黑名单丢失放行”的窗口。

### 2.4 会话上下文与透传

- `LoginUser`（id/username/nickname/avatarUrl/roles）在认证过滤器填充 ThreadLocal，
  Controller 参数注入或静态上下文读取，业务层不再重复查库；
- **异步边界**（线程池/定时任务）须显式透传或不透传（禁止隐式串号），同 TraceId 处理。

## 3. 🗝️ 授权模型（To-Be，at-permission）

### 3.1 判定合并（Access Decision）

资源可访问 = **RBAC 静态权限**（角色→权限点） ∪ **动态临时授权**（grant 生效中） ⇒
其余一律拒绝。

```
访问判定（resourceId 维度，单入口 AccessControlService）：
 1) 默认 DENY；
 2) 命中 RBAC：权限点满足 且 数据范围满足 → ALLOW；
 3) 命中 sys_user_file_permission(status=1 AND expire_at > now) → ALLOW；
 4) 其余 → NO_AUTH(1003)，按资源 level 决定是否引导申请。
```

- **对象级（行级）越权防线**：凡按 ID 访问（文件/任务/空间/申请单/分享），必须走
  资源归属校验（见 §3.3），**禁止只查行不回写归属条件**；
- “权限点 → 数据范围”三维（本人-本部门-全部）已随 V1 落于 `sys_role.data_scope`（1/2/3 枚举，见 §3.2）。

### 3.2 内置角色与权限分离（US-06）

- 内置角色（2026-09-06 随 `sql/V2__init_data.sql` 定稿；原三权分立中 `system_admin` /
  `security_admin` 的细分职能并入 `SUPER_ADMIN`，`AUDITOR` 审计独立保留）：
  - `SUPER_ADMIN`：全部管理域 + 文件域全权限（data_scope=3 全部），含七个原子文件权限点与审计只读；
  - `DEPT_ADMIN`：本部门及以下数据范围（data_scope=2）的文件域管理（不含审计）；
  - `AUDITOR`：仅 `audit:log:read` 只读审计（data_scope=3），**任何写操作被权限点拒绝**；
  - `USER`：默认业务角色（data_scope=1 本人），常规文件操作（不含高危 `file:destroy`）；
- 管理角色互斥（单账号不可兼任 SUPER_ADMIN / DEPT_ADMIN / AUDITOR）：服务层角色变更事务内校验，
  数据层互斥约束随 at-permission 落地（[V-05]）；审计员执行写操作 ⇒ 后端按权限点拒绝并记录审计事件。

### 3.3 资源所有权与成员模型

| 资源 | 控制者 | 行级校验依据 |
| --- | --- | --- |
| 共享空间 space | owner_user_id | `space.owner_user_id = 当前用户` 或 空间成员（子表待建） |
| 空间内文件 file | 所在空间 | 经空间归属反查（file 挂 space_id） |
| 传输任务 upload | 任务创建人 | `sys_upload_task.user_id = 当前用户` |
| 申请单 application | 申请人 / 当前审批人 / 管理员 | `sys_approval_request.applicant_id` 或 `approver_id` 且审批权 |
| 外发分享 link | 创建者 / 安全管理员 | `sys_share_link.owner_user_id` |

> 待建子表：`space_member`（空间-用户-角色：owner/member-read/member-write），文件经
> `sys_file.space_id`（挂载）。所有“按成员放行”的接口以空间成员表为准，
> 不得仅按 Owner 判断。

### 3.4 分级与审批（US-05）

- 资源级别低/中/高：文件**继承**空间级别，可独立调级（`sys_file.level` 已随 V1 落地，
  文件默认低；继承空间级解析待 `collaboration_space` 表族落地后实现，见 [V-04] 处置）；
- 审批规则单级可配（每级别：自动放行 / 一级审批）；
- 申请单要素：`apply_type(ACCESS/DOWNLOAD/EDIT/SHARE) + resource(resource_type/resource_id) +
  purpose + desired_expire_at`（申请默认授权 24 h，批复可调整）；
- 冲突校验（1008 已生效授权 / 1009 重复在审）的并发安全见 [C-01]。

### 3.5 默认安全与白名单（重要红线）

- 鉴权采用**默认 DENY + 显式放行**：拦截器默认校验 `/api/**`（除白名单），
  `@RequireLogin` / `@RequirePermission` 仅作增强与声明，**禁止“漏标注解即放行”**；
- 白名单（集中维护，禁止散落）：`POST /api/v1/auth/token`、
  `POST /api/v1/auth/token/refresh`、外发分享下载通道、**头像直出** `GET /api/v1/users/{userId}/avatar`、
  健康检查端点；
- ⚠️ **白名单里的路径参数段一律用数字正则（`{userId:[0-9]+}`），不得用 `*`**：Spring Security 的路径放行
  **不看 HTTP 方法**，读路径 `/v1/users/*/avatar` 会连带命中写路径 `POST /v1/users/me/avatar`，
  把「本人自助换头像」静默放宽成匿名可调。回归护栏 `SecurityConfigTest`
  （`builtInWhitelist_shouldNotPermitSelfAvatarUpload`）同时做反向与正向断言；
- 头像直出的放行前提是「**只回图片字节**」：一旦要带昵称 / 部门等账号信息，必须改为「登录态换票 + 凭票取字节」；
- **禁止仅在前端隐藏功能**（US-04：后端强制鉴权）。

## 4. 🗄️ 数据模型与表族

### 4.1 表族地图

| 表 | 归属 | 版本 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| `sys_user` | at-auth | V1（2026-09-06 二次重置） | 已落地 | 雪花主键 + snake_case；含 dept_id / status（对应错误码 1004/1005）；`token_epoch`（会话吊销纪元，§2.3）随 at-auth 会话实现以 Flyway V3 增列；原脚手架 camelCase 版本已移除（[T-07] 关闭） |
| `sys_dept` / `sys_user.dept_id` | at-auth | V1（二次重置） | 已落地 | 树形部门（ancestors 物化路径，`idx_ancestors` 前缀索引），支撑数据范围「本部门及以下」（[V-02] 关闭） |
| `sys_role` / `sys_permission` / `sys_user_role` / `sys_role_permission` | at-permission | V1（二次重置） | 已落地 | RBAC 核心四表 + 权限点菜单树；`sys_role.data_scope`（1 本人 / 2 本部门及以下 / 3 全部）承载三维度；`sys_permission.perm_code` 点编码唯一 |
| `sys_group` | at-auth / at-collaboration | V1（二次重置） | 已落地 | 项目 / 群组组织单元基座；成员与文件挂靠随协作演进版本扩展（原 user_group_member 不再占位） |
| `sys_approval_request` | at-permission | V1（并入原 V3） | 已落地 | 申请单；`uk_application_no` 单号唯一；活动态判重（1008/1009）由应用层保证（[C-01]） |
| `sys_user_file_permission` | at-permission | V1（并入原 V3） | 已落地 | 对象级实际授权；`grant_source`（1-角色继承 / 2-审批获得）+ `expire_at` 时效回收；`idx_user_expire(user_id,status,expire_at)` 个人扫描、`idx_expire(status,expire_at)` 全局回收 |
| `sys_approval_node` | at-permission | V1（二次重置） | 预留 | 多级审批扩展点（EE Won't，PRD §8）；CE 固定 `node_seq=1` |
| `sys_file` | at-file | V1（二次重置） | 已落地 | `uk_sha256_size` 物理唯一 + `ref_count` 引用计数；含 level / group_id / space_id（space_id 逻辑关联待建空间表，[V-04] 关闭） |
| `sys_upload_task` | at-transfer | V1（二次重置） | 已落地 | 状态机 0~6（含「合并中」）；已传分片索引持久化于 `uploaded_indexes`（原 transfer_part 子表收敛于此） |
| `sys_share_link` | at-collaboration | V1（二次重置） | 已落地 | 外发链接：token 唯一 / 提取码散列 / 有效期 / 次数（原子扣减）/ 状态；提取码错误计数走 Redis |
| `collaboration_space` / `space_member` | at-collaboration | 待建（实体已建） | 规划 | 空间与成员模型随 at-collaboration Service 落地；`sys_file.space_id`、授权 `resource_type=SPACE` 逻辑关联此族 |
| `sys_notify_message` | at-collaboration | V1（二次重置）+ V17 / V18 扩展 | 已落地 | 站内 / 离线消息（US-08），`idx_user_read(recipient_user_id, read_status, id)` 支撑未读角标。**V18** 增 `mentioned`（**行级**标记：群消息写扩散为一行 / 接收人，故「有人 @ 我」退化成 `mentioned=1 and read_status=0` 的等值查询，无需解析正文昵称）+ 保留期清理索引；**V17** 将 `notify_type` 扩至 `9 = SHARE_ACCESSED`（**计入站内信未读、不进待办**）。保留期由 `ChatRetentionScheduler` 按 **≥30 天下限**分批**物理**删除（保留期是留存承诺，不是软删除开关） |
| `sys_operation_log` / `sys_login_log` | at-common / at-auth | V1（二次重置） | 已落地 | append-only；操作日志留存 ≥ 6 个月（归档任务按 log_time 清理）；`idx_log_time` 等供审计检索 |

### 4.2 主键 / 审计 / 逻辑删除规约

- 新表一律 `id bigint` 雪花（`MyBatis-Plus ASSIGN_ID`，application.yml `id-type: assign_id` 全局）；
- 公共列组（V1 起全表统一）：`tenant_id`（预留，CE 恒 0，不建租户表）+ `create_by / create_time /
  update_by / update_time / deleted`；其中 `deleted` 与 `BaseEntity` 及全局 `logic-delete-field` 对齐
  （BaseEntity 已含 createBy / updateBy / deleted 字段映射）；
  **update_time 写入者须统一**（应用 MetaObjectHandler 或 DB `on update`，二选一，防时钟/覆盖漂移，[T-08]）；
- 命名 snake_case；索引前缀 `idx_`，唯一键前缀 `uk_`。

## 5. 🔄 核心业务流与状态机

### 5.1 上传主线（at-transfer + at-file，时序口径见 use-case-flows §1）

预检(秒传) → 建任务 → 分片并发上传(≤5，逐片 Hash) → 合并 → 整件 SHA-256 校验 → 落库 + 事件。

> 📣 **完成通知（2026-09-29）**：合并成功后由 at-transfer 的 `TransferEventPublisher` **在状态提交后**
> 发布 `TransferCompletedEvent`（通知域消费，`NotifyType 8`）。发布失败**只留痕**——已落库的传输结果
> 不因通知失败而回滚（非关键副作用，见 `P-3` 与 [红队 PRD-07](./red-team-review.md)）。

**传输任务状态机**（评审修订版，落地以本表为准）：

```
0 排队 → 1 传输中 ⇄ 2 已暂停
1 传输中 → 6 合并中 → 3 已完成          ← 修订：显式“合并中”，避免 merge 长事务/长 IO
0/1/2    → 4 失败（可重试回 0）
0/1/2/6  → 5 已取消
```

- **所有状态迁移以 CAS 落地**：`UPDATE ... WHERE id=? AND status=<期望态>`，影响行数≠1 ⇒ 409（4102）；
- `sys_upload_task.transferred_size` 采用原子累加（`transferred_size = transferred_size + ?`），
  已传分片索引持久化于 `uploaded_indexes`（JSON，原 transfer_part 子表收敛于此），断点续传跳过已收片；
- 分片暂存保留 24 h；取消/失败后多余分片可清理，不破坏数据正确性。

### 5.2 权限审批主线（at-permission，use-case-flows §2）

申请单状态机 `0 待审 → 1 通过 / 2 驳回 / 3 转审 / 4 撤销`；
授权状态机 `1 生效 → 2 到期回收 / 3 撤销`（回收/撤销为终态，幂等）。

**评审修订（关键）**：
1. **授权写表必须在审批事务内**（步骤“状态→1 通过 + 写 sys_user_file_permission(status=1)”为同一本地事务），
   事务提交后的事件仅用于通知/审计等**非关键路径**（use-case-flows §2.3 已按此回写修订，2026-09-06）；
2. 到期回收定时任务：`UPDATE sys_user_file_permission SET status=2, revoke_at=now()
   WHERE status=1 AND expire_at <= now()`（一条原子 SQL），重复触发天然幂等；
3. 访问判定与回收“无空档”仅在同库同事务前提下成立——判定条件
   `status=1 AND expire_at>now` 单条查询即为原子。

### 5.3 外发下载主线（原规划 at-collaboration，CE 实际落地 at-file，见 [AT-DIFF-06](../development/AT-DIFF-todos.md#at-diff-06-外发分享模块归属)）

创建（校验创建者对源文件的访问权限，[V-07]）→ 生成高熵不透明 token → 下载校验
（未撤销 + 未过期 + 提取码对）→ **次数扣减（DB 原子裁决，Redis 前置闸加速）** → 审计下载。

**次数扣减：DB 为唯一放行裁决，Redis 仅前置配额闸与计数镜像（[C-08] / P-8）**：

1. **DB 权威裁决（防超卖唯一判据）**：`UPDATE sys_share_link SET status=CASE WHEN downloaded_count >=
   download_limit-1 THEN 2 ELSE status END, revoke_at=..., downloaded_count=downloaded_count+1
   WHERE id=? AND status=0 AND expire_at > now() AND downloaded_count < download_limit`，
   影响行数 = 1 才放行发流（并发第 N/N+1 次不超卖）；0 行 ⇒ `4004`（已过期 / 次数用尽）。
   **「用尽最后一次」的 `status=2`（终态）在同一语句内原子收敛**（免额外回读、无悬空态）；
   注意 `status` / `revoke_at` 的赋值必须写在 `downloaded_count` 之前——CASE 中引用的必须是**自增前**的旧值，
   这是正确性的一部分（`ShareLinkMapper#consumeDownloadQuota` 有完整说明）；
2. **Redis 前置配额闸（可选加速）**：创建链接时 `SET at:share:count:{token} <剩余配额> EX <链接剩余有效秒>`；
   核销判定前 `DECR`，返回值 < 0 直接快速拒绝并 `INCR` 归还（已用尽链接不再打 DB）；键不存在
   （Redis 丢失 / 重启）⇒ 跳过前置闸直接走 DB 裁决，DB 拒绝后重建镜像 `download_limit -
   downloaded_count`（自愈）。Redis 计数永远以 DB 为准，偏差只影响拒绝效率，**不产生超卖**；
   ⚠️ 前置闸判定为「已用尽」时**只拒绝、不改链接状态**——镜像归零意味着「最后一次额度刚被并发放行」，
   此刻置终态会连带拒掉仍在途的成功 UPDATE（该最后一条 SQL 自己会收敛终态）；
3. **提取码错误锁定**：Redis `INCR at:share:lock:{token}`，连续错 5 次 ⇒ `4011` 临时锁（429/30min）；
   TTL 在**触发锁定那一刻**刷新为完整时长（而非仅首次错误时设置）——否则「第 5 次错误发生在第 25 分钟」
   就只剩 5 分钟锁定，窗口被侵蚀；判定是否锁定须**比值 ≥ 阈值**，不能只看键存在（计数与锁定同键，
   `hasKey` 会把第 1 次错误误判为锁定）；提取码正确即 DEL 该键；锁定属防爆破加速态，Redis 丢失仅放宽
   尝试窗口，无正确性风险；**锁定提醒（2026-09-29 修正）**：仅在计数**恰好跨过阈值**时向创建者发出一次，
   避免脚本连打把创建者收件箱刷满；
4. 白名单端点：分享下载允许**无登录**，但校验严格限定在分享通道内，不泄露原存储路径（[V-07]）；
5. **三步式取件（双票模型，CE 实现新增）**：① 换票 `POST /v1/shares/{token}/verify` 走完上述校验后仅签发
  **一次性票据**（Redis `at:share:ticket:{ticket}`，TTL 5 min，`GETDEL` 取用即焚、**不落库**），
  **不在换票时扣次数**（避免「换票后未取件」白吃额度）；② 核销 `POST /v1/shares/redeem` 才做
  前置闸 + DB 原子扣减 + 写审计，并**二次校验链接状态**，使撤销 / 过期对已签发票据即时生效，
  同时换发**取件票**（Redis `at:share:pick:{ticket}`，TTL 同票据口径）；③ 取字节
  `GET /v1/shares/{token}/content?ticket=` 凭取件票流式下发，支持 `Range` 断点续传。
  **两票分工**：一次性票回答「谁有权取件」（不可重放），取件票回答「把这一次取件读完」（TTL 内可重复读）——
  一次取件在传输层必然被拆成多次请求（`Range` 分段 / 浏览器重试 / 多线程下载），若用一次性票读字节，
  第二次就会撞上「票已焚毁」；次数扣减与审计仍只发生在核销那一次，取件票重复读**不再扣减、不再审计**。
6. **取件回执（CE 实现新增，2026-09-29）**：核销 `POST /v1/shares/redeem` 成功后向**链接创建者**回推
  取件回执（`NotifyType 9 = SHARE_ACCESSED`，计入站内信未读、**不进待办**）。免登录访客无账号，
  这是创建者唯一能感知「链接真的被用了」的通道（此前只能自行翻取件审计）；
7. **到期前提醒（CE 实现新增，2026-09-29）**：`ShareExpireNotifyScheduler`（cron 默认**每小时第 25 分**）
  经 `ShareLinkMapper#selectExpiringActive` 选出即将到期的活动链接发提醒；幂等为「Redis 占位键 +
  `existsForBiz` 兜底」两层，且**发送失败会释放占位键**以便下轮重试。

## 6. 🚧 一致性、并发与事务设计基线（红线，实现必守）

| # | 原则 |
| --- | --- |
| P-1 | 状态机类更新一律 **CAS + 行数校验**，禁止 `select → 判断 → updateById` 的读改写 |
| P-2 | DB 事务内**禁止大文件 IO / 远程调用**（对象存储、外部 API）；文件重组与 SHA 校验在事务外完成 |
| P-3 | 跨模块写编排在**同一本地事务**（见 §1.2 SPI 规则）；事件只承载非关键副作用（通知/审计管道），且统一 `@TransactionalEventListener(AFTER_COMMIT)` |
| P-4 | 写磁盘/对象存储与 DB 元数据**无法同原子**：采取“存储优先写入 + 幂等可重放 + 定时清理孤儿”的最终一致，上传方向可接受；下载先记审计再输出流，语义明确定义 |
| P-5 | 写接口具备**幂等与防重**：申请单/建任务/建分享以“幂等键 + 唯一约束”或 CAS 防重复提交 |
| P-6 | 计数类（进度/下载次数/提取码失败）用 DB 原子 UPDATE 或 Redis 原子指令，禁止“读-改-写” |
| P-7 | `@Transactional` 只放在 **public 跨 Bean 入口**；模块内自调用不生效（自注入/内部私有事务方法=失效），代码评审门禁 |
| P-8 | Redis 与 DB 双写遵循“DB 为主、Redis 为加速”，缓存丢失可自愈（访问时回源校验），不存在只有 Redis 的关键判定 |
| P-9 | 时间：过期/回收等强一致判定统一**数据库时钟**（`expire_at <= now()` 交给 SQL），应用层只传参；`datetime` 语义与 JDBC/容器时区（Asia/Shanghai）在配置中显式统一 |
| P-10 | 默认拒绝（§3.5）与最小权限；生产配置禁止调试端点（swagger/actuator）暴露 |

## 7. ✂️ 横切设计

| 横切 | 决策 |
| --- | --- |
| 统一返回体 | `Result{code,message,data,traceId}`（at-common，构造自动带 traceId） |
| 异常 | `BusinessException(ErrorCode)`；at-gateway `GlobalExceptionHandler` 按 `ErrorCode.httpStatus` 映射 HTTP |
| 追踪 | `TraceIdFilter` + `TraceUtils`（ThreadLocal+MDC）；**入站 X-Trace-Id 需清洗（长度/字符集），防 MDC 注入**（[D-02]） |
| CORS | dev 全放开（现状）；**prod 收敛为配置化白名单**，凭 Cookie 场景谨慎 allowCredentials（[D-01]） |
| 限流 | 429 语义已定义；登录、refresh、提取码通道、上传并发需落地 Redis 令牌桶/计数（现缺实现） |
| 审计 | 关键操作全量审计；审计表只增不改删；留存 ≥ 6 个月（归档导出后清理）；审计员操作亦记录 |
| 配置 | 环境变量占位 `:默认值`；Flyway locations 已统一为 classpath:db/migration（构建期打包 sql/，见 at-bootstrap pom） |
| 通知 | 站内信**与业务同事务**落 `sys_notify_message`（`P-3`），事件 / 定时任务只负责异步推送与邮件；类型见 PRD §4 与 at-common `NotifyType`（`9 = SHARE_ACCESSED` 计入未读、**不进待办**，`isInbox()` 与未读 SQL 同口径） |
| 定时任务 | 文件域清理 **03:30**、外发链接到期前提醒（**每小时第 25 分**）、聊天消息保留期清理 **04:20**（`0 20 4 * * ?`）；均为「分布式锁 + 分批 + 失败留痕」，多实例只允许一个执行 |
| CE/EE 扩展点 | 7 个 SPI 定义在 at-common `com.anttransfer.common.spi`；**能力差异只由 Bean 是否存在表达**（`@ConditionalOnMissingBean`），业务代码禁止 `if (eeEnabled)`；`TransportStrategy` 为 Bean 名称级例外（协议是集合，避免类型级顶替造成功能回退） |

### 7.1 Redis Key 规划

Key 与 TTL 的**唯一权威常量**在 at-common `RedisKeyConstants`（各业务模块禁止手拼 Key，
一律经其工厂方法生成），下表与常量镜像，**新增 / 变更 Key 必须两处同步**（全键统一前缀 `at:`）：

| Key | 类型 / 用途 | TTL | 过期 / 失效策略 |
| --- | --- | --- | --- |
| `at:token:access:{userId}` | String = `sys_user.token_epoch` 镜像；access 鉴权吊销比对（§2.3） | 30 min | 缓存：全端吊销（epoch+1）主动 DEL，miss 回源 DB 自愈 |
| `at:token:refresh:{userId}` | String = 最新 refresh 指纹；白名单 + 原子轮换 + 复用检测（§2.2） | 7 d | 顶替续期；吊销 / 重放打击 DEL |
| `at:login:fail:{username}` | String = 登录失败计数（INCR） | 15 min | 滑动窗口计数，达阈值账号临时锁定（[D-03]） |
| `at:upload:{uploadId}` | Hash = 上传任务进度 / 状态镜像 | 24 h | 分片索引持久于 `sys_upload_task.uploaded_indexes`，丢失可重建（P-8）；任务完成清理 |
| `at:share:count:{token}` | String = 剩余配额镜像（DECR 前置闸，DB 裁决） | 随链接剩余有效期 | 链接失效 / 撤销清理；丢失回源 DB 重建（§5.3） |
| `at:share:lock:{token}` | String = 提取码错误计数（INCR，计数与锁定同键） | 30 min（**触发锁定时刷新为完整时长**） | 错 5 次临时锁（`4011`，判定须比值 ≥ 阈值，禁 `hasKey`）；提取码正确 DEL |
| `at:share:ticket:{ticket}` | String = 一次性取件票据载荷（JSON：shareId/fileId/accessType） | 5 min | `GETDEL` 取用即焚；丢失即失效、需重新换票（CE 两步式取件，§5.3-5） |
| `at:perm:{userId}` | 用户可达权限点聚合（角色静态 ∪ 授权动态快照） | 30 min | 授权 / 角色变更、账号停用主动 DEL；丢失由 RBAC 判定重算（P-8） |
| `at:rl:{类}#{方法}[:业务key]:{维度}` | String = 固定窗口限流计数（Lua `INCR` + 首增 `EXPIRE` 原子） | = `@RateLimit.windowSeconds`（窗口即 TTL，动态） | 超限 `4290`（HTTP 429）；Redis 异常降级放行（防御态，P-8） |
| `at:ws:channel` | Pub/Sub 频道名 | 常驻 | 集群 WebSocket 广播通道 |
| `at:chat:retention-lock` | String = 聊天消息保留期清理的分布式锁（`SETNX` 占位） | 15 min | **不主动释放**，实例崩溃靠 TTL 兜底；**Redis 异常时降级放行**（清理幂等，而「锁坏了就不清理」会让保留期悄悄失效） |

> 语义红线：本表中仅 `at:token:refresh:{userId}`、「分享链接临时锁」与「`at:share:ticket`」属 Redis 单写
> （写丢失会放宽安全窗口 / 使票据失效需重换，但**不破坏数据正确性**——频次与配额仍以 DB 为准）；
> 其余各键全部遵循 P-8（DB 为主、Redis 丢失可自愈）。

## 8. 🔍 现状核对（As-Is）与实现顺序

**已落地**：8 模块结构 + 依赖铁律；`Result/ErrorCode/BaseEntity/BusinessException/TraceUtils`；
网关过滤器/全局异常/CORS；`RequireLogin` / `RequirePermission` 注解；
**RBAC 鉴权（2026-09-07）：`@RequiresPerm` + AOP 切面、`PermissionService`（at:perm 缓存 +
多角色并集 + 显式 Deny 优先）、`AccessControlService`（归属 + 数据范围守卫，V-01 统一入口）、
`AuthenticatedUser` 公共主体契约、`GET /api/v1/permission/my`**（前端映射见
docs/development/frontend-permission-map.md）；
`LoginUser`、业务实体（TransferRecord/FileObject/CollaborationSpace）；MyBatis-Plus 配置
（雪花/逻辑删除/二级缓存关）；Flyway 统一（classpath 打包）；**`sql/V1__schema.sql` 二次重置为
CE sys_ 前缀 16 表四族 + `V2__init_data.sql` 初始化数据**（2026-09-06，脚手架示例表移除、原 V3
审批表语义并入；内置角色 / 权限点 / 菜单树与 admin 初始账号随 V2 落地）；
前端 Ant Design Pro 模板（业务 API 未对接）；
Redis Key 规划定稿：at-common `RedisKeyConstants`（`at:` 前缀 Key/TTL 常量 + 键工厂方法）与
本文件 §2.1~2.3（token_epoch 吊销模型）、§5.3（分享次数 DB 裁决 + Redis 前置闸）、§7.1
（Redis Key 规划表）同步（2026-09-06）；2026-09-13 补入限流键 `at:rl:`——原散落于 at-gateway
`RateLimitAspect`（手拼前缀），已回归常量类工厂方法，全仓无手拼 Key。

**2026-09-29 落地（三批）**：

- 🧩 **CE/EE 扩展点 7 个 SPI**：接口上收 at-common `com.anttransfer.common.spi`；CE 默认实现
  （`LocalIdentityProvider` / `SuffixAndKeywordScanInterceptor` / `NoopVirusScanner` / `NoopWatermarkProvider` /
  `PlainCryptoCodec` / `SingleNodeApprovalResolver` / `HttpTransportStrategy`）+ `@ConditionalOnMissingBean`
  装配门禁 + 实际消费点 + 回归测试**同批完成**（详见 [architecture.md §2.3](./architecture.md)）；
- 📣 **站内通知接线三件**：传输完成提醒（`TransferEventPublisher` → `TransferCompletedEvent`）、
  外发链接到期前提醒（`ShareExpireNotifyScheduler` + `ShareLinkMapper#selectExpiringActive`）、
  取件回执（`ShareAccessService#redeem` 回推创建者）；`NotifyType` 新增 `9 = SHARE_ACCESSED`（`sql/V17`）；
- 💬 **轻 IM @ 提及 + 消息保留 ≥ 30 天**：`sql/V18` 落 `notify_message.mentioned`（行级）+ 清理索引；
  上行 `mentionUserIds`、下行 `mentioned` / `mentionUnreadCount`；`ChatRetentionScheduler` 按 ≥30 天下限
  物理分批清理（GAP-08 关闭）。

**回归证据（2026-09-29 实跑）**：后端 8 模块 **661 例**全绿（at-common 30 / at-gateway 55 / at-auth 55 /
at-transfer 46 / at-permission 225 / at-file 148 / at-collaboration 72 / at-bootstrap 30）；
前端 **73 文件 / 828 例**全绿。

**待实现（按 P0 顺序建议，相关表已随 V1 就绪）**：
1. ~~认证切面 + 双令牌 + Redis 会话~~ **✅ 已实现（2026-09-07）**：Spring Security 过滤链 +
   access JWT（`ver=token_epoch`）+ refresh Redis 白名单原子轮换 + 登录失败计数锁定；
   Flyway V3 增列 `sys_user.token_epoch` 已落地；端点 `/api/v1/auth/{token, token/refresh, logout, me}`。
2. ~~访问判定 + 资源归属校验~~ **✅ 守卫已就绪（2026-09-07）**：`@RequiresPerm` +
   `AccessControlService` 可作为各业务模块 by-id 访问的统一入口；剩余：RBAC 写管理
   （角色/授权界面与 `invalidate` 触发点）待业务模块实现期接入；
3. ~~上传主线（sys_upload_task 状态机 + uploaded_indexes 分片索引 + merge 短事务 + 整件 SHA-256 校验）~~
   **✅ 已实现（2026-09-14）**：落地于 `at-transfer`——`TransferController` 五端点（`precheck` / `GET parts` /
   `PUT parts` / `merge` / `DELETE`）+ `TransferTaskService` 编排 + `TransferTaskStateStore`（`SELECT ... FOR UPDATE` + 状态 CAS）
   + `ChunkStore`（`.tmp` 原子改名落片 / 流式合片 / 服务端重算 SHA-256）+ `ChunkIndexes`（`uploaded_indexes` 索引集）；
   合片产物经 `FileIngestPort` 交 `at-file` 登记（不破坏依赖铁律）；单测 25 例（服务层 18 + 控制器 7）；
4. ~~审批主线（冲突判重 1008/1009 + CAS + 到期回收定时任务）~~ **✅ 已实现（2026-09-29 复核）**：
   落地于 `at-permission`——`PermissionApplicationService` 编排申请与三选一审批（通过 / 驳回 / 转审）
   + 授权**随审批同事务**写入 + `PermissionGrantExpireScheduler` 到期回收；审批人解析经
   `ApprovalNodeResolverChain`（CE 默认 `SingleNodeApprovalResolver`，接口已上收 at-common `spi.approval`）；
5. ~~外发分享（下载三校验 + 次数原子扣减 + 审计）~~ **✅ 已实现（2026-09-13）**：落地于 `at-file`
   （**非**本文档原规划的 at-collaboration，差异见 [AT-DIFF-06](../development/AT-DIFF-todos.md#at-diff-06-外发分享模块归属)）；
   创建者侧 `ShareController` + 访客侧免登录 `ShareAccessController`，含一次性票据（Redis `GETDEL`）、
   Redis 前置闸 + DB 原子扣减、提取码连错锁定、`ContentScanInterceptor` 后缀 / 敏感词拦截与取件审计；
   并发集成测试 `ShareQuotaConcurrencyIntegrationTest` 已验证「额度 3 / 并发 12 恰好 3 成功」不超发。

## 9. 🔗 关联文档

- 产品范围与验收：[PRD](../prd/README.md)；时序基线：[use-case-flows](./use-case-flows.md)；
  接口契约：[API](../api/README.md)、[error-codes](../api/error-codes.md)；
  模块总览：[architecture/README](./README.md)；
  迁移脚本：[sql/README](../../sql/README.md)。
- **红队评审（越权 / 并发 / 事务边界门禁清单）**：[red-team-review](./red-team-review.md)。
