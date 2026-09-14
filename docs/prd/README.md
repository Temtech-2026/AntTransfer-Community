# 📋 AntTransfer CE 产品需求文档（PRD）

| 项 | 内容 |
| --- | --- |
| 产品 | AntTransfer CE（Community Edition）— 开源「安全文件传输 + 权限管控」平台 |
| 版本 / 状态 | v0.2-draft · 待评审（v0.2 增补：P0 补「工作台数据总览」、P1 补「批量打包 / 任务级限速 / 文件历史版本」，并新增 §4.1 实现现状核查） |
| 日期 | 2026-09-13 |
| 优先级口径 | MoSCoW + P0/P1 双轨：**Must ↔ P0**（1.0 发布门槛）、**Should ↔ P1**（1.x 迭代）、**Won't ↔ EE 专属**（战略规划书右栏能力，仅留扩展点），详见 §1.1 |
| 技术基线 | 前端 React 19 / Ant Design Pro v6（Umi Max + TypeScript，Node ≥ 22）；后端 Spring Boot 3.5 / Java 21 模块化单体（`server/` 8 个 `at-*` 模块）；MySQL 8.0 + Redis 7 + Flyway |
| 目标用户 | 开发者与中小团队（≤ 500 人规模） |
| 关联文档 | [README](../../README.md)、[架构说明](../architecture/README.md)、[系统设计](../architecture/system-design.md)、[核心用例时序](../architecture/use-case-flows.md)、[API 约定](../api/README.md)、[错误码表](../api/error-codes.md)、[AT-DIFF 待裁决](../development/AT-DIFF-todos.md) |

> 本文档定义产品范围（P0 / P1 / Won't）、用户故事与验收口径，作为迭代排期、开发与测试的基准。凡未列入 P0/P1 的需求，须先评审再进入。

---

## 1. 🎯 背景与产品定位

AntTransfer CE 面向**开发者与中小团队**，解决三类日常痛点：

1. **大文件传不动**：跨网络传大文件靠聊天工具/网盘，无进度、易中断、无一致性校验；
2. **权限不可控**：共享盘「谁都能看」，敏感文件（合同、密钥、客户数据）无分级、无申请留痕；
3. **外发无边界**：链接一给就永久有效、任意转发，无法限制有效期/次数/提取码。

定位一句话：**自托管的、把「传输能力」与「权限管控」做成一个闭环的开源平台**——传得动、传得稳、给谁看不给谁看可管可审。

交付形态：Docker Compose 一键部署的模块化单体（`server/` 8 个 `at-*` 模块）+ Web 前端（`web/`），开箱即用，遵循 Apache 2.0。

### 1.1 产品范围边界（MoSCoW + P0/P1）

> 范围采用 **MoSCoW（Must / Should / Won't）** 与 **P0 / P1** 双轨标注，并与战略规划书对齐：
> **Must** ↔ 战略规划书 P0 清单；**Should** ↔ 战略规划书 P1 清单；**Won't** ↔ 战略规划书「0.3 节」右栏 **EE 专属**能力（CE 不实现，仅预留扩展点）。
> 注：战略规划书当前为外部归档文档，入库后在此补精确章节引用。

| MoSCoW | 优先级 | 内容 | 说明 |
| --- | --- | --- | --- |
| **Must** | **P0** | 传输引擎（分片上传 / 断点续传 / 秒传 / SHA-256 校验）；RBAC + 三权分立；分级权限申请审批闭环（低中高，单级可配）；JWT 双令牌；外发链接（有效期 + 提取码 + 次数）；站内通知；**工作台数据总览**；Docker Compose 部署 | 1.0 发布门槛，全部交付并通过验收方视为 1.0 |
| **Should** | **P1** | 权限地图、IM、邮件、待办中心、**批量打包**、**任务级限速**、**文件历史版本**、回收站、标签、搜索、传输统计、中英文国际化 | 1.x 迭代持续交付 |
| **Won't** | — | AI DLP、盲水印、KMS 存储加密、多租户、ES 高级审计、杀毒、动态多级审批、QUIC、SSO | 对应战略规划书右栏 **EE 专属**；本期不做，但**预留扩展点**，见 §8 |

---

## 2. 👥 用户画像

| 画像 | 角色 | 典型场景与诉求 | 关键痛处 |
| --- | --- | --- | --- |
| **P1「普通成员」**（业务操作员） | 研发 / 产品 / 财务 / 市场等团队一线员工 | 传大文件、发外链、访问共享空间、被通知审批结果 | 传一半断了要重来；不小心把链接转给外人；想看某个目录没权限却不知找谁 |
| **P2「共享空间 Owner / 审批人」** | 部门负责人、项目负责人、资源责任人 | 有人申请访问自己名下资源，需要判断并批准/驳回；配置敏感级别 | 审批消息淹没在邮件/IM 里；没有统一的待办入口；不知道谁下载过什么 |
| **P3「系统管理员」**（三权之一） | 团队内被指派的运维/管理员 | 建账号、配角色、配外发链接默认参数、部署升级、看系统健康 | 装机要配一堆中间件；出问题难以定位；离职账号收回麻烦 |
| **P4「安全管理员」**（三权之一） | 负责权限策略的成员 | 定义敏感级别与审批规则、分级授权、配置访问边界 | 想做到「最小权限」但缺工具；文件分级后没人执行申请流程 |
| **P5「安全审计员」**（三权之一） | 独立于管理与操作的角色 | 查看操作与审批日志、追踪敏感文件流向、导出审计报告 | 日志分散无法关联；事后追责缺证据；无 6 个月以上留存 |
| **P6「外部协作者」** | 客户 / 供应商 / 外包，无平台账号 | 凭提取码在有效期内下载对方发来的文件 | 没账号也能下载；链接过期/次数用完即失效，不用联系管理员 |
| **P7「二次开发者 / 开源贡献者」** | 集成方、社区 | 在 CE 上改造、贡献代码、对接企业系统 | 模块边界是否清晰、扩展点在哪、文档是否齐全 |

**角色关系要点**：三权分立中 P3/P4/P5 三个管理角色**互斥**（同一账号不得兼任两个管理角色，且管理角色不得用于日常文件业务）；P6 是无账号的外部身份，只走外发链接通道。

---

## 3. 🧩 核心用户故事（含验收标准）

### US-01 分片上传 + 断点续传（P0）
作为**普通成员**，我希望上传超大文件时能断点续传而不是失败重来，以便在弱网/中断场景下不丢工作。

