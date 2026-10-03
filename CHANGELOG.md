# 📝 Changelog

本项目所有重要变更均记录于此。
格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased] 🔄

### ✨ Added（新增）

- 🔔 **群消息提醒偏好（免打扰 / @我 / @所有人）与「@所有人」发送（2026-09-30）**：
  此前群里只有一种提醒方式——**所有消息都响**，成员无法对某个群单独降噪（只能退群或忍着）；
  同时群内无法 `@` 全体成员，群主发通知只能指望成员自觉逐条看。本轮一次补齐：
  - **SQL**：`sql/V20__chat_mention_all_and_group_notify_preference.sql`——`sys_group_member` 增
    `mute_status` / `notify_on_mention` / `notify_on_mention_all`（统一 `0-关 / 1-开` 刻度，
    默认 `0 / 1 / 1`，即「免打扰关、两类提及都提醒」）；`sys_notify_message` 增 `mention_type`
    （`0` 无 / `1` @我 / `2` @所有人），原 `mentioned` 布尔降为 `mention_type` 的投影列，历史查询不变。
  - **后端**：新增 `ChatGroupNotifyPreferenceDTO/VO` 与
    `GET|PUT /api/v1/chat/groups/{groupId}/notify-preference`（整体覆盖式 `PUT`，三字段缺一即 400）；
    `POST /api/v1/chat/messages` 增 `mentionAll`；`ConversationVO` 增 `memberCount` 与
    `notifyPreference`（偏好随会话列表整批下发，**避免「为了决定要不要响」每条消息都多发一次请求**）。
  - **新错误码 1042 `CHAT_MENTION_ALL_OWNER_REQUIRED`（403 / 策略 D）**：非群主 `@所有人` 明确失败。
    此处与逐人点名的口径**刻意相反**——`mentionUserIds` 对非法项静默剔除（装饰性标记，
    不该连坐整条消息），而 `@所有人` 是「一发出即给全体成员设备推提醒」的**范围声明**；
    静默会让成员误以为全群都被提醒到了，故**一行都不落库**。校验放在幂等回查**之前**：
    越权重放与越权首发同得 1042，不因「上次恰好成功」而被洗白。与 1041 分开是因为 1041 说
    「这个动作只有群主能做」，1042 说「你在群里发言、@ 个别人照常，只是 `@所有人` 这档打扰权你没有」——
    复用会让成员以为自己连发言权都没了。
  - **前端**：`services/chat/notifyPreference.ts` 做 `(scope, targetId)` 进程内偏好索引
    （会话列表整批灌入 + 群设置面板单点更新；**换人登录必须清空**，键里不含用户维度）；
    `shouldRemindMessage` 收敛为「该不该响」的**唯一裁决点**，四档口径：自己发的永不提醒 /
    单聊恒提醒 / 群聊未免打扰全提醒 / 已免打扰只看命中档位的开关，且**偏好缺失一律按「照常提醒」**。
  - **回归**：`ChatServiceMentionAllTest`、`ChatGroupNotifyPreferenceTest`、`ChatConversationGroupFieldsTest`；
    前端 `types.test.ts` / `messages.test.ts` / `useChatMentionables.test.tsx`。
  - **文档**：`docs/api/README.md`（at-collaboration 模块行 + §5 表 + §7 裁决口径）、
    `docs/api/error-codes.md`（1042 全表 / 重试语义 / HTTP 附录）。

- 🔊 **新消息提示音：三个内置合成音 + 自定义音频上传（2026-09-30）**：
  此前新消息只有角标与列表未读，**页面上没有声音**——用户停在文件页 / 审批页时会整段时间漏掉消息。
  - **SQL**：`sql/V21__user_notify_sound_setting.sql`——新增 `sys_user_notify_setting`
    （`sound_enabled` 默认 1、`sound_preset` 默认 `default`、`custom_sound_*` 四列存 key / 名称 / 大小 / 时长）。
  - **后端**：`UserNotifySetting` + `SelfNotifySettingService`，四个端点
    `GET|PUT /api/v1/users/me/notify-setting`、`POST|DELETE .../sound` 与 `GET .../sound/content`
    （**须登录**、`private, no-cache` + 强 `ETag`，刻意不开放匿名——与头像**相反**：头像要出现在
    他人名单里，提示音只在本人已登录的会话里播放）；`AudioTypes` 做容器魔数识别与时长解析
    （仅 MP3 Layer III / WAV / OGG），`NotificationSoundStoragePort` 定下 **≤ 1 MiB、≤ 10 秒**且
    **由服务端实测**（不采信前端上报），`LocalNotificationSoundStorage` 落盘走「先写临时再原子改名、
    提交后才删旧文件」。
  - **新错误码 4029~4033（策略 E）**：过大 413 / 过长 400 / 容器不允许 415 / **无法解析 400**
    （拒绝而不是按 0 秒放行，「无法验证」不等于「满足上限」）/ 尚未设置 404
    （前端**不弹错**、静默回落内置音）。
  - **前端**：`services/notify/soundPlan.ts` 是纯决策层（设置 → 怎么响），三个内置音色用
    `OscillatorNode` **现场合成**（零资源、跨端一致，总时长均 ≤ 400ms）；`soundPlayer.ts` 负责
    `primeNotifySound` 借全局手势解锁自动播放与 Blob URL 生命周期；`components/NotifySoundAlert/`
    是挂在**登录态布局**上的无 UI 组件（**刻意不挂聊天页**——否则「在文件页收到消息」会彻底无声，
    而这恰恰是提示音最该起作用的场景）；`components/RightContent/NotifySoundSetting.tsx` 是设置面板。
  - **本地预检只判格式与大小、不判时长**：时长要真正解码，为提前 200ms 报错而解一次 1 MiB 不划算；
    如实把不确定性留给服务端（4030），而不是拿「大小 ÷ 码率」估一个假时长去拦合法文件。

- 👥 **会话列表补群成员人数、聊天页补本端连接质量弱提示（2026-09-30）**：
  - `ConversationVO.memberCount`（群聊含群主的人数；**单聊恒为 `null`**——由 `targetName` 回答
    「对方是谁」，人数没有语义；已退群 / 被移除后同样为 `null`，前端不渲染人数，该会话本就已无法继续发言）。
  - `components/ConnectionQuality/`：聊天页页头的常驻弱提示，只说「我与服务器的实时通道好不好」。
    **刻意与会话标题旁的 `ChatPeerStatus` 分开**——后者说的是「对方在不在线」，两者相互独立
    （我断网时对方仍可能在线），并排会让用户把「我的连接质量」读成「对方是否在线」；
    圆点始终配文字（不靠颜色单独表意），`idle` 不画错误色（握手尚未开始的那一帧不能谎报断线）。

- 🛡️ **语言包新增源码级护栏：同一文件内顶层 key 不得重复（2026-09-30）**：
  本轮补齐语言包时，7 个语言包被**整块贴了两遍**，产生 **80 个 TS1117**，
  却一路躲过了全部 vitest 用例与 `biome`——因为 `export default { a, a }` 在运行时只留一个键，
  任何基于 `Object.keys()` 的检查（含 `i18n-parity.test.ts` 里那条「无重复 key」）都**恒为真**。
  新增 `src/locales/i18n-source.test.ts` 直接读源码、按文件内最小缩进取顶层 key 去重；
  并带一条兜底断言（一个 key 都没扫到即判失败），避免缩进口径失效后变成假阳性。
  **验证**：`node scripts/run-vitest.mjs run` → **77 文件 / 1090 用例全通过**；
  `npx tsc --noEmit` → 0 错误；`mvnw.cmd -B test` → BUILD SUCCESS。

- 🌍 **新增法文 / 俄文 / 西班牙文（fr-FR / ru-RU / es-ES）语言包与切换支持（2026-09-29）**：
  继韩文、日文之后，把另外三种企业客户高频语言按同一口径提升为一等语言；三者此前在
  `web/src/locales` 下**连骨架目录都不存在**（脚手架只留了 zh-TW / pt-BR / id-ID / fa-IR / bn-BD），
  业务文案只能回退成原始 key。本轮一次补齐：
  - **语言包**：`web/src/locales/{fr-FR,ru-RU,es-ES}/` 各 21 个命名空间（`common` / `exception` /
    `globalHeader` / `layout` / `workbench` / `network` / `auth` / `settingDrawer` / `settings` /
    `message` / `menu` / `pages` / `approval` / `audit` / `permissionMap` / `shares` / `component` /
    `upload` / `chat` / `file` / `system`），**逐键**对齐 zh-CN（含 `system` 236 键、`file` 200 键、
    `chat` 194 键，合计约 1000 键 / 语言）。术语全包统一（机敏级别 = `niveau de confidentialité` /
    `уровень конфиденциальности` / `nivel de confidencialidad`，权限、审批、部门、回收站、水印、
    外部共享、提取码等同理）；**不译技术 token**——权限码（`system:role:assign-perm`）、错误码
    （`403` / `1003` / `1021`）、API 路径（`GET /api/v1/permission-points`）、表名（`sys_group`）、
    扩展名、反引号内标识符一律原样保留。
  - **语言归一化**（`web/src/utils/locale.ts`）：`SUPPORTED` 扩为 7 种
    （zh-CN / ko-KR / ja-JP / fr-FR / ru-RU / es-ES / en-US）。ko 落地时引入的**同语系前缀回退**
    自动覆盖三种新语言——`fr` / `fr-CA` → fr-FR、`ru` → ru-RU、`es` / `es-419` → es-ES；
    未登记语言（`pt-BR` / `zh-TW` / `fa-IR`…）仍回落 en-US。
  - **切换器**（`LangDropdown`）：补 `dayjs/locale/{fr,ru,es}`（日期/时间格式随语言本地化）与
    `🇫🇷 Français` / `🇷🇺 Русский` / `🇪🇸 Español` 自称标签。
  - **聚合入口**：`web/src/locales/{fr-FR,ru-RU,es-ES}.ts` 新建，按与 zh-CN 完全相同的 21 段展开
    顺序（含 `navBar.lang` / `layout.user.link.*` / `app.preview.down.block` 5 个根级键的本地化）。
  - **回归护栏**：`i18n-parity.test.ts` 由「zh-CN ↔ en-US / ja-JP / ko-KR」扩为
    「zh-CN ↔ en-US / es-ES / fr-FR / ja-JP / ko-KR / ru-RU」七方键集合比对（保留跨命名空间键冲突
    检查）；`welcome-i18n.test.ts` / `menu-i18n.test.ts` 的比对面同步扩到 fr-FR / ru-RU / es-ES。
  - **验证**：`node scripts/run-vitest.mjs run` → 75 文件 / 1057 用例全通过；`npx tsc --noEmit` 无错误；
    `npm run build` 通过；另用一次性校验（21 命名空间 × 3 语言的缺失 / 多余 / 空值 / 哨兵残留 /
    中日韩字符泄漏差集，64 用例）确认后删除该临时文件。
  - **文档同步**：`docs/prd/README.md` §7「国际化」指标改写为
    `zh-CN / ko-KR / ja-JP / fr-FR / ru-RU / es-ES / en-US`。
  - **分工说明**：三语语言包由三个独立子任务并行产出（各自独占一个语言目录），框架层、聚合入口、
    护栏测试与文档由主任务统一收口，避免同名文件并发改写。

- 🇯🇵 **新增日文（ja-JP）语言包与切换支持（2026-09-29）**：
  `web/src/locales/ja-JP/` 下只有敏捷脚手架自带的 7 个命名空间（`component` / `globalHeader` / `menu` /
  `network` / `pages` / `settingDrawer` / `settings`），且**键集合是上游示例页的**（如 `menu.register`、
  `component.tagSelect`），与本项目自建键并不对应——业务页面的文案取不到值，只能回退成原始 key。
  本轮按「文案 100% 走 i18n 资源、切换即时生效」的既有口径，把 ja-JP 提升为一等语言：
  - **语言包**：`web/src/locales/ja-JP/` 补齐到 21 个命名空间（`common` / `exception` / `globalHeader` /
    `layout` / `workbench` / `network` / `auth` / `settingDrawer` / `settings` / `message` / `menu` / `pages` /
    `approval` / `audit` / `permissionMap` / `shares` / `component` / `upload` / `chat` / `file` / `system`），
    **逐键**对齐 zh-CN（含 `system` 236 键、`file` 200 键、`chat` 194 键）——脚手架遗留的上游键按项目口径
    重写而非叠加（`menu.register*` / `menu.editor.*` 等本仓库零引用的示例键不保留）；`component` / `network` /
    `pages` / `settings` / `menu` 等已有文件因键集合不一致被整体替换。聚合入口 `web/src/locales/ja-JP.ts`
    重写为 21 个命名空间的展开顺序，与 zh-CN / ko-KR 一致。Umi i18n 插件自动扫描 `src/locales/*.ts`，
    `config/config.ts` 无需改动。
  - **语言归一化**（`web/src/utils/locale.ts`）：`SUPPORTED` 加入 `ja-JP`。`resolveUiLocale` 已有的
    **同语系前缀回退**（ko 落地时引入）自动覆盖日文——浏览器只上报 `ja` 时收敛到 `ja-JP`；
    未登记语言仍回落到 en-US（原「`ja-JP` → en-US」的用例已改用 `pt-BR` 表达同一意图）。
  - **切换器**（`LangDropdown`）：补 `dayjs/locale/ja` 与 `🇯🇵 日本語` 标签，日期/时间格式随语言本地化。
  - **回归护栏**：`i18n-parity.test.ts` 由「zh-CN ↔ en-US / ko-KR」扩为「zh-CN ↔ en-US / ko-KR / ja-JP」
    四方键集合比对（保留跨命名空间键冲突检查）；`app.test.tsx` 新增 `ja` → `ja-JP` 归一化用例，
    并断言 `ja-JP` 精确命中受支持集合时**不再写回**，避免「碰巧被前缀匹配救回来」。
  - **验证**：`node scripts/run-vitest.mjs run` → 75 文件 / 949 用例全通过；`npx tsc --noEmit` 无错误；
    `npm run build` 通过；另用一次性键位校验（21 命名空间的缺失/多余/未翻译键差集）确认逐键对齐后删除该临时文件。
  - **文档同步**：`docs/prd/README.md` §7「国际化」指标改写为 `zh-CN / ko-KR / ja-JP / en-US`。

- 🇰🇷 **新增韩文（ko-KR）语言包与切换支持（2026-09-29）**：
  此前的 i18n 资源只落 `zh-CN` / `en-US`，`LangDropdown` 也只列这两种，韩文用户拿不到任何界面文案。
  本轮按「文案 100% 走 i18n 资源、切换即时生效」的既有口径补齐第三种语言：
  - **语言包**：新增 `web/src/locales/ko-KR/` 下 21 个命名空间文件（`common` / `exception` / `globalHeader` /
    `layout` / `workbench` / `network` / `auth` / `settingDrawer` / `settings` / `message` / `menu` / `pages` /
    `approval` / `audit` / `permissionMap` / `shares` / `component` / `upload` / `chat` / `file` / `system`）
    与聚合入口 `web/src/locales/ko-KR.ts`，**逐键**对齐 zh-CN（含 `system` 这类 200+ 键的大命名空间）。
    Umi i18n 插件自动扫描 `src/locales/*.ts`，`config/config.ts` 无需改动。
  - **语言归一化**（`web/src/utils/locale.ts`）：`SUPPORTED` 加入 `ko-KR`，并给 `resolveUiLocale` / `normalizeLocale`
    补上**同语系前缀回退**——浏览器只上报 `ko`、或上报 `ko-KP` / `ko_KR` 时一律收敛到 `ko-KR`。
    原逻辑以「zh 语系 → zh-CN，其余一律 en-US」收尾，韩文会被误判成「不支持的语言」而回落英文，
    用户看到的就是「切了韩文界面还是英文」；现在回退只在**确实没有同语系语言包**时才触发。
  - **切换器**（`LangDropdown`）：补 `dayjs/locale/ko` 与 `🇰🇷 한국어` 标签，日期/时间格式随语言本地化。
  - **回归护栏**：`i18n-parity.test.ts` 由「zh-CN ↔ en-US」扩为「zh-CN ↔ en-US / ko-KR」三方键集合比对
    （并保留跨命名空间键冲突检查）；`menu-i18n.test.ts` / `welcome-i18n.test.ts` 纳入 ko-KR；
    `app.test.tsx` 新增 `ko` / `ko-KP` → `ko-KR` 的归一化用例，钉死「不得回落 en-US」。
  - **验证**：`node scripts/run-vitest.mjs run` → 75 文件 / 916 用例全通过；`npx tsc --noEmit`、`npx biome lint`
    无新增告警；`npm run build` 通过。
  - **文档同步**：`docs/prd/README.md` §7「国际化」指标改写为 `zh-CN / ko-KR / en-US`。

- 🔎 **版本可查：镜像标签 / `/api/actuator/info` / 前端 `version.json` 三处落点（2026-09-29）**：
  起因是一次发版后的真实困境——「线上跑的到底是哪个提交」只能靠<b>间接推断</b>（源码包解压时保留的
  commit 时间、镜像构建时间、容器启动时间、Flyway 迁移时间），任何一环被覆盖（同标签重建镜像、
  手工替换 jar、只传前端产物）就失去证据，而且这些时间戳**永远变不回提交号**。
  现改为三处显式落点，各管一种查询场景：
  - **镜像标签**（`Dockerfile` 的 `ARG` + `LABEL`，参数由根 `docker-compose.yml` 的 `server.build.args` 透传）：
    写入 `org.opencontainers.image.revision`（提交号）与 `org.opencontainers.image.ref.name`（分支）。
    `docker image inspect anttransfer/server:latest --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'`
    即可读出，**无需启动容器**；回滚留底镜像（`prev-*`）同样带标签，回滚后能立刻确认退回到了哪个提交。
    构建前需 `export GIT_COMMIT=$(git rev-parse HEAD)`（`GIT_BRANCH` 同理）；未导出则回落 `unknown`
    ——`.dockerignore` 排除了 `.git/`，构建上下文里没有版本库，镜像内无从自行获取，只能外部注入；
    宁可显示 unknown，也不静默沿用上一次构建的提交号（那会让「查到的版本」指向错误提交，比没有更危险）。
  - **应用内**（`spring-boot-maven-plugin` 的 `build-info` goal + 新增 `spring-boot-starter-actuator` 依赖）：
    父 pom 新增 `git.commit` / `git.branch` 属性（默认 `unknown`，可被 `-D` 覆盖），由 `build-info` 写入
    `META-INF/build-info.properties` 的 `build.commitId` / `build.branch`，经 `GET /api/actuator/info`
    回显 `{version, commitId, branch, time}`。构建期 `Dockerfile` 以 `-Dgit.commit="${GIT_COMMIT}"` 注入。
  - **前端**（新增 `web/scripts/gen-version.mjs`，由 `npm run build` 串联在 `max build` 之后）：
    产出 `dist/version.json`（`commit` / `commitShort` / `branch` / `buildTime` / `commitTime`），
    `curl -s http://<host>/version.json` 即得；脚本在无 git 环境（tarball / 浅克隆）下回落 `unknown`
    且**不阻断构建**——版本标签是诊断信息，不该成为发布失败的成因。
    nginx 配置模板为它单列 `location = /version.json`（`no-store` + `=404`，避免缺文件时静默回退成 HTML）。
  - **安全边界（本轮必须守住的一条）**：actuator 暴露面**按端点白名单**收窄，不做通配——
    `management.endpoints.web.exposure.include: health,info`，且 `health.show-details: never`
    （不返回数据源地址 / 磁盘路径 / 组件版本等明细）。两个探针端点进
    `SecurityConfig.BUILT_IN_PERMIT_ALL`（调用方是负载均衡 / 容器编排 / 发布脚本，天然没有登录态与 token），
    并新增契约测试 `actuatorProbes_mustNotBePermittedByWildcard` 钉死「不得退化成 `/actuator/**` 通配」：
    通配会顺带交出 `/actuator/env`（含 `AUTH_ACCESS_TOKEN_SECRET`）、`configprops`、`beans`，
    以及最危险的 `heapdump`——一次 GET 就能把整个堆转储下载下来。

- 💬 **会话对端备注：给单聊对端起一个「我这边记得住的名字」（2026-09-29）**：
  对齐微信 / QQ 的**备注**能力。本系统没有好友 / 联系人关系（私聊是「按登录账号搜索 → 直接发起」），
  因此备注被定义为**单方面私有的「会话对端备注」**，而不是账号级昵称。
  新增 `sql/V19__chat_peer_alias.sql`（`sys_chat_peer_alias`：`owner_user_id` / `peer_user_id` / `alias`，
  唯一键 `uk_owner_peer`）。
  - **语义边界（本轮最重要的一条）**：备注是 `(我, 他)` 这一行的**私有属性**，
    **只影响我看到的展示名**——不写 `sys_user`、不广播、对方与其他任何人的界面都不变。
    因此接口挂在 `/api/v1/chat/contacts/{peerId}/alias` 而不是账号路径上：
    挂 `/users/{id}/alias` 会让人读成「改那个账号」。
    展示链统一裁决为 **备注 → 真实昵称 → 「用户 #id」**，会话列表 VO 新增 `peerAlias` 而
    **保留** `targetName`（昵称仍是对方真实名，资料卡要**并列**显示两者，用户才能确认「备注没改到对方」）。
  - **接口**：`PUT /api/v1/chat/contacts/{peerId}/alias`（设置 / 修改，入参 `{alias}`，裁空白、上限 32 字）、
    `DELETE /api/v1/chat/contacts/{peerId}/alias`（取消，**幂等**：本就没设备注同样回成功）。
    两者回 `ChatPeerVO{peerId, alias}`（操作后的状态，前端据此就地生效、**不必重拉会话列表**）、
    带 `@RateLimit`（60s / 30 次）、**不挂权限点**——归属者恒为登录人，不存在「替别人设备注」的入参面。
    「目标是自己 / 不存在 / 已停用」**统一回 1013**（与 `/targets/resolve` 同一把尺子，
    不区分「不存在 / 已注销」，以免沦为账号存在性枚举器）。空白回 2002、超长回 2001。
  - **两个数据层坑**：① 唯一键 `uk_owner_peer` **不含 `deleted`**，而取消备注是逻辑删除 →
    取消后再设必须**复活旧行**而不是插入新行（`selectAny` 绕过逻辑删除回查 + `revive`）；
    ② 取消走**逻辑删除**（沿用全库 `deleted` 口径：业务数据只置标记、不物理抹除，
    「他什么时候被我备注过、又什么时候取消」是可追溯的事实），与 ① 合起来才解释得通
    「为什么必须有复活这条路，而不是删干净重插」。
  - **两条并发口径（真 MySQL 压出来的，单测 mock 看不出来）**：
    ① **撞键收敛必须用「当前读」，不能回查**——并发首次设置时，输家的事务快照建立在赢家提交之前
    （MySQL 默认 REPEATABLE READ），撞键后再 `selectAny` 回查读到的仍是「没有这一行」，
    重复键会被原样抛给用户（连点保存 / 弱网重发即可复现）。故撞键兜底改走
    `ChatPeerAliasMapper#reviveByOwnerPeer`（`UPDATE ... WHERE (owner, peer)`，当前读），
    并以其影响行数判定：影响 0 行说明该行真的不存在（对手回滚了），如实上抛而不假装成功。
    这条路径**在任何隔离级别下都成立**，不依赖「回查能看到新行」这个假设。
    ② **`setPeerAlias` 刻意不套 `@Transactional`**——`insert 撞键 → 改走更新` 若共处一个显式事务，
    多个请求会同时持有重复键放出的**共享锁**再抢写锁，MySQL 直接判死锁牺牲其一
    （实测 `DeadlockLoserDataAccessException`，16 线程场景必现）。本方法只有单条写语句，
    每条语句各自成事务后共享锁随语句结束即释放，冲突退化为同一行的写锁排队；
    终态正确性由唯一键 + 条件更新保证，**不依赖跨语句事务**。若将来要求写方法统一带事务，
    须改为「事务内执行 + 外层捕获死锁重试」，不能直接加回注解。
  - **一次批量取，不做 N+1**：会话列表按 `owner_user_id = 登录人 AND peer_user_id IN (本页对端)`
    一次取回备注再回填，而不是每个会话单查一次（列表上限 50 → 原本是 50 次往返）。
  - **前端**：新增 `services/chat/peerAlias.ts`（覆盖表 + `applyPeerAliasOverride`）与 `hooks/usePeerAlias`，
    对齐既有头像覆盖表的 `useSyncExternalStore` 模式 —— 保存后备注**立刻生效**，
    无需为改几个字重拉列表（否则列表会闪烁、分页与筛选状态还得一并保住）。
    新增 `components/ChatPeerPanel`（对端资料：只读真实昵称 + 可写备注 + 「备注只对你可见」的界面口径说明），
    由 `/chat` 页标题栏与 `ChatDrawer` 标题栏的「备注」入口打开（与群设置入口互为镜像，**群聊不出现**）。
    `conversationTitle` 是展示链的**唯一裁决处**：列表、详情标题、消息气泡署名、头像首字全都经它取值，
    因此不会出现「列表显示备注、详情显示昵称」的分裂。
    登出 / 改密时清空覆盖表（备注是私有数据，残留会把上一个人的称呼展示给下一个人）。
  - **回归证据**：后端 `at-collaboration` 新增 `ChatPeerAliasTest`（9 例：首次插入 + trim、复活不插入、
    并发撞键当前读收敛、撞键且行不存在则上抛、自设备注拒绝、对端不可用拒绝、空白拒绝、取消幂等），
    **模块 96 例全绿**；另新增**端到端集成测试** `ChatPeerAliasE2eIntegrationTest`
    （at-bootstrap，Testcontainers 真 `mysql:8.4` + 真 `redis:7-alpine` + 真 HTTP 栈，**5 用例 / 13 次执行**）：
    ① 绕过应用层直插第二行 `(我, 他)` 被 InnoDB 拒绝——证明唯一键护栏真在库里，而非只存在于 Mockito 剧本里；
    ② 16 线程并发首设（**连跑 5 轮**）无失败、恰好 1 行、别名是某次提交的原值；
    ③ 取消后 16 线程并发复活（**连跑 5 轮**）**行主键不变**（复用同一行）、仍 1 行、`deleted` 归 0；
    ④ 限流走完整 HTTP：连发 30 次全 200 且别名真写入，第 31 次 **HTTP 429 + 4290**，Redis 计数真实累加；
    ⑤ HTTP DELETE 重复调用均成功、生效行 0 而物理行仍在（逻辑删除语义）。
    测试设计取舍：**并发用例走服务层直调、限流用例走完整 HTTP**——`@RateLimit`（60s / 30 次）
    会先挡住并发流量，用 HTTP 压并发就测不到底层的唯一键收敛。
    复验：`at-bootstrap` 全量 **43 例全绿**（5 个 IT 类 + 契约测试），`at-collaboration -am` **126 例全绿**；
    同批修复 `ConversationVO` 新增 `peerAlias` 后 `PlatformIdJsonContractTest` 两处构造漏参
    （曾使 `at-bootstrap` 测试整体无法编译，已补齐、4 例通过）。前端新增
    `services/chat/peerAlias.test.ts`（8 例，含「`null` 要压过旧值」）、
    `components/ChatPeerPanel/index.test.tsx`（8 例）与 `types.test.ts` / `endpoints.test.ts` / `api.test.ts`
    增补用例，**全量 75 个测试文件 / 863 例全绿**，`biome lint` + `tsc --noEmit` 干净（均为 2026-09-29 实跑）。
  - **文档同步**：[`docs/api/README.md` 协作域行](docs/api/README.md)（新增两个端点 + `ConversationVO.peerAlias` 口径）、
    [`sql/README.md`](sql/README.md)（迁移清单 + V19 说明）。

