# 🎨 前端微信风视觉改造方案（PC 端 · 方案 A）

| 项 | 内容 |
| --- | --- |
| 文档定位 | **前端视觉改造实施方案**：界定「PC 端模仿微信桌面版」的范围、量化口径、文件级改动清单与排期验收 |
| 版本 / 状态 | v1.0 · 2026-09-16（草案，**未开工**，待评审） |
| 适用读者 | 前端实现者（§3 施工清单）· 设计评审人（§2 口径）· 项目负责人（§4 排期 / §6 红线） |
| 技术基线 | React 19 / Umi Max · Ant Design Pro v6（antd 6，`variant: 'filled'`）· `antd-style` CSS-in-JS |
| 改造范围 | **仅 `web/`**。后端、`web/src/services/**`、`web/config/routes.ts` 零改动 |
| 关联文档 | [开发指南](./README.md) · [前端权限映射](./frontend-permission-map.md) · [架构落地说明](../architecture/architecture.md) · [错误码契约](../api/error-codes.md) · [方案 B（备选，已评估未采纳）](./前端微信风视觉改造方案B（自研三栏壳）.md) |

> 🎯 **一句话**：不换布局骨架、不换牌子，只把「底色分层 + 1px 分隔 + 紧凑密度 + 零阴影」这套微信版面语言，通过 token 收口点注入现有 Ant Design Pro 体系。

> ⚠️ **本文是草案**：§8 两个待决策项确认后，版本升至 v1.1 并进入 P0。

---

## 1. 📌 背景与方案取舍

现有前端是标准 Ant Design Pro 管理后台形态（`layout: 'mix'` + 侧栏菜单 + `PageContainer` 大标题 + `ProTable`）。诉求是让 PC 端观感对齐微信桌面版。

微信 PC 骨架是「60px 窄图标条 + 250px 列表栏 + 内容区」，理论上可自研壳替换 `ProLayout`。评估后不采纳：

| 维度 | 方案 A：微信风 token + 保留 Pro 骨架 ✅ | 方案 B：全站改微信三栏壳 ❌ |
| --- | --- | --- |
| 工作量 | 8-12 人天 | 约 3 周 |
| 管理页体验 | **不受损**（只收紧密度，不动信息结构） | **退化**：13px 小字 + 无边框装不下「用户名/角色/部门/状态/时间/操作」六列 |
| 后续成本 | 新页面自动继承微信风 token | 每个新页面额外为「微信风」买单 |
| 主要风险 | 观感可能「形似神不似」 | 迁移 `ProLayout` 十余个钩子，工期与回归不可控 |

> 💡 **核心判断**：「像微信」主要由 **版面语言**（灰底差分 / 1px 分隔 / 紧凑 / 零阴影）决定，而非色相与骨架。微信 PC 本身不承载表格型管理场景，硬套骨架会牺牲可用性。

**边界** —— 做：色彩、圆角、字号密度、阴影策略、分隔与底色分层、4 个内容页完整微信化。不做：布局骨架替换、导航结构重排、业务逻辑、接口契约、权限口径。

---

## 2. 📐 「像微信」的量化口径

没有量化口径，改造会退化成自由发挥。微信 PC（4.x）的观感由 6 个参数决定，与色彩关系不大：

| 维度 | 微信 PC | 项目现状 | 目标 | 收口点 |
| --- | --- | --- | --- | --- |
| 圆角 | 2-4px（近乎直角） | `RADIUS_CARD = 8` / `RADIUS_PANEL = 12` | 4px / 6px | `theme/tokens.ts` |
| 正文号 | 13px | 14px（antd 默认） | 13px | `config/config.ts` |
| 控件高 | 30-32px | 32px（antd 默认） | 32px（保持） | — |
| 阴影 | **仅浮层使用** | `StatCard` hover 有阴影 + 上浮 | 卡片全去阴影 | `components/StatCard/` |
| 分隔 | 1px 实线 `#E7E7E7` | 卡片边框 + 圆角 | 改底色差分 | 全局样式 |
| 底色 | 列表栏 `#F7F7F7` / 内容区 `#FFF` | 统一 `colorBgContainer` | 三层分层 | `theme/tokens.ts` |

### 2.1 两个关键判断

**判断一：不换品牌色（保留 `#00d68f`）。** 现品牌色与微信绿 `#07C160` 同为绿色系，色相接近，换色收益极小，但会牵动 Logo、错误态 UI、暗色 token 等多处品牌资产。