验收标准：
- Given 我上传一个 10 GiB 的文件（默认分片 8 MiB），When 上传到约 60% 时断网，Then 恢复网络后在同一会话/登录态内继续上传，无需重新选择文件，服务端校验已传分片后只续传缺失分片；
- Given 任一并发上传会话，When 前端取消上传，Then 已传分片按策略保留（默认保留 24h 供续传），服务端任务状态为 `PAUSED/CANCELLED`；
- When 上传全部完成，Then 任务状态变为 `COMPLETED`，前端展示进度 0→100% 且无跳变回退；
- 同一时刻单文件并发上传分片数 ≤ 5，分片最大 8 MiB（可配置），重复上传同名同内容文件必须命中「秒传」（见 US-02），不得重复落盘。

### US-02 秒传 + SHA-256 一致性校验（P0）
作为**普通成员**，我希望同一文件只上传一次，且上传结果可被校验，以便省流量并确保文件没有被损坏。

验收标准：
- Given 服务端已存在同一 SHA-256 摘要的文件，When 我再次上传，Then 秒传命中：立即返回 `COMPLETED`，接口耗时 < 5 s（1 GiB 文件），不产生新的物理存储副本；
- When 普通上传完成，Then 服务端必须基于已收分片重算 SHA-256 与客户端上报值比对，一致才落库为成功；不一致则返回 `校验失败` 且不生成可用文件记录；
- Given 文件元数据记录，Then 可通过 API 查询其 SHA-256、长度、分片清单，用于事后审计。

### US-03 外发链接（有效期 + 提取码 + 次数）（P0）
作为**普通成员**，我希望把文件发给没有账号的外部协作者时，链接带有效期、提取码和下载次数上限，以便控制文件外溢。

验收标准：
- Given 我选择一个「已受控文件/空间内文件」，When 创建外发链接，Then 必须设置：有效期（默认 7 天，最长不超过管理员配置上限）、提取码（≥ 6 位，可含字母数字）、下载次数上限（默认 10 次）；
- Given 提取码错误连续 5 次，When 外部协作者继续尝试，Then 该链接被临时锁定（30 分钟），并通知链接创建者；
- Given 链接到达有效期或下载次数用尽，When 协作者访问，Then 返回「链接已失效」，该文件对链接通道不可再访问；
- When 链接创建者主动撤销，Then 链接立即失效，已生成的历史下载记录仍保留可审计；
- 外部协作者访问**无需登录**，全程不暴露文件真实存储路径，仅可通过提取码通道下载。

### US-04 RBAC 角色授权（P0）
作为**系统管理员**，我希望用角色而非逐个账号来授权，以便满足最小权限与快速开人/销人。

验收标准：
- Given 我已创建角色（如「研发-只读」「财务-读写」），When 为新成员分配角色，Then 成员立即获得该角色全部权限点，无需重新登录；
- Given 某个角色被禁用/移除某权限点，When 该角色成员访问对应功能，Then 后端按权限点鉴权拒绝（`403`），前端隐藏入口；
- When 成员被停用，Then 其 access token 在 ≤ 2 分钟内失效（吊销生效），已登录会话不可再调用受保护接口；
- RBAC 模型必须覆盖「菜单/操作按钮/数据范围（本人-本部门-全部）」三维度，权限点全量可枚举（供权限地图 US-P1-1 展示）。

### US-05 分级权限申请—审批闭环（P0）
作为**普通成员 / 审批人**，我希望访问高于我权限的敏感资源时走「申请→审批→通知」闭环，以便敏感文件访问留痕可控。

验收标准：
- 资源敏感级别三档：**低 / 中 / 高**；文件默认继承所在空间级别，空间/文件 Owner 可单独调级；
- 审批规则**单级且可配置**：系统可针对每一敏感级别配置「无需审批自动放行 / 需一级审批」；本级版本只支持一级审批（多级属 Won't，见 §8）；
- Given 我（无权）尝试访问「中」级目录或下载其中文件，When 系统拦截并提示发起申请，Then 生成一条申请单，字段含**类型**（访问 / 下载）、目标资源、级别、目的（理由）、拟授权期限（默认 24 h），并为同资源**已有生效授权 / 重复在审申请**做冲突校验（命中则提示，不产生重复单）；
- When 申请提交且校验通过，Then 自动路由到该资源 Owner（或配置的安全管理员）的待办与站内通知；审批人可**批准（可改授权期限）、驳回（必填理由）或转审（reassign）给可审批该资源的人**；
- When 审批通过，Then 发布 `PermissionGrantEvent` 并**写入带过期时间的授权记录**，申请人收到站内通知，获得限时权限（默认 24 h），超期自动回收，全程写入审计（详细系统时序见 docs/architecture/use-case-flows.md）；
- Given 我尝试访问「高」级资源且未获授权，Then 任何非申请通道（含直链、搜索命中但无权）均不得预览/下载内容，仅展示元数据占位。

### US-06 三权分立与审计（P0）
作为**安全审计员**，我希望系统管理员、安全管理员、审计员三方权责互斥且全量审计，以便满足内部合规与事后追责。

验收标准：
- 系统内置三套管理角色并**强制互斥**：系统管理员（账号/系统/参数）、安全管理员（权限点/敏感级别/审批规则）、安全审计员（只看审计，不操作业务与授权）；任一账号不可同时具备两个管理角色，管理角色不携带文件业务权限；
- 关键操作（登录、授权变更、级别变更、审批结论、外发链接创建/撤销、文件下载、删除）**全部**产生审计事件，审计员角色执行的操作同样被记录；
- 审计员可检索审计记录（操作人/对象/时间/结果/IP）并导出报告；**审计记录不可被任何角色修改或删除**（仅可归档/导出），留存 ≥ 6 个月（可配置 3/6/12 个月，见 §7）；
- Given 审计员角色，When 其尝试执行任何写操作（改权限/删文件），Then 被后端拒绝并记录一条审计事件。

### US-07 JWT 双令牌（P0）
作为**普通成员**，我希望登录状态安全且不用频繁输密码，以便长会话使用与安全性兼顾。

验收标准：
- 登录成功后签发 `access token`（有效期默认 30 分钟）与 `refresh token`（有效期默认 7 天）；
- When access token 过期，Then 客户端静默用 refresh token 换取新令牌对，**refresh token 必须轮换**（旧 refresh 即失效）；
- Given 同一 refresh token 被使用两次（疑似被盗重放），When 服务端检测到，Then 吊销该用户当前全部令牌并要求重新登录；
- When 用户主动注销 / 被停用 / 改密，Then refresh token 立即吊销；refresh token 有效期到后强制重新登录。

### US-08 站内通知（P0）
作为**普通成员 / 审批人**，我希望审批结果与安全事件都汇集到站内通知，以便不再错过关键动作。

验收标准：
- 通知类型含：**审批待办、审批结果（通过/驳回）、外发链接被锁定、链接到期提醒、异常登录告警**；
- 通知中心区分未读/已读，未读角标实时更新（轮询 ≤ 30 s）；关键类型（审批、告警）支持同时触发邮件（P1 打通）；
- Given 一条审批待办通知，When 我在任意一端处理，Then 另一端同步标记已处理，不产生重复待办。