- 🧩 **CE/EE 差异化扩展点全量落地：7 个 SPI 建为真实接缝（2026-09-29 · [A-6 / D-2](docs/architecture/architecture.md) 收口）**：
  PRD §8 的 Won't 项此前只有「预留扩展点位置」的**设计约定**，接口在代码中零命中（`A-6`）；
  同一批接口在附录 C 与 PRD §8 之间存在**两套命名**（`D-2`）。本轮把 7 个接缝**同批建立**，
  每个都带「接口 + CE 默认实现 + 装配门禁 + 实际消费点 + 回归测试」五项，杜绝「接口建了没人调用」的假接缝。
  - **接口全部上收 `at-common` 的 `spi` 子包**（`identity` / `scan` / `crypto` / `watermark` / `approval` / `transport`）：
    业务模块仍只依赖 `at-common`；EE 只需依赖 `at-common` 即可实现**任一**扩展点，
    不必反向依赖某个业务模块。`ContentScanInterceptor`（原在 `at-file`）与
    `ApprovalNodeResolver` / `ApprovalContext`（原在 `at-permission`）随之**上移**，
    `AT-DIFF-09` 按方案 B 收口（CE 的 `SuffixAndKeywordScanInterceptor` 留在 `at-file` 且**继续真实生效**，
    未退化为 Noop PASS）。
  - **CE 默认实现**：`LocalIdentityProvider`（at-auth）、`SuffixAndKeywordScanInterceptor`（at-file）、
    `NoopVirusScanner` / `NoopWatermarkProvider` / `PlainCryptoCodec`（at-file）、
    `SingleNodeApprovalResolver`（at-permission）、`HttpTransportStrategy`（at-gateway）。
  - **装配门禁：能力差异只由 Bean 是否存在表达**，全批**零 `if (eeEnabled)`**。
    六个接缝用类型级 `@ConditionalOnMissingBean` 顶替；**`TransportStrategy` 是唯一例外，改用 Bean 名称级**
    （`httpTransportStrategy`）——协议是**集合**而非单点能力，按类型顶替会让 EE 只新增一个 QUIC 实现就把
    CE 的 HTTP 挤掉，部署随即失去 HTTP 通道，那是功能回退而不是差异化。新增协议与 CE 的 HTTP **共存**，
    由新增的 `TransportStrategyRegistry` 按 `@Order` 选协议，并在**启动期拒绝重复 `protocol()`**
    （配置错误即启动失败，而不是让某次请求随机走另一个实现）。同理 `ContentScanInterceptor` **不设 Noop 兜底**
    ——它是 CE 必须生效的外发闸门，EE 的 DLP 以 `@Order` 叠加而非替换。
  - **消费点（接缝真的被读）**：`AuthService.login()` → `IdentityProviderChain`（首个 `supports` 命中即止，
    避免一次登录触发多次远端认证）；`ShareLinkService` → `ContentScanChain`；
    `FileContentService` 入库前 → `FileScanPipeline.assertClean`；`FileDownloadService.stream(...)`（下载与匿名分享下载）
    → `WatermarkResource`；`LocalFileStorage` 读写两侧 → `CodecResource`；`PermissionApplicationService` → `ApprovalNodeResolverChain`。
  - **两条新增设计口径**：① **认证失败的计数留在编排层**（`AuthService` 只对 `BAD_CREDENTIALS` 计数，
    `1004` / `1005` 不计数），身份源只回答「是不是本人」——否则换 SSO 后「错 5 次锁 30 分钟」会因身份源不同而失效；
    ② **内容寻址下扫描命中不删物理内容**，只拒绝本次登记并落审计（同一 sha256 的字节被多个文件记录共享，
    删除会连带破坏其它引用）。
  - **回归证据**：新增 `IdentityProviderChainTest` / `LocalIdentityProviderTest` / `IdentitySpiConfigTest`（at-auth）、
    `ApprovalResolverSpiTest`（at-permission）、`FileSpiDefaultsTest`（at-file）、
    `TransportStrategyRegistryTest`（at-gateway，含 `ApplicationContextRunner` 验证「CE 不加配置可启动」
    与「EE 声明实现即顶替」）；**本轮后端全量 8 模块共 661 例全绿**（at-common 30 / at-gateway 55 / at-auth 55 /
    at-transfer 46 / at-permission 225 / at-file 148 / at-collaboration 72 / at-bootstrap 30），
    **前端 73 个测试文件 / 828 例全绿**（`npm test`，均为 2026-09-29 实跑）。
  - **文档同步**：[architecture.md §2.2 实际签名与 §2.3 落地登记](docs/architecture/architecture.md)（契约草案 → 与代码逐行一致，
    差异逐条标注）、[PRD §8 命名回写](docs/prd/README.md)、[AT-DIFF-09 关闭](docs/development/AT-DIFF-todos.md)。
    残留：附录 C 原文仍未入库（仅影响溯源，不阻塞开发），`FileStore` / `AuditSink` / 组织边界抽象**不预建空接口**。
- 💬 **站内轻 IM：`@` 提及 + 消息保留 ≥ 30 天（2026-09-29 · [GAP-08](docs/development/AT-DIFF-todos.md) 全量收口）**：
  PRD §4.1 P1 的「站内轻 IM（会话与 **@ 提及**）；**消息持久化 ≥ 30 天**」两项验收此前均无落点。
  新增 `sql/V18__chat_mention_and_retention.sql`（`notify_message.mentioned` 列 + 保留期清理索引）。
  - **`@` 提及按「行」记，不按「条」记**：群消息是写扩散的（一条消息落 N 行），
    故 `mentioned` 是**每接收人一行**的标记，而非消息级属性 ——
    于是「有人 @ 我」退化成 `mentioned = 1 and read_status = 0` 的等值查询，
    **完全不需要解析正文里的昵称**（重名、昵称含空格、正文改字都不会误判）。
  - **上行契约**：`POST /api/v1/chat/messages` 新增可空 `mentionUserIds`（≤ 500 项）。
    服务端与**群成员求交集**，非成员 / 发送人自己 / 重复项**静默剔除**：
    点名失败不该让整句话发不出去，而客户端手里的成员名单本来就可能是旧快照。
  - **下行**：`CHAT` 帧载荷 `NotifyMessageVO` 新增 `mentioned`（只对被点名者那一行为 `true`，
    发送人自己恒为 `false`）；会话列表 `ConversationVO` 新增 `mentionUnreadCount`
    —— 它是 `unreadCount` 的**子集，两个数不能相加**（角标数字仍取 `unreadCount`，仅在 > 0 时染强调色）。
    **不额外写站内信**：同一句话若在「会话未读」与「站内信未读」各算一次，
    用户点任一处都清不掉另一处（产品若要消息中心留痕，须先定未读合并口径）。
  - **前端**：输入框 `@` 选人（`resolveMentionTrigger` / `filterMentionCandidates` / `insertMention` /
    `pushMention` / `retainActiveMentions` 五个纯函数 + `MentionPanel` 候选面板，支持 ↑↓ + Enter、Esc、点外面收起）、
    气泡「有人@我」标记 + 描边（描边用 `box-shadow` 内阴影，避免与非文本气泡的左边框争夺样式优先级）、
    会话列表摘要前缀 `[有人@我]`（对齐微信）；候选名单由 `useChatMentionables` 统一提供
    （群成员 → 候选，按群 ID 常驻缓存，**切群不串群**，拉不到成员时静默降级为空名单 = 不显示 `@` 入口）。
    **生效提及靠正文匹配**（用户删掉 `@昵称` 即失效），不跟踪插入位置。
  - **保留期清理**：`ChatRetentionScheduler`（`anttransfer.collaboration.notify.message-cleanup-cron`，默认 `0 20 4 * * ?`，与文件域清理 03:30 错峰）
    → `NotifyMessageService#purgeExpiredChatMessages` → `NotifyMessageMapper#deleteExpiredChatMessages`
    （`order by create_time limit` **分批物理删除**：保留期是留存承诺，不是软删除开关）。
    **30 天下限硬钳制**（`NotifyProperties.MIN_MESSAGE_RETENTION_DAYS`，配置下探无效且**不回写配置**，
    便于发现管理员配错）；并发用 Redis `SETNX at:chat:retention-lock`（TTL 15 min、**不主动释放**、
    实例崩溃靠 TTL 兜底），**Redis 异常时降级放行**（清理幂等，而「锁坏了就不清理」会让保留期悄悄失效）。
    参照 `at-file` 的 `FileCleanupScheduler` 而非 D-10 的 `AuditArchiveScheduler`（后者至今未落地）。
  - **回归护栏**：后端 `ChatServiceRecallTest` + `PlatformIdJsonContractTest`（`mentionUnreadCount` 保持数字、不下发字符串）；
    前端 5 个相关测试文件 **149 例全绿**（`npm test -- …`）：`ChatComposer/composer.test.ts`（提及纯函数）、
    `ChatComposer/index.test.tsx`（输入框交互）、`hooks/useChatMentionables.test.tsx`（候选名单与缓存）、
    `services/chat/messages.test.ts`（未读 / 提及未读派生）、`services/chat/types.test.ts`（摘要前缀）。
  - **文档同步**：[AT-DIFF-todos GAP-08 关闭](docs/development/AT-DIFF-todos.md)、[PRD §4.1](docs/prd/README.md)、
    [API 契约 `CHAT` 帧与 `mentionUserIds`](docs/api/README.md)。
- 🔔 **通知接线三件（2026-09-29）**：补齐三处「契约已定、发送方缺失」的通知缺口 ——
  ① **传输完成提醒**：at-transfer 在分片合并成功后发布 `TransferCompletedEvent`
  （新增 `TransferEventPublisher`，状态提交后发布、发布失败只留痕，不影响已落库的传输结果），
  打通 at-collaboration 侧早已就绪的监听器（此前无任何 `publishEvent` 调用）；
  ② **外发链接到期前提醒**：新增 at-file `ShareExpireNotifyScheduler`
  （`cron` 默认每小时第 25 分）+ `ShareLinkMapper#selectExpiringActive`，
  幂等为「Redis 占位键 + `existsForBiz` 兜底」两层，且**发送失败会释放占位键**以便下轮重试；
  ③ **取件回执**：`ShareAccessService#redeem` 成功后回推链接创建者（免登录访客无账号，
  这是创建者唯一能感知「链接真的被用了」的通道，此前只能自己去翻取件审计）；
  提取码锁定提醒改为在计数**恰好跨过阈值**时发出一次（避免脚本连打把创建者收件箱刷满）。
  同步：`NotifyType` 新增 **9 = SHARE_ACCESSED**（计入站内信未读、**不进待办**；
  `isInbox()` 一并修正为与未读 SQL 同口径）、`NotificationCommand` 新增 3 个工厂方法、
  `V17__share_access_notify_type.sql` 同步列注释、前端消息中心图标与中英文案。
- 🧱 仓库由「脚手架单体」演进为 AntTransfer CE 模块化单体：`server/` 下 8 个 Maven 模块
  （`at-common` / `at-gateway` / `at-auth` / `at-transfer` / `at-permission` / `at-file` / `at-collaboration` / `at-bootstrap`）。
- ⚖️ Apache-2.0 `LICENSE`，全部 Java/pom 文件许可证头，Spotless `verify` 阶段自动校验。
- 📂 标准开源工程骨架：`docs/`、`deploy/`、`scripts/`、`tests/`、`.github/`（CI、Issue 模板、CODEOWNERS）。
- 🧰 根编排：`Makefile`、`docker-compose.yml`（MySQL/Redis/server 全栈）、`docker-compose.dev.yml`（本地依赖）。
- 🗄️ `sql/` 采用 Flyway 版本化布局：`V1__schema.sql`（建表）、`V2__init_data.sql`（初始化数据）。
- 🐳 Dockerfile 多阶段构建（JDK 21 / Maven 3.9 → JRE 运行镜像）。
- 👤 初始化数据 `sql/V2__init_data.sql`：内置角色 SUPER_ADMIN/AUDITOR/DEPT_ADMIN/USER（sys_role）、
  文件菜单树与七个原子文件权限点 + 审计只读权限点（sys_permission / sys_role_permission）、
  初始化管理员 admin（BCrypt cost=10 真实密文，默认口令 Admin@123，首次登录须改密）。
- 📐 新增 [架构落地说明 `docs/architecture/architecture.md`](docs/architecture/architecture.md)：8 模块职责与依赖方向、
  **四层包结构（`controller` / `service` / `repository` / `model`）**、跨模块协作三通道（SPI 依赖倒置 + 写单事务 + 事件只承载副作用）、
  一次请求的统一处理链路（Filter→Controller→Service→Repository）、**CE/EE 扩展点清单**（`IdentityProvider` /
  `ContentScanInterceptor` / `WatermarkProvider` / `CryptoCodec` / `VirusScanner` / `ApprovalNodeResolver` /
  `TransportStrategy` + `FileStore`，含契约草案与 PRD §8 命名映射）、部署拓扑（Nginx / Web / Server / MySQL / Redis / 存储）。
- 🛡️ [红队评审](docs/architecture/red-team-review.md) 升级至 **v1.1**：新增「四列速览表（问题描述 / 风险等级 / 触发条件 / 修改建议）」、
  主题 E「空指针与边界值」（`N-01~N-11` / `B-01~B-07`）与主题 F「PRD 与 API 契约漏审」（`PRD-01~PRD-09` / `API-01~API-06`），
  补 `D-06`；发现总数 32 → **66**（高 27 / 中 34 / 低 5），八维度排查已全覆盖。
- 📐 [架构落地说明 `docs/architecture/architecture.md`](docs/architecture/architecture.md) §4 扩充「⏸ 延期登记」至 **D-1 ~ D-7**，并新增
  「🎯 本阶段 DoD 现状对照」表；同步更新 [红队评审](docs/architecture/red-team-review.md) 发布门禁第 7 条与待回改项裁决说明：
  - **D-4**（= D-3「对外契约 4 项」· DoD-3）：写接口 `Idempotency-Key` 幂等键定义缺失、免登录端点集中化与防刷未补、前后端确认无留痕 → 须在**写首个 Controller 之前**完成（硬前置）；
  - **D-5**（DoD-4）：分片上传 / 审批两组接口未定稿——审批动作端点路径（approve / reject / reassign / 撤销 / 待办 / 列表 / 详情）缺失、
    字段级 schema（DTO 字段、`precheck` 参数位置、`parts` hash 载体）缺失、`docs/api/README.md` §1 前缀表缺 `/permission/applications` → 须在**进入 Phase 4 之前**完成（硬前置）；
  - **D-6**（DoD-1 ①）：CE/EE 功能边界未书面冻结（PRD 仍 `v0.2-draft · 待评审`）→ 范围评审后置 `frozen`；
  - **D-7**（= A-2 范围侧 · DoD-1 ②）：战略规划书 0.3 节原文未入库，`§1.1 ↔ 0.3 节` 逐项对应不可验证 → 原文入库后逐项核对并出具「无遗漏」结论。
  - DoD 现状：**② 达成**（13 个用户故事、P0 占 9）/ **③ 基本达成**（缺 D-4）/ **①、④ 部分达成**（D-6 / D-7 / D-5 + SPI 接缝 A-6）；
    风险分级：🟢 口径 / 文档类（D-1 / D-2 / D-6 / D-7）、🔴 有兼容成本类须前置（D-4 / D-5）、⚠️ 接缝类（A-6 / D-2 的 7 个 SPI 仍未建）。
- 🧩 延期登记再扩充 **D-8 ~ D-12** 并落地配套结构变更（[architecture.md §4 ⏸ 延期登记](docs/architecture/architecture.md)）：
  - **D-8**（= N-1 · ✅ **已收口**）：`at:share:lock:{token}` TTL 口径裁定为 **30 min** —— 以 PRD US-03「连续 5 次 → 临时锁定（30 分钟）」为需求权威源，
    与 `RedisKeyConstants.SHARE_LOCK_TTL_SECONDS`、`system-design` §5.3 / §7.1、红队 [C-08] **四处一致**；15 min 系与 `at:login:fail`（确为 15 min）串行误抄。项目内本已一致，**无需回改**；
  - **D-9**（= N-2 · 随 D-5 收口）：动态菜单「有数据、无字段、无接口」→ V4 已补路由元数据列，`GET /api/v1/permission/menus` 挂 **Phase 5** 路由守卫阶段，字段级 schema 并入 **D-5**；
  - **D-10**（= N-3）：审计留存 ≥ 6 个月的 `AuditArchiveScheduler`（**先归档后删除** + 分布式锁 + 失败告警）未实现 → 待审计写入方落地后（Phase 3~4）；
  - **D-11**（= N-4）：群组 / 空间成员模型缺失 → V4 新建 `sys_group_member` / `sys_space`，`at-collaboration` 落地时接管读写；
  - **D-12**（= N-5 · ✅ **CE 口径已定**）：外部协作者受限身份 → V4 补 `sys_user.user_type`（CE 恒为 `1`，存量行为零变化）；
    **CE 裁定维持 PRD §2.1 P6**（外部协作者 = **无平台账号**、只走外发链接通道），**不创建外部协作者账号**，该列仅作 **EE / 受限账号预留**；
    EE 将来若启用受限账号，属需求变更，须先经 **D-6** 范围评审（同步改写 PRD P6 与 US-03 验收标准）。
- 🗄️ 新增 `sql/V4__menu_route_user_type_and_collaboration.sql`（**纯增量**；「V3」已被 `V3__add_user_token_epoch.sql` 占用，故版本号顺延）：
  `sys_permission` 补 `route_path` / `component` / `icon` / `visible`；`sys_user` 补 `user_type`（默认 `1`-内部用户）；
  新建 `sys_group_member`（唯一键 `uk_group_user`）与 `sys_space` —— **`sys_` 前缀表由 16 增至 18**。V1 / V2 / V3 属已发布脚本，按 Flyway checksum 约定**未回改**。
- 🧵 `at-collaboration` 骨架实体 `CollaborationSpace` 表名由 `collaboration_space` 对齐为 **`sys_space`** 并补 `group_id`；
  [docs/api/README.md](docs/api/README.md) §1 前缀表登记 `/api/v1/permission/menus`。
- 🔑 Redis Key 规约收敛：限流键 `at:rl:{类}#{方法}[:业务key]:{维度}` 原由 at-gateway `RateLimitAspect`
  **手拼前缀**，现回归 at-common `RedisKeyConstants`（新增 `RATE_LIMIT_PREFIX` 常量 + `rateLimitKey(...)` 工厂方法），
  `system-design` §7.1 Key 规划表同步补录该行 —— 至此**全仓无手拼 Redis Key**（DoD-4 达成）。
- 🐳 `docker-compose.dev.yml` 的 MySQL / Redis 宿主端口改为**可覆盖**（`${MYSQL_PORT:-3306}` / `${REDIS_PORT:-6379}`），
  与 `docker-compose.yml`、`.env.example` 口径对齐；宿主机 3306 已被本机 MySQL 服务占用时，
  复制 `.env.example` 为 `.env` 设 `MYSQL_PORT=3307` 即可，**无需停掉本机服务**（默认值不变，向后兼容）。
- ⬆️ **前端大文件分片上传模块（web/src/services/upload + workers + hooks + components/ChunkUpload）**：
  - `utils/sha256.ts` + `workers/hash.worker.ts`：纯 TS 增量 SHA-256（FIPS 180-4 向量校验），在 Worker 内**一趟读取**同时产出全文件摘要与逐片摘要，
    有 `crypto.subtle` 时自动走原生实现；主线程不参与计算，10 GiB 文件也不会卡 UI；
  - 上传主流程（`ChunkUploadController`，与 React 解耦的纯 TS 引擎）：**哈希 → 秒传预检 → 查询服务端已收分片 → 只补缺失片 → 合并**；
    服务端是切片口径与已收分片的**唯一权威**，其 `chunkSize` 变化会触发本地重算，票据过期（4101）自动作废重走预检；
  - 并发与容错：单文件并发分片数 1~5（默认 3，超上限会被服务端 4103 拒绝）、失败**指数退避重试 3 次**（含 ±20% 抖动，封顶 30 s）、
    不可重试错误（如 4003 完整性失败）**立即失败**不做无谓重试；暂停 / 继续 / 取消 / 重试 / 移除全链路可用；
  - 断点续传：进度与已收分片落 localStorage（按「名称 + 大小 + 修改时间」匹配），刷新后提示「检测到未完成的上传」，**重新选择同一文件即续传**
    （浏览器不允许持久化 `File` 对象）；若同名同大小但摘要已变，则作废旧票据重传，避免合并出损坏文件；
  - UI（`components/ChunkUpload`）：AntD 拖拽上传 + **整体进度**（字节加权）+ 单文件进度 / 速率 / 重试次数，分片大小与并发数可调；
  - 单测 28 例（`sha256.test.ts` 5 / `uploadCore.test.ts` 8 / `ChunkUploadController.test.ts` 15）：标准向量、padding 边界、分片边界、
    退避曲线、存储与恢复、秒传、并发上限、重试、暂停续传（含暂停意图上报与续传对账补发）、取消、票据失效等路径全覆盖。
- 🖥️ 新增分片上传示例页（前端路由 `/upload`）：`web/src/pages/upload/index.tsx` 用步骤条讲清上传链路，
  上传完成后实时列出文件（名称 / 大小 / 是否秒传 / `fileId`），并给出组件与 Hook 的接入示例；
  配套 `_mock.ts` 以**内存**模拟服务端（票据、已收分片、秒传索引均存活于 dev server 进程），
  因此 `npm run start`（开启 mock）可在**无后端**时完整走通分片上传、秒传与「刷新后重选文件续传」；
  路由与中英文菜单文案（`menu.upload`）同步登记。
- ⬆️ **后端分片上传主线（at-transfer）**：前端分片上传模块（含示例页）已就绪，但后端此前**零落点**（无 precheck / parts / merge），
  本轮把「秒传预检 → 断点续传 → 分片落盘 → 合片校验 → 落库」补齐，端点与前端契约逐字对齐：
  - 端点（`/api/v1/transfers`）：`POST /precheck`（命中秒传直接建引用并回 `fileId/nodeId`）、`GET /{uploadId}/parts`（已收分片清单）、
    `PUT /{uploadId}/parts/{index}`（multipart：字节流字段 `chunk` + 分片指纹字段 `hash`，索引以路径为准；
    成功回 `data.received` = 已收分片**索引数组**而非计数，与前端 `PartUploadedResult.received: number[]` 逐字对齐）、
    `POST /{uploadId}/merge`（合片落库）、`DELETE /{uploadId}`（取消并清暂存）；
  - **B 类流程分支码不抛异常**：秒传未命中 `4001`、缺片 `4002` 均以 **HTTP 200 + `code` 分流 + `data` 载荷**返回
    （上传票据 / `received` + `missing`）。若按异常处理，全局处理器会回 `Result<Void>`，`data` 被静默丢弃，
    前端将同时失去「秒传」与「补传」两条路——故 `at-common` 的 `Result` 新增 `failWithData` 工厂承载分支载荷；
  - `TransferTaskStateStore`：`SELECT ... FOR UPDATE` 行锁 + 状态 CAS（`0 排队 / 1 传输中 / 2 暂停 / 3 完成 / 4 失败 / 5 取消 / 6 合并中`），
    `sys_upload_task.uploaded_indexes` 的读改写不依赖应用层「先查后写」；合片与流式落盘等大 IO 一律留在事务外，
    事务内只碰元数据（短事务 + 大 IO 分离）；
  - `ChunkStore`：分片先写 `.tmp` 再原子改名（避免半个分片被计入已收）、合片**流式**拷贝不整件入内存、
    分片级与整件级 SHA-256 **均由服务端重算**（不信任客户端上报）；
  - 跨模块接缝：`FileIngestPort`（at-common）+ `FileIngestAdapter`（at-file），`at-transfer` **不依赖 `at-file`**，
    合片产物经端口登记，守住「依赖倒置」的架构铁律；
  - 安全与配额：任务归属校验失败一律按「不存在」处理（不区分 403 / 404，避免票据号被枚举探测）、
    单用户进行中任务数超限 `4103`、单文件超限（`max-chunk-size × max-chunk-count`）`4006`、任务 TTL 24 h 顺带回收；
  - 配置：新增 `anttransfer.transfer.*`（8 MiB 默认分片 / 64 MiB 单分片 / 1024 片上限 / 暂存根 / 并发上限 / TTL）与
    `spring.servlet.multipart`（`max-file-size=64MB` / `max-request-size=80MB` / `file-size-threshold=0`）——
    后者此前**完全未配置**，一直沿用 Spring 默认单文件 1 MB，与本能力直接冲突；
  - `V10__upload_task_parent_id.sql` 补 `sys_upload_task.parent_id`：预检上报目标目录，
    **同内容传到不同目录不再互相复用票据**，合片时作为 `folderId` 透传 at-file；
  - 测试：`TransferTaskServiceTest` 18 例（秒传命中 / 复用进行中任务 / 并发上限 / 参数越界 / 续传 / 分片大小与指纹 /
    缺片分支 / 请求过期 / 整件指纹不符 / 归属越权 / 取消）+ `TransferControllerTest` 7 例（HTTP 契约与分支码载荷）。