**判断二：保留 `variant: 'filled'`。** `config/config.ts` 中该配置是 antd 6 的填灰底变体，而微信 PC 的搜索框、输入框恰好就是灰底填充风格——方向一致，保留不动。

### 2.2 目标色板（新增常量，沉淀到 `theme/tokens.ts`）

| 常量 | 明色 | 暗色 | 用途 |
| --- | --- | --- | --- |
| `WECHAT_BG_LAYOUT` | `#F7F7F7` | `#191919` | 二级列表栏 / 页面底色 |
| `WECHAT_BG_CONTENT` | `#FFFFFF` | `#2E2E2E` | 内容主区 |
| `WECHAT_BG_HOVER` | `#EFEFEF` | `#3A3A3A` | 列表项 hover |
| `WECHAT_BG_SELECTED` | `#E3E3E3` | `#404040` | 列表项选中（**中性灰，非绿底**） |
| `WECHAT_DIVIDER` | `#E7E7E7` | `#262626` | 1px 分隔线 |

> 🔑 **选中态是本次改造最易被忽略、但观感差异最大的点**：微信侧栏选中项用**中性灰底 + 深色字**，绿色只留给「未读红点 / 主按钮 / 进度条」。项目现在用的是**浅绿底 + 深绿字**（见 §3.1-③）。

---

## 3. 🔧 改动分层与文件清单

严格按 **L1 → L2 → L3** 推进：L1 是全局杠杆（改 3 个文件全站见效），L2 定骨架观感，L3 才动具体页面。

| 层 | 目标 | 文件数 | 工作量 |
| --- | --- | --- | --- |
| **L1** Token | 色板 / 圆角 / 字号 / 阴影降级 | 3 | 1 天 |
| **L2** 骨架 | 全局样式治理 + ProLayout 收敛 + 移除大标题 | 4 | 2-3 天 |
| **L3** 页面 | 内容型 4 页微信化 + 管理型 11 页密度收紧 | ~20 | 4-6 天 |

### 3.1 L1 — Token 层（最高投入产出比）

**① `web/src/theme/tokens.ts`**

现状**只有暗色结构色（`DARK_LAYOUT_COLORS`），缺亮色一套**。改动：

- 新增 `LIGHT_LAYOUT_COLORS`（与暗色对称）
- 新增 §2.2 的 `WECHAT_*` 色板
- `RADIUS_CARD`：`8` → `4`；`RADIUS_PANEL`：`12` → `6`
- `DARK_LAYOUT_COLORS.siderSelectedBg`：品牌绿 → 中性灰 `#404040`（与亮色侧口径一致）

> ⚠️ 该文件**必须保持零依赖**（`config/defaultSettings.ts` 在 Node 侧直接 import 它），新增常量不得引入 antd / react。

**② `web/config/config.ts`**

`antd.configProvider.theme.token` 现只钉了 `fontFamily` + `borderRadius` 两个值，需补全：`fontSize: 13`、`controlHeight: 32`、`borderRadius: 4`、`borderRadiusLG: 6`、`boxShadow` / `boxShadowSecondary` 降级为仅浮层可用、`card.boxShadow: 'none'`。

**③ `web/config/defaultSettings.ts`**

侧栏选中态当前是**绿底 + 深绿字**（`colorBgMenuItemSelected: BRAND_PRIMARY_BG`、`colorTextMenuSelected: BRAND_PRIMARY_ACTIVE`）。改动：

- `colorBgMenuItemSelected` → `WECHAT_BG_SELECTED`（中性灰）
- `colorBgMenuItemHover` → `WECHAT_BG_HOVER`
- `colorTextMenuSelected` → `token.colorText`（深色字）
- `colorTextMenuItemHover` → 保留品牌绿（hover 用绿仍合理）
- 新增 `siderMenuType: 'sub'`

> ⚠️ 该文件被 `config/config.ts` 的 `layout` 段与 `app.tsx` 的 `getInitialState` 双消费，改动前核对取值口径一致。

### 3.2 L2 — 骨架层（保留 ProLayout）

**④ 全局样式治理（必须最先做）**

**现状：全局样式有两份，其中一份是死代码。**