### US-09 回收站与恢复（P1）
作为**普通成员 / 空间 Owner**，我希望误删文件先进回收站可恢复，以便降低误操作损失。

验收标准：
- 文件删除默认进回收站（保留期默认 30 天，可配置），保留期内仅 Owner/管理员可见并可直接恢复原路径；
- 回收站到期或被清空后物理删除并记录审计；高敏级文件删除必须二次确认。

### US-10 标签 / 搜索 / 统计（P1）
作为**普通成员 / 安全管理员**，我希望给文件打标签并全库检索、看传输与访问统计，以便管理与洞察。

验收标准：
- 文件/空间支持多标签，可按标签筛选；搜索支持文件名 + 标签 + 上传者，且只返回当前用户有权限的结果（无权限内容不泄露命中）；
- 统计中心（按空间/时间/类型）展示：上传下载量、外发链接点击与提取码失败、审批通过率等，数据来源为审计事件与传输任务，只读导出。

### US-11 工作台数据总览（P0）
作为**普通成员 / 管理员**，我希望登录后的工作台一屏汇总与我相关的关键数据，以便直接进入待办与最近活动，而不是在菜单里翻找。

验收标准：
- 工作台展示四类卡片：**我的待办**（待我审批 / 我提交的申请）、**最近活动**（我最近的上下载与外发）、**我的资源**（空间数 / 文件数 / 占用）、**外发链接状态**（有效 / 已过期 / 已锁定 / 次数将尽）；
- 所有卡片数据**按当前用户数据范围过滤**（数据范围 1/2/3 与 RBAC 一致），不得聚合出用户无权查看的资源名或计数；
- 首屏 **P95 < 1 s**（可缓存 + 分页），无数据时展示空态而非报错；单卡片失败时降级为局部错误占位，不阻塞整页；
- 卡片可下钻到对应列表页，且下钻后的筛选条件与卡片口径一致（同一数据源，禁止两套统计）；
- 未持有 `audit:log:read` 的用户，工作台不得出现任何审计类指标。

### US-12 批量打包与任务级限速（P1）
作为**普通成员 / 空间 Owner**，我希望把多个文件一次性打包下载、并给单个传输任务设置速率上限，以便批量取件又不挤占团队带宽。

验收标准：
- 选中 N 个文件（上限默认 **200 个 / 合计 20 GiB**，可配置）创建打包任务：异步生成 zip，期间不阻塞其他上传/下载任务；完成后站内通知，产物支持 Range 下载；
- 打包任务具备独立状态机（排队 / 打包中 / 完成 / 失败 / 已过期），产物默认保留 **24 h** 后自动清理，创建与下载均写审计；
- 超限组合在**创建入口即拒绝**（不可先排队后失败），并提示具体超限维度（文件数 / 总量）；
- 任务级限速：单任务可设速率上限（如 10 MB/s，**0 = 不限**），服务端按令牌桶/漏桶生效；限速仅作用于本任务，**仍受全局并发与带宽上限兜底**，全局超限时返回 `4103`；
- 限速变更的生效时机（即时生效 / 下次任务生效）必须在 UI 明示，不得让用户误判当前速率。

### US-13 文件历史版本（P1）
作为**空间 Owner / 成员**，我希望文件保留历史版本并可回滚，以便误覆盖或误改后能快速找回。

验收标准：
- 同名文件内容变更时自动形成新版本（版本号递增），默认保留最近 **10 个**版本（可配置，超出按策略清理最旧版本并审计）；
- 版本列表展示：版本号 / 大小 / SHA-256 / 上传人 / 时间 / 备注；支持**下载指定历史版本**与**回滚到指定版本**——回滚动作**生成一个新版本**，原有历史不丢失；
- 历史版本与主文件共用同一套权限与敏感级别约束（无主文件权限即无版本权限），下载历史版本同样写审计；
- 秒传去重键仍为全局 SHA-256，**不受版本维度影响**（不同版本的物理文件按哈希各自去重）。

---

## 4. 🗂️ 功能清单

| 模块 | 功能 | 优先级 | 验收要点 |
| --- | --- | --- | --- |
| **认证（at-auth）** | 本地账号登录 / 注销 / 改密 | P0 | 登录态可校验；改密后全端令牌吊销 |
| | JWT 双令牌（轮换 + 重放检测） | P0 | 满足 US-07 全部验收 |
| | 账号停用 / 启用 | P0 | 停用 2 分钟内会话失效 |
| **权限（at-permission）** | RBAC（角色-权限点-数据范围） | P0 | 满足 US-04；后端强制鉴权而非仅前端隐藏 |
| | 三权分立内置角色与互斥 | P0 | 满足 US-06；互斥规则在数据层约束 |
| | 敏感级别（低/中/高）与审批规则配置 | P0 | 单级可配；级别变更走审计 |
| | 分级权限申请—审批闭环 | P0 | 满足 US-05；超期自动回收授权 |
| | 权限地图 | P1 | 可视化展示角色×权限点×数据范围；支持查询某个成员的全部可达权限 |
| | 待办中心 | P1 | 审批待办统一入口，跨端同步已处理 |
| **文件与传输（at-transfer / at-file）** | 分片上传 + 断点续传 + 进度 | P0 | 满足 US-01 |
| | SHA-256 校验 + 秒传 | P0 | 满足 US-02；物理去重，一致性比对 |
| | 上传/下载流式接口、暂停恢复 | P0 | 下载支持 Range 断点 |
| | 文件管理（目录、移动、复制、删除） | P0 | 删除进回收站（回收站为 P1，P0 先行记录） |
| | 批量打包下载 | P1 | 满足 US-12；异步打包 + 产物过期清理，超限在创建入口即拒绝 |
| | 任务级限速 | P1 | 满足 US-12；单任务速率上限，仍受全局并发/带宽兜底（超限 4103） |
| | 文件历史版本 | P1 | 满足 US-13；回滚生成新版本，权限与审计与主文件一致 |
| | 回收站与恢复 | P1 | 满足 US-09 |
| | 标签 / 全文与标签搜索 | P1 | 满足 US-10；搜索权限收敛 |
| | 统计中心 | P1 | 满足 US-10；数据只读可导出 |
| **协作与分享（at-collaboration）** | 共享空间（Owner、成员、读写/只读角色） | P0 | 资源权限可继承到文件级 |
| | 外发链接（有效期/提取码/次数） | P0 | 满足 US-03；创建/撤销均审计 |
| | 站内轻 IM（会话与 @ 提及） | P1 | 文件与链接可转发到会话；消息持久化 ≥ 30 天 |
| **通知（at-collaboration 通知域）** | 站内通知中心 | P0 | 满足 US-08 |
| | 邮件通知 | P1 | 审批/告警触发邮件；失败静默降级不阻塞主流程 |
| **审计与合规（at-common / at-permission）** | 关键操作全量审计 | P0 | 满足 US-06；审计记录不可改删、留存 ≥ 6 个月可配 |
| | 审计检索与导出 | P0 | 支持按人/对象/时间/级别过滤导出 |
| **系统与部署（at-bootstrap / 工程化）** | Docker Compose 一键部署 | P0 | `docker compose up -d --build` 一键拉起 MySQL + Redis + 后端 +（可选）前端；环境变量覆盖默认参数 |
| | 配置管理（文件上限/分片/令牌时长/通知等） | P0 | 关键参数均环境变量可配，生产默认关闭调试口 |
| | 中英文国际化 | P1 | 界面文案全量 i18n；语言切换不丢失会话 |
| | 健康检查 / 优雅启停 | P0 | 就绪探针供 Compose 使用 |
| **工作台（web 首页）** | 数据总览（待办 / 最近活动 / 我的资源 / 外发链接状态） | P0 | 满足 US-11；按数据范围过滤，首屏 P95 < 1 s，可下钻 |