- ⏸️ **分片上传「暂停 / 续传」闭环补全（at-transfer + web）**：此前「暂停」只有前端本地态、服务端零落点（`2 暂停` 只能由外部写入），本轮把**意图登记 + 自愈**补齐：
  - 端点（`/api/v1/transfers`）：新增 `PATCH /{uploadId}`（请求体 `{"action":"pause"|"resume"}`，需 `file:upload`）——
    暂停 CAS `0 排队 / 1 传输中 → 2 暂停`、续传 CAS `2 暂停 → 0 排队 / 1 传输中`（目标态按已收分片判定）；
  - **暂停 = 意图登记，不是服务端闸门**：服务端不主动打断在途分片，避免「abort 与落库竞态」制造伪 `4102`；
    真正止血由前端 `AbortSignal` 完成，服务端只记录「用户想停」并在续传时给出正确目标态；
  - 幂等与边界：重复动作**幂等成功**；终态（`3 完成 / 4 失败 / 5 取消`）按「不存在」回 `4101`；`6 合并中` 回 `4102`；
    `action` 非法回 `2003`（`@Pattern` 前置拦截 + 兜底分支防注解被误删）；
  - 竞态收口（`TransferTaskStateStore.appendPart`）：暂停态写入在途分片时 **保持 `2 暂停`**、不被反推为 `1 传输中`，已收分片不丢、进度不倒退；
  - 可读性：`GET /{uploadId}/parts` 增回任务 `status`（`ChunkPartsVO` 扩列），前端据此对账；
  - 前端（`web/src/services/upload`）：`pause()` 先 `AbortSignal.abort()` **即时止血**、再 best-effort 上报（**不 await 往返、失败不阻断本地暂停**）；
    续传对账发现服务端仍 `2 暂停` 且本地未 abort 时**自动补发 `resume`**，让「上报丢失」自愈；
  - 测试：后端新增 `TransferTaskStateStoreTest`（锁定暂停不被在途分片撤销）、`TransferTaskServiceTest` 8 例
    （幂等 / 合并中 `4102` / 终态 `4101` / 续传目标态）、`TransferControllerTest` 新增 pause / resume HTTP 契约；
    前端 `ChunkUploadController.test.ts` 新增 4 例（上报、无票据不报、对账补发、对账期间再暂停不顶掉），**15 例全通过**；同步补齐 `useChunkUpload.test.tsx` 的 `uploadApi` 替身（缺 `changeTaskState` / `TASK_STATUS_PAUSED` 会让续传对账误判并打死任务），**8 例全通过**。
- 🔐 **权限申请审批闭环（at-permission）**：打通「无权限 → 申请 → 审批 → 授权 → 到期回收」全链路，
  写侧一律 CAS + 行数校验（红线 P-1），事件与缓存副作用统一在**事务提交后**发布：
  - **申请**（`PermissionApplicationService.create` + `ApplicationCreateDTO`）：按 `applyType` / `resourceType` /
    `resourceId` / `purpose` / `desiredExpireAt` 落单为 `PENDING`；落单前三重校验——显式 **Deny 冲突命中即拒**
    （`1003`）、已有生效授权 `1008`、同人同资源存在进行中申请 `1009`（防重复）；按敏感等级
    `LOW/MEDIUM/HIGH` 解析审批人与 SLA（`24h/12h/4h`，`ApprovalProperties`），**未解析出审批人不静默放行**，
    落库待认领并由超时任务升级。
  - **审批三件套**：通过（`approve`）允许审批人**缩小授权范围 / 缩短有效期**（`resolveFinalGrantType` 拒绝放大、
    `resolveExpireAt` 取更早者），同事务写 `sys_user_file_permission`（最终 `expire_time`、来源 `APPROVAL`）并在
    提交后发 `PermissionGrantEvent` + 失效 `at:perm:{userId}`；驳回（`reject`）理由必填并通知申请人；转审
    （`transfer`）经 `PENDING → TRANSFERRED → PENDING` 两段 CAS 改指审批人，`sys_approval_node` 留痕并通知新审批人。
    `ApprovalStateMachine` 覆盖全分支，非法流转抛 `1011`。
  - **通知抽象**（`Notifier` / `PermissionNotifier` + `PermissionNotification`）：站内信 `InboxNotifier`（P0，
    落 `sys_notify_message`）与邮件 `EmailNotifier`（P1，开关控制）可插拔，业务侧只依赖抽象。
  - **定时任务**：`PermissionGrantExpireScheduler` 每小时 CAS 回收过期授权并发 `PermissionExpiredEvent`；
    `ApprovalEscalationScheduler` 每 10 分钟扫描超时未审批单并升级提醒上一级；`EmergencyApprovalScheduler`
    紧急通道（强提醒、1h、仅中敏感及以下）**标记为 P1 开关**。
  - **实时判定与重评估**：`PermissionGrantService.hasActiveGrant/assertActiveGrant` 每次**实时回源**判断
    `expire_time`（不依赖定时任务，过期即判无权限 `1003`）；对外提供 `revokeApprovalGrants(userId)` 作
    「调岗 / 离职」重评估入口——逐条 CAS 回收该用户来源 `APPROVAL` 的授权、发 `PermissionExpiredEvent` 并失效缓存
    （供 4.6 用户管理调用），CAS 抢单失败不重复发事件。
  - **审批人视图**：`PermissionQueryService` + `PermissionApplicationController` 提供「待我审批 / 我发起」分页
    与申请人**权限地图**（权限点 + 来源：角色继承 / 审批获得）。
  - **CE/EE 扩展点**：`ApprovalNodeResolver` + `ApprovalNodeResolverChain`（CE 为 `SingleNodeApprovalResolver`
    单节点，EE 可动态解析多级节点）；ABAC 时间 / IP 规则只留解析扩展点 `AccessRuleResolver` +
    `AccessRuleResolverChain`（Deny 优先、无解析器 `ABSTAIN`，P1）。
  - 🧪 新增单测 70 例（`ApprovalStateMachineTest` / `PermissionApplicationServiceTest` / `PermissionGrantServiceTest` /
    `ApprovalPropertiesTest` / `AccessRuleResolverChainTest`）：状态机全分支、防重复、Deny 冲突、审批三件套与
    CAS 并发抢单、**过期实时判断**、调岗 / 离职重评估全覆盖；纯单测下显式初始化 MyBatis-Plus `TableInfo` 缓存
    （`MybatisPlusTestSupport`），既保留 Lambda 条件构造器（防列名硬编码）又无需启动 Spring 容器。