| 文件 | 加载方式 | 是否生效 |
| --- | --- | --- |
| `web/src/global.less` | Umi 约定 `src/global.less` 自动引入 | ✅ **生效（唯一实际入口）** |
| `web/src/global.style.ts` | `createStyles` 导出 `useStyles`，**全仓库零引用** | ❌ **未生效（死代码）** |

且 `global.style.ts` 内有疑似笔误（如 `'ant-layout'` 缺前导点、媒体查询块内用 `&-thead` 对象键），与 `global.less` 中同名规则的**正确写法**重复。

**改动**：合并为一个入口（建议保留 `global.less`），删除死文件，再追加微信风覆盖——卡片去边框去阴影、`ProTable` 表头改灰底 `#F7F7F7` + 首行 1px 分隔、滚动条收窄、列表项 hover / 选中底色取 §2.2 常量。

> 🧹 清理 `global.style.ts` 属技术债治理，不是扩张：不做它，微信风样式将无家可归。

**⑤ `web/src/app.tsx` — ProLayout 观感收敛**

`layout()` 已绑定 `menuDataRender` / `menuItemRender` / `actionsRender` / `avatarProps` / `footerRender` / `onPageChange` / `menuHeaderRender` / `settingDrawerRender` / `token` 等钩子，方案 A **全部保留**，仅：顶栏压至 48px、标题左对齐、`actionsRender` 收敛图标数量、`token` 段接入 §2.2 常量。

**⑥ `PageContainer` 大标题治理（本层最大一块活）**

微信 PC 没有「大标题 + 面包屑」这一层。而 `PageContainer` 在 **15 个页面**使用，且有**两种写法**（`title=` / `subTitle=` 直传，与 `header={{ title, subTitle }}`）。

**推荐做法**：新增 `web/src/components/PageShell/`，内部包住 `PageContainer` 并统一 `header={false}`，对外提供微信式极简标题条（标题左对齐 + 右侧图标按钮）；随后改 15 个页面的 import 与 props。代价约 0.5-1 天，收益是此后标题区只改一处——与已有的 `SectionCard` 收口思路一致。

受影响页面：`workbench` · `messages` · `chat` · `file` · `upload` · `shares` · `approval` · `audit` · `permission-map` · `Welcome` · `system/users` · `system/roles` · `system/depts` · `system/groups` · `system/menus`

### 3.3 L3 — 页面层（分两类，不搞一刀切）

**⑦ 内容型 4 页：完整微信化（主战场）**

| 页面 | 现状 | 改造 | 现有资产 |
| --- | --- | --- | --- |
| `pages/chat/` | 已有「左会话列表 + 右气泡流」，最接近微信 | 补气泡尾巴、头像、时间分组、右键菜单 | ✅ `index.style.ts`（253 行） |
| `pages/messages/` | `ProTable` 列表 | 改微信消息流（头像 + 摘要 + 时间 + 未读点） | 需新建 style |
| `pages/file/` | 左目录树 + 右表格 | 改微信「通讯录」式两栏 | ✅ `index.style.ts` + `folder-tree.ts` |
| `pages/workbench/` | KPI 卡 + 快捷入口网格 | KPI 改平铺、去阴影 | ✅ `index.style.ts` |

> 💡 `chat/index.style.ts` 高度用 `calc(100vh - 260px)` 而非 `100%`，是为避免布局层塌陷静默。**不要改这个策略**，L2 顶栏高度变化后同步调整偏移量即可。

**⑧ 管理型 11 页：仅密度收紧**（`system/*` 5 页 · `audit` · `approval` · `shares` · `permission-map` · `upload` · `exception`）——不改结构，靠 L1 token 与 `size="small"` 自动获益。

**⑨ 收口组件样式（4 个）**

| 组件 | 改造 |
| --- | --- |
| `components/SectionCard/` | 去外边框，改微信「设置页」式标题栏 + 1px 分隔线 |
| `components/StatCard/` | 去掉 hover 上浮（`translateY(-2px)`）与 `boxShadowSecondary` |
| `components/StandardFormRow/` | 跟随 token 微调 |
| `components/PageSkeleton/` | 跟随新圆角 / 底色 |

> 📎 `SectionCard` 与 `StatCard` **未在 `components/index.ts` 统一导出**，页面按路径直接引用。改造保持现有引用方式，**不要顺手改导出结构**（会扩大影响面）。

---

## 4. 🗓️ 排期与验收点