### 4.1 📊 实现现状核查（As-Is，2026-09-14 · 后端复核）

> 口径：以仓库当前代码为准（`server/` 8 模块 + `web/` + `sql/`），对照 §1.1 范围逐项核对。
> **本次修订范围：`server/` 后端**——`at-permission` 的「用户管理 / 角色管理 / 权限申请审批 / 审计日志」四条线本轮落地后重核；
> `web/` 前端现状未变，仍沿用 2026-09-13 结论。
> 图例：✅ 已落地（有实现 + 测试/验收证据）｜🟡 部分落地｜⬜ 未落地（仅表 / 实体 / 错误码等前置物）。
> 路径约定：本节端点一律**省略全局前缀 `/api`**（`server.servlet.context-path=/api`），故 `POST /v1/files` 的完整地址为 `/api/v1/files`；完整契约见 [API 约定](../api/README.md)。

#### P0（1.0 门槛）

| 能力 | 现状 | 证据与缺口 |
| --- | --- | --- |
| JWT 双令牌 | ✅ | `at-auth`：`POST /v1/auth/token`、`/token/refresh`、`/logout`、`GET /me`；access 30 min（HS256，`ver=token_epoch`）+ refresh 7 d 随机串原子轮换（Lua）+ 复用打击全端吊销 + 登录失败 5 次锁 15 min；`V3__add_user_token_epoch.sql` 落地；`AuthFlowIntegrationTest` 8 例全绿 |
| 本地账号登录 / 注销 / 改密 | 🟡 | 登录 / 注销已在 `AuthController` 闭环（端点与锁定、全端吊销明细见上行 JWT 行）。**缺口：无用户自助「改密」端点**——改密当前仅管理面 `POST /v1/system/users/{id}/reset-password`（`UserAdminPortAdapter#resetPassword` 在 SQL 内联 `token_epoch + 1`，故「改密后全端令牌吊销」语义已满足），但 §4 要求的「用户自助改密（校验旧口令）」无落点 |
| 账号停用 / 启用 | 🟡 | 双端协同：`at-permission` 的 `UserAdminService#changeStatus` 落 `sys_user.status`（权限点 `system:user:status`），`at-auth` 在**登录与刷新时服务端强校验**（禁用 → `1005 ACCOUNT_DISABLED`、锁定 → `1004 ACCOUNT_LOCKED`，不依赖失败计数）；`TokenSessionService#revokeAll` 以 DB `token_epoch+1`（唯一权威）+ 事务提交后清 Redis 实现全端吊销。**缺口：未满足 §4 验收「停用 2 分钟内会话失效」**——`changeStatus` **未联动吊销会话**（`revokeAll` 仅由登出 / 刷新遇停用 / refresh 重放触发，`at-permission` 侧零调用），且 `JwtAuthenticationFilter` 不做逐请求 `status` 校验，故已签发的 access 最长可用到 30 min 自然过期；需补「停用 → 跨模块吊销」联动（扩展 `UserAdminPort` 或订阅事件） |
| RBAC（角色-权限点-数据范围） | ✅ | `at-permission`：`@RequiresPerm` AOP（多角色并集 + 显式 Deny 优先）、`PermissionService`（`at:perm:{userId}` 缓存 30 min、变更 `invalidate` 即时生效）、`AccessControlService`（归属 + 数据范围 1/2/3 行级守卫）、`GET /v1/permission/my`、`GET /v1/permission-points`。**本轮补齐系统管理面端点（权限点见 `V9__system_admin_permission_points.sql`）**：用户管理 `/v1/system/users`（列表 / 详情 / 部门与角色选项 / 建号 / 编辑含调岗 / 启停 / 重置口令 / 分配角色 / 删除，对应 7 个 `system:user:*` 原子点，**写侧绕道 `UserAdminPort` SPI**）+ 角色管理 `/v1/roles`（列表 / 选项 / 详情 / 建 / 改 / 删 / 查授权 / 授权整集替换，对应 `system:role:*` 原子点）；相关单测 36 例（用户 19 + 角色 17） |
| 三权分立 | 🟡 | 实际内置 4 角色 `SUPER_ADMIN / DEPT_ADMIN / AUDITOR / USER`（`V2__init_data.sql`）：**原 system_admin / security_admin 职能已并入 SUPER_ADMIN**，仅审计独立（AUDITOR 仅 `audit:log:read`、写操作天然 403）。本轮已落实两条锚点：**内置角色保护**（`RoleAdminService` 四条红线：内置角色不可删、内置角色数据范围不可改、`AUDITOR` 权限集锁定只读 `ErrorCode.AUDITOR_PERM_LOCKED`、非全量数据范围不得提权 `ErrorCode.PRIVILEGE_ESCALATION`）与**防自锁**（账号维度 `UserRoleMapper.countByRoleId` + 权限维度 `SystemAdminConstants.SUPER_ADMIN_REQUIRED_PERMS` 双重兜底）。**缺口：角色互斥（SUPER_ADMIN / AUDITOR 等不可兼得）仍仅有设计口径**（system-design §3.2）——全仓库 `mutex` / 互斥 / `exclusive` **零命中**，数据层约束与服务层校验均未实现 |
| 敏感级别（低 / 中 / 高）与审批规则配置 | 🟡 | 已落地：`sys_file_node.level`（**1 低 / 2 中 / 3 高，按引用独立、可高于物理文件默认级**，见 `FileNode` 类注释）+ `NodeQuery.level` 作为检索过滤维度；审批侧 `sys_approval_request.level` 与 `ApprovalProperties` 按低 / 中 / 高提供 **SLA 24 / 12 / 4 h**、升级目标与紧急窗口。**缺口：①「单级可配」（每级别自动放行 / 一级审批）无落点**——无规则表、无配置端点，仅 `defaultApproverId` 兜底；**② 敏感级别无变更端点，亦无「级别变更走审计」的动作记录**（`OperationLog` 动作字典中无级别变更项）；**③ 缺少「提级需审批」的强制联动**，级别当前仅用于上传落库与检索过滤 |
| 分级权限申请审批闭环 | 🟡 | 本轮补齐主线：`PermissionApplicationController`（`/v1/permission`）提供 **提交 `POST /applications`、通过 `POST /applications/{id}/approve`（授权落地含有效期）、驳回 `/reject`、转审 `/transfer`、待我审批 `GET /applications/pending`、我的申请 `GET /applications/mine`、权限地图 `GET /map`**；配套 `sys_approval_request` / `sys_approval_node` / `sys_user_file_permission` 三表（含 `level`、`grant_source`、`expire_at`）、状态机 `ApprovalStateMachine`、错误码 `1008/1009/1010`、`PermissionGrant` 实体、到期 CAS 回收 `PermissionGrantExpireScheduler` + `PermissionExpiredEvent`、超时升级 `ApprovalEscalationScheduler`、紧急通道 `EmergencyApprovalScheduler`（`ApprovalProperties` 按低 / 中 / 高 SLA 24 / 12 / 4 h、升级目标与紧急窗口可配）；审批链路已接审计（`APPROVE` / `REJECT` / `TRANSFER` / `GRANT`）。**缺口：① 申请人主动「撤销」申请单的端点缺失**（`PermissionGrantService.revokeApprovalGrants` 仅由调岗 / 停用被动触发回收，非申请人撤回）；**② §6「每级别自动放行 / 一级审批」的运行时可配规则无落点**——现仅配置文件 + 兜底审批人（`defaultApproverId`），无「自动放行」分支，亦无审批规则配置表 / 端点 |
| 上传 / 下载流式接口（含 Range 断点） | 🟡 | 下载 ✅：`GET /v1/files/{nodeId}/content` 支持 `Range`（`LocalFileStorage` 流式输出 + 任务级 `speedLimit`），外发链接匿名下载复用同一通道；上传 ✅：`POST /v1/files`（multipart）**流式落盘并边写边算 SHA-256**，不整文件入内存。**缺口：无「暂停」后端语义**（无 `PATCH /v1/transfers/{uploadId}` 暂停端点，进行中任务不会转入 `2 暂停` 态）；**「恢复」已落地**——`GET /v1/transfers/{uploadId}/parts` 回服务端已确认分片清单，中断后重进页面只补缺片（见下行），不再整文件重传 |
| 文件管理（目录 / 移动 / 复制 / 删除） | ✅ | `FolderController`（`/v1/folders`：`GET /tree` / 建 / `PATCH /{id}/rename` / `PATCH /{id}/move` / `DELETE /{id}`）+ `FileController`（`PATCH /{nodeId}/rename`、`PATCH /{nodeId}/move`、`POST /{nodeId}/copy`、`DELETE /{nodeId}` 软删、`POST /batch/recycle` 批量回收、`GET /recycle`、`POST /{nodeId}/restore`、`DELETE /{nodeId}/destroy` 彻底销毁、`POST /recycle/empty` 清空）；写操作统一过 `FileOwnershipGuard` 归属校验并写审计，`file:destroy` 已收敛至仅 SUPER_ADMIN |
| 分片上传 / 断点续传 | ✅ | 本轮落地：`at-transfer` 新增 `TransferController`（`/v1/transfers`：`POST /precheck` 秒传预检 + 上传票据、`GET /{uploadId}/parts` 已收分片、`PUT /{uploadId}/parts/{index}` 单分片 multipart（字段 `chunk` / `hash`）、`POST /{uploadId}/merge` 合片落库、`DELETE /{uploadId}` 取消清暂存）+ `TransferTaskService`（编排）+ `TransferTaskStateStore`（`SELECT ... FOR UPDATE` + 状态 CAS）+ `ChunkStore`（`.tmp` 原子改名落分片 / 流式合片 / 服务端重算 SHA-256）+ `ChunkIndexes`（`uploaded_indexes` 索引集）；状态机 `0 排队 / 1 传输中 / 2 暂停 / 3 完成 / 4 失败 / 5 取消 / 6 合并中` 与 `isTerminal()` 生效；秒传未命中（4001）与缺片（4002）按 **B 类分支码 = HTTP 200 + `code` + `data` 载荷** 返回（异常化会丢 `data`，见 `Result#failWithData`）；`V10__upload_task_parent_id.sql` 补 `sys_upload_task.parent_id`（同内容传到不同目录不再复用票据）；测试 25 例（`TransferTaskServiceTest` 18 + `TransferControllerTest` 7）。**缺口：无「暂停」端点与语义**（无 `PATCH /v1/transfers/{uploadId}`，「暂停」态 `2` 只能由外部写入）——「恢复」已由 `GET /parts` 覆盖（见上行「上传 / 下载流式接口」） |
| 秒传 + SHA-256 校验 | ✅ | `at-file`：`POST /v1/files/instant`（`InstantUploadRequest` → `FileContentService.instantUpload`，命中既有内容只建引用、不传字节）+ `POST /v1/files`（multipart 直传，**服务端流式重算 sha256、不信任客户端上报**）；内容寻址存储 `LocalFileStorage` + `FileHashUtils`，`sys_file_object.sha256` 唯一键去重；错误码 `4001/4002/4003` 已接入 |
| 共享空间（Owner / 成员 / 读写角色） | ⬜ | 未落地：`sys_space` 表已建（`sql/V4__menu_route_user_type_and_collaboration.sql`），但 `CollaborationSpace` 实体自述为「骨架」，且**无 `SpaceController` / `SpaceService` / 成员增删改端点**（`at-collaboration` 仅有 Notify / Chat / Todo 三组端点）；`sys_group_member` 当前只被 `ChatService` 用作**会话群成员**，与「空间成员 + 读 / 写角色」不是同一语义（无空间维度的角色字段）。影响：P0「共享空间」不可演示，且「文件 / 任务挂载到空间」的能力无处调用 |
| 外发链接 | ✅ | `at-file`：`ShareLinkService`（创建 / 撤销 / 详情 / 我的列表；有效期 · 提取码 ≥ 6 位 · 次数限制 · 错 5 次锁 30 min；quota 镜像 + Redis 前置闸）+ `ShareAccessService`（匿名 verify / redeem / `Range` 下载；DB 原子扣减兜底）+ `ShareTicketService`（短时票据，`<a>` / `<img>` 免登录取件）；创建与撤销均写审计（`ShareAuditLogger`）；并发口径有 `ShareQuotaConcurrencyIntegrationTest` 2 例兜底 |
| 站内通知 | ✅ | `at-collaboration`：`NotifyController`（`/v1/notifications`）提供分页、`/unread` 角标、`/offline` 离线拉取、`POST /{id}/read`、`/read-all`；通知渠道含站内（`sys_notify_message`）与**邮件 `MailNotifier`**（`NotifyProperties` 控制开关，发送失败降级不阻塞主流程） |
| 审计与合规 | ✅ | 共享内核 `com.anttransfer.common.audit`（`OperationLog` + `OperationLogMapper`，本轮由 `at-file` 下沉至 `at-common`）+ 三域写入器（`FileAuditLogger` / `ShareAuditLogger` / `PermissionAuditLogger`；**成功记录入调用方事务、失败记录走 `REQUIRES_NEW` 独立事务先提交**）+ 只读检索导出 `AuditLogController`（`GET /v1/audit/logs` 分页、`GET /v1/audit/logs/export` CSV，共用 `audit:log:read`，仅 SUPER_ADMIN / AUDITOR）；本轮补齐权限 / 审批域埋点 15 处（用户 6 + 角色 4 + 审批 4 + 授权回收 1，另在「审批通过」时追加一条 `GRANT` 授权落地记录；口令类只记「谁重置了谁」）；全链**无任何 update / delete 端点**（`audit:log:clear` 从不签发）；单测 11 例（`AuditLogQueryServiceTest` 7 + `AuditLogCsvTest` 4） |
| 工作台数据总览 | ✅ | 后端 `at-transfer`：`TransferStatisticsController`（`GET /v1/transfers/statistics`，**登录即可用、不挂权限点**）按登录人聚合 `sys_operation_log` 的 `FILE_UPLOAD` / `FILE_DOWNLOAD` 流水——条数按结果分成功 / 失败，字节取**实际过网量**（上传用 `transferredBytes`，秒传命中为 0；下载用 `sentBytes`，`Range` 续传只计本段），无任何流水时 `successRate=null` 以区分「还没数据」与「全失败 0%」；单测 5 例 + Testcontainers 集成 3 例。前端 `web/src/pages/workbench` 四卡片（传输量 / 传输成功率 / 待我审批 / 待办数）全部接真实接口，单卡片失败仅降级为「--」占位、不阻塞整页 |
| 配置管理 / 健康检查 / 优雅启停 | 🟡 | 配置管理：`application.yml` 已把**连接类与安全类**参数环境变量化（`SERVER_PORT` / `DB_*` / `REDIS_*` / `FLYWAY_ENABLED` / `AUTH_ACCESS_TOKEN_SECRET` / `ANTTRANSFER_CORS_ALLOWED_ORIGINS`），业务阈值（令牌 TTL、共享下载上限与有效期、提取码锁定、内容扫描开关、通知开关、离线补拉与历史上限）集中在 `anttransfer.*` 配置块——**改配置文件可以，但未做环境变量占位**。**① 文件上传上限已补齐（本轮）**：`spring.servlet.multipart` 配 `max-file-size=64MB` / `max-request-size=80MB` / `file-size-threshold=0`，与 `anttransfer.transfer.max-chunk-size` 对齐——分片端点每次只应收到一个分片，故上限刻意贴近**单分片**而非单文件（放宽到 GB 级只会让超长请求先落临时文件、再被业务按 `size` 拒绝，白耗暂存盘与带宽）；整文件上限由业务侧 `max-chunk-size × max-chunk-count` 判定，超限在上传入口回 `4006`。**缺口：② **无健康检查端点**（`management.*` / actuator 零命中）；③ **未开启优雅启停**（无 `server.shutdown=graceful`，默认 immediate）；④ compose 中 **server 服务无探针**，「就绪探针供 Compose 使用」未满足 |
| Docker Compose 部署 | 🟡 | `docker-compose.yml`（MySQL 8.4 + Redis 7 + server）+ 多阶段 `Dockerfile` + `docker-compose.dev.yml` 已就绪，`SPRING_PROFILES_ACTIVE=prod` 亦已接入，MySQL / Redis 均配 healthcheck（**server 自身无探针**，见上行「配置管理 / 健康检查 / 优雅启停」）。**缺口：前端 `web/` 未纳入编排**（§4 表述为「可选前端」），「一键拉起全栈」目前仅覆盖后端 + 中间件 |