- 🔗 **外发分享主线（落地于 `at-file`，见 [AT-DIFF-06](docs/development/AT-DIFF-todos.md#at-diff-06-外发分享模块归属)）**：
  创建 / 撤销 / 查询 + 访客**免登录**换票取件。
  - **创建者侧** `ShareController`（`POST /api/v1/shares`、`DELETE|GET /api/v1/shares/{token}`、`GET /api/v1/shares/mine`）
    统一 `@RequiresPerm("file:share")`；`shareToken` = `SecureRandom` + Base64URL（256 bit，不可猜），提取码
    **BCrypt 加盐**落库，`ShareLinkVO` 不含该字段（**绝不回显**）；详情 / 列表仅创建者本人可见（行级归属校验）。
  - **访客侧** `ShareAccessController`（**免登录白名单** `/v1/shares/{token}/verify`、`/v1/shares/redeem`，均带 `@RateLimit`
    防刷）执行严格校验链：令牌存在 → 未撤销 / 未过期 → 提取码 → 次数未耗尽 → 签发一次性票据。票据存 Redis
    （`at:share:ticket:{ticket}`，TTL 5 min，**`GETDEL` 取用即焚**、不落库），核销时**二次校验链接状态**，
    使撤销 / 过期对**已签发**票据即时生效。
  - **次数不超发（[C-08] / P-8）**：核销时先过 Redis `DECR` 前置闸（Lua；键缺失 / Redis 异常一律降级为「仅 DB 裁决」），
    再以 `UPDATE ... WHERE ... AND downloaded_count < download_limit` 的**单条原子 SQL** 作唯一权威裁决，影响行数 = 1 才放行；
    同一条 SQL 用 `CASE` 在「用尽最后一次」时原子收敛 `status=2`（**赋值顺序即正确性**，见 `ShareLinkMapper` 注释）；
    DB 拒绝时回写镜像 `download_limit - downloaded_count`，与 `sys_share_link` 最终一致。
  - **提取码防爆破**：`INCR at:share:lock:{token}` 连错 5 次锁 **30 min**（D-8 口径，可配）；TTL 刷新点设在
    **触发锁定那一刻**而非首次错误，避免「第 5 次错误发生在第 25 分钟 → 只剩 5 分钟锁定」的窗口缩水；
    锁定期内即便提取码正确也拒绝（4011）。
  - **内容扫描扩展点**：`ContentScanInterceptor` + `ContentScanChain`（**Deny 优先** + **fail-closed**：扫描器抛异常按
    拦截处理，绝不因 DLP 故障放行）；CE 实现 `SuffixAndKeywordScanInterceptor` 读**配置化**后缀黑名单
    （默认 `exe/sh/bat/msi/com/scr`）与文件名敏感词，命中即 4007 拦截并写 `SHARE_BLOCKED` 审计；EE 可挂 AI DLP。
  - **审计**：取件成功写 `SHARE_DOWNLOAD` / `SHARE_PREVIEW`（匿名操作人 + IP + UA + 时间 + 剩余次数，UA 落 detail），
    锁定写 `SHARE_CODE_LOCKED`，创建 / 撤销写 `SHARE_CREATE` / `SHARE_REVOKE`；**审计失败只告警不阻断业务**。
  - 🧪 **测试**：`ContentScanChainTest`（6 例：黑名单 / 敏感词 / Deny 短路 / fail-closed / 应急开关）；
    `ShareQuotaConcurrencyIntegrationTest`（Testcontainers MySQL 8.4 + Redis 7，**额度 3 / 并发 12 →
    恰好 3 成功、9 个 4004**，`downloaded_count` 恒为 3、链接收敛 `status=2`、Redis 镜像归零；提取码连错 5 次锁定 4011）。
    ⚠️ 该集成测试在开发中**真实捕获**「锁定键与错误计数键共用同一 Redis Key → 仅用 `hasKey` 判定导致第 1 次错误即
    被误判锁定」的缺陷，已改为 **比值（`>= maxCodeErrors`）** 判定修复，并保留用例为回归防线。
  - **分享管理页批量失效（`/shares` 行复选框 + 「失效所选」/「失效全部」）**：新增
     `POST /api/v1/shares/batch/revoke`（`RevokeSharesRequest`，令牌列表，单次上限 200）与
     `POST /api/v1/shares/all/revoke`（**无请求体**）两个端点，均 `@RequiresPerm("file:share")`，回**实际失效条数**。
     - **范围不可由请求决定**：「失效全部」刻意**不接受任何范围参数**——作用域就是「当前登录用户的全部生效中链接」，
       一旦范围可被请求控制，一次传参失误就会变成「以为全撤了、其实只撤了一页」的沉默失败（不止本页）。
     - **单条原子 UPDATE，不用逐条 CAS**：`revokeBatch` 为 `WHERE owner_user_id = ? AND share_token IN (...)`、
       `revokeAll` 为 `WHERE owner_user_id = ? AND status = 0`，影响行数即权威事实，不留中间态；
       `owner_user_id` 过滤同时兜住越权——非本人令牌既不命中也不报错，无法借批量接口反向试探他人令牌是否存在。
     - **个别失败不拖垮整批**：已终态 / 非本人 / 并发已被他人撤掉的条目**静默跳过**（不再回 4012），
       只回实际失效条数；前端据此把「撤掉 N 条」与「本来就没有可撤的」（`0` → `shares.revoke.none`）**分开如实陈述**，0 条绝不谎报成功。
     - **审计一次操作一条**：`SHARE_REVOKE` 一条留痕，`extra` 带 `scope`（`batch` / `all`）、`revoked`（实际失效）、
       `requested`（意图失效）——逐条写会把审计表刷满并淹没其它事件，与「清空回收站」同口径；
       无事实变化（影响行数 `0`）时不写审计。
     - Redis 配额镜像 `at:share:count:{token}` 在**事务提交后**（`AfterCommitUtils`）一次 `DEL` 多键清理，真值仍以 DB 为准。
     - **前端**：`ProTable` 行复选框 `getCheckboxProps` 令**仅「生效中」的行可勾选**（勾上撤不掉的行，等于让「失效所选」
       变成一次静默空操作），工具条「失效所选」带出已选条数且未勾选时禁用；两个入口均走 `DangerConfirm` 二次确认
     （`level: 'critical'`，撤销是终态）。
     - 🧪 **回归**：后端 `ShareLinkBulkRevokeTest`（8 例：归属收口 / 幂等计数 / 零副作用 / 审计口径，25 例全绿含
       `SharePermissionBoundaryTest` 17 例）；前端 `web/src/pages/shares/index.test.tsx`（6 例：复选框只对生效中开放 /
       失效全部不带范围参数 / 0 条不谎报成功 / 无 `file:share` 整页拒绝）。
- 💬 **站内通知与 IM 长连接（`at-collaboration`，US-08）**：
  - **通知域统一收敛**：删除 `at-permission` 自带的站内信 / 邮件实现与渠道开关（`notify` 包、`PermissionNotifier`、
    `PermissionNotification`、本地 `NotifyMessage` 实体与 Mapper），统一为 `at-common` 的
    `NotificationPort` / `NotificationCommand` / `NotifyType` SPI，由 `at-collaboration` 独占实现——
    否则「两套渠道开关 + 两处落库」必然出现口径分歧；跨模块事件（`PermissionGrantEvent` /
    `PermissionExpiredEvent` 等）一并收归 `at-common`，消除模块间反向依赖。
  - **WebSocket 通道**：原生 `TextWebSocketHandler` + JSON 信封，**不引入 STOMP**——本场景所有下行都是
    「按用户点对点推送」，没有广播主题，STOMP 只会多一层目的地解析却仍要自建会话注册表 / 心跳 / 跨实例广播
    （`SimpleBroker` 不支持集群）；协议面更小、可测、跨语言客户端直接可用。
    握手复用 JWT 鉴权（浏览器 WebSocket 构造器无法设头，令牌走 `?token=`），30s 心跳探测 + 90s 超时清理僵尸连接，
    多实例经 Redis Pub/Sub `at:ws:channel` 广播且**只推给本机已连接用户**。
  - **可靠性口径**：消息**先落库（`sys_notify_message`）再推送**，WebSocket 仅作加速通道——离线用户走
    `GET /api/v1/notifications/offline` 补拉并清红点，故推送丢失**无需补偿重发、客户端无需 ACK**；
    校验通过后立即下发 `CONNECTED`（携带未读快照），突发重连不产生「红点闪回」。
    ⚠️ 已知边界：鉴权只在握手做一次，令牌过期 / 登出不会断开**已建立**的连接（`WebSocketConfig` 类注释已登记）。
  - **数据模型（`sql/V5__collaboration_im_notify.sql`）**：`sys_notify_message` 补会话维度列
    （`sender_user_id` / `message_type` / `chat_scope` / `chat_target_id` / `client_msg_id`，全可空，向后兼容）
    与 `idx_session`、`uk_sender_recipient_client` 索引；采用**写扩散落库**（单聊 2 行 / 群聊 N 行），
    查询恒为单表按 `(recipient_user_id, chat_scope, chat_target_id)` 走索引。
    唯一键**必须含 `recipient_user_id`**：群聊共享同一 `clientMsgId`，若只按 `(sender, clientMsgId)` 约束，
    第 2 个成员的消息会因幂等键冲突写不进去。
  - **三口径未读分离**：inbox（导航栏红点）/ todo（待办角标）/ chat（会话角标）各自成板；
    离线补拉只清 inbox，**待办已读必须由处置动作驱动**，不会被补拉顺带清掉。
  - **端点**：`GET /api/v1/notifications`（收件箱分页）、`GET /unread`、`GET /offline`、
    `POST /{id}/read`、`POST /read-all`；`GET /api/v1/todos`、`GET /api/v1/todos/count`；
    `POST|GET /api/v1/chat/messages`、`POST /api/v1/chat/read`。
    所有接口 **userId 一律取自登录态**，不提供任何以入参指定用户的口子（越权入口）。
    单条已读失败抛 `BusinessException(RESOURCE_NOT_FOUND)` 而非返回 `Result.fail`，
    避免「HTTP 200 + 业务错误码」与其余接口的错误语义不一致。
  - 🐛 **修复 afterCommit 静默丢数据**：审批事件在 `afterCommit` 回调中到达时，外层事务已提交但连接仍绑定线程、
    事务同步仍 `active`，此时 `REQUIRED` 传播会「加入」一个已完成的事务，导致 INSERT **既不提交也不回滚**
    （无异常、无日志，数据静默消失）。改为 `TransactionTemplate` + `PROPAGATION_REQUIRES_NEW`
    挂起旧事务另开新事务写入。
  - 🧪 受影响的 `at-permission` 单测（`PermissionApplicationServiceTest` / `PermissionGrantServiceTest` /
    `ApprovalPropertiesTest`）同步改用 `NotificationPort` / `NotificationCommand` mock 与断言。
- 🗂️ **文件域（at-file）目录树 / 分页列表 / 物理去重落地**（`FolderService` / `FileNodeService` /
  `FileContentService` / `FileCleanupScheduler` / `FolderController` / `FileController`）：
  - **目录树（物化路径）**：`sys_folder.path` 以「父路径 + 自身 ID」拼接，前缀查询即可取整棵子树，移动目录时
    一次性重写子孙 `path` / `depth`；移动前用**路径前缀**判成环（目标是自身或子孙），改名不影响子孙路径。
    `GET /api/v1/folders/tree` 一次返回整树（`children` 空数组而非 `null`），另有 `POST /api/v1/folders`、
    `PATCH /{id}/rename`、`PATCH /{id}/move`、`DELETE /{id}`。
  - **删除目录 ≠ 销毁文件**：目录删除只把目录及其子孙目录下的文件**移入回收站**并逻辑删除目录，
    `ref_count` 不变、文件仍可还原；只有「彻底销毁 / 清空回收站 / 回收站到期清理」才递减引用计数。
  - **物理去重（内容寻址 + 引用计数）**：`sys_file` 以 `uk_sha256_size` 唯一键保证同内容仅一份物理字节；
    首次入库 `ref_count=1`，秒传命中 / 复制 `+1`；递减走带 `ref_count > 0` 守卫的原子 SQL，
    **归零且引用表实际行数为 0**（双计数交叉校验，防计数漂移误删）才回收物理文件。
  - **物理回收放到事务提交之后**（`AfterCommitUtils`）：删字节不可回滚，若在事务内删盘又回滚会留下
    「库里有行、盘上无字节」的坏数据；故提交后先删元数据行、再删字节，回调执行前再复核一次计数，
    期间被并发秒传把引用加回去则放弃回收。
  - **IO 与事务分离**（`FileContentService` vs `FileNodeService`）：磁盘探测 / 落盘在事务外完成，短事务只写元数据；
    `sha256` 由服务端流式计算，不信任客户端上报值。
  - **分页列表多条件筛选 + 排序**：`folderId` / `keyword` / `ext` / `level` / `uploadUserId` /
    `minSize|maxSize` / `startTime|endTime` / `tagId`（空集合 = 无结果，不退化为忽略条件）；排序为
    **白名单字段映射物理列**（杜绝注入）并恒定追加主键，避免排序键相同时翻页重复 / 漏行；
    `pageSize` 收敛到 100，与分页插件上界口径一致。
  - **秒传幂等**：同用户已有同内容正常态条目时直接复用、不重复建行也不重复计数，重复秒传不会灌大 `ref_count`。
  - **权限四档**：`file:preview` / `file:upload` / `file:edit` / `file:destroy`，`file:destroy` 只给到
    「彻底销毁 / 清空回收站」；`level=3` 高敏感文件的销毁在审批联动能力到位前 **fail-closed** 一律拒绝。
  - 回收站到期清理（`FileCleanupScheduler`，cron 默认 `0 30 3 * * ?`，可配）分批循环、每批一个独立事务，
    避免长事务与磁盘 IO 尖峰。
- ⬇️ **文件域（at-file）下载票据 / Range 流式下载 / 缩略图 / 预览落地**
  （`FileDownloadTicketService` / `FileDownloadService` / `FilePreviewService` / `FileTypePolicy`）：
  - **下载票据（短时 + 绑定用户与文件）**：`POST /api/v1/files/{id}/ticket` 在登录态下校验
    `file:download` 与条目归属后签发，TTL 默认 5min（可配）。票据绑定 `userId + nodeId + 取件范围`，
    核销时逐项比对，任一不符即 `4018`。**只校验不销毁**——同一用户重试 / 断点续传 / 多线程分段拉取
    都会重复取件，一次即焚会把正常行为判成失效（与分享域访客票据的「一次即焚」刻意相反）。
  - **`/content`、`/thumbnail` 必须放行匿名**：`<a href>` 原生下载、`<img src>`、播放器与下载工具
    **都无法携带 Authorization 头**，凭证只能走查询串。故权限判定被前移到换票阶段，
    取件端点在服务层复核「票据绑定 + 当次重新读库的条目归属」（不信票据里的归属快照），
    并各自挂 `@RateLimit` 抗票据爆破。
  - **票据 scope 防权限降级**：预览票（`file:preview` 签发）只能取缩略图与「可安全内联」类型，
    **强制 inline 且不可改判为 attachment**；否则 `file:preview` 等价于 `file:download`，权限点形同虚设。
  - **Range 断点续传**：单段 `bytes=a-b` / `bytes=a-` / 后缀式 `bytes=-N` 均支持，
    206 + `Content-Range` + `Accept-Ranges`；起点越界回 **416 + `bytes */total`**（正常协议协商，不记失败审计）；
    多段 Range 按整份下发（多段响应需 `multipart/byteranges`，收益与复杂度不成正比）。
  - **任务级可选限速 + 全局兜底**：`speedLimit`（字节/秒，**未传取 `defaultSpeedLimit`，显式传 0 表示不限速**，
    两者语义不同）；每条下载流一个独立漏桶（任务粒度 = 一次传输），叠加全局桶即天然取更严者，
    顺序先任务后全局以免全局桶等待被单任务长等待挤占。**超限表现为背压等待而非掐断**——
    响应头早已发出，掐断只会让用户拿到半截文件且无法续传。
  - **补上 `BandwidthLimiter.evictIdle` 的调用方**：此前该方法零调用，而每条下载流都会建桶，
    等于一条稳定的内存泄漏（桶极小、增长慢，最容易被忽略到 OOM 才暴露）。
    现由 `FileCleanupScheduler` 每小时回收 1h 无活动的桶，与回收站清理错峰。
  - **图片缩略图**：等比缩放到最长边 256（默认），**小图不放大**；带 alpha 转 PNG、否则 JPEG。
    **防解压炸弹**：先只读图片头取尺寸做准入（`thumbnailMaxSourcePixels`，默认 4000 万像素）再决定是否解码，
    否则一个几 MB 的 PNG 可解出几万 × 几万的位图直接打爆堆；解码器初始化即关闭 `ImageIO` 磁盘缓存。
  - **PDF / 文本预览，Office 仅下载**：策略由服务端判定并随 `PreviewVO` 下发
    （`text` / `pdf` / `image` / `download-only` / `none`），前端只分发不判断，避免两端策略漂移。
    文本读前 2 MiB 后以 **JSON 字符串**返回（而非内联 `text/plain`，让 `.txt` 里的 HTML 无从执行）；
    编码判定为「严格 UTF-8 → 严格 GBK → ISO-8859-1 兜底」，并处理 UTF-8/UTF-16 BOM 与
    **末尾被截断的多字节字符**（逐字节退避重试，把「内容被截断」与「编码不对」区分开）。
    Office 系一律 `download-only`（服务端转码需 LibreOffice / POI 全量依赖，CE 不做）。
  - **内联渲染仅限 PDF 与光栅图**：内联时 MIME 按白名单**反查**给出，绝不回显客户端自报的
    `contentType`（否则等于让上传者指定浏览器用什么引擎渲染，存储型 XSS）；全链路带
    `X-Content-Type-Options: nosniff`。下载（attachment）才回显原 `contentType`，有 attachment + nosniff 兜底。
  - **下载文件名兼容老客户端**：同时给 ASCII 回退名与 RFC 5987 `filename*=UTF-8''` 编码名，
    并剔除控制字符 / 引号 / 反斜杠，避免头结构被破坏。
- 🧨 **文件域（at-file）文件管理四项能力落地**（`TagService` / `FileVersionService` / `PackService` +
  `TagController` / `FileVersionController` / `PackController`；数据层见 `sql/V6` / `V7` / `V8`）：
  - **彻底销毁（`file:destroy`）**：**绕过回收站**直接逻辑删除条目并 `ref_count - 1`，归零后物理回收。
    两条准入为**与**关系——① RBAC 的 `file:destroy`（`V8` 已从 DEPT_ADMIN 回收，等价「仅 SUPER_ADMIN」）；
    ② `level>=3` 高敏感文件必须关联一张「已通过」的高敏感审批单，经 `at-common` 的
    `SensitiveDestroyApprovalPort` SPI 校验（**不跨模块直读 at-permission**，守模块边界铁律），
    不满足统一 `4017`（策略 D，就地提示不跳登录）。此前的「审批联动到位前 fail-closed」口径就此收口。
  - **物理回收统一三道闸**（`FileNodeService#registerPurgeIfOrphaned`，公开供版本服务复用）：
    `sys_file.ref_count` / `sys_file_node` 存活行数 / **`sys_file_version` 存活版本数**任一非零即不回收。
    历史版本刻意不占 `ref_count`，第三道闸专治「版本列表已看不到某版、字节却永远留在盘上」的静默泄漏。
  - **标签与多标签搜索**：标签 CRUD + 文件打/取消标签（全量覆盖，空数组即清空；**先断关联再删标签**，
    避免出现「筛一个不存在的标签却有结果」）；列表页标签批量回显；搜索复用 `GET /files?tagId=` 或
    `tagIds=`，多标签为 **AND**（`having count(distinct tag_id)=N` 与单标签结果取交集）。
    越权口径与文件条目一致：别人的标签按「不存在」处理，不泄露 ID 空间。
  - **历史版本（P1，`versionKeepCount` 默认近 10 版）**：新版本上传走与主链路同一套
    `acquireContentReference`（同一去重与计数口径，避免两份实现漂移）；**回滚不是拨指针**，
    而是把目标版本内容复制成一条更高的 `versionNo`，使「谁在何时回滚到哪一版」永久可查；
    超限裁剪先逻辑删版本行**再**复核孤儿内容（顺序反了会把当前版算进引用、永远回收不掉）。
  - **批量打包下载（P1）**：**异步任务 + 磁盘产物**而非请求内边压边发——产物是普通 zip，`Range` 直接作用其上
    （可续传），文件数 / 合计大小 / 每用户并发全部在**创建入口**判掉（`4019` / `4103`），产物到期定时清理；
    打包线程池为独立有界池 + 中止策略（拒绝即判失败，不静默排队），提交挂在 `AfterCommitUtils` 上；
    zip 条目名做 **zip-slip 剥离 + 长度截断 + 同名去重**（`a/报告.pdf` 与 `b/报告.pdf` 不会互相覆盖）；
    僵尸任务（线程池拒绝 / 进程重启）由定时任务按超时收口，防止每用户并发名额泄漏成永久故障。
  - 📇 新增错误码 `4013`~`4023`（目录 / 回收站 / 票据 / 打包 / 标签 / 版本）已登记
    [error-codes.md](docs/api/error-codes.md)，接口前缀与语义已同步 [api/README.md](docs/api/README.md) §1。

- 👥 **系统管理面（用户 / 角色 / 权限点）落地于 `at-permission`，不新建 `at-system` 模块**：
  - 🧭 **落点裁决**：`sys_user` 的表主是 `at-auth`，故用户主数据的写入经 at-common 新增的
    `UserAdminPort` SPI 委托给 `at-auth`（`UserAdminPortAdapter`），与既有 `UserLookupPort` /
    `SensitiveDestroyApprovalPort` / `NotificationPort` 同构——**读写分道**：at-permission 只做
    「谁能管、能管到谁」的授权判定，用户行本身仍由表主单事务落库，跨模块边界不出现对方表名。
  - 🗂️ `sql/V9__system_admin_permission_points.sql`：新增 `system:user:*` / `system:role:*` 权限点，
    **仅授予 SUPER_ADMIN**；AUDITOR 一个 `system:*` 都不给。
  - 🔐 **四条不可绕过的红线**（数据层 + 服务层双保险，服务层判定见 `RoleAdminService` / `UserAdminService`）：
    ① **内置角色不可删不可改数据范围**（`SUPER_ADMIN` / `AUDITOR` / `DEPT_ADMIN` / `USER`）；
    ② **AUDITOR 权限集锁定只读**，任何变更请求一律 `1021`（改「审计员能不能看审计」= 让被审计者改考卷）；
    ③ **防提权**：数据范围非「全部」的操作者不能把角色范围改到超过自身、不能授予自身不具备的权限点、
    不能分配自己不持有的角色；
    ④ **防自锁**：`SUPER_ADMIN` 的必需管理能力（`assign-perm` / `user:list` / `user:assign-role`）不可削空、
    系统内最后一个可用超管不可停用 / 删除 / 摘角色，`admin` 受保护账号必须始终持有超管角色。
  - 🚫 **不得对自己操作**：停用 / 删除 / 重置口令 / 改角色四类动作对自己调用一律 `1023`
    （应走个人中心），杜绝「自查自升」与「一键自锁」两条最短路径。
  - 🔁 **调岗 / 离职触发权限重评估**：部门变更、停用（离职）、删除均调用 4.2 的
    `PermissionGrantService#revokeApprovalGrants` 回收其审批类授权，并 `invalidate` 权限缓存；
    部门未变化时不触发，避免无谓回收。**该副作用无返回值、漏调不报错**，故用 verify 钉死在单测里。
  - 🧾 **唯一性口径**：`uk_username` 是纯 username 唯一键、逻辑删除行仍占名，故建号查重走
    `countUsernameAnyState`（含删除行），撞名返回 `1016` 业务错误而非数据库异常 500。
  - 🔑 重置口令 / 停用 / 删除同步 **`token_epoch + 1`** 吊销在途会话，改密后旧 token 立即失效。
  - 📇 新增错误码 `1015`~`1028`（用户 / 角色 / 内置角色保护 / 防提权 / 防自锁）已登记
    [error-codes.md](docs/api/error-codes.md)；接口前缀 `/v1/system/users`、`/v1/roles`、
    `/v1/permission-points` 与逐端点权限点已同步 [api/README.md](docs/api/README.md) §1 与
    [frontend-permission-map.md](docs/development/frontend-permission-map.md)。
  - 🧪 新增单测 36 例（`RoleAdminServiceTest` 17 例 / `UserAdminServiceTest` 19 例）：
    四条红线逐条断言「抛的是哪一条」而非「抛了异常」、授权替换的「复活 / 停用 / 新增」三分类、
    缓存按角色持有者广播失效、数据范围收敛与分页上界。

- 🧾 **审计日志域（§4.6 审计与合规 · US-06）**：共享内核 + 权限/审批域全量埋点 + 检索导出接口「三件套」落地：
  - **共享内核下沉**：`sys_operation_log` 的实体与 Mapper 由 `at-file` 迁至 `at-common`
    （`com.anttransfer.common.audit.{OperationLog, repository.OperationLogMapper}`），落实 V1 表注释
    「审计族归口 at-common / at-permission」，使跨域（FILE / PERMISSION / AUTH）只写各自 logger 而不再「谁写审计就依赖谁」；
    动作字典（`FILE_*` / `SHARE_*` / `USER_*` / `ROLE_*` / `APPLY` / `APPROVE` / `REVOKE`…）与域 / 对象 / 结果常量集中一处，查表即知全集。
    `at-file` 侧 10 个 service 与两个审计器（`FileAuditLogger` / `ShareAuditLogger`）**仅切 import，行为零变化**；
  - **写侧埋点**（口径沿用 `FileAuditLogger`：**成功记录入调用方业务事务、失败记录走 `REQUIRES_NEW` 独立事务先提交**，保证「业务回滚不留成功假象」且「越权 / 被拒事件不会被回滚吞掉」）：
    `PermissionAuditLogger` + 用户管理 6 处（建号 / 编辑含调岗 / 重置口令 / 启停 / 删除 / 改角色）、
    角色管理 4 处（建 / 改含数据范围前后 / 删 / 授权整集替换含新增与移除差量）、
    审批 4 处（提交 / 通过（另记一条 `GRANT` 授权落地 + 有效期）/ 驳回（记理由）/ 转审（记 from→to））、
    授权回收 1 处（记回收原因、命中与回收条数、grantId 集）；**口令类只记「谁重置了谁」，绝不落口令明文 / 哈希**；
  - **读侧接口**（`AuditLogController`，前缀 `/api/v1/audit`，**独立于 `/v1/system` 管理面**，与四只读权限点受众 AUDITOR 对齐）：
    `GET /api/v1/audit/logs` 分页检索（过滤维度一一对齐 `idx_user_time` / `idx_target` / `idx_module_action` / `idx_log_time` 四个索引，
    固定 `log_time DESC, id DESC`，不接受任意字段排序以免走不了索引的全表排序）与
    `GET /api/v1/audit/logs/export` 导出 CSV（与列表**同一套过滤**，UTF-8 BOM 供 Excel 识别中文 + RFC 4180 转义使含逗号/引号的
    JSON `detail` 不错列；**单次 10000 行硬上界**——导出走 `selectList` 不受分页插件 100 上限约束，故必须自设上界防整表入内存）；
    两端点**共用** `audit:log:read`（仅 SUPER_ADMIN / AUDITOR，二者 data_scope 均为「全部」，审计的全量可追溯性不可按部门切分）。
    操作人展示名经 `UserLookupPort.findContacts` **批量**反查（N+1 → 1，`sys_user` 属 at-auth 表族不直连），查不到回落为空、不阻断；
  - **只读承诺**：服务层仅 `selectPage / selectList`，全链**不提供任何 update / delete / 清除端点**——
    与「审计不可被任何角色修改或删除、仅可归档导出」「`audit:log:clear` CE 从不签发（超管亦无）」两条红线一致；
  - 🧪 新增单测 11 例：`AuditLogQueryServiceTest` 7 例（展示名批量反查 / 系统动作不反查 / 缺联系人回落 / 分页与页码收敛 /
    时间倒挂早失败且不打库 / 导出强制 `LIMIT` 上界 / 导出与列表同过滤）+ `AuditLogCsvTest` 4 例（BOM / 空结果仅表头 /
    逗号引号换行转义与结果语义化 / null 渲染为空串）；同步 4 个既有 Service 单测的构造依赖（注入 `PermissionAuditLogger`）。

- 📊 **工作台「传输量 / 成功率」统计聚合落地（`at-transfer` + 前端接真实接口）**：
  - 新增 `GET /api/v1/transfers/statistics`（`TransferStatisticsController`，**登录即可用、不挂权限点**——只回调用者自己的聚合数字，
    用户 ID 仅从登录态取；一旦开放 `?userId=` 就能越权看他人传输量）；
  - 数据源复用共享内核审计账本 `sys_operation_log` 的 `FILE_UPLOAD` / `FILE_DOWNLOAD` 流水（不另立统计表，避免双写漂移）；
    `detail` 字节键由 `OperationLog` 集中定义（`transferredBytes` / `sentBytes`），写方（at-file）与聚合 SQL 引用同一常量，
    **键名一改即编译失败**，不会退化成「统计悄悄恒为 0」；
  - 口径：条数按 `result` 分成功 / 失败（失败不并入 upload / downloadCount，否则成功率分母自我重复计入）；
    字节取**实际过网量**——上传 `transferredBytes`（秒传命中为 0）、下载 `sentBytes`（`Range` 续传只计本段），
    且**不受结果过滤**（失败前已下发的半份仍是真实流量）；无任何流水时 `successRate` 返回 `null` 而非 `0`，以区分「还没数据」与「全失败」；
  - 字段级契约：`TransferStatisticsVO`（record）与前端 `services/dashboard/types.ts` 的 `TransferStats` 逐一对齐；
    工作台四卡片全部接真实接口，统计拉取失败仅让对应卡片降级为「--」占位（`silent` 请求、不弹错误 toast），整页照常可用；
  - 🧪 单测 5 例（`TransferStatisticsServiceTest`：聚合 / 无数据 null 率 / 全失败 0% / 整数率保留一位小数 / null 列归 0）+
    Testcontainers 集成 3 例（`TransferStatisticsIntegrationTest`，真 MySQL 8.4 校验 JSON 路径与口径：只看自己 / 秒传不计量 /
    失败前已下发算量 / 老流水缺字节键归 0 / 无流水 null 率 / 未登录 401(1001)）。

- 🧪 **质量门禁补齐：JaCoCo 覆盖率接入 `verify` + 前端独立 CI job**（对应交付 DoD 第 2 / 4 条，
  核对结论见 [docs/development/dod.md](docs/development/dod.md)）：
  - 父工程 `pom.xml` 接入 `jacoco-maven-plugin` **0.8.15**：`prepare-agent` 探针 + `verify` 阶段 `report`
    （各模块产出 `target/site/jacoco/{index.html,jacoco.xml,jacoco.csv}`）+ `check` 判定规则
    （**模块整体行覆盖率 ≥ 85%**、**安全逻辑类 ≥ 90%**，与 DoD 门槛一致）；
  - ⚠️ `check` 当前以 `haltOnFailure=false` **report-only** 运行：实测基线（2026-09-14）为
    **整体 36.50%（1892/5184 行）**、**安全包 52.86%（120/227 行）**，远低于目标值 —— 若直接硬门禁会让 CI
    永久红灯并阻断全部合并；达标后删除该参数即成为硬门禁（`pom.xml` 内已就地标注 ⛔）；
  - 打开 CI 中原 `if: false` 的覆盖率步骤，改为 `codecov/codecov-action@v7` 上传各模块 `jacoco.xml`；
    新增仓库根 [`codecov.yml`](codecov.yml)（后端防回归下限 `project target 36%` / `threshold 1%`，
    patch 覆盖率仅公示不阻断）；
  - CI **新增 `frontend` job**（Node 22，`web/` 工作目录）：`npm ci` → `npm test` → `npm run tsc` → `npm run build`，
    前端用例与类型错误自此进入 CI（此前 CI 仅覆盖后端），两个 job 并列即为「测试失败 → CI 红」；
  - 📌 统计口径：85% 按模块（BUNDLE）、90% 按类（CLASS）逐一判定；`at-collaboration` 因暂无测试执行
    不产出 `jacoco.exec`，报告与判定被自动跳过（属「尚未被测」而非「通过」）。
- 📄 **新增 [docs/development/dod.md](docs/development/dod.md)：交付质量 DoD 清单本体 + 逐项核对结论**，
  含四项标准的达成判定、实测证据、分模块覆盖率基线表、差距分析与待办清单；并在
  [docs/development/README.md](docs/development/README.md) § 测试策略建立入口（与 `architecture.md`
  § 🎯 本阶段 DoD「阶段范围 DoD」明确区分，避免两套 DoD 混淆）。

- 🔐 **账号自助改密 + 停用即时吊销（GAP-03 / GAP-02 同批收口，2026-09-20）**：
  - 🔑 **新增自助改密端点 `PUT /api/v1/auth/password`**（body `{oldPassword, newPassword}`）：
    `AuthService#changePassword` 按序执行「账号状态校验 → 原口令 `matches` → `PasswordPolicy` →
    `updatePassword` → 全端吊销 → 审计」；成功后 `token_epoch + 1`（**含发起本次请求的当前会话**），
    故前端拿到 `code=0` 也必须清本地令牌并回登录页，否则后续请求只会拿到 401 + `1001`；
  - 🧪 新增 `PasswordPolicy`：长度 8~64、须同时包含字母与数字、不得含空白、**不得与原口令相同**；
    上限 64 是 BCrypt 72 字节截断的安全边界；
  - 📇 新增错误码 `1029 OLD_PASSWORD_MISMATCH` / `1030 PASSWORD_POLICY_VIOLATION`（均 HTTP 400 + 策略 E）：
    属「请求被拒、**会话仍有效**」——就地提示并把错误挂到具体字段，**不得清令牌、不得跳登录**；
    前端 `result.ts` 策略表与 `requestErrorConfig.test.ts` 同步断言；
  - 🧾 新增审计动作 `OperationLog.ACTION_PASSWORD_CHANGE = "PASSWORD_CHANGE"`：
    detail 仅记 `username` 与 `revokedSessions`，**不落任何口令明文 / 摘要**；
  - 🛠️ **停用即时吊销（GAP-02 真正的根因修复）**：原实现「只递增 `token_epoch`、未清 Redis 纪元镜像键
    `at:token:access:{userId}`」时，`JwtAuthenticationFilter` 回源会读到**未提交的旧纪元**并**自愈回填**，
    把刚写下的吊销抹掉（最坏拖到 access TTL **30 min**，这才是「2 分钟窗口」的真实来源）。
    现 `TokenSessionService` 新增 `revokeAllInCurrentTransaction(userId)`
    （`@Transactional(MANDATORY)`，参与调用方事务，避免管理面持 `sys_user` 行锁时另开事务自锁），
    与既有 `revokeAll`（`REQUIRES_NEW`）共用同一个私有方法 `bumpEpochAndEvictAfterCommit`
    （DB 纪元为唯一权威 + **事务提交后**（`afterCommit`）清 Redis 镜像键，且清理异常被吞掉只告警：
    缓存清理失败最多退化为窗口期，**不会**把已提交的登出 / 改密翻成 500 或整笔回滚）；`UserAdminPortAdapter` 的
    `resetPassword` / `changeStatus(停用)` / `deleteUser` 统一改调该方法 —— 停用**当场失效**，优于原「2 分钟内」验收；
  - 🧪 回归：`AuthServiceTest`（成功吊销 + 审计 / 1029 / 1030 / 1005 且不校验原口令）、新增 `PasswordPolicyTest`
    （长度边界 / 组合 / 空白 / 与原口令相同 / null / 合规放行）、`AuthFlowIntegrationTest` 增
    `changePassword_shouldRevokeAllSessionsAndRotateCredential` 与 `disableUser_shouldRevokeSessionsImmediately`
    （管理员停用后原 access 立即 401 + `1001`）；
  - 💻 前端：`services/auth#changePassword`（**成功才清本地令牌**，失败保留）+ `AvatarDropdown` 新增
    「修改密码」入口与二次确认弹窗（当前 / 新 / 确认新口令），i18n 中英齐备；回归护栏
    `web/src/services/auth/api.test.ts`（成功清令牌 / 失败保留令牌成对断言）；
  - 📄 文档同步：[api/README.md](docs/api/README.md) §5 端点表与「自助改密结果分两类」说明、
    [error-codes.md](docs/api/error-codes.md) 新增 1029 / 1030 行 + 「GAP-02 收口说明」副作用表、
    [prd/README.md](docs/prd/README.md) §4.1「登录 / 注销 / 改密」与「停用 / 启用」两行置 ✅、
    [AT-DIFF-todos.md](docs/development/AT-DIFF-todos.md) GAP-02 / GAP-03 置「已关闭」并留决策留痕。
  - ℹ️ 备注：GAP-02 方案 B（`JwtAuthenticationFilter` 逐请求校验 `sys_user.status` + Redis 快照兜底）
    **未实现** —— 按「不做非必需动作」原则不顺手扩面，当前 A 路径已覆盖全部管理面入口，
    重启条件记于 AT-DIFF-todos。
- 💬 **聊天输入框改为微信式：发送按钮做进输入框，并内置表情面板**（`/chat` 页与即时通讯抽屉共用）。
  - 🧩 新增共享组件 `web/src/components/ChatComposer/`：输入框整体是一个带边框的盒子，正文占上半部分，
    下半部分是一行**框内**工具栏（左侧表情入口、右侧发送按钮），发送按钮因此是「在输入框里」而不是并排在外面；
    表情面板从盒子下方展开，**分类页签放在底部**（对齐微信）。两个聊天入口此前各写一份输入框，
    行为已经漂移（抽屉「回车发送」、页面「Ctrl + Enter 发送」），合并为同一组件后口径统一。
  - ⌨️ **发送口径统一为微信：Enter 发送，Shift + Enter 换行**（保留 Ctrl / Cmd + Enter 发送）。
    按键判定抽成纯函数 `resolveComposerKey`，并**显式让开输入法**——中文拼音选词时的回车不能被当成发送：
    Chrome 在组合期间 `isComposing === true`，Safari 在 `compositionend` 之后只剩 `keyCode === 229`
    可判，两个信号都认（否则用户按回车挑词会发出半截拼音）。
  - 😀 表情为**内置 Unicode 字符**（约 200 个 / 7 组），零第三方依赖、零网络：聊天正文本就是纯文本
    （`sys_notify_message.content` 是 utf8mb4 的 `varchar(1000)`），表情即字符本身，
    长度口径与后端 `@Size(max = 1000)`（UTF-16 码元）完全一致，也不会让历史消息在别处渲染成乱码。
  - 🎯 **表情插在光标处而非追加到末尾**（写到一半挑表情是常态）：光标在点表情按钮失焦前记入 ref，
    插入后落回片段之后；越界 / 反向框选的选区一律收敛（`insertAtCaret` 已覆盖边界用例）。
  - 🕘 面板首组为「最近使用」（用过即置顶去重，上限 16，落 localStorage）；存储不可用
    （隐身模式 / 配额满）时静默退化为无该组，不影响发消息。
  - ♿ 发送按钮显式给出可访问名（图标自带 `aria-label`，否则读屏会念成「send 发送」）；表情入口带
    `aria-expanded`，分类页签为 `role="tab"` + `aria-selected`。
  - 🧪 新增 `composer.test.ts`（按键口径含输入法 3 例 / 光标插入边界 5 例 / 最近使用与坏数据兜底 8 例）
    与 `index.test.tsx`（发送按钮可点性、Enter 与 Shift + Enter、光标处插入、分类切换、最近使用落盘）；
    两处输入框的旧样式（`composer` / `composerRow`）随之删除。
- 📎 **聊天输入框新增文件传输入口（回形针 → 「发送文件」），一次动作覆盖两种来源**（`/chat` 页与即时通讯抽屉共用）：
  - 🧩 新增共享组件 `web/src/components/ChatAttachmentPicker/`：`ChatComposer` 工具栏左侧开一个 `tools` 插槽
    （在框内、发送按钮之前），入口挂在这里；弹窗上半部是「上传本机文件」，下半部是「我的文件」候选列表
    （复用文件工作台的节点分页查询，带文件名搜索，改关键词即回到第一页）。
  - 🔗 **两条来源产出的载荷与「从文件区拖进来」完全同形**（`FileDragPayload`）：下游待发附件条与用途限制
    （有效期 / 下载次数）不必区分来源；规则收在纯函数 `picker.ts`（`nodeToPayload` / `uploadedFileToPayload` /
    `normalizeSizeBytes` / `isUploadBusy`）并配 9 例单测。
  - 🚫 **本机文件走分片上传而非小文件直传**：at-file 的直传受容器 `spring.servlet.multipart.max-file-size`（64 MB）限制，
    超限会在进 Controller 之前就被裸 400 拦掉、业务侧连日志都没有，故复用文件工作台同一条流水线（秒传 / 断点续传 / 并发分片），
    且 `persist: false` 不落断点缓存——这里是一次性动作，不留界面永远不会认领的续传记录。为此上传层补 `nodeId` 透传
    （秒传与普通合并都回条目 ID），聊天侧只认条目 ID，不拿 `fileId` 凑合。
  - 🧯 **拿不到条目就不产出草稿**：上传完成却没回条目 ID 时提示去「我的文件」确认后再选一次，不让空 ID 一路走到
    「点发送」才失败；候选列表查询失败时**先清空上一页数据**再提示，避免用户从过期列表里挑一个发出去。
  - 🔁 **入口不会被挂住**：禁用与否看任务自身状态而不是「我发起过」——顶栏传输中心取消上传不会回调 `onTaskError`，
    只记「发起过」会让入口永久停在禁用态。
  - 📏 **弹窗与投放提示都写明单文件大小上限**（默认 10 GiB）：数字取自 `services/upload/constants` 的 `MAX_FILE_SIZE`
    （与 `anttransfer.file.max-file-size` 默认值对齐——分片侧另有一道 `max-chunk-size × max-chunk-count` 的 64 GiB 上限，
    但合并落库仍要过更严的这道校验）。**只提示、不拦截**：上限可配置，真正拒收的是服务端 4006，
    前端提前改判会在运维调大上限后变成「服务端让传、前端不让选」。
  - 🧪 新增 24 例（`picker.test.ts` 9 + `index.test.tsx` 15：两条来源的载荷、空 ID、查询失败、上传失败与重试、
    上传中禁用入口、取消后恢复、入口禁用态、大小提示）；全量前端单测 **604 例**（53 个文件）全绿。
- 📊 **权限地图页补可视化**（`web/src/pages/permission-map/`），全部由已有字段推导，未新增任何后端契约：
  新增「授权状态分布」卡片——四态占比条 + 图例（条数 / 占比），条宽按**条数**现算而不是拿四舍五入后的
  百分比拼（否则会出现缝隙或溢出）；权限概览卡里按权限点 `:` 前缀画「权限域分布」条（后端没有「域」字段，
  文案已写明这是前端分组口径，条长相对条数最多的一组）；审批授权表的有效期列加一条「剩余天数条」。
  三处刻度都收在纯函数里（`summarizeGrantStates` / `validityBarPercent` / `groupPermCodesByDomain`）并配单测：
  其中剩余天数条是 **30 天封顶的视觉刻度**、不是「授权已用比例」——后端不下发生效时间，长有效期一律满格，
  长期有效与已过期不画条；占比条整条 `aria-hidden`，四态信息由图例文字完整给出。
- 💬 **新增 `GET /api/v1/chat/targets/resolve`（会话目标解析，登录即用、不挂权限点）**：
  入参 `query`（**登录账号优先**，回落按用户 ID），经 at-auth 新增的 SPI
  `UserLookupPort#findActiveByUsername`（精确匹配，非模糊检索）解析为会话目标，
  回 `{ targetId, displayName }`（展示名回落登录账号）。端点带 `@RateLimit`（60s / 30 次）防刷；
  **「查无此人」与「目标不可用」统一回 `CHAT_TARGET_INVALID`(1013)**，不区分「不存在」与「已注销」，
  避免把本端点变成账号存在性枚举器。前端非管理员「发起会话」由此从「手输 19 位雪花 ID」
  （实际不可用）改为「输对方登录账号 → 解析 → 发起」；管理员路径仍走用户选择器，口径不变。
  测试：新增后端 `ChatServiceTargetResolveTest`（6 项）与前端「聊天页 · 发起会话」4 项。
- ✅ **会话消息支持已读回执：消息气泡下展示读者头像**（对齐 Telegram / 抖音的「已读」形态，群聊同样生效）：
  - 🧭 **口径先行——回执是派生态，不加表、不加列**：写扩散（V5）下一条已读事实天然存在于**收件人那一行**
    （`recipient` 的 `read_status` 由 0 翻 1 就是「recipient 读了 sender 的这条消息」），
    故「谁读了我发的这条」= 同一 `client_msg_id` 下别人的镜像行中 `read_status=1` 的那些行。
    刻意**不落冗余「已读人」列或已读计数**：本表的已读只有「置读」一个写入点，派生成本可控且永不失真。
  - ⚠️ **纠偏：`NotifyMessageVO.readStatus` 不能当回执用**——写扩散下「我发的」那一行接收人就是我自己，
    该字段恒为已读（`1`）。前端「谁读了」只认历史里的 `readers` 与 `CHAT_READ` 帧；
    该字段的语义已写进 VO 的 `@implNote` 与 `docs/api/README.md`，避免后来者再踩。
  - 🗄️ **`sql/V13__chat_read_receipt.sql`（纯增量）**：`sys_notify_message` 补
    `idx_sender_session (sender_user_id, chat_scope, chat_target_id, client_msg_id, read_status)`。
    V5 的 `idx_session` 服务于「我作为接收人」的方向相反；`uk_sender_recipient_client` 虽以 sender 为前缀，
    但 `client_msg_id` 排在第三列，按它过滤只能把「我历史上发过的所有行」全扫一遍（跨会话、跨年份）。
    新索引前三列等值 + 第四列 IN，命中数 = 页内消息数 × 参与人数，与历史总量无关；
    `read_status` 放进索引让未读行在索引内即被过滤（已读是少数派）。单聊的 `chat_target_id` 是发送人自己的
    ID（见 V5 注释 c 的镜像行互指），故单聊 / 群聊共用同一索引、无需分支。PG 需改写为独立 `CREATE INDEX`。
  - 🔍 `NotifyMessageMapper` 新增两条查询（`@Select` 注解脚本 + 新增行模型 `ChatReadRow`）：
    `selectReadReceipts(senderId, scope, mirrorTargetId, clientMsgIds)` 取回执事实（`recipient_user_id <> senderId`
    排除自己，`order by id` 让头像顺序稳定）；`selectSessionUnreadRows(userId, scope, targetId, limit)`
    在置读**之前**取未读快照（最新 `limit` 条），供推送归并用。
  - 📜 **会话历史每条消息返回「谁读过」**：`ChatService#history` 取完本页后批量 `loadReaders()`
    （只筛「我发的」消息、单聊按 `mirrorTargetId = 本人 ID` 换算、批量反查读者展示名、查不到名的读者整条丢弃），
    挂到新增的 `NotifyMessageVO.readers`（新增 `ChatReaderVO`：`userId` 字符串过线 + `displayName`）。
    **为什么要回展示名**：群聊里的读者是任意群成员，而群成员名单没有对外的只读端点
    （`/api/v1/system/users` 挂在系统管理面权限上，普通用户取不到），服务端带名是「非管理员也能看到谁读了」的唯一可行路径。
  - 📡 **实时通道 `CHAT_READ` 帧**（`WsProtocol.TYPE_CHAT_READ` + `ChatReadReceiptVO`）：
    `NotifyMessageService#markSessionRead` 改为「先取未读快照 → 翻转 → 推未读 + 推回执」，
    按发送人归并后给每位发送人推一帧。三个必须记牢的设计点：
    ① **只推给发送人**（方向是「读者 → 发送人」）；② `chatTargetId` 是**发送人视角**的会话目标
    （单聊回读者本人，群聊回群 ID），**不能照抄库里的 `chat_target_id`**——那是读者视角的定位，
    直接下发会让前端匹配不到自己的会话窗口；③ 按 `clientMsgIds`（幂等键）而非消息 ID 匹配，
    因为乐观发送下前端在服务端 ID 落地前就已经把气泡画出来了。
    推送经 `AfterCommitExecutor` 在事务提交后下发，条数按 `notify.chat-history-limit` 裁剪。
  - 🖥️ **前端**：新增纯函数模块 `web/src/services/chat/readReceipt.ts`
    （`isReceiptOfSession` 会话匹配 / `mergeReaders` 按 `userId` 去重 / `applyReadReceipt` 合并 /
    `summarizeReaders` 头像封顶后折「+N」）；WS 侧把回执做成**独立事件**（`WsFrameType.CHAT_READ` +
    `parseChatReadPayload` 防御式解析 + `wsStore.subscribeReadReceipt` + `useWebSocket({ onReadReceipt })`），
    不混进消息流、不动未读；聊天页与 `ChatDrawer` 共用同一套合并与渲染规则，
    气泡下按「读者首字头像 + 叠放 + `+N`」渲染（`role="img"` + `aria-label="已读：…"` 给全文字等价物，
    新增 i18n `chat.read.by` / `chat.read.more`，中英双语）。
    `applyReadReceipt` 在无变化时**返回原数组引用**（它跑在 `setState` 的 updater 里，返回新数组会让整屏重渲染）。
    另给 `mergeMessage` 加了保底：`readers` 是唯一「缺省不代表事实」的字段（消息通道的帧永远不带读者，
    回执走 `CHAT_READ`），故重复到达的消息帧不会擦掉已画出的头像——擦了就再也补不回来（回执不重放）。
  - 🔁 **回执是加速通道而非真值**：推送丢失 / 裁剪不会造成状态错乱——发送人下次拉会话历史时回执照样由
    `read_status` 派生。故发送人离线期间发生的阅读**不补推，也不必补推**（已写入 `docs/api/README.md` §7 与
    `ChatReadReceiptVO` / `ChatReaderVO` 的类型注释）。
  - 🧪 测试：后端新增 `ChatServiceReadReceiptTest`（6 例：单聊镜像 target 换算、只查我发的、群聊多读者顺序、
    丢弃查不到名的读者、无我发消息不查、`userId` 序列化为字符串）与 `NotifyMessageServiceReadReceiptTest`
    （5 例：单聊 target = 读者、群聊按发送人归并、读者未知不推、无未读不推、自己发给自己不推）；
    前端新增 32 例（`readReceipt.test.ts` 18 + WS 契约 6（`protocol` 4 / `ws-client` 2）+ 聊天页 5 +
    抽屉 1 + 消息合并保底 2），相关 6 个测试文件 78 例全绿。
  - 📚 文档同步：[`docs/api/README.md`](docs/api/README.md) §7 补 `CHAT_READ` 帧格式与四个口径要点、
    §1 的 `GET /api/v1/chat/messages` 行补 `readers` 字段说明；
    [`docs/development/joint-debug-prep.md`](docs/development/joint-debug-prep.md) 补 **S16-g** 联调步骤
    （含「关掉发送人 WS 后靠历史回正」这条反例，以及 `readStatus` 不能当回执用的反例）。
- 🟢 **会话对端在线状态（三态）与「对方正在输入…」**（`at-collaboration` + 前端聊天页 / 即时通讯抽屉）：
  - 🔢 **三态口径**（`ChatPresenceStatus` / `ChatPresenceVO`）：`ONLINE` 绿点 / `OFFLINE` 灰点 /
    `UNSTABLE` 红点 =「网络状态不佳」。关键是**红 ≠ 断线**：`UNSTABLE` 表示连接还在、心跳却已超出
    **1.5 × 心跳间隔**（30s 心跳 → **45s** 判据，`WsProperties#presenceHealthySeconds`）；
    真断线直接是 `OFFLINE`（连接关闭即清活跃记录）。两条语义不同，合并会让「网络抖动」与「人不在」不分。
  - 🗄️ **状态存储**（`WsPresenceService` + `RedisKeyConstants`）：活跃时刻写 `at:ws:presence:{userId}`
    （TTL = 心跳超时 90s，**动态续期**）；订阅关系写 `at:ws:presence:watch:{userId}`（TTL **120s**、成员为被观察者）。
    「订阅」与「读取当前值」合并成一次往返（`POST /v1/chat/presence/watch`）——要不要显示状态点与要不要订阅
    永远是同一个决定。**Redis 异常降级为 `OFFLINE` 且不影响接口成功**：状态点属辅助信息，宁缺不弹错。
  - 📡 **`PRESENCE` 帧**（`WsProtocol.TYPE_PRESENCE`）：活跃时刻在「健康 / 迟滞 / 消失」之间**发生迁移**时才推，
    平迁（如 ONLINE→ONLINE）不推——否则每个心跳都会放大成全量推送。`userId` 是**状态发生变化的那个用户**
    （非接收人视角），订阅者必须与当前会话的对端比对后再改点。
  - ✍️ **`TYPING` 帧 + `POST /v1/chat/typing`**（`WsProtocol.TYPE_TYPING` / `ChatTypingVO`）：
    **上行 HTTP、下行 WS 帧**——上行要限流（60s / 120 次）、要能明确回参数错误（群聊 2001 / 填自己 1013）、
    要与消息投递共用同一把目标校验尺子；下行是瞬时信号，不落库、不计未读、不补推。
    服务端换算为**接收人视角**的 `chatTargetId`（单聊 = 输入者本人），与 `CHAT_READ` 同一口径。
  - 🖥️ **前端**：新增纯规则模块 `web/src/services/chat/presence.ts`
    （`isPresenceOfSession` / `isTypingOfSession` 会话过滤——**只认单聊**，群聊没有单一对端；
    `createTypingEmitter` 把连续按键折算成「开始 + 每 3s 续订 + 结束」三段流量）；WS 侧做成**独立事件**
    （`WsFrameType.PRESENCE` / `TYPING` + `parsePresencePayload` / `parseTypingPayload` 防御式解析 +
    `wsStore.subscribePresence` / `subscribeTyping` + `useWebSocket({ onPresence, onTyping })`），
    不混进消息流、不动未读。新增 `hooks/useChatPresence` 统一接线（打开会话即订阅、每 30s 续订、
    切换 / 关闭会话即停并补发停止信号）与 `components/ChatPeerStatus` 共用展示组件，
    聊天页与 `ChatDrawer` 同一份实现（抽屉会话头两行堆叠，`/chat` 页同版式）。
  - ♿ **颜色不单独表意**：三态圆点始终配文字（在线 / 离线 / 网络状态不佳），色盲用户与高对比度模式下
    仍有信息；圆点 `aria-hidden`、语义由同一行文字承担，容器 `role="status" + aria-live="polite"`
    让异步出现的「正在输入…」能被读屏感知。状态未知（加载中 / 非单聊 / 取不到）时**整个组件不渲染**——
    宁可什么都不显示，也不要一个含义不明的灰点让人猜（离线是「确定不在」，加载中是「还不知道」）。
  - ⏱️ **接收端必须有空闲兜底（6s）**：`TYPING` 是瞬时信号，丢帧 / 对端崩溃都不会有任何通知，
    只靠 `typing=false` 收起会让「对方正在输入…」永久挂住——比不显示更糟。发送端则在节流窗口
    （3s）内不重复发（连续按键一次输入就是几十个 onChange，每次都发会顶到限流）。
    另：**发送 / 清空后立刻补一帧 `false`**（清空走 `setState` 而非 `onChange`），
    好让提示在对方点「发送」的瞬间收起，而不是等空闲兜底的那几秒。
  - 🧪 测试：后端新增 `WsPresenceServiceTest`（10 例：三态判定、仅迁移推送、无变化不推、Redis 降级、
    订阅登记、跳过自己）与 `ChatServiceTypingTest`（9 例：接收人视角载荷、停止信号、群聊拒绝、目标不可用、
    填自己拒绝、缺目标拒绝、watch 委托、watch 不查库、群聊 / 自己拒绝），**19 例全绿**；
    前端新增 **47 例**（`presence.test.ts` 21 = 会话过滤 + 节流上报器 + 时间常量口径、
    协议契约 11（`protocol` 8 = 三态净化与两个载荷解析 / `ws-client` 3 = 事件路由、停止信号、脏帧丢弃）、
    `ChatPeerStatus` 5、聊天页 7、抽屉 3），相关 6 个测试文件 **104 例**全绿。
    另把聊天页与抽屉的 `useWebSocket` 替身由「单槽覆盖」改为**合并**——页面上现在有两处订阅
    （消息 / 回执 + 在线状态 / 输入态），后注册的那次会把前一次的回调挤掉。
  - 📚 文档同步：[`docs/api/README.md`](docs/api/README.md) §7 补 `PRESENCE` / `TYPING` 帧格式与口径要点、
    §1 的 `at-collaboration` 行补 `presence/watch` 与 `typing` 两个端点（含三态语义、限流额度与错误码）；
    [`docs/development/joint-debug-prep.md`](docs/development/joint-debug-prep.md) 新增 **S16-h** 联调步骤
    （含「红点 ≠ 断线」「订阅 2min 不续订即失效」「Redis 停掉仍回成功并降级 `OFFLINE`」三条反例），
    并把 S16-d 的帧清单补上 `PRESENCE` / `TYPING`。

- 👥 **群聊从「有入口、无能力」变为可用：补齐建群闭环**（`sql/V14` + `ChatGroupService` + 聊天弹窗）。
  在此之前 `sys_group` / `sys_group_member` 只被**读**——发送前校验「是不是成员」、投递时按成员写扩散，
  **全系统没有任何创建群组的入口**；于是新建会话弹窗的群聊分支只能让用户手填一个群组 ID，
  而这样的群组永远不存在。群聊的故障不是「某个操作失败」，而是**入口成死路**：对任何人都走不通。
  - 🗄️ `sql/V14__chat_group_permission_points.sql`：会话菜单根节点 `chat` + 新增权限点
    **`chat:group:create`**，授 SUPER_ADMIN / DEPT_ADMIN / USER，**不授 AUDITOR**
    （建群写 `sys_group` / `sys_group_member` 并决定后续消息可见范围，与审计员「权限锁定只读」冲突）；
  - 🔐 `POST /api/v1/chat/groups`（`ChatController#createGroup`，挂 `@RequiresPerm("chat:group:create")`）：
    入参 `{name, memberIds}`，`memberIds` 按**受邀者**理解、不含创建者——服务端把登录人写为群主并自动入群
    （先剔除自己再去重），使「我建的群我居然不在里面」在数据层不可能发生；逐个校验受邀成员为**可用用户**
    （与单聊发送前同一把尺子，否则会造出「名字挂在群里、却永远读不到消息」的僵尸成员）；
    **建群 + 群主入群 + 受邀者入群在同一事务**，失败整体回滚——若只落群行会得到「没有成员的群」，
    它的会话任何人都发不进去（含群主自己），前端表现为「建群成功但一发消息就 1012」，比建群失败更难排查；
    成功回 `ChatGroupVO`，**返回的 `id` 就是群聊会话的 `targetId`**，前端据此直接进会话、不必等会话列表刷新；
  - 📋 `GET /api/v1/chat/groups`（**我加入的群**，登录即用、不挂权限点）：只返回登录人 `sys_group_member`
    里的生效群并聚合成员数；若加权限点，默认角色拿不到就会表现为「建完群却看不到群」，
    把可用性事故伪装成权限配置问题；
  - 🔢 新增错误码 **1031**（无有效受邀成员，含「只填了自己」）/ **1032**（总人数含群主超
    `SysGroup.MAX_MEMBERS`(500)）/ **1033**（受邀成员不存在或已停用，**不逐位回报是哪一个**——
    那会把建群端点变成账号存在性枚举器）。三者均属**提交被拒**（HTTP 400、会话仍然有效）：
    前端不得清令牌 / 跳登录，建群弹窗须留在原地改条件重试；
  - 🖥️ 前端 `web/src/pages/chat/index.tsx`：弹窗「群聊」分支由**手填群组 ID** 改为**群名 + 选成员建群**，
    建完直接进入会话；成员选择走两条路径并归一到同一形状（`ChatTarget`）——管理员用用户检索
    （`system:user:list`），非管理员用「填登录账号 → 服务端解析」（与单聊同一条 `/targets/resolve` 路径，
    账号打错当场提示，不必等点了「发起」才被拒）；另补「我加入的群」入口（**选中即进入该群会话、不发消息**
    ——群聊的会话标识由 `sys_group` 独立存在、不依赖消息推导），补回手填 ID 被去掉后丢掉的能力；
    首条消息对**建群**仍必填：被拉进群的人正是靠这条消息第一次看到这个群；
  - 🚫 无 `chat:group:create` 时**整个「群聊」类型都不渲染**（隐藏，不是置灰）——该分支下每个动作都以建群
    为前提，留下一个必然失败的入口只会重演本次要修的这个问题。前端显隐不构成安全边界，
    强制校验在后端注解（见 [frontend-permission-map.md](docs/development/frontend-permission-map.md)）；
  - 🔧 `ChatService` 会话列表**解析群聊群名**：原先群聊恒 `targetName=null`、前端回落「群聊 #id」
    （D-11 在会话列表侧的残留）；查不到群记录时仍**不丢会话**——宁少一个名字，不少一个会话；
  - 🧪 测试：后端新增 `ChatGroupServiceTest` / `ChatGroupMemberLimitTest`（断言建群成员上限与投递侧
    `MAX_FANOUT_RECIPIENTS` 同源），三个既有 `ChatService*Test` 补 `SysGroupMapper` 替身，**45 例**全绿；
    前端新增 `chat/endpoints.test.ts`（端点与权限点的镜像契约——路径前缀写错只会表现为 404 或入口消失，
    没有任何编译期提示）与 `chat/api.test.ts`（建群**不静默**、我加入的群**静默**且把 `null` 归一成空数组、
    19 位雪花 ID 全程保持字符串），前端全量 **634 例**全绿；
  - 📚 文档同步：[`docs/api/README.md`](docs/api/README.md) §1 `at-collaboration` 行补两个端点并收口
    D-11 残留、[`docs/api/error-codes.md`](docs/api/error-codes.md) 补 1031~1033 三行与 HTTP 400 归类、
    [`docs/development/frontend-permission-map.md`](docs/development/frontend-permission-map.md) 补会话域权限点行
    与「隐藏而非置灰」的显隐口径、`web/src/utils/result.ts` 显式登记 1031~1033 为**策略 E**
    （不登记会按首段数字降级成策略 D——同样不跳登录，但语义从「请修正后重试」变成「拒绝」）。

- ↩️ **会话消息支持「2 分钟内撤回」与「引用回复」**（`sql/V15` + `ChatService` + 前端聊天页 / 即时通讯抽屉）。
  此前消息发出去就改不了、也没法针对某条说话：发错人 / 发错内容只能补一句「上面那条作废」，
  别人问「你是说哪句」也无从指认。本次为消息表补两组列（撤回状态 + 引用快照），并新增撤回端点与撤回帧：
  - 🗄️ `sql/V15__chat_message_recall_quote.sql`（**纯增量**）：`sys_notify_message` 补 `recall_status` / `recall_time`
    与引用快照三项 `quote_client_msg_id` / `quote_sender_user_id` / `quote_content`，并新增索引
    `idx_sender_client (sender_user_id, client_msg_id)`。**撤回是「整条逻辑消息」的动作，不是「某一行」的动作**：
    写扩散下一条消息落 N 行、各行 id 不同（单聊的 `chat_target_id` 还互指对端），只有
    `(sender_user_id, client_msg_id)` 全局一致——按 id 撤只会撤掉自己那一行，表现为「我撤了，他还能看到」；
  - 🧱 **`recall_status` 必须独立成列，不能靠「content 清空」表达撤回**：空正文是合法状态
    （文件 / 审批类消息的展示文案可为空），以空串判定会把正常消息渲染成「已撤回」；撤回时置位与清正文
    一起做，但**判定只看标记**（前端 `isRecalled` 同理）；
  - 🔐 `POST /api/v1/chat/messages/recall`（`ChatController#recall`，`clientMsgId` 走 Query）：事务内按
    `(sender_user_id, client_msg_id)` 批量置位 + 清正文，提交后向**该消息的全部参与人**（含撤回者自己的其他端）
    推 `CHAT_RECALL` 帧；带 `@RateLimit`（60s / 30 次）。**仅发送人本人、仅 2 分钟窗口内**
    （`ChatService.RECALL_WINDOW`，**不落库、不建列**——窗口是判定规则而非数据事实，留一行「窗口值」在库里
    只会多一个会漂移的副本）；
  - 🔢 新增错误码 **1034**（超窗：**终态错误**，重试不会有不同结果，前端应就地提示并撤下撤回入口）/
    **1035**（消息不存在 / 非本人发送：四种情况合并成一个码，分开报会给出「这条幂等键是否存在」的探测面）/
    **1036**（引用目标不在本会话或已被撤回）；
  - 📡 新增 `CHAT_RECALL` 帧（`WsProtocol.TYPE_CHAT_RECALL` + `ChatRecallVO`）：**刻意不复用 `CHAT` 帧**——
    后者的语义是「来了一条新消息」，重推会被客户端按新消息插流，未读数与会话摘要各多算一次；撤回不产生新消息，
    帧语义必须与之一致。载荷带 `clientMsgId`（**匹配键**，客户端只有它能跨端指认一条消息）/ `senderUserId`（谁撤的）/
    `chatScope + chatTargetId`（**本接收人视角**的会话定位，与 `CHAT_READ` 同一换算口径，客户端须比对当前会话后再改）/
    `recallTime`；与 `CHAT_READ` 一样是**加速通道**，真值在库里，丢了只表现为「重新拉历史后才看到已撤回」；
  - 📎 **引用存「快照」而不是「外键」**：`ChatSendDTO.quoteClientMsgId` 非空即为引用回复，服务端写入前校验
    目标在同一会话内且未撤回，并把**被引用消息的发送人 + 正文**（按码点截断至 200）写进本次发送的每一行。
    冗余的理由：被引用消息随后被撤回时正文已清空，若回查原消息，引用块会在几秒钟后集体变空白——
    用户看到的是「引用了一条空消息」；
  - 🖥️ **前端纯函数层**：新增 `web/src/services/chat/quote.ts`（`toQuoteDraft`——已撤回或无幂等键的消息
    构造不出草稿，右键菜单里「引用」项的显隐**直接由它决定**，不另写一套判断，免得两处口径漂移）；
    `services/chat/messages` 三则（`RECALL_WINDOW_MS` 2min + `RECALL_CLOCK_TOLERANCE_MS` 30s 钟差容忍 /
    `isRecallable` / `applyRecall` 幂等收敛且未命中返回原数组 / `markConversationRecalled` 补左栏摘要）；
    `isRecalled` 只看 `recallStatus`，`messageSenderLabel` 供引用块与撤回占位共用；新增 `CHAT_RECALL` 帧的
    防御式解析（脏帧静默丢弃，宁可不打这次标记也不崩掉聊天页）与独立事件订阅（`wsStore.subscribeRecall` +
    `useWebSocket({ onRecall })`），**不混进消息流、不动未读**；
  - 🖱️ **右键气泡弹菜单（引用在前、撤回在后）**：新增 `components/ChatMessageMenu`（`Dropdown` **直接克隆 children**
    而不是再包一层 `div`——多包一层会让百分比宽度被二次计算，右键范围与气泡对不上）、`components/ChatMessageQuote`
    （引用块，取服务端快照，**不回查原消息**）、`components/ChatQuoteBar`（输入框上方的「正在引用」条 + 取消）；
    撤回项**只对自己发的、且 2 分钟内的消息出现**，别人发的消息没有该项；
  - 🛡️ **撤回「先发请求、成功后再改本地」**：撤回成功的表现是正文永久消失，本地先改而服务端拒绝
    （1034 超窗 / 1035 不是你的消息）时原文已找不回来，只剩一个与事实不符的「已撤回」；反过来的代价只是几百毫秒
    等待，而这期间 `CHAT_RECALL` 帧往往比响应先到（与本地应用走同一条幂等收敛规则），用户感觉不到；
  - 🧭 **时间窗的权威判定在服务端**：前端 `isRecallable` 只控制菜单显隐（含 30s 钟差容忍，避免误藏入口），
    越窗点击仍按 1034 提示而不是静默失败；**切换会话即清空引用草稿**（留着会让下一条消息被误挂到另一个会话的引用上，
    服务端也会以 1036 拒绝，但那已经是发出去之后的事了）；发送失败时**保留**引用草稿，让用户改完正文直接重试同一句引用；
  - 🧪 测试：后端新增 `ChatServiceRecallTest`**14 例**（批量翻转全部行 + 每个接收人视角各推一帧、群聊逐个成员、
    超窗拒绝、窗内放行、未知 / 他人消息拒绝、重复撤回幂等、并发先手不报错、空幂等键拒绝，以及引用的
    快照写全行 / 普通消息不写 / 跨会话拒绝 / 已撤回拒绝 / 目标不存在拒绝 / 按码点截断），
   并把 `ChatRecallVO` 登记进 at-bootstrap 的 `PlatformIdJsonContractTest`（`senderUserId` / `chatTargetId`
   要与前端字符串形式的会话键比对，漏标会让 `chatTargetId` 被舍入后匹配不上窗口）；
    前端新增 `services/chat/quote.test.ts` **5 例** + 聊天页「右键撤回与引用」**9 例** +
    三个新组件的组件级用例 **12 例**（`ChatMessageMenu` 6：两项顺序 / 撤回项 danger / 各方向单独可用 /
    两项都不可用时不弹空菜单 / 两个入口不串台；`ChatMessageQuote` 3：两行结构 / 摘要原样渲染不截断 /
    空摘要不塌成空白；`ChatQuoteBar` 3：可读的取消入口 / 取消回调 / 发送中禁用），
    并在 `messages.test.ts`（30 例）/ `types.test.ts`（18 例）/ 协议契约 / `ws-client` 事件路由 /
    `api.test.ts` 端点非静默处补相应断言；全量前端单测 **678 例**（62 个文件）全绿；
  - 📚 文档同步：[`docs/api/README.md`](docs/api/README.md) §7 补 `CHAT_RECALL` 帧格式与四个口径要点、§1 的
    `at-collaboration` 行补 `POST /api/v1/chat/messages/recall` 与 `quoteClientMsgId`、VO 新增字段；
    [`docs/api/error-codes.md`](docs/api/error-codes.md) 补 1034~1036 三行 + 策略块 + HTTP 400 归类
    （`1031~1036`）；`web/src/utils/result.ts` 登记 1034~1036 为策略 E / `BAD_REQUEST`。
  - 🎛️ 顺带把聊天输入框工具栏的顺序调为**表情在前、文件在后**：`tools` 插槽此前整体排在表情按钮之前，
    与「先内容、后载体」的直觉相反（表情是正文的一部分，文件是另一条通道）。

- ⚙️ **群聊支持「群设置」：改群名 / 邀请成员 / 移除成员 / 退出群聊 / 解散群聊**
  （`sql/V16__chat_group_manage_permission_points.sql` + `ChatGroupService` + `web/src/components/ChatGroupPanel`）。
  V14 只解决了「群怎么建」——建完即冻结：改不了名、拉不进人、移不掉人、也解散不了，
  而 `sys_group_member` 又是发送与历史拉取的**唯一**授权依据，成员关系一旦建错就只能重建一个群。
  本次把群关系的完整生命周期补齐（`ChatController` 六个端点 + 四个权限点）：
  - 🔐 **四个权限点与建群同一条授权线**（`chat:group:update / invite / remove / dissolve`，均**不授 AUDITOR**，
    理由同建群：写 `sys_group_member` 就是决定后续消息可见范围，与审计员「权限锁定只读」冲突）；
  - 🧭 **双授权线：权限点（`1003`）与群内身份（`1038` / `1041`）正交**，必须同时成立。权限点论
    「这个账号有没有群管理这项功能」，身份论「我在**这个群**里是什么身份」——功能给了、身份不够照样拒绝。
    改名 / 邀请要求群主或管理员，移除 / 解散**仅群主**（管理员也不满足）；
  - 🧾 `GET /groups/{groupId}`（群详情）与 `POST /groups/{groupId}/quit`（退群）**不挂权限点**：
    前者的越权面由「我是成员」堵住（非成员回 `1012`），后者作用对象恒为登录人本人——加权限点只会把
    「建了群却看不到群资料 / 退不了自己」伪造成权限配置问题；
  - 👑 **`ChatGroupDetailVO.ability` 由服务端算好**（`canRename / canInvite / canRemoveMember / canDissolve / canQuit`），
    前端据此显隐而**不自行推断「我是不是群主」**：登录态里没有可信的用户主键，推断必然是错的；服务端按
    `sys_group.owner_user_id` + `member_role` 实时算出，**不落第二份「谁是群主」的副本**；
  - 💀 **`1039`：群主不能退群，也不能被移除**（含「群主移除自己」）。这两条路都必须堵死——都会造出一个
    **没有所有者的群**，此后无人能改名 / 邀请 / 移除 / 解散，群变成只能发消息的死结构；群主想离开只能先解散；
  - 🧟 **移除后重邀必须「复活」原成员行，而不是插入新行**：唯一键 `uk_group_user(group_id, user_id)`
    **不含 `deleted`**，`@TableLogic` 只改标记、不释放唯一键，直接 insert 会撞键；沿用 `UserRoleMapper` 的
    `markDeleted / markRestored` 口径。邀请对「已在群者」**幂等跳过**（全员已在群仍回 200 + 当前详情，
    报「重复邀请」会让批量邀请里的其他人白等）；
  - 🧯 **解散先清全体成员关系、再停群行**：反过来的中间态是「群已停用、成员行仍在」，而发送侧只认成员行，
    并发下能往一个已解散的群写进消息；先落安全态；
  - 🔢 新增错误码 **1037**（群不存在或已解散，404）/ **1038**（群内身份不足，403）/ **1039**（群主不能退群或被移除，403）/
    **1040**（目标不是该群成员，404）/ **1041**（仅群主可执行，403）。1037 合并「不存在」与「已解散」——分开报
    会给出「这个群 ID 曾经存在吗」的探测面；五个码均属**请求被拒**（会话仍然有效），前端不得清令牌 / 跳登录；
  - 🖥️ 前端 `web/src/components/ChatGroupPanel`：**一个面板、两处入口**（`/chat` 页头 + 即时通讯抽屉头部），
    按钮显隐 = **权限点 ∧ `ability`** 的合取——只看其一都会做出「按钮在、点了必失败」的界面。
    危险动作（移除 / 退群 / 解散）一律走 `useDangerConfirm` 弹窗（行内气泡易误触，解散标 `critical`）；
    邀请按成员上限提前拦一道，选人沿用建群的两条路径并归一到 `ChatTarget`；写接口**回最新详情**并据此刷新面板
    （省一次回读，也避免「写完之后读到的还是旧值」）；
  - 🧪 测试：后端新增 `ChatGroupManageServiceTest`（邀请的复活 / 幂等 / 超限 / 身份不足、移除的 `1041` / `1040` / `1039`、
    退群、解散以 `InOrder` 断言**先清成员后停群行**）；前端新增 `ChatGroupPanel/index.test.tsx` **7 例**
    （权限点与 `ability` 的合取两侧、改名回传、退群二次确认、已在群者不进待邀请列表、群主行无「移除」），
    并补 `ChatDrawer` 测试里的 `useAccess` 替身；
  - 📚 文档同步：[`docs/api/README.md`](docs/api/README.md) §1 `at-collaboration` 行把「不做成员增删」
    改写为六个群管理端点及其授权口径、[`docs/api/error-codes.md`](docs/api/error-codes.md) 补 1037~1041 五行 +
    双授权线说明块 + 附录 A 的 403 / 404 归类、
    [`docs/development/frontend-permission-map.md`](docs/development/frontend-permission-map.md) 补七行面板能力
    与「权限点 ∧ 身份」显隐口径、`web/src/utils/result.ts` 显式登记 1038 / 1039 / 1041 为**策略 D**、
    1037 / 1040 为**策略 E**（不登记会按首段数字降级）。
- 🖼️ **本人自助更换头像（`POST /api/v1/users/me/avatar`）与「头像一变、全端立刻换图」**（[AT-DIFF-11](docs/development/AT-DIFF-todos.md#at-diff-11头像双写入口与-profile-帧广播)）：
  - 🔐 **新增独立通道，而不是复用管理面路径**：`at-auth` 新增 `UserSelfController` + `SelfProfileService`，
    端点落在 `/v1/users/me` —— **不挂任何权限点**，目标 ID 恒取令牌 subject，路径里的 `me` 让「改谁」
    不再是一个可篡改的入参（越权在结构上不可达）。不吊销会话、不触发权限重评估（换头像不参与任何授权判定）；
  - 🧾 **审计动作分离**：新增 `OperationLog.ACTION_USER_AVATAR_SELF`（`USER_AVATAR_SELF`），
    与管理员侧 `USER_AVATAR` 分开编码，使审计能回答「是本人自改还是管理员改他人」；两者都**不记录头像 key**
    （地址里含可直出访问的凭据，不该在审计表长期留档）；
  - 📡 **`PROFILE` 帧由「推给本人多端」改为全员广播**（`WsBroadcaster#broadcast`，`WsDelivery.userId=null`）：
    产品口径是「头像一变，所有能看到它的地方立刻换图」——除本人其他标签页 / 设备外，会话对端、群成员列表、
    用户管理列表里的这张头像也要立刻变。精确扇出需要一张「谁在关注谁」的订阅表并与群成员关系变更对账，
    而帧载荷只有 `userId + 免登录可读的直出地址`，广播的暴露面与「让对方直接访问该 URL」相同，
    且换头像是低频人工动作（滚动发布期间旧实例收到 `userId=null` 会按原逻辑丢弃，
    退化为「下次拉取时刷新」，属可接受降级）；
  - 🖥️ **前端新增全局头像覆盖表**：`services/avatar/overrides.ts`（模块级状态 + 订阅）+ `hooks/useAvatarUrl.ts`
    + `components/UserAvatar`，把「覆盖表优先、页面数据兜底」的取值口径收敛到一处；`ProfileSync` 按 `userId`
    分两步处理 —— **任何人**的帧都写入覆盖表，**仅 `userId` == 当前登录人**时才更新登录态
    （否则会把自己的顶栏头像改成别人的）；`null` 覆盖值的语义是「已无头像」，必须**压掉**回落值，
    与「本地无记录」严格区分。顶栏下拉（`AvatarDropdown`）新增换头像入口，成功后同步本地 profile / 登录态 /
    覆盖表三处，登出时 `resetAvatarOverrides()`；`chat` 页与 `ChatDrawer` / `ChatGroupPanel` 的气泡、
    标题、成员头像统一改走 `UserAvatar`；
  - 🧪 测试：后端 `SecurityConfigTest` 5 例全绿（含白名单反向 + 正向双向断言）；前端全量 **765 例**通过
    （新增 `useAvatarUrl` 用例、`ProfileSync` 补「他人帧不改登录态但写覆盖表」等契约），`tsc` 与 `lint` 通过；
  - 📚 文档同步：[`docs/api/README.md`](docs/api/README.md) §1 前缀表 / §5 鉴权表（新增 2 行免登录与自助端点）/
    §7 下行帧表补 `PROFILE` 帧与四个口径要点、[`system-design.md`](docs/architecture/system-design.md) §3.5 白名单红线、
    [`frontend-permission-map.md`](docs/development/frontend-permission-map.md)、PRD §4 / §4.1、
    [`AT-DIFF-todos.md`](docs/development/AT-DIFF-todos.md) 新增 **AT-DIFF-11** 与 **GAP-10**。

### 🔄 Changed（变更）

- 📄 **修正「双数据库支持」误导性口径（2026-10-02）**：`sql/README.md` 末条原以「🗄️ 双数据库支持」起头，
  正文却写「V1/V2 为 MySQL 方言、需改写脚本后再启用」——**标题与正文自相矛盾**，最容易被摘出来当成
  「PG 也能直接跑」。现拆成两条明确断言：MySQL 为**唯一可用存储**（`V1` ~ `V21` 全 21 个脚本即
  MySQL 8 方言，仅此一套可执行）；PostgreSQL **仅为示例 profile，不构成「双数据库支持」**，并补记
  「`V1` ~ `V21` 全为 MySQL 方言（13 个脚本带「PostgreSQL 差异点」注记）」、6 条必须逐条改写点
  （tinyint→smallint / datetime→timestamp / 列内 `on update CURRENT_TIMESTAMP` 转触发器 /
  行内 `KEY`·`UNIQUE KEY` 转独立 `CREATE INDEX` / `COMMENT` 转 `COMMENT ON` / `collate`·`ENGINE` 无对应写法）
  与「改写完成前 PG 上 Flyway 迁移跑不通」。另 `docker-compose.dev.yml` 头部「直接连
  localhost:3307 / localhost:6379」补注：3307 / 6379 只是**默认值**，`.env` 覆盖
  `MYSQL_PORT` / `REDIS_PORT` 后须按覆盖后端口连（本机 6379 已被其它项目的 redis 容器占用、
  `.env` 写 `REDIS_PORT=6380`，照抄 6379 会连到别人的 Redis）。

- 🧹 **清理前端模板遗留与仓库空占位目录（2026-10-01）**：
  这些目录/文件自 Ant Design Pro 模板初始化后再没被任何代码或构建引用，却一直挂在忽略清单与目录树里
  消耗注意力；其中 `scripts/simple.js` 更是**危险**的一次性精简脚本——它会用模板路由覆盖
  `config/routes.ts`（指向 `./Welcome`、`./Admin`、`./table-list` 等早已不存在的页面）后再删除自身。
  另有一处**隐藏耦合**由 `tsc` 当场抓出并已收口（见第一条）：
  - **删模板示例服务层**：`web/src/services/ant-design-pro/**`（`/api/currentUser` 等示例，无任何 import 引用），
    但它同时承载了全局 `API` 命名空间，其中 `API.CurrentUser` 仍被 `app.tsx` / `access.ts` /
    `services/auth/adapter.ts` 使用（以 `API.` 前缀出现，纯 import 检索查不到）——因此把这 4 个字段
    （`name` / `avatar` / `userid` / `access`）收编为项目自有类型 `services/auth/types.ts` 的 `CurrentUser`，
    全局命名空间随之取消；同时移除只为该目录存在的 `vitest.config.ts` 覆盖率排除项与 `biome.json`
    忽略项——忽略项留着会成为「指向不存在路径」的静默规则；
  - **删模板预置的演示 API 类型**：`web/types/**`——`index.d.ts` 是按 `config/oneapi.json` 的
    Ant Design 演示契约（`/api/rule`、`Serati Ma` 等）预生成的 `export namespace API`，模块化导出、
    0 引用；`types/cache/mock/login.mock.cache.js` 是配套的录制缓存。真实契约在
    `GET /api/v3/api-docs`（多分组，见 `docs/development/joint-debug-prep.md`），
    `config/oneapi.json` 暂留待换成真实导出后再生成类型；
  - **删从未被加载的 mock**：`web/mock/{user,route,notices,utils}.ts`——`config.ts` 的 `mock.include`
    只收 `src/pages/**/_mock.ts`（唯一真实 mock 是 `src/pages/upload/_mock.ts`），且 `dev` / `start` /
    `start:*` 一律 `MOCK=none`；`biome.json` 的 `!**/mock` 保留（`npm run record` 仍会写入
    `mock/requestRecord.mock.js`）；
  - **删 simple 模式残留**：`web/config/routes.simple.ts` + `web/scripts/simple.js` +
    `package.json` 的 `simple` 脚本（一次性精简脚本，其目标页面与依赖早已不存在）；
  - **删空占位**：`sql/migrations/`（仅 `.gitkeep`；Flyway 脚本由 at-bootstrap 的
    `copy-flyway-migrations` 从 `sql/V*.sql` 复制，构建从不读该目录）与根 `target/` 空目录；
  - **保留（有意占位，已登记）**：`deploy/helm/`（1.0.0 随包发布的预留 Chart）、
    `tests/{e2e,performance}`（规划中，用例文档已在）、`deploy/docker/{mysql-initdb.d,m2}`
    （分别被 compose 挂载 / Dockerfile 读取）、`scripts/db-init.sh`（无 Flyway 的手工环境兜底）；
  - **验证**：`npm run tsc` / `npm run biome:lint` / `npm test` / `npm run build` 全绿；
  - **文档同步**：`docs/development/README.md`（仓库导航 sql 描述）、`docs/api/README.md` §7、
    `web/README.md`。

- 🧹 **用户可见文案不再标注「CE 版 / EE 能力」，并撤下顶栏的模板残留「历史版本」入口（2026-09-30）**：
  界面此前把「这一项为什么不能点」答成了版本号：分享弹窗给「指定接收人」「动态水印」挂 `<Tag>EE</Tag>`、
  组织切换器菜单尾部与顶栏搜索提示各写一段「属 EE 能力 / CE 版未提供」、群组与部门两个只读页的标题
  也以「CE 版未提供…」开头。对使用者这是**无效信息**——他只关心「现在能不能用」，不关心版本划分；
  而能力一旦下放 / 上收，散落在各处的版本口径必然漂移成「同一能力一处说没有、一处说能做」。本轮统一为
  **只说现状、不报版本**：
  - **删键而非留空值**：`component.globalSearch.scopeEe`、`component.version.history`、
    `component.org.eeHint` 三键连同使用点一并移除，**7 个语言包同批删除**——留空值会留下
    「键还在、某语漏删」的漂移，空串还会在界面上撑出一行空白；
  - **改写 4 键**（`file.share.audience.memberHint` / `file.share.watermark.description` /
    `system.group.alert.title` / `system.dept.alert.title`，同为 7 语）：`CE 版未提供` → `当前尚未提供`、
    `the CE edition does not provide` → `not available yet`，把「缺什么」讲成**待补**而不是**版本差异**
    （两种写法的用户动作相同：先换别的方式；但后者会让人误以为「买了另一个版本就能用」）；
  - **顶栏撤下「历史版本」下拉**：它是 **Ant Design Pro 脚手架的残留**——菜单项是 `v5-pro.ant.design` /
    `v4` / `v2` / `v1`（模板自己的历史版本站），与 AntTransfer 的版本、与**文件历史版本**都无关；
    披着 `component.version.history`（「历史版本」）的标签挂在全局顶栏，既会被读成「本应用的版本记录」，
    又是一个点了就离开本站的**不受控外链**。产品侧真正的文件历史版本走后端
    `GET|POST /v1/files/{nodeId}/versions`（权限点 `file:version`），前端界面入口尚未接入，
    **并不依赖**这个顶栏下拉，故直接删除 `components/RightContent/VersionDropdown.tsx` 及
    `components/index.ts` / `app.tsx` 两处装配；
  - **有意保留**：产品名仍为 **AntTransfer CE**（`config/defaultSettings.ts` 站点标题、`config/config.ts`、
    `public/manifest.json` 的 PWA 名称、欢迎页标题与 `Footer` 版权行）——版本是**发布物身份**，该留；
    被删的只是**能力差异在界面上的标注**；
  - 🧪 回归：`app.test.tsx` 去掉 `VersionDropdown` 的 mock；前端 **77 文件 / 1090 例全绿**，
    `tsc` 与 `biome lint` 通过。

- 🧹 **回滚留底约定由「保留最近一次」改为「保留最近两份」（2026-09-29）**：
  `docs/deployment/发版与回滚手册.md` 第六章原写「确认稳定运行几天后，只保留最近一次」，
  但落地后一轮维护就攒到四份（其中三份是同一小时内的连续备份），且该约定本身自相矛盾：
  只留一份时，一旦真的退回上一版、随后又发现问题还想再退或再观察一轮，第二份已经不在了。
  现改为**保留最近两份**（当前版本 + 上一版本），并给出可逐一对照的命令：
  `ls -1d /home/ubuntu/anttransfer.bak.* | sort | tail -n 2` 是保留项、
  `| head -n -2` 是待删项，核对无误后再 `rm -rf`；镜像 `prev-*` 同样保留最近两个，
  并重申**禁止** `docker image prune -a`——它会连留底镜像一起删掉，回滚手段当场失效。
  线上已按新约定清理：删除 `anttransfer.bak.2026-09-29-0251`、`-0252`，
  保留 `-0255`、`-1710`；现网 `/home/ubuntu/anttransfer` 与运行中的容器均未受影响。

- 🎨 **品牌主色由满饱和青绿 `#00d68f` 调为同色相柔和绿 `#2fb188`**（`web/src/theme/tokens.ts`）：
  **色相 161° 不变**，只把饱和度 100% → 58%、亮度 50% → 44%——原色在白顶栏与实心按钮上偏刺眼，
  而刺眼来自饱和度而不是色相，所以不动色相、只压柔，保住品牌识别。hover / active / 浅底 / 绿底文字
  四个派生色随之在同一色相上重算，并顺手把**四处散写的品牌色**收进权威源：
  `PublicDarkTheme.ts` 里三次硬编码的 `#00d68f`（登录页与访客取件页——访客唯一见过的界面，
  原先换色必漏这两页）、`workbench` 成功率进度条的渐变绿、`app.tsx` 与 `defaultSettings.ts` 里
  两处菜单 hover 浅底 `#f2fdf8`（新收为 `BRAND_PRIMARY_BG_HOVER`）、`public/manifest.json` 的
  PWA `theme_color`、以及首屏 `public/scripts/loading.js` 里仍是 antd 默认蓝 `#1890ff` 的加载转圈
  （品牌露出的第一帧，与主色明显不搭）。对比度已核对：墨绿字在实心绿底上 6.1:1、
  侧栏选中文字在浅绿底上 4.9:1，均达 WCAG AA。

- ⚠️ **授权收敛（破坏性）**：`sql/V8__restrict_file_destroy_to_super_admin.sql` 从 DEPT_ADMIN 回收
  `file:destroy` 授权行。部门管理员不再能执行彻底销毁，须由超管操作；前端须同步隐藏 / 禁用销毁入口
  （[frontend-permission-map.md](docs/development/frontend-permission-map.md) 已回写）。
  「谁有资格发起」（权限点）与「高敏感文件需二次背书」（审批单）是相互独立的与关系。

- 🧾 **审计耐久性：失败记录不再被业务回滚吞掉**（`FileAuditLogger`）。失败审计的典型调用形态是
  「记一条 fail，紧接着 `throw`」（如销毁高敏感文件缺审批单 → `4017`），该 INSERT 原先跟随业务事务，
  那声 `throw` 触发的回滚会把它一并抹掉——于是**最需要留痕的「越权 / 缺审批被拒」事件恰恰查不到**，
  审计只在一切顺利时可信。现改为**失败记录走 `REQUIRES_NEW` 独立事务先提交**；
  **成功记录仍加入调用方业务事务**，使「业务回滚了、库里却留着一条成功」不可能发生。
  「审计写失败永不抛异常」的口径不变（审计不得反向让业务失败）。属
  [red-team T-05](docs/architecture/red-team-review.md) 的部分收敛，其余（AFTER_COMMIT 异步 + 补偿队列、
  审计表 DB 账号只 insert/select、归档物理删除）仍开放。
- 🗑️ **删除无归属过滤的批量读 API `TagService#tagsByNodeIds(List<Long>)`**：该签名只吃 `nodeIds`、
  不吃 `ownerUserId`，无论怎么实现都在诱导调用方「先查后校验」，某个列表接口一旦漏做归属过滤，
  它就成了按 ID 批量拖走他人标签的**静默越权通道**（且该方法是死代码：列表页回显实际由
  `FileNodeService#loadTags` 在「已按 `owner_user_id` 过滤完的分页结果」之上完成）。
  现以一条注释钉死该设计口径，杜绝日后重新引入。

- 🧹 `web/biome.json` 忽略范围由 `**/src/services`（整个服务层）收窄为 `**/src/services/ant-design-pro`：
  原规则本意是跳过脚手架生成的服务代码，但一并跳过了**手写**服务层——`src/services/upload/**` 自此纳入 lint 与格式化。
- 🔧 修复页脚（`web/src/components/Footer`）遗留的 4 条类型报错：`web/package.json` 补 `repository` 字段
  （原缺失导致 `tsc --noEmit` 报 TS2339）；同时把仓库地址推导从「写死 github.com」改为**只做规范化**
  （去 `git+` 前缀、`git@host:path` 转 https、去 `.git` 后缀），使 Gitee / GitLab 等非 GitHub 仓库也能正确成链
  —— 否则会静默退回 Ant Design Pro 模板地址，把用户引到别人家的仓库；页脚文案随之改为显示实际托管域名。
- 🏷️ **页脚去掉脚手架品牌（`web/src/components/Footer`）**：版权行 `Ant Design Pro ©` 改为本项目
  `AntTransfer Community Edition ©`；仓库兜底地址由 `github.com/ant-design/ant-design-pro` 改指本项目
  [Gitee 仓库](https://gitee.com/Temtech-close_source/AntTransfer-Community)。原兜底只在 `web/package.json`
  缺 `repository` 时触发，一旦触发就会把访问者引到模板仓库，且版权行会让用户以为本站由 Ant Design Pro 出品。
  上游模板的 MIT 授权声明仍完整保留在 `web/LICENSE`，不受文案调整影响。
- 🏷️ **欢迎页与语言包去掉脚手架品牌字样**（`web/src/pages/Welcome.tsx`、`web/src/locales/*/pages.ts`）：
  技术栈标签 `Ant Design Pro · React 19` → `Umi Max · React 19`；8 个语言包的
  `pages.welcome.celebrationTitle`（原「欢迎使用 Ant Design Pro {v6}」）改为本项目名称；
  `zh-CN` / `en-US` 欢迎页描述句里的「Ant Design Pro 前端」→「Umi Max / React 19 前端」。
  另同步 `web/config/oneapi.json` 的 `info.title`（影响 `max openapi` 生成代码的头部注释）
  与 `web/package.json` 的 `description`。`pages.welcome.infoCard.*` / `alertMessage` /
  `pages.layouts.userLayout.title` 等脚手架遗留键**全仓库零引用**（死键），本次未动。
- 🌐 **欢迎页文案补齐到 8 种语言 + 新增回归护栏**（`web/src/locales/*/pages.ts`、
  `web/src/locales/welcome-i18n.test.ts`）：欢迎页的 16 个文案 id（`header.*` / `hero.*` /
  `feature.*` / `quickStart.*`）此前只存在于 `zh-CN` / `en-US`，`zh-TW` / `ja-JP` / `pt-BR` /
  `id-ID` / `fa-IR` / `bn-BD` 六份整体缺失——react-intl 找不到 id 时会静默回退成
  `pages.welcome.hero.title` 这类原始键名直接渲染到页面上。本次按各语言补齐（`/api`、
  `http://localhost:8080`、`config/proxy.ts` 等代码字面量与 `at-transfer` / `at-file`
  模块名不翻译；三段式拼接的 `proxyPrefix/Middle/Suffix` 按各自语序重排），并新增
  `welcome-i18n.test.ts` 护栏：现有 `i18n-parity.test.ts` 只比对 zh-CN ↔ en-US，
  覆盖不到这 6 种语言，漏翻译将直接导致用例失败。
- ⚠️ **本地开发默认数据库端口 `3306` → `3307`（杜绝误连本机 MySQL）**：原 `DB_URL` 默认
  `localhost:3306`，容器没起来时会静默连上开发者本机自装 MySQL 并把 Flyway 跑完，形成
  「迁移成功、数据却进了本机库」的假象。现确立口径：**宿主机 `3307` = 本项目容器 MySQL，
  `3306` 留给本机自装 MySQL**——`docker-compose.dev.yml` / `docker-compose.yml` 宿主映射默认
  `${MYSQL_PORT:-3307}`（容器内仍为 3306）、`.env.example` 设 `MYSQL_PORT=3307`、
  `application.yml` / `application-mysql.yml` 默认 URL 与端口同步为 3307。
  **升级须知**：用容器库者无需改动（重新 `up -d` 即映射新端口）；一直使用本机自装 MySQL 者
  请显式设置 `DB_URL`——否则会连 3307 失败，这正是期望的 fail-fast。
- 🔎 新增 dev 启动自检 `DatabaseEndpointLogger`（at-bootstrap）：启动后打印实际 JDBC URL、
  服务端版本、当前库名与 Flyway 已应用版本；若连的是本机地址且端口非 3307，
  追加醒目告警点明「数据写入了本机库，容器库不受影响」。
- ⚠️ **破坏性：认证授权错误码重排（1xxx）** —— 裁决 [AT-DIFF-01]，采纳「权限不足 = `1003 / 403`」口径：
  `1003` 由 `TOKEN_INVALID(401)` 改为 **`NO_AUTH(403)`**，原 Token 非法后移至 `1006`；
  账号锁定 `1005→1004`、账号禁用 `1006→1005`。新排序为
  `1001 未登录 / 1002 过期 / 1003 无权限 / 1004 账号锁定 / 1005 账号禁用 / 1006 Token 无效 / 1007 密码错误`。
  已同步 `ErrorCode`、`docs/api/error-codes.md`（附录 B 迁移表）、at-auth 两个 handler、
  at-permission 注解与切面、at-gateway `GlobalExceptionHandler`、前端 `web/src/utils/result.ts`
  策略表与单测。前端红线更新：**`1003` 属策略 D（就地提示、禁止引导登录），跳登录改用 `1006`**。
- 📦 后端模块物理路径由仓库根迁移至 `server/`，同步修正 Maven 聚合、Dockerfile 产物路径与文档链接。
- 🗄️ 原 `sql/create_table.sql` 整理为 Flyway 风格 `sql/V1__schema.sql`（内容不变）。
- 🔄 `sql/V1__schema.sql` 全量重置为 CE `sys_` 前缀 16 表四族基线：原脚手架示例表
  （`user`/`post`/`post_thumb`/`post_favour` camelCase 版本）移除，`V3__permission_apply.sql`
  审批两张表并入；统一雪花主键、`snake_case`、`tenant_id` 预留列与 `deleted` 逻辑删除规约。
- 🏷️ `sql/V1__schema.sql` 二次重置：表族命名对齐 `sys_` 前缀（`sys_user`/`sys_role`/
  `sys_permission`/`sys_file`…16 表，旧直连命名废弃），权限点表字段 `code/name` 更名为
  `perm_code/perm_name`；逻辑删除列 `is_delete` → `deleted`（同步 at-common `BaseEntity` 与
  全局 logic-delete-field）；`sys_user_file_permission` 增加 `grant_source`（角色继承 / 审批获得）
  来源语义与 `expire_at` 时效回收（PermissionGrant 实体与到期回收定时任务同步适配）。
- ▶️ 应用启动默认执行 Flyway 自动迁移（`FLYWAY_ENABLED` 默认 true）+ `baseline-on-migrate` /
  `baseline-version=0` 存量库基线设定；新增 `application-mysql.yml` / `application-pg.yml`
  数据源 profile 示例与 PostgreSQL 方言/驱动依赖（V1/V2 仍为 MySQL 方言，需改写后启用）。
- 🎭 内置角色模型定稿（随 V2 初始化）：原三权分立细分职能并入 SUPER_ADMIN，四角色
  SUPER_ADMIN/AUDITOR/DEPT_ADMIN/USER；AUDITOR 仅日志只读（audit:log:read），USER 不含 file:destroy。
- ⏰ at-permission 授权到期回收定时任务（PermissionGrantExpireScheduler +
  PermissionExpiredEvent）：@Scheduled 每小时扫描 `sys_user_file_permission` 中
  `expire_at<=now` 的生效授权 CAS 置失效、事务提交后发布事件；同步补齐模块依赖与 @EnableScheduling。
- 🐳 `docker-compose.dev.yml` 按 Flyway 默认自动迁移语义重写：移除 initdb.d 对 V1/V2 的挂载
  （避免与 Flyway 重复执行冲突），建表与初始化数据统一由应用 Flyway 承担；
  initdb.d 改为 `deploy/docker/mysql-initdb.d/` 自定义入口（默认空，含使用说明）。
- 🗝️ Redis Key 规划定稿（at-common `RedisKeyConstants`）：`at:` 统一前缀 + TTL 秒常量 + 键工厂方法，
  覆盖会话 / 登录失败 / 上传任务 / 外发分享 / 权限缓存 / WS 集群广播（镜像 system-design §7.1）。
- 📦 统一响应地基补齐：`PageResult<T>` 分页响应体（`records/total/current/pageSize/pages`，
  对齐 `docs/api/README.md` §3，支持 `PageResult.of(IPage)` 直接转换 MP 分页结果）。
- 🚨 认证授权异常 `AuthException`（at-common）：承载 1xxx 段错误码，与业务异常 `BusinessException`
  分轨处理，供 at-auth 接入 Spring Security 后统一转换 `AuthenticationException` / `AccessDeniedException`。
- 🧩 MyBatis-Plus 装配落地（at-bootstrap `com.anttransfer.bootstrap.mybatis`，**不放在共享内核**）：
  ① 分页插件 `MybatisPlusConfig`（单页上限 100 对齐契约、方言由 `anttransfer.persistence.db-type` 配置）；
  ② 自动填充 `FillMetaObjectHandler`（createTime/updateTime/deleted 兜底 0 + 操作人填充，非空不覆盖）；
  ③ 新增 `CurrentUserProvider` SPI 保留在 at-common（供 at-auth 实现，避免 at-auth 反向依赖
  at-bootstrap），at-common 依赖收敛为 `mybatis-plus-annotation` + `mybatis-plus-core`，
  不再引入 starter / JDBC 传递依赖。
- 🧪 at-common 单测骨架：`ResultTest` / `PageResultTest` / `FillMetaObjectHandlerTest`（17 例），
  为「统一契约」提供回归保护。
- 🔐 认证吊销模型重构（system-design §2.1~2.3）：废除“逐 jti 黑名单 `at:deny:{jti}`”，改为
  “DB `sys_user.token_epoch` 权威 + Redis 缓存/白名单 + JWT `ver` claim”混合模型；refresh 白名单
  键定稿为 `at:token:refresh:{userId}`（原 `at:refresh:{userId}` 废弃）；`token_epoch` 增列
  随 at-auth 会话实现以 Flyway V3 落地。
- 🔢 外发分享次数口径定稿（system-design §5.3）：DB 原子 UPDATE（`downloaded_count < download_limit`）
  为唯一放行裁决防超卖，Redis `at:share:count:{token}` 降级为前置配额闸/镜像（丢失回源自愈）；
  提取码错误锁定键定稿 `at:share:lock:{token}`（连续错 5 次锁 30min，对齐 PRD US-03）。

- 🛡️ 全局异常处理器 `GlobalExceptionHandler` 覆盖 15 类异常，按「认证授权 / 业务 / 参数校验 /
  协议层 / 系统兜底」分轨映射错误码：新增 `AuthException`（1xxx）、`BindException`、
  `HandlerMethodValidationException`、`ConstraintViolationException`、`ServletRequestBindingException`
  （2xxx）、`HttpMediaTypeNotSupportedException`（4007/415）、`HttpRequestMethodNotSupportedException`
  （2001）、`MaxUploadSizeExceededException`（4006/413）、404 统一转 `Result`（4040）。
  红线：**未预期异常只回 `5001 系统繁忙` + traceId，完整堆栈仅落服务端日志**。
- 🎫 新增错误码 `4040 RESOURCE_NOT_FOUND`（HTTP 404，中文提示「资源不存在」），同步
  `docs/api/error-codes.md`；按契约 §9「分段内新增错误码为非破坏性」直接发布。
- 🗂️ 错误码表按「处理策略」分门别类（`docs/api/error-codes.md` 重写）：新增
  **A 成功 / B 流程分支 / C 凭证失效 / D 拒绝不跳登录 / E 请求需修正 / F 状态失效冲突 /
  G 限流退避 / H 系统兜底** 八类策略，每张表增加「策略」列，并补充
  「重试语义」（可安全重试 / 仅一次重放 / 须先刷新状态 / 须重新发起 / 不可重试）与
  「服务端副作用」（提取码计数锁定、通知创建者、令牌吊销）两张注明表；
  `ErrorCode` 枚举逐条以 `【策略 X】` 标注，新增错误码须同步补标注。
- 🧵 新增 `logback-spring.xml`：`CONSOLE_LOG_PATTERN` 增加 `%X{traceId}`，使 `TraceIdFilter`
  写入 MDC 的 traceId 真正贯穿每一行日志（此前仅写入 MDC、无 pattern 消费）。
- 🌐 前端按统一契约改造（原为 Ant Design Pro 模板的 `success/errorCode/errorMessage` 结构）：
  ① 新增 `web/src/utils/result.ts` —— `Result<T>` / `PageResult<T>` 类型与 A~H 处理策略表
  （镜像后端 `ErrorCode`，未登记的错误码降级并在开发期告警）；
  ② 新增 `web/src/utils/token.ts` —— 双令牌存储，SSR/隐私模式下降级为内存；
  ③ 重写 `web/src/requestErrorConfig.ts` —— 业务判据改为 `body.code`、响应体不拆包；
  **B 类流程分支码（1008/1009/4001/4002）绝不弹错误提示**；
  `1002` 在响应拦截器内静默 refresh（单飞）+ 重放原请求一次，`1001/1006` 清会话跳登录、
  `1007` 仅提示；G 类退避提示、H 类通知展示 traceId；请求拦截器注入 `Authorization`；
  ④ 单测 20 例（前端全量 31 例通过），覆盖策略分流与「B 类不弹窗」红线。
- 🧾 at-gateway 增加 `spring-boot-starter-validation`：Boot 2.3+ 起 `@Valid`/`@Validated`
  不再随 web starter 传递，补齐后参数校验才真正生效。

- 🔐 **JWT 认证链路落地（at-auth，system-design §2 定稿模型）**：
  ① 登录校验（BCrypt cost=10 与 V2 admin 密文一致）+ Spring Security 过滤链；
  ② 双令牌：access JWT（HS256，30min，claims 含 `sub/ver=token_epoch`，无角色避免陈旧）
     + refresh 随机不透明串（7d，Redis 白名单只存 SHA-256 指纹）；
  ③ `JwtAuthenticationFilter`：Header 解析 → 验签/过期（1002/1006）→ Redis 纪元缓存比对
     （miss 回源 DB 自愈 P-8）→ 构建 `Authentication` 入 SecurityContext，未认证统一
     `Result` 输出（1001/1002/1006，默认拒绝 V-06）；
  ④ 登出/全端吊销：DB `token_epoch+1`（REQUIRES_NEW 提交）+ 提交后清理 Redis 键；
  ⑤ 登录失败 Redis 计数：5 次锁 15 min（`at:login:fail:{username}`），成功清零；
  ⑥ refresh 原子轮换（Lua）+ 复用打击（指纹不匹配 ⇒ epoch+1 全端吊销）；账号不存在与
  密码错误统一 `1007` 不泄露账号存在性。
- 🗄️ Flyway `sql/V3__add_user_token_epoch.sql`：`sys_user.token_epoch`（会话吊销纪元）。
- 🔌 新增认证端点：`POST /api/v1/auth/token`（登录）/ `POST /api/v1/auth/token/refresh`
  （刷新，白名单）/ `POST /api/v1/auth/logout`（登出，需登录）/ `GET /api/v1/auth/me`；
  `SecurityCurrentUserProvider` 接通 at-common SPI，`createBy/updateBy` 自动填充生效。
- 🧪 at-auth 单测 11 例（JwtTokenProvider 签发/验签/过期/指纹 + AuthService 锁定阈值/状态）。

- 🔐 **RBAC 鉴权落地（at-permission，system-design §3 / 前端映射见 docs/development/frontend-permission-map.md）**：
  ① `AuthenticatedUser` 公共主体验约（at-common），跨模块读 SecurityContext 不破坏依赖铁律；
  ② `@RequiresPerm("file:download")` 注解 + AOP 切面：多角色权限点取**并集**（`sys_role_permission`
     distinct 查询）、**显式 Deny 优先**（`anttransfer.permission.role-deny` 角色黑名单，命中即
     deny 即使他角色已授予）、`any=true` 满足其一；不满足统一 403（1003）；
  ③ `PermissionService`：解析结果缓存 `at:perm:{userId}`（30min，RedisKeyConstants），
     miss 回源 DB 自愈（P-8），授权/角色变更 `invalidate` 主动失效（PRD US-04 即时生效）；
  ④ `AccessControlService`：对象级/数据级守卫——Owner 即本人放行；数据范围 3 全部放行；
     2 本部门及以下（sys_dept.ancestors 祖先链子树判定）；1 仅本人，其余默认拒绝——
     防水平越权（改 fileId 看不到他人文件）的统一入口（红队 V-01/V-06）；
  ⑤ 三权分立：AUDITOR 仅 `audit:log:read`（写类 @RequiresPerm 天然 403）+ role-deny 纵深防御；
     「日志清除」权限点 CE 从不签发，SUPER_ADMIN 亦无（审计不可改删，PRD US-06）；
  ⑥ `GET /api/v1/permission/my` 返回 `{roles, permCodes, dataScope}` 供 Phase 5 前端
     路由守卫 / 按钮显隐与后端一一对应（旧 `@RequirePermission` 标记 @Deprecated）。
- 🧪 at-permission 单测 11 例（并集/Deny 优先/AUDITOR 403/超管无 log:clear/归属与部门范围）。
- 🧭 自测冒烟端点 `SmokeGuardController`（`/v1/smoke/perm/{read,write}`，仅 `anttransfer.smoke.enabled=true`
  且 dev profile 下注册）用于 RBAC 端到端验收；dev profile 追加 Swagger 免登录白名单。
  **2026-09-07 实机自测通过**：Swagger 200；登录返回双 Token；无 Token 访问受保护接口
  401(code=1001)；审计员读 `file:download` 与写 `file:destroy` 均 403；admin/auditor 权限快照正确。
- 🧱 at-gateway 地基补齐：
  ① 访问日志过滤器 `AccessLogFilter`（order=1，随 TraceIdFilter 之后）：单行 access log
     （method/uri/status/耗时/客户端 IP/traceId，uri 不落 query 防敏感参数泄漏）；
  ② 全局异常新增 `AccessDeniedException` → **1003 NO_AUTH（403）** 兜底分支
    （2026-09-13 裁决 AT-DIFF-01：采纳「权限不足 = 1003/403」口径，原 1004 已替换，
    详见 docs/api/error-codes.md 附录 B 与上文 Changed 段的破坏性变更说明）；
  ③ `@RateLimit`（at-common）+ Redis 固定窗口切面（at-gateway）：Lua INCR+EXPIRE 原子计数，
     超限抛新错误码 **4290 RATE_LIMITED**（HTTP 429，策略 G，前端已登记）；Redis 异常降级放行
     仅告警；
  ④ CORS 白名单属性化：`anttransfer.cors.allowed-origin-patterns`（at-gateway 与 at-auth
     同键消费），dev 默认 `*`、生产以 `ANTTRANSFER_CORS_ALLOWED_ORIGINS` 收紧；
  ⑤ 容器级错误页统一为 `Result` JSON（新增 `com.anttransfer.gateway.error` 包）：
     `HttpStatusErrorMapper`（HTTP 状态 → 已登记错误码兜底映射，**绝不新建错误码**）+
     `ApiErrorController`（实现 `ErrorController` 接管 `/error`，Boot `BasicErrorController` 因
     `@ConditionalOnMissingBean` 自动退让）+ `JsonErrorReportValve`（继承 Tomcat `ErrorReportValve`，
     覆盖**绕过 Spring MVC 异常链的连接器级拒绝**：非法 URI(400)、超限请求头/请求行(400)，
     此前一律返回 Tomcat HTML(`HTTP Status 400 – Bad Request`)）+ `TomcatJsonErrorReportConfig`
     （监听 `WebServerInitializedEvent`，仅对 Tomcat 生效，移除 Boot 注入的 `ErrorReportValve`
     并装载本阀门）。响应体只含错误码默认文案 + traceId，真实堆栈仅落服务端日志。

- 📋 新增差异点索引页 `docs/development/AT-DIFF-todos.md`：汇总外部计划与仓库契约的 5 处差异
  （AccessDenied 1003/1004、Filter 权限加载、部门范围拦截器、HTTP JUnit5 测试、接口命名），
  详细描述与方案已嵌代码内 `TODO[AT-DIFF-01~05]`；其中 **AT-DIFF-01 已于 2026-09-13 裁决**
  （改采 1003/403，见上文 Changed 段），余下 02/03/05 项仍开放。
- 🧩 OpenApiConfig（at-bootstrap）：Swagger UI 增加 `bearerAuth` 安全方案与全局 SecurityRequirement，
  登录拿到 access token 后可在 UI Authorize 处填入并在线调试全部受保护接口。
- 🧪 正式集成测试套件 `AuthFlowIntegrationTest`（at-bootstrap，Testcontainers 自动拉起 MySQL+Redis，
  无 Docker 自动跳过）：认证/授权八条全链路断言（登录双 token、401/1001、200、auditor 403/1003、
  登出后旧 token 失效 401/1001、refresh 复用打击 401/1006、错误密码 401/1007）；
  AT-DIFF-04 已办结。

- 📊 **PRD §4.1 实现现状核查「后端」复核（`docs/prd/README.md`）**：原表仍是「审批 / 用户管理 /
  角色管理 / 审计 / 通知 / IM / 待办 / 打包 / 限速 / 秒传 / 外发链接全部未落地」的早期快照，
  与代码严重脱节。本次以 `server/` 实际实现为准重核 P0 全表（**10 → 18 行，补齐 §4 有 P0 而
  原表漏报的 8 项**）+ P1 段 + 横切地基：
  - **状态修正**：秒传 + SHA-256 校验、外发链接、站内通知 由 ⬜ → ✅；
    分级权限申请审批闭环由「闭环全缺」→ 🟡（提交 / 通过 / 驳回 / 转审 / 待我审批 / 我的申请 /
    权限地图七端点已落地，仍缺「申请人主动撤销」端点，以及「每级别自动放行 / 一级审批」的可配规则）；
    三权分立保持 🟡，但补记已实现的内置角色保护与防自锁两条锚点，缺口收敛为
    「角色互斥无数据层约束 / 服务层校验」（`mutex` 全文零命中）；
    分片上传 / 断点续传仍为 ⬜（`at-transfer` 未落地，无 precheck / parts / merge，未消费 `sys_upload_task`）；
  - **新增行**：审计与合规（✅，共享内核 + 三域写入器 + 检索导出 + 只读承诺）；本地账号登录 / 注销 / 改密
    （🟡，缺用户自助改密端点，改密目前仅管理面重置且已带全端吊销）；账号停用 / 启用（🟡，
    **不满足「停用 2 分钟内会话失效」**——`changeStatus` 未联动吊销、Filter 不校验 `status`，旧 access 最长 30 min）；
    敏感级别与审批规则配置（🟡，字段与 SLA 已在，缺「单级自动放行 / 一级审批」可配规则与级别变更审计）；
    上传 / 下载流式接口（🟡，下载 Range 与上传流式 sha256 已在，缺「暂停 / 恢复」所需的分片清单）；
    文件管理（✅，目录 / 移动 / 复制 / 软删 / 回收站 / 恢复 / 销毁 / 清空全链）；共享空间（⬜，
    `sys_space` 仅骨架实体、无 Controller / Service / 成员角色端点）；配置管理 / 健康检查 / 优雅启停（🟡，
    **发现上传上限完全未配置**——无 `multipart.max-file-size` 亦无 `MultipartConfigElement`，沿用 Spring 默认 1 MB；
    无 actuator 健康端点、未开 `server.shutdown=graceful`、compose 中 server 无探针）；
  - **P1 段**：补两处精确缺口——`keyword` 为 LIKE 匹配、**未建全文索引**（§4「全文搜索」未满足）；
    轻 IM 缺 **@ 提及**与「消息保留 ≥ 30 天」策略；
  - **新增盘点**：后端 20 个测试类逐类用例数、Flyway `V1~V9` 用途，以及开放裁决项刷新
    （AT-DIFF-01 已裁决，02 / 03 / 05 待裁决，06~10 已登记未阻塞）；
  - **路径约定**：§4.1 端点统一**省略全局前缀 `/api`**（`server.servlet.context-path=/api`），
    消除同一小节内 `/v1/...` 与 `/api/v1/...` 混用导致的歧义。

- 🧱 **后端功能缺口登记（GAP-01 ~ GAP-08，留待项目完工后回头改进）**：§4.1 复核发现的
  「已落地部分中的缺口」（**非口径差异**，故不落 `TODO[AT-DIFF-]` 标记、AT-DIFF grep 计数仍为 3 处）
  已在 `docs/development/AT-DIFF-todos.md` 新增独立小节登记，并在 `docs/architecture/architecture.md` §4
  延期登记处加交叉引用，**与 D-x 同批关闭**（三条主线跑通后的加固期）：
  ① 上传大小上限未配置（Spring 默认单文件 **1 MB**，`multipart` 段与 `MultipartConfigElement` 全仓零命中，**建议提前**）；
  ② 账号停用未联动吊销会话（不满足「停用 2 分钟内会话失效」：`revokeAll` 未被 `changeStatus` 调用、Filter 不校验 `status`）；
  ③ 无用户自助改密端点（仅管理面 `reset-password`，自助入口与首登强制改密无法闭环）；
  ④ 健康检查端点 / 优雅启停 / compose 中 server 探针三项缺失；
  ⑤ 三权分立缺角色互斥校验（`mutex` 全仓零命中，无数据层约束与服务层校验）；
  ⑥ 敏感级别缺变更端点与变更审计、缺「提级需审批」强制联动；
  ⑦ 全文搜索未建索引（`keyword` 走 LIKE，数据量增长后无法走索引）；
  ⑧ 轻 IM 缺 @ 提及与「消息保留 ≥ 30 天」策略（无归档 / 清理任务）。
  共享空间 / 审批端点 / 分片上传三项已由 **D-11 / D-5** 覆盖，**未重复登记**。

- 🧱 **构建前置门禁：JDK 版本不符时构建一开始就失败**（根 `pom.xml` 新增 `maven-enforcer-plugin`
  的 `requireJavaVersion`，版本区间 `[21,)`，绑定最早的 `validate` 阶段）。此前 `JAVA_HOME` 指向 JDK 17
  时会撞上一种极隐蔽的失败：`target/classes` 里是 JDK 21 编的类（major 65），JDK 17 的 javac 因增量检查
  认定「Nothing to compile」而**跳过重编译**，构建日志一路全绿，直到 `spring-boot:run` 派生 JVM 才抛
  `UnsupportedClassVersionError`（65.0 无法被只认到 61.0 的 JVM 加载）——报错落在运行期、根因却在环境变量。
  现 JDK 不对即失败并直接给出修复指引（`mvnw -v` 可查看当前 JVM）。口径：校验的就是「运行 Maven 的 JDK」
  （它同时是 `spring-boot:run` 派生 JVM 的来源，二者必然一致），下界 21、不设上界（JDK 22/25 照常放行）。

### 🐛 Fixed（修复）

- 🧵 **四处「并发撞唯一键后回查既有行」的幂等兜底其实永远走不通**（MySQL 默认 REPEATABLE READ）：
  `ChatService#send`（消息写扩散）、`ChatAttachmentService#create`（附件授权）、
  `FileNodeService#registerStoredContent` / `#acquireContentReference`（内容寻址）四处同形——
  显式事务 + `insert` 之前已有一条一致性读（幂等前置查询）+ 撞键后靠「回查既有行」收敛。
  但快照正是在 `insert` 之前那次查询建立的，对手的行在那之后才提交，撞键后再沿用同一快照回查
  **必然读到空**，回查因此形同虚设、重复键被原样抛给「弱网重发 / 双端同发」的用户——
  而这正是那几段兜底存在的唯一理由（`send` 的注释原话是「可安全回查既有消息并返回」）。
  真库复现：新增 `ChatSendIdempotencyE2eIntegrationTest`（真 MySQL + 真 Redis），
  16 线程同一 `clientMsgId` 连跑 3 轮全部失败于
  `Duplicate entry '1-1-…' for key 'sys_notify_message.uk_sender_recipient_client'`；
  同一类里的**隔离级别机理探针**用两条真实连接证明根因（普通回查看不到快照之后提交的行、
  `for share` 看得到），**顺序重发对照组**则说明该缺陷为何长期不可见（单线程只走得到干净路径）。
  修复：#1 / #2 的回查改走**当前读**（`limit 1 for share`）；#3 / #4 改走**只读独立事务**
  （`REQUIRES_NEW` + `readOnly`）——它们撞键后还要对同一行做 `ref_count + 1`，实测先是死锁
  （`Deadlock found when trying to get lock`：`for share` 留下的共享锁要升级成排他锁，
  多个并发输家互相等待），换成不持锁的新事务才既拿到新快照、又不破坏调用方原子性
  （`FileVersionService#createVersion` 正处在更大的写事务里）。验证：新增
  `FileContentRaceE2eIntegrationTest`（秒传登记 / 内容引用 / 附件授权各 8 线程 × 2 轮），
  连同上述用例共 11 个真库用例全绿，断言的是「并发下无任何请求失败且终态唯一」，
  而不是把「抛出了重复键」当成预期行为固化下来。判例与不属此列的白名单见
  `docs/development/AT-DIFF-todos.md` 的 RACE-01（已关闭）。
  - **全量回归（2026-09-29 实跑）**：后端 `mvnw -B test` 9 个模块**全 SUCCESS**，
  68 个测试类 / **645 例，0 失败 0 错误 0 跳过**（含 `at-bootstrap` 的 6 个 Testcontainers 真库 IT）；
  后端 `mvnw -B package`（含 Spring Boot repackage）通过。
  前端 `npm test` **75 个测试文件 / 863 例全绿**，`biome lint` 408 个文件**零告警**
  （唯一 2 条 warning 是既有的 `pages/shares/index.test.tsx` 非空断言，已把 `queryByRole + !`
  换成 `findByRole` 等待式查询顺手消除，该文件 6 例复跑通过）、
  `tsc --noEmit` 干净、`max build` 通过（dist 产物与各路由 html 均已生成）。
  浏览器 E2E 未跑：`tests/e2e/` 仍是「规划中」占位目录、尚无 Playwright 工程。
- 🖼️ **头像「传完既没提示、也不出预览」，根因不在头像功能而在二进制通道读响应体的方式**：
  `uploadBinary` 把 `xhr.responseType` 设成 `'json'`（响应体是 `Result`），而 `readBinaryBody`
  仍去读 `xhr.responseText`——规范只允许在 `responseType` 为 `'' / 'text'` 时读它，其余取值下
  **必抛 `InvalidStateError`**（Chrome / Firefox / Safari / jsdom 行为一致）。于是「后端已 200、
  图已落库」的每一次上传都在读响应体那一步炸掉，被上层当成解析失败：用户看到的就是「点了没反应、
  没有成功提示」，`avatarUrl` 也拿不到、预览自然不更新。修复：`'json'` 一律取浏览器已解析好的
  `xhr.response`（响应体不是 JSON 时为 `null`，交由 HTTP 状态兜底），只有文本型才读 `responseText`。
  测试：`request.test.ts` 的假 XHR 改为**与浏览器同语义**（`json` 下读 `responseText` 抛
  `InvalidStateError`、只填已解析的 `response`——这正是原用例假绿的原因），新增两条用例钉住；
  **已验证旧实现下必然失败**，修复后 25 例全绿。真机复现与验证：Playwright 开真实浏览器，
  把 `admin` 头像置空后走列表「编辑 → 上传头像」——旧写法在页面内直接执行即得
  `THROWS InvalidStateError`（与线上病症同源），修复后弹出「头像已更新」且预览 `img` 的
  `naturalWidth=1`（图确实加载出来了）。
- 💬 **即时通讯抽屉里自己刚发的消息会变成两个气泡**：抽屉的消息流一直是**追加**维护
  （发送响应 `[...prev, sent]`、实时帧 `[...prev, msg]`），可自己发的消息本来就有**两条到达路径**——
  HTTP 发送响应，以及服务端把这条帧**原样推回**（推送覆盖该用户全部连接），同一条消息因此被画两遍。
  `/chat` 页没这个问题，因为它走 `mergeMessage`（同时认 `id` 与 `clientMsgId`）。修复：抽屉改为复用
  共用规则，去重规则只留一份而非两处各写一份（顺带获得按 `id` 排序：迟到的帧落到正确位置，
  不再永远挂在流末尾）。测试：新增 `ChatDrawer 消息合并` 用例走真实链路（点发送 → 注入服务端推回的
  同一条帧 → 断言只有一个气泡），**已验证在旧的追加实现下失败**
  （`expected [<span>, <span>] to have a length of 1 but got 2`）。
- 💬 **顺带收敛：抽屉的会话列表侧也不再自研一份规则**：抽屉原本自己写了一份 `applyIncoming`——
  不排序（新消息到了会话不往前挪）、不判乱序（迟到的旧帧会把摘要改回旧文案）、列表里还没有的会话
  就地插一条缺 `targetName` 的壳（先显示「用户 #id」再跳真名）；`/chat` 页走的是
  `applyIncomingToConversations`（含乱序保护与排序），于是同一件事有了两份实现。修复：抽屉改取共用
  规则，并补上「列表里还没有这个会话 → 重拉一次会话列表」而不是插壳。共用逻辑随之下沉到领域层
  `src/services/chat/messages.ts`（与 `readReceipt.ts` / `fileCard.ts` 同层），组件不再从 `pages/`
  反向取逻辑——模块与它的测试一并从 `pages/chat/` 迁到 `services/chat/`。测试：新增
  `ChatDrawer 会话列表` 三个用例（新消息把该会话顶到最前且摘要更新、迟到的旧帧不让摘要回退、
  未知会话重拉列表而**不**插壳），**已验证三者在旧的自研实现下全部失败**（分别卡在「列表不排序」
  「旧帧覆盖摘要」「不重拉列表」三处断言上）。
- 💬 **抽屉的置读口径也对齐会话页：只对别人发来的置读，置读后回正顶栏角标**：会话页的规则有两条——
  `if (!isMine(incoming))` 才 `markChatRead`（自己发的会被推送原样收回来，多标签页里给自己置读
  没有任何意义），以及 `affected > 0` 时 `wsStore.refresh()`（未读数的唯一事实源是 `wsStore`，
  少这一拉顶栏红点就停在旧数字上）。抽屉两条都不满足：对**每一条**帧（含自己发的）都置读，
  且从不 refresh。修复后抽屉的两处置读（进入会话、会话正开着收到帧）与会话页逐项一致。
  测试：新增 `ChatDrawer 已读口径` 三个用例（别人发来的帧 → 置读 + 回正角标；置读没改到行 → 不白拉
  一次未读快照；自己发的帧 → 不置读但消息照常合并），**已验证旧口径下失败 2 例**——「别人发来的帧」
  卡在 `refresh` 从未被调用（`expected "vi.fn()" to be called 1 times, but got 0 times`）、
  「自己发的帧」卡在置读仍被调用（`expected "vi.fn()" to not be called at all, but actually been
  called 1 times`）；第三例是「别过度刷新」的护栏，旧口径下本就通过。聊天域 10 个测试文件 154 例
  通过，`tsc --noEmit` 与 `biome lint` 均干净。
- 💬 **「发起会话」对话框把「第一条消息」标成可选，留空提交后会话在左侧列表里根本不出现（刷新即消失）**：
  会话采用**写扩散**模型——只有发出首条消息才会落 `sys_notify_message` 行，而会话列表是按消息行分组推导的，
  故「空会话」压根不成立；但弹窗文案写着「可以留空，创建后再输入」，校验也放行空内容，
  于是用户以为建好了、点进空会话也无处可写（列表里没有入口）。修复：**首条消息改为必填**——
  文案去掉「（可选）」与「可以留空，创建后再输入」，空内容提交就地提示 `chat.new.content.required`，
  从源头杜绝「以为建了其实没建」。顺带把「非管理员发起会话」的目标输入拆分为
  私聊（输入登录账号 + 内联解析反馈）与群聊（输入群 ID）两条渲染分支，并让解析请求做在途去重、
  输入变更即失效，避免旧响应覆盖新输入。
  首条消息的输入框**换成聊天界面那个 `ChatComposer`**（发送按钮在框内、Enter 发送 / Shift + Enter
  换行、带表情面板），弹窗页脚随之只留「取消」——发起动作与聊天页共用同一条代码路径，
  不再是一个另写的裸 `TextArea` 加一个页脚按钮（同一动作两个入口，改文案还必然漂移）；
  `ChatComposer` 新增 `bare`（无外壳）样式开关，供弹窗内嵌使用，去掉为「消息流 ↔ 输入区」
  设计的内边距与上分隔线。正文长度上限仍为 1000，唯去掉 `showCount`
  （计数器与「框内工具栏」这套布局会互相挤位，而首条消息几乎用不到计数）。
- 🧑💻 **聊天头像前后不一致：列表里「系统管理员」是「系」，一点进会话就变成「用」**：
  详情态的会话只是一个**定位键**（点击列表时只取了 `scope + targetId`，名字被留在列表里），
  而详情态的标题与消息头像**各查各的**——标题做了「回查会话列表补名字」，头像直接拿裸定位取首字，
  于是回落成「用户 #<雪花ID>」的首字「用」，与同屏标题自相矛盾。
  修复：新增 `resolveSessionDisplay`（会话名回填的唯一出口）并约定**详情态标题与头像必须取同一个展示对象**；
  抽屉点击时把 `targetName` 随定位一起带进详情，不再依赖回查（深链、列表尚未加载完的空窗也能即刻正确）；
  聊天页里重复的内联回填一并收敛到该函数。
  测试：新增 `ChatDrawer` 头像一致性渲染测试（**已验证在旧实现下失败**，避免写出永远通过的假回归）
  与 `resolveSessionDisplay` 单元测试，聊天域 57 项测试通过，`tsc --noEmit` 与 `biome lint` 均干净。
- 📄 **别人发来的文本文件预览被拒：提示「该类型无法在线预览，而发送方未允许下载」，
  可同一个文件在发送方自己的文件域里却能正常预览**：根因是取件层把
  **「可预览」当成了「可交给浏览器按 MIME 渲染」**。`ChatAttachmentService#issueTicket` 原先用
  `FileTypePolicy.inlineRenderable(ext)` 填 `previewSupported`，而该方法是**安全边界**
  （只认「PDF + 光栅图」），于是 `.txt` / `.md` / `.json` / `.xml` / `.csv` / `.log` / `.sql`
  这类文本被下成 `previewSupported=false`，前端照此弹提示；取流层对文本同样会以
  「不支持在线预览」拒绝（实测附着 `测试.txt` / `usage_mode=1`）。
  修复：新增 `FileTypePolicy#previewable(ext) = inlineRenderable || previewableText`
  把**产品口径**（用户能不能在线看到）与**安全口径**（能否让浏览器按 MIME 渲染）显式分开，
  `previewSupported` 改用它——该方法<b>只用于能力告知，绝不用于判定能否内联</b>。
  同时新增文本专用下发通道 `FileDownloadService#streamTextPreview`：MIME **服务端硬编码**
  `text/plain;charset=UTF-8` + `X-Content-Type-Options: nosniff`（内容里写满 `<script>`
  也只会被当可见字符显示）、`Content-Disposition: inline`、`private, no-store`，
  读取上限 `previewTextMaxBytes`（与文件域文本预览同上限），截断时回 `X-Preview-Truncated`
  以便区分「文件就这么长」与「被截断」；该通道刻意**不支持 `Range`**——按字节分段会把多字节
  字符切断，反使每段都解码失败。
  顺带修掉一处编码隐患：把文本解码抽成 `TextPreviewDecoder`（**编码判定只此一份**），
  文件域（JSON 返回字符串）与取件层共用同一实现，严格 UTF-8 → 严格 GBK → ISO-8859-1 兜底，
  并带「末尾最多回退 3 字节」重试以区分「内容被截断」与「编码不对」——否则 GBK 文本在浏览器里
  会整篇乱码，也会出现「同一文件两处预览编码不一致」的诡异差异。
  **安全边界未放宽**：`inlineRenderable` 对 `txt` / `xml` / `html` / `svg` 仍为 `false`；
  Office / 压缩包 / 可执行 / 网页类仍无预览路径，且**绝不降级为下载**（降级等于把预览票变成
  下载票，绕过「仅预览」档位）。契约层面未新增端点 / 字段 / 错误码，仅 `ChatAttachmentTicketVO#previewSupported`
  的语义扩为「是否支持在线预览」；分享取件侧（访问类型 `preview`）的同类误拒一并修复。
  测试：新增 `FileTypePolicyPreviewBoundaryTest`（46 项，含**反方向**守住「文本可预览但绝不可内联」）
  与 `FileDownloadServiceTextPreviewTest`（7 项：UTF-8 / GBK / 截断 / 多字节截断边界 / 安全响应头 /
  仍需拒绝的 Office·压缩包 / 内容缺失显式失败），`at-file` 全量 98 项测试通过。
- 💬 **会话「发送消息」恒定报「目标用户不存在或不可用」**：两层缺陷叠加，且**下层一直被上层挡住**。
  上层是 **19 位雪花 ID 当 JSON number 过线**——`at-collaboration` 的 `ConversationVO` 与
  `NotifyMessageVO`（WS 实时帧）里的会话定位 ID 未标 `@JsonSerialize(using = ToStringSerializer.class)`，
  超出 JS `Number.MAX_SAFE_INTEGER`（2^53-1）后浏览器 `JSON.parse` 把末位**静默取整**，
  前端再回传时该值已与库里主键不是一个数 → `ChatService` 的 `existsActiveUser` 查不到人，
  直接抛 `CHAT_TARGET_INVALID`(1013)。同域其余对外 VO（用户 / 部门 / 角色 / 菜单 / 权限点 / 审批单）
  一并字符串化，新增 `PlatformIdJsonContractTest`（反射扫描认证域 / 权限域 / 协作域全部对外 VO，
  漏标即失败）钉住口径，前端 ID 契约统一按 `string` 承接。
  下层是 **`sys_notify_message.title` 的 `not null` 约束**：V5 把该表扩成「系统通知 + 会话消息」
  双语义时补的 5 列全可空，唯独漏掉 V1 遗留的 `title`；而会话消息本就无标题
  （`ChatSendDTO` 无 `title` 入参，`ChatService` 落行也不写该列），MyBatis-Plus 默认跳过 null 字段
  使 `INSERT` 里根本不出现 `title`，MySQL 严格模式随即报
  `Field 'title' doesn't have a default value` → 发送命中 HTTP 500。
  该缺陷此前被上层完全掩盖（ID 一律先被判 1013，请求根本走不到落库这一步）。
  修复：新增 [`sql/V11__notify_message_title_nullable.sql`](sql/V11__notify_message_title_nullable.sql)
  把 `title` 放宽为可空（不改类型 / 长度、不动存量数据；系统通知侧 `NotificationDispatcher`
  一律显式写入标题，行为不变）。
  实机回归（dev：`admin` → `test1`）：用字符串 ID 发送返回 `code=0` 且 `chatTargetId` 为 19 位原值；
  改用舍入后的数字 ID 发送则精确复现 1013 —— 两者对照即锁死根因。
- 🦊 **文件下载「点了没反应、不落盘」（只在火狐暴露）**：根因不在取件链路的正确性，而在**取件被当成了「顶层导航」发出**。
  `startNativeDownload` 原先只靠服务端 `Content-Disposition: attachment` 把这次导航「改判」成下载，而浏览器在响应头
  回来之前只能按「即将换文档」处理：当前文档开始卸载 → 页面里的 WebSocket 被断开 → 开发服务器的 HMR 客户端
  （控制台实测 `[utoopack] Dev server disconnected. Polling for restart...`）据此误判「服务重启」并触发整页
  `location.reload()` → 这次 reload 把尚在飞行中的取件导航取消掉，浏览器报 `NS_BINDING_ABORTED`，下载管理器
  从未接手（`download` 事件不触发、桌面无文件、Firefox 下载列表 `places.sqlite` 里也没有记录，与「点了没反应」吻合）。
  1.9 KB 的小文件纯属竞速，Chrome 恰好抢先到达下载管理器，所以**同一个 bug 只在火狐上稳定复现**。
  修复：`startNativeDownload(url, fileName?)` 给隐藏 `<a>` 显式加 `download` 属性——同源下浏览器在**点击那一刻**就
  按下载处理，不再拆除当前文档；该属性不要求用户激活态，而本函数总是在 `await` 换票之后才被调用、激活态可能已过期，
  故与 `target="_blank"` 一类写法不同。分享页访客侧的下载入口（`<a href={contentUrl}>`，同一问题）一并补上。
  文件名仍以服务端 RFC 5987 的 `filename*` 为准（实测落盘 `测试.txt` 而非 `download`），`fileName` 仅作响应头缺失时的兜底。
  代价：取件端点若返回 JSON 错误体（只可能来自「票据刚签发就失效」，TTL 5 分钟当次即刻取件）会被落成文件而非渲染成页面。
  回归：`request.test.ts` 钉住「`download` 属性必须存在」（含不给兜底文件名时留空值——属性在不在才是下载 / 导航的分界），
  `api.test.ts` 同步兜底文件名入参；另在真实 Firefox(Gecko 155) 内核上按用户真实路径（登录 → 文件列表 → 点下载）
  端到端复现并验证：修复前 `FAIL NS_BINDING_ABORTED` + 无落盘，修复后 `RESP 200 attachment` → `DOWNLOAD 测试.txt`
  → 落盘 1982 B，且不再发生整页 reload。
- 🔌 **聊天界面实时连接一直卡在「正在建立实时连接」**：根因与 WebSocket 代码无关，是 **dev profile 静默清空了免登录白名单**。
  `application.yml` 的 `anttransfer.auth.permit-all` 原本放行了 5 条「产品固有」的匿名入口
  （`/ws/notify`、`/v1/files/*/content`、`/v1/files/*/thumbnail`、`/v1/shares/*/verify`、`/v1/shares/redeem`），
  但 `application-dev.yml` 为放行 Swagger 又定义了**同一个键** —— Spring Boot 的 profile 配置文档优先级高于
  主文档，且 **List 属性整体替换而非逐项合并**，于是那 5 条在 dev 下被整份丢弃；而 `application-prod.yml`
  没写这个键，所以表现为**只在 dev 坏**。
  后果：`/ws/notify` 落回 `anyRequest().authenticated()`，浏览器 WebSocket 构造器又无法设置
  `Authorization` 头（令牌只能走查询串），在 Security 眼里永远是匿名请求 → 握手被
  `RestAuthenticationEntryPoint` 拒成 `401 {"code":1001}`（实测可据响应体区分：安全链拒绝返回统一 Result JSON，
  握手拦截器拒绝返回空响应体）→ 前端在 `connecting`/`reconnecting` 之间循环，故一直显示「正在建立实时连接」。
  同样被波及的还有文件取件与分享核销：原生下载、缩略图、访客取件页在 dev 下都会 401。
  修复：把这 5 条**与运行环境无关**的固有匿名入口从 YAML 上移到 `SecurityConfig.BUILT_IN_PERMIT_ALL`，
  profile 从此无法覆盖它们；`application.yml` 的 `permit-all` 改为默认留空并加警示注释，
  profile 只保留真正的环境差异（dev 的 Swagger 路径）。安全口径不变：**放行访问路径 ≠ 免鉴权**，
  WebSocket 仍由 `WsHandshakeInterceptor` 在 Upgrade 阶段校验 JWT，未通过不升级为长连接。
  回归：新增 `SecurityConfigTest`（4 例，守住「配置只能追加、删不掉内置项」，覆盖空 / 仅 Swagger / null 三种配置形态）；
  `docs/development/joint-debug-prep.md` 补白名单陷阱说明。
- 🔗 **外发分享「生成链接」报 `4005` 文件不存在或已被删除**：根因是**前端把「条目 ID」当「物理文件 ID」提交**。
  数据模型分两层——`sys_file`（物理层：真实字节与归属）与 `sys_file_node`（引用层：用户在列表 / 目录里看到的条目），
  而外发分享是**物理文件**维度：后端 `ShareLinkService#requireOwnedFile` 拿 `fileId` 查 `sys_file`，
  `sys_share_link.file_id` 关联的也是 `sys_file.id`（`sql/V1__schema.sql` 的列注释已写明），
  即列表项里的 `FileNode.fileId`。但两个入口都传了 `FileNode.id`：文件页 `ShareModal` 提交 `fileId: node.id`，
  分享页 `CreateShareModal` 的文件下拉 `value: node.id`。两张表的 ID 都由雪花生成、分属不同值空间，
  查库必然落空，于是被服务端判成 `4005`「文件不存在或已被删除」（该码与「无权访问」刻意不可区分，
  因此从报错上完全看不出是用错了 ID）。
  现两处统一改取 `node.fileId`；分享页的选项映射抽成 `toFileSelectOptions`，顺带过滤 `fileId` 缺失的残缺行，
  不让用户选中一个注定失败的文件；文件页在提交前就地拦截并提示（新增中英双语
  `file.share.missingFileId`），不再发出必然 400 的请求。
  回归：`ShareModal.test.tsx` 新增「提交的是 `node.fileId` 而非 `node.id`」「缺 `fileId` 时不发请求」两例，
  `CreateShareModal.test.ts` 新增 2 例（钉住选项 `value` 与残缺行过滤）；`docs/api/README.md` §4 补「两个文件 ID 别混用」。
- 🧾 **外发分享「生成链接」报 `2004` 请求体格式错误、且同一句提示弹两遍**：两个独立缺陷叠加，前者是触发条件，后者放大体感。
  - **时间入参不是 ISO-8601**：`ShareModal` 原先用 `dayjs().add(N, 'day').format('YYYY-MM-DD HH:mm:ss')` 直接当请求体，
    而**空格分隔不是 ISO-8601**；后端 `CreateShareRequest.expireAt` 是 `LocalDateTime` 且未配 `@JsonFormat`，
    反序列化阶段即抛 `HttpMessageNotReadableException`，被 `GlobalExceptionHandler` 统一回成 `2004`
    「请求体格式错误，请检查 JSON 与字段类型」。现改走 `web/src/utils/datetime.ts` 的 `formatLocalDateTime`
    交出 `T` 分隔的 ISO，成功态再转回本地可读格式展示（服务端回显的 ISO 不再把 `T` 直接摆给用户）。
    同一根因还命中 `PermissionApplyModal` 的 `desiredExpireAt`，一并修正。
  - **同一错误弹两遍**：两个弹窗的 `catch` 都无条件 `message.error` 兜底，但全局错误链路
    （`requestErrorConfig` 的 `errorHandler`）对业务错误 / 带响应体的 HTTP 错误 / 网络异常**已各提示过一次**，
    且 `errorHandler` 执行完 Umi 仍会 reject、`catch` 照样会跑到——于是同一句话弹两遍，用户误以为提交了两次。
    现抽出 `web/src/utils/result.ts` 的 `isErrorHandledByRequestLayer(error)`，页面只对**不经 request 通道**
    的同步异常兜底；同类反模式一并修掉 `ApprovalDecisionModal`。
  - 回归：`ShareModal.test.tsx` ×2（时间入参必须 `T` 分隔、成功态展示不得带 `T`）+ `utils/result.test.ts` ×5
    （四类错误形态的提示归属）；`docs/api/README.md` §4 补「空格分隔不是 ISO-8601」的排障提示。
- 🖼️ **文件工作台「上传成功后无法预览 / 下载」**：根因是**文件域 VO 把 19 位雪花 ID 当 JSON number 下发**。
  上传域（`PrecheckResultVO` / `MergeResultVO`）早已按「ID 以字符串过线」处理，文件域漏了同一口径：`id` 超出
  JS `Number.MAX_SAFE_INTEGER`（2^53-1），浏览器 `JSON.parse` 时末位被静默取整，于是列表接口返回的
  `id` 与库里的真实主键**已经不是一个值**；前端再拿它去请求 `/v1/files/{nodeId}/preview`、
  `/v1/files/{nodeId}/ticket` 自然查不到节点——**列表能看到文件，预览 / 下载必然失败**（下载路径还会
  被归属校验先拦一道）。同一根因还会连带打歪：`folderId` 被 `toOptionalNumber` 归一后「进入目录列表为空」、
  勾选行 `keys.map(Number)` 后批量操作静默失效、分享 / 打包 / 版本回滚拿错 ID。
  修复分两端：服务端在 `at-file` 全部对外 VO 的 ID 字段上标
  `@JsonSerialize(using = ToStringSerializer.class)`（含计数字段不动，`sizeBytes` / `total` 仍是数字）；
  前端把文件域 ID 的 TS 契约改为 `string` 并新增 `SnowflakeId` 别名与 `toOptionalId`，
  同步清理 `toOptionalNumber` / `Number(keys)` 两处归一，目录树补 `isRootFolderId` 判定
  （`'0'` 是真值，否则根目录语义会反转）。
  回归防线：新增 `FileDomainIdJsonContractTest`（反射扫描 11 个对外 VO + 断言序列化后 ID 是 19 位原值），
  前端补 `folder-tree` / `buildFileQuery` 的雪花 ID 精度用例。
  对外契约已回写 [api/README.md §4](docs/api/README.md)（「ID 一律以字符串下发」）。
- 🌐 **侧栏菜单切换语言后「只有个别项翻译生效、其余菜单名不变」**：Ant Design Pro 脚手架自带的 8 个语言包
  只翻译了示例页菜单，项目自建菜单键（`menu.workbench` / `menu.upload` / `menu.file` / `menu.shares` /
  `menu.message` / `menu.chat` / `menu.approval` / `menu.permissionMap` / `menu.audit` / `menu.system*`）
  原先只补在 `zh-CN`、`en-US`；其余 6 种语言（`zh-TW` / `ja-JP` / `pt-BR` / `id-ID` / `fa-IR` / `bn-BD`）
  因缺键被 `react-intl` 回退到 `formatMessage` 的 `defaultMessage`，也就是**把路由名 `workbench` / `upload`
  原样显示**，表现为「只有 `menu.welcome`（脚手架共有键）会变，其余都不变」。现按路由口径补齐 15 个键 × 6 语言，
  并新增回归用例 [`web/src/locales/menu-i18n.test.ts`](web/src/locales/menu-i18n.test.ts)——
  必需键直接由 `config/routes.ts` 派生，**新增菜单若漏翻译任一语言会立即失败**。
- 🚪 **普通用户一登录进入系统，首先看到的是 403 页面**：根因是**登录落点只校验「站内」不校验「当前用户可达」**。
  会话失效（或用户主动退出）时 `PermGuard` 会带着原目标跳登录页（`?redirect=/system%2Fusers`），
  而登录成功后的整页跳转直接交给 `safeRedirectPath`——它只挡 open redirect（外链 / `//` / `/\`），
  对「站内但越权」的路径一律放行。于是只要上一位用户停在 `/system/users`、`/audit` 这类
  SUPER_ADMIN 专属页，**普通用户登录成功后第一屏就撞进 `PermGuard` 的 403**，
  看起来像「一登录就没权限」，实际只是被上一段会话的残留 redirect 带偏。
  修复：新增 `web/src/services/access/landing.ts`，把落点从「站内」再收敛为「可达」——
  `pathnameOf` 先剥 query/hash（否则 `/system/users?page=2` 会绕过映射判定），
  `canReachPath` 复用 PermGuard 同口径（数组用 `hasAnyPerm`「满足其一」、`Set` 用 `hasPerm`，
  以 `perm_code` 逐字符一致为准）；`resolveLoginLandingPath` 采取**懒加载**——
  落点不受守卫保护时（如默认 `/welcome`）短路返回、不发起权限请求，
  只有目标确实登记在 `ROUTE_PERM_RULES` 上才去拉 `GET /api/v1/permission/my`；
  拉取失败沿用「全拒绝」降级，回落 `DEFAULT_REDIRECT_PATH`。登录页接入该收敛函数替换裸 `safeRedirectPath`。
  回归：新增 [`web/src/services/access/landing.test.ts`](web/src/services/access/landing.test.ts) ×11
  （query/hash 剥离、越权回落、有权限保留目标含子路径、懒加载短路不触发权限请求、open redirect 拦截、
  权限快照失败 / 空权限回落、数组型「满足其一」）。
- 🔗 **复制分享链接后，在浏览器打开却看不到对应画面**：根因是**前端没有兜住访客取件路由，且后端缺少凭票据取字节的端点**。
  创建者复制的链接是 `{origin}/share/{token}`，但 `config/routes.ts` 里**没有任何 `/share/**` 路由**，
  于是 `{token}` 被路径段吞掉、整条链接掉进兜底的 `/*` → 404 页——表现就是「链接复制出来了，浏览器打开却没有画面」；
  即便路由存在，访客页也会被登录守卫（`app.tsx` 的公开路径判定 + 路由切换守卫）重定向到登录页拦住。
  后端此前访客通道只有 `verify`（换一次性票）与 `redeem`（核销回元信息）两步，**没有靠票据拉字节的端点**，
  前端拿到元信息也无处取内容。修复分三层：
  - **① 取票模型从「一次性票一步到位」改为「双票三步式」**：`verify` 换**一次性票**
    （`at:share:ticket:{ticket}`，`GETDEL` 取用即焚）只回答「谁有权取件」；`redeem` 校验通过后在其上换发
    **取件票**（`at:share:pick:{ticket}`，TTL 同票据口径）回答「把这一次取件读完」；新增
    `GET /v1/shares/{token}/content?ticket=`（`@RateLimit` 120 次/分钟）凭取件票流式下发，支持 `Range` 断点续传。
    之所以不能用一次性票读字节：一次取件在传输层必然被拆成多次请求（`Range` 分段 / 浏览器重试 / 多线程下载），
    第二次就会撞上「票已焚毁」；次数扣减与审计仍只发生在 `redeem` 那一次，取件票重复读**不再扣减、不再审计**。
  - **② 白名单**：后端把 `/v1/shares/*/content` 加入 `anttransfer.auth.permit-all`（浏览器原生 `<a href>` 下载
    **无法携带 `Authorization` 头**，凭证只能走查询串），并同步 `PRODUCT_ANONYMOUS_ENTRIES` 回归用例。
  - **③ 前端补齐公开画面与放行**：新增免登录访客取件页 [`web/src/pages/share/index.tsx`](web/src/pages/share/index.tsx)
    （`layout:false`、共享暗色主题、**手动点击才提交**）——输入提取码 → 换票 → 核销（核销即扣次数）→
    用 `<a href={contentUrl}>` 下载；新增 `web/src/services/access/public-paths.ts` 统一 `isPublicPath` 判定并接进
    `app.tsx` 的登录守卫与路由切换守卫；`config/routes.ts` 注册 `/share/:token`（`layout:false`，`/share/*` → 404）。
  - 🧪 **回归**：新增 [`web/src/services/access/public-paths.test.ts`](web/src/services/access/public-paths.test.ts) ×6
    （正例 / 尾斜杠 / 无前导斜杠 / 拒裸前缀与深层 / 拒前缀相近 / 登录路径）与
    [`web/src/services/file/endpoints.test.ts`](web/src/services/file/endpoints.test.ts) ×5
    （token 与票据在路径 / 查询串中的转义，含 `+ / =` 保留字符）；前端全量 **35 文件 / 353 例**通过。
  - 📖 对外契约已回写 [api/README.md §1](docs/api/README.md) 与
    [system-design.md §5](docs/architecture/system-design.md)，前端路由映射登记
    [frontend-permission-map.md](docs/development/frontend-permission-map.md)。

### 🔒 Security（安全）

- 🚫 生产 profile 默认关闭 Swagger / OpenAPI 文档暴露。
- 🔐 JWT 签名算法**固化 HS256**（`JwtTokenProvider`）：原用 jjwt `signWith(SecretKey)` 单参重载，
  会按密钥字节长度**静默选择 HS256/384/512**——算法随密钥长度漂移，与 system-design 定稿口径不符，
  且难过安全评审。现改为显式 `signWith(key, Jwts.SIG.HS256)`，验签后额外校验 JWA 算法头与预期一致
  （不一致即 `1006 TOKEN_INVALID`）；密钥统一经 `buildSigningKey` 校验 **≥ 32 字节** 后以
  `SecretKeySpec("HmacSHA256")` 构造。
- 🖼️ **头像白名单由通配收紧为数字正则**（`SecurityConfig` 的 `BUILT_IN_PERMIT_ALL`）：头像直出读路径
  `GET /v1/users/{id}/avatar` 原以 `/v1/users/*/avatar` 放行，而 Spring Security 的路径放行**不看 HTTP 方法**，
  该条会连带放行写路径 `POST /v1/users/me/avatar` —— 「谁能改头像」被静默放宽成**匿名可调**。
  现改为 `{userId:[0-9]+}`（顺带把 `/v1/users/abc/avatar` 这类注定 400 的路径挡在鉴权之前），
  并新增回归护栏 `SecurityConfigTest#builtInWhitelist_shouldNotPermitSelfAvatarUpload`：
  **反向**断言写路径不匹配任一白名单条目 + **正向**断言数字读路径仍匹配
  （只做反向断言时，把整条白名单删空也会变绿）。详见
  [AT-DIFF-11](docs/development/AT-DIFF-todos.md#at-diff-11头像双写入口与-profile-帧广播)。

## [1.0.0-SNAPSHOT] 🚧 - 开发中

首个功能快照，尚未正式发布。

### 🔄 Changed（变更）

- 📖 校正 Flyway 迁移开关的文档口径为「**`dev` / `prod` 统一默认开启**」（配置侧为准：
  `application.yml` 的 `spring.flyway.enabled=${FLYWAY_ENABLED:true}`，`application-dev.yml`
  未覆盖该项，`application-prod.yml` 亦注明无需重复配置——**配置无误，属文档单侧写反**）：
  修正 `README.md`（特性表 + 环境变量表）、`docs/getting-started/README.md`（快速开始 + 常见问题）、
  `docs/deployment/README.md`、`docs/architecture/README.md` 共 6 处；
  并将「手工执行 `sql/V1__schema.sql` 建表」更正为准确口径——`V1` 全表 `create table if not exists`
  可安全重入，配合 `baseline-on-migrate` 自动打基线，建表无需手工；仅手工重复执行
  `sql/V2__init_data.sql` 会因固定 ID 插入与 Flyway 冲突。