| 阶段 | 内容 | 工作量 | 验收点 |
| --- | --- | --- | --- |
| **P0** | L1 Token 三文件 | 1 天 | 🛑 **停下截图确认**：全站变紧凑、侧栏选中态变灰底 |
| **P1** | 全局样式合并 + ProLayout 收敛 + `PageShell` 抽离（15 页 import） | 2-3 天 | 大标题消失，骨架定型 |
| **P2** | `chat` + `messages` 微信化 | 2 天 | 🛑 **停下验收样张**，确认后铺开 |
| **P3** | `file` + `workbench` | 2 天 | 4 个内容页风格齐平 |
| **P4** | 管理型 11 页收紧 + 回归 + 测试修复 | 1-2 天 | 全站统一，测试全绿 |

**合计 8-12 人天。**

> 🚩 **P0 结束**与**P2 结束**是强制停止点，不允许跳过验收直接铺开——这两处口子开错，后面 20 个文件要一起返工。

---

## 5. ✅ 验收标准

| 项 | 标准 |
| --- | --- |
| 观感 | 侧栏 / 列表栏 / 内容区三层底色差分；卡片零阴影；1px 实线分隔替代边框 + 圆角 |
| 密度 | 正文 13px；控件高 32px；`ProTable` 表头灰底 |
| 选中态 | 导航与列表选中用中性灰底 + 深色字；绿色仅用于红点 / 主按钮 / 进度条 |
| 一致性 | 色值全部取自 `theme/tokens.ts`，业务代码零散写十六进制 |
| 功能 | 15 个页面路由、权限、分页、筛选行为**完全不变** |
| 质量 | `npm test` 全绿；`npm run build` 通过 |
| 暗色 | 明暗两套观感均通过（系统偏好与手动切换各验一遍） |

---

## 6. 🚨 红线

1. **不碰 `web/src/services/**`。** 这是方案 A 的边界——若某处改动需要改 services，说明已越界成方案 B，须回到本文重新评审。
2. **不碰权限提示的语义。** 皮肤改造只动观感。错误码口径（`1003` = 无权限 / 403 / **策略 D：就地提示、禁止引导登录**；`1006` = Token 无效 / 401 / 跳登录）是已裁决契约，改提示 UI 时**不得**把「引导登录」混进 1003。
3. **不碰 `config/routes.ts`。** 路由与菜单结构不动，导航观感仅由 token 与 ProLayout 配置驱动。
4. **优先走 token，少覆盖类名。** `@ant-design/pro-components` 内部类名非稳定契约，升版即断。类名覆盖仅用于 token 覆盖不到之处，且集中在一处。
5. **对比度底线。** 13px 小字 + 灰分隔线易撞 WCAG 下限，表格正文不得低于 `#333`。微信桌面端自身对比度偏低，管理后台**不要学这一点**。

---

## 7. ⚠️ 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| 测试断言被结构变更打断 | `chat/messages.test.ts`、`file/index.test.tsx`、`file/folder-tree.test.ts`、`approval/index.test.tsx` | 改 header 与表格密度前先扫这些文件；基于 `data-testid` / `role` 的断言不受影响，基于结构与文案的会断，P4 留修复时间 |
| 观感「形似神不似」 | 骨架仍是 Pro | P2 样张强制验收；不达预期再评估局部自研壳 |
| 全局样式双入口导致改动失效 | 新样式写进死文件，白干 | L2-④ **强制先合并**再写新样式 |
| `defaultSettings.ts` 双消费方不一致 | 明暗观感错位 | 改动前核对两处取值口径 |
| `ProLayout` 内部 token 覆盖不彻底 | 个别区域仍是旧观感 | 允许少量类名覆盖，集中在一处并登记为技术债 |

---

## 8. ❓ 待决策项（阻塞开工）

| # | 决策点 | 建议 | 状态 |
| --- | --- | --- | --- |
| **D-1** | 品牌色是否换成微信绿 `#07C160`？ | **保留 `#00d68f`**（见 §2.1 判断一） | ⏳ 待确认 |
| **D-2** | 样张顺序：先验收哪个页面？ | P0 + P1 后先在 `chat` 做单页样张，确认后铺开 `messages` / `file` / `workbench` | ⏳ 待确认 |

> ✅ 两项确认后版本升至 **v1.1**，进入 P0 施工。