#### P1

**后端复核（2026-09-14）**：

- ✅ **已落地**：批量打包下载（`PackService` + `sys_pack_task`，异步打包 + 产物过期清理 + 失败任务收敛）、任务级限速（`BandwidthLimiter` + 下载端点 `speedLimit`，与全局并发 / 带宽兜底叠加）、文件历史版本（`FileVersionService` / `FileVersionController`，权限点 `file:version`：`GET|POST /v1/files/{nodeId}/versions`、`POST .../{versionNo}/rollback`）、回收站与恢复（含彻底销毁 `file:destroy` 已收敛至仅 SUPER_ADMIN）、标签与关键词搜索（`TagService` + `FileController#page` 的 `NodeQuery`：`folderId / keyword / ext / level / size 区间 / 时间区间 / tagId / sort`；**`keyword` 为 LIKE 匹配、未建全文索引**，故 §4「全文搜索」尚未满足）、目录树（`FolderService` + `sys_folder` 物化路径）、站内轻 IM（`ChatController`：发消息 / 拉历史 / 标记已读，`scope + targetId` 会话维度）、邮件通知（`MailNotifier`）、待办中心（`TodoController`：`GET /v1/todos` 分页三态 + `GET /v1/todos/count` 角标）、权限地图（`GET /v1/permission/map`）；
- ⬜ **仍缺**：中英文国际化**业务文案未接入**（ADP 模板自带 `web/src/locales` 具备框架能力，但业务页未接入）、传输统计 / 统计中心（无后端聚合接口）、站内轻 IM 的 **@ 提及**与「消息保留 ≥ 30 天」策略（无归档 / 清理任务，保留期无实现）；
- **表与契约**：所需表由 `sql/V6__file_management.sql` 创建 —— `sys_folder`（物化路径目录树）、`sys_file_node`（引用层）、`sys_file_version`（历史版本）、`sys_tag` / `sys_file_tag`（标签与关联）、`sys_pack_task`（异步打包任务）；`sql/V7` 补 `sys_pack_task.node_ids` 输入清单；`sql/V8` 把 `file:destroy` 收敛至仅 SUPER_ADMIN；`sql/V9__system_admin_permission_points.sql` 补系统管理面权限点（`system:user:*` 7 个 + `system:role:*` 系列，**仅授 SUPER_ADMIN、AUDITOR 一个不授**）。对外契约见 `docs/api/README.md` §1 与 `docs/api/error-codes.md`（`4013~4023`）。

#### Won't

均未实现（符合预期）。§8 所列扩展点的 CE 落地状态与「命名权威源」待办，见 §8 与 [`architecture.md` §4「⏸ 延期登记」](../architecture/architecture.md) 的 D-2 条目（附录 C 的 7 个接口名当前全仓库零命中，暂以附录 C 命名为准）。

#### 横切地基（超出 P0 清单，但为 P0 前置）

✅ 统一返回体 `Result` / `PageResult`、错误码分段（`0/1xxx/2xxx/4xxx/5xxx`，含 A~H 处理策略标注）、全局异常处理（15 类异常分轨映射）、`traceId` 全链路（logback pattern 消费）、访问日志、`@RateLimit` 固定窗口限流（`4290`）、CORS 属性化、前端契约改造（`web/src/utils/result.ts`、`utils/token.ts`、`requestErrorConfig.ts`，31 例单测通过）。

**后端测试盘点（2026-09-14）**：`server/` 共 20 个测试类 —— `at-permission` 11 类（`PermissionApplicationServiceTest` 21 · `UserAdminServiceTest` 19 · `RoleAdminServiceTest` 17 · `PermissionGrantServiceTest` 9 · `AuditLogQueryServiceTest` 7 · `ApprovalStateMachineTest` 6 · `AccessControlServiceTest` 6 · `PermissionServiceTest` 5 · `AuditLogCsvTest` 4 · `AccessRuleResolverChainTest` 4 · `ApprovalPropertiesTest` 3）、`at-file` 2 类（`FileOwnershipGuardTest` 11 · `ContentScanChainTest` 6）、`at-auth` 2 类（`AuthServiceTest` 6 · `JwtTokenProviderTest` 5）、`at-common` 2 类（`ResultTest` 7 · `PageResultTest` 5）、`at-bootstrap` 3 类（集成测试 `AuthFlowIntegrationTest` 8 + `ShareQuotaConcurrencyIntegrationTest` 2，另有 `FillMetaObjectHandlerTest` 5）。

**开放裁决项**：`AT-DIFF-01` 已裁决（**「权限不足 = `1003` / 403」**，原 `1003 TOKEN_INVALID` 后移至 `1006`，属破坏性契约变更，已同步 `docs/api/error-codes.md` 与前端 `web/src/utils/result.ts`）；`AT-DIFF-02`（Filter 权限加载）、`AT-DIFF-03`（部门范围拦截器）、`AT-DIFF-05`（接口命名）待整体完工前裁决；`AT-DIFF-06 ~ 10` 为「已实现、未阻塞」的登记项。详见 [AT-DIFF 待裁决清单](../development/AT-DIFF-todos.md)。

---

## 5. 主用例时序描述（文字版）

### 用例 A：大文件上传断点续传 → 外发链接给外部协作者

1. 张工（普通成员，属「研发部」）在浏览器登录 AntTransfer CE，获得 access/refresh 双令牌；前端每 30 分钟静默换新令牌。
2. 张工进入协作空间「产品发布」，点击上传 4.2 GiB 的安装包；前端把文件切成 8 MiB 分片，逐片计算 SHA-256 后**先请求预检**：服务端在文件库查询该哈希，未命中则返回「需要上传」及分片清单。
3. 前端并发（≤ 5 片）上传分片，服务端逐片校验哈希与顺序，落盘为临时分片并更新传输任务进度；上传到 63% 时张工网络中断。
4. 网络恢复后前端继续上传：服务端比对已收分片，**只接收缺失分片**，进度从 63% 继续而非归零；全部到齐后服务端重组文件、整体重算 SHA-256 与客户端一致，任务置为「已完成」，写入文件元数据与审计事件。
5. 张工选中该文件点击「创建外发链接」，设置：有效期 7 天、提取码 `AT-8392`、最多下载 10 次；系统生成不可猜测链接并返回。
6. 张工把链接发给客户王工（无账号）。王工打开链接输入提取码，直接流式下载（支持 Range）。系统在下载时校验「未过期、次数未用尽、提取码正确」三条件，并记录第 n/10 次下载。
7. 第 11 次访问被拒并返回「链接已失效」，同时站内通知张工；张工可在界面撤销链接，撤销后立即不可再访问。全程审计可查：谁、何时、下载几次、从哪个 IP。

### 用例 B：敏感文件的分级权限申请—审批闭环

1. 安全管理员赵姐将「合同库」空间级别从「低」调整为「中」（中 = 需要一级审批），操作写入审计。
2. 销售小李想下载合同库中的某份 PDF；系统按其数据范围拦截，页面提示「无权限，可发起访问申请」。
3. 小李点击「申请访问」，填写：类型（下载授权）、目标资源（自动带出）、级别（中）、目的（「投标需要核对付款条款」）、拟授权期限（默认 24 小时）；系统做冲突校验（无生效授权、无在审重复单）后生成审批单。
4. 审批单进入该空间 Owner（王经理）的**待办中心**并触发站内通知；王经理查看申请上下文（资源名、级别、申请人、目的、申请人在本组织的访问历史），点击「批准并授权 48 小时」（如需他人复核也可转审）。
5. 系统写入带过期时间（48 小时）的授权记录并发布 `PermissionGrantEvent`；审批结果站内通知小李，小李随即完成下载；系统开始倒计时授权。
6. 48 小时后权限自动回收；小李再次下载被拦截，需重新走申请。王经理与赵姐均可在审计中检索这条「申请—审批—授权—到期」完整链路；审计员可独立复核，无人能删除该记录。

---

## 6. 📏 关键产品规则（实现口径）

| 主题 | 规则 |
| --- | --- |
| 敏感级别 | 低 / 中 / 高三档；文件默认继承空间级别；调级权限归安全管理员与资源 Owner，变更必审计 |
| 审批配置 | 每级别可配置「自动放行 / 一级审批」；本期仅单级，审批人 = 资源 Owner（或指定安全管理员） |
| 授权期限 | 审批可指定授权有效期，默认 24 h，到期自动回收；不提供永久授权 |
| 外发链接 | 有效期默认 7 d（管理员可设上限）；提取码 ≥ 6 位；下载次数默认 10；错 5 次锁 30 min；创建/撤销/过期均审计 |
| 分片与续传 | 分片默认 8 MiB、并发 ≤ 5；分片暂存默认保留 24 h；断点续传必须基于服务端分片清单增量完成 |
| 秒传 | 以 SHA-256（+ 长度）为唯一键做物理去重；一致性由服务端整件重算兜底 |
| 双令牌 | access 30 min / refresh 7 d，refresh 轮换 + 单次性 + 重放吊销 |
| 回收站 | P1 全量；P0 至少保证删除留痕与可恢复接口骨架（保留期默认 30 d） |
| 通知 | 审批、外发链接锁定/到期、异常登录为必达类型；未读角标 ≤ 30 s 刷新 |

---

## 7. 📈 非功能需求（指标）

| 类别 | 指标 |
| --- | --- |
| **文件大小** | 单文件默认上限 **10 GiB**（可配置）；分片上传对 10 GiB 文件可用；超过上限的文件在上传入口即被拒绝并提示 |
| **并发能力**（单实例 Compose 部署基线） | 在线会话 ≥ 500；活跃上传任务 ≥ 50（含分片并发）；高峰期上传+下载吞吐不触发 OOM/线程耗尽，超出时排队而非崩溃 |
| **性能** | 秒传判定：1 GiB 文件 **P95 < 5 s**；分片落盘单实例吞吐内网 **≥ 50 MB/s**；列表/详情 API **P95 < 500 ms**；登录/换令牌 **P95 < 300 ms** |
| **审计留存** | 关键操作审计留存 **≥ 6 个月**（默认 180 天，支持 3/6/12 个月配置）；审计记录不可修改、不可删除 |
| **安全** | 令牌吊销生效 ≤ 2 min；敏感文件传输全程 TLS（Compose 默认 HTTP 用于内网，出网/生产强制反代 TLS）；提取码锁定与登录防爆破均含速率限制 |
| **可用性** | 单机 Compose 目标可用性 ≥ 99.9%（含自动重启策略）；数据库迁移 Flyway 可回滚口径升级 |
| **浏览器** | Chrome / Edge / Firefox / Safari 最近两个大版本 |
| **国际化** | 文案 100% 走 i18n 资源（zh-CN / en-US），切换即时生效、不丢失会话 |
| **可观测** | 全链路 `X-Trace-Id`；错误码分段可检索；日志脱敏（不落密码/提取码/令牌） |

---

## 8. 🚫 Won't 项与扩展点（本期不做，仅预留）

> 原则：**默认不做的能力，在架构上留出接缝**，保证未来可按插拔方式演进而不破坏 CE 现有闭环。
> 溯源：下表与战略规划书「0.3 节」右栏 **EE 专属**能力对齐；EE 立项时按预留接缝承接，CE 不引入。

| Won't 项 | 本期处理方式 | 预留扩展点位置 |
| --- | --- | --- |
| **AI DLP** | 不上传内容扫描/敏感词/涉密识别 | `at-file` 文件接收异步事件上预留「后处理管道 Hook」（与杀毒共用一条 SPI） |
| **杀毒** | 不做病毒扫描 | 同上：文件入库后处理管道（scan pipeline），实现方按 SPI 注册即可 |
| **盲水印** | 下载/预览不加任何水印 | `at-transfer` / `at-collaboration` 下载渲染管线预留「内容渲染处理器」（可插拔加水印/DRM） |
| **KMS 存储加密** | 文件落盘默认明文（权限与审计为安全主链路），数据库敏感字段加密除外 | `at-file` 存储层抽象 `FileStore`，预留信封加密包装器接口；对象存储键不耦合加密方案 |
| **多租户** | 单租户 CE | 账号/组织模型不引入租户列；预留组织边界抽象，供企业版/未来按租户隔离演进 |
| **ES 高级审计** | 审计落 MySQL + 检索导出 | 审计事件定义独立领域事件 + 通用 `AuditSink`，可扩展对接 Elasticsearch/对象存储归档 |
| **动态多级审批** | 固定单级（Owner 审批），仅级别×是否审批可配 | `at-permission` 审批策略抽象为「审批链 Policy 接口」，多级/会签作为另一实现接入 |
| **QUIC / HTTP3** | 仅 HTTP/HTTPS（TLS） | 传输网关协议层抽象（当前 at-gateway 转发），协议升级不影响业务模块 |
| **SSO / OIDC** | 仅本地账号 + JWT 双令牌 | `at-auth` 认证入口抽象 `AuthenticationProvider`，预留 OIDC/SAML/LDAP 适配器位 |

> ⚠️ **扩展点落地状态（2026-09-13）**：上表「预留扩展点位置」当前**全部为设计约定**——
> `FileStore`（存储抽象）、`AuditSink`（审计出口）、`AuthenticationProvider`（认证入口）、
> 审批链 `Policy`（多级审批）、后处理管道（DLP / 杀毒 SPI）、内容渲染处理器（水印）等接口
> **尚未在代码中建立**（`at-file` / `at-transfer` / `at-collaboration` 仍为空壳模块）。
> 即 Won't 项当前既未实现，也**尚无真正的可插拔接缝**。
>
> 建立接缝的时机不应晚于对应模块首个功能落地（例：`at-file` 实现存储时即抽出 `FileStore`；
> `at-permission` 实现审批时即以 `Policy` 接口承载单级实现），否则 EE 化时将被迫改动
> 已发布接口，破坏 CE 兼容性。

---

## 9. 🗓️ 版本里程碑（建议）

| 里程碑 | 范围 | 退出条件 |
| --- | --- | --- |
| M1（1.0.0） | 全部 P0 | §3 US-01～US-08、US-11 验收全通过；Compose 一键部署冒烟通过；审计留存满足 §7 |
| M2（1.x） | 全部 P1 | 权限地图 / 回收站 / 搜索统计 / 邮件 / IM / 打包限速 / 版本 / 国际化上线；性能基线见 `tests/performance` |
| M3（社区演进） | Won't 项逐个评估 | 依 §8 扩展点立项，另行评审 |

> 📍 **当前进度（2026-09-13）**：处于 M1 前半程。P0 中「JWT 双令牌」「RBAC」已落地（含集成测试 8 例全绿）；
> 「三权分立」「审批闭环」为部分落地；「传输引擎」「外发链接」「站内通知」「工作台」**尚未开工**
> （`at-file` / `at-transfer` / `at-collaboration` 为空壳模块）；Compose 编排缺前端。
> 距 1.0 门槛的剩余量以 §4.1 为准。

## 10. 📖 术语表

| 术语 | 定义 |
| --- | --- |
| 三权分立 | 系统管理、安全管理、安全审计三角色互斥分权，任何一方不可独自完成「授权 + 操作 + 审计」闭环（**CE 实现现状**：管理与安全职能已合并为 `SUPER_ADMIN`，仅审计独立为 `AUDITOR`，详见 §4.1） |
| RBAC | 基于角色的访问控制：角色绑定权限点，用户绑定角色 |
| 敏感级别 | 资源机密程度：低 / 中 / 高，决定访问是否需要申请与审批 |
| 外发链接 | 面向无账号外部人员的限时/限次/限提取码的文件下载通道 |
| 秒传 | 服务端已存在同哈希文件时跳过实际上传直接完成 |
| 断点续传 | 基于已收分片清单只续传缺失分片的增量上传 |
| 双令牌 | access（短期）+ refresh（长期可轮换）的令牌体系 |
