# 🧱 前端微信风视觉改造方案（PC 端 · 方案 B：自研三栏壳）

| 项 | 内容 |
| --- | --- |
| 文档定位 | 前端视觉改造**备选方案**：以自研三栏壳替换 `ProLayout` 的完整评估、施工清单与风险登记 |
| 版本 / 状态 | v1.0 · 2026-09-16（备选方案，**暂不采纳**，留档备查） |
| 适用读者 | 方案评审人（§1 / §10）· 前端实现者（§3 / §4）· 项目负责人（§5 / §8） |
| 技术基线 | React 19 / Umi Max · Ant Design Pro v6（antd 6，`variant: 'filled'`）· `antd-style` CSS-in-JS |
| 改造范围 | **仅 `web/`**，但**包含 `web/config/routes.ts`**（需做导航收敛，见 §10 D-1）；后端与 `web/src/services/**` 零改动 |
| 关联文档 | [方案 A（主案）](./前端微信风视觉改造方案A.md) · [开发指南](./README.md) · [前端权限映射](./frontend-permission-map.md) · [架构落地说明](../architecture/architecture.md) |

> 🎯 **一句话**：用自研的「60px 导航条 + 列表栏 + 内容区」三栏壳替换 `ProLayout`，换取最接近微信的骨架；代价是迁移全部布局钩子、自己重建菜单 i18n 树，以及 11 个表格页在压缩后的内容区里体验退化。

> ⚠️ **本文是备选方案，当前不采纳。** 经 §1 对比评估，主案为方案 A。留档目的有二：一是方案 A 的观感验收若出现「形似神不似」（方案 A §7 风险项），可直接启用本文；二是把否决理由固化，避免后续重复论证。

> 🔗 **与方案 A 的关系**：B **不是 A 的替代品，而是 A 的超集**。B 同样需要 A 的 L1 Token 层（同一套 `WECHAT_*` 色板）与 `PageShell` 抽离，增量部分才是「换骨架」。因此 B 的增量成本约 4-8 人天，而非全部工作量——这个数字是评审时的关键口径。

---

## 1. 📌 背景与方案取舍

现有前端是标准 Ant Design Pro 管理后台形态（`defaultSettings.ts` 的 `layout: 'mix'` + 侧栏菜单 + `PageContainer` 大标题 + `ProTable`）。方案 A 通过 token 注入微信的版面语言，但保留 Pro 骨架，存在「形似神不似」的风险。方案 B 正面解决这一点：**把骨架换掉**。

### 1.1 微信 PC 骨架拆解

| 栏 | 宽度 | 底色（明亮） | 内容 |
| --- | --- | --- | --- |
| 导航条 NavRail | 60px | `#2E2E2E`（**深色，恒为深色**） | 一级图标 + 底部头像 |
| 列表栏 SessionList | 250-320px | `#F2F2F2` | 二级菜单 / 会话项 + 搜索框 |
| 内容区 Content | 自适应 | `#FFFFFF` | 业务页面 |

> 🔑 **导航条恒为深色**是本次评估中最重要的观感发现。项目当前 `navTheme` 同时决定顶栏与侧栏的明暗（见 `app.tsx` 的 `token` 段与 `isDark` 分支），而微信的导航条**不随主题变化**——暗色模式下变的是列表栏与内容区。这意味着换壳后明暗逻辑必须重构，**不能沿用现有的 `isDark` 二分**。

> 💡 这条结论**两个方案都适用**：方案 A 同样可以通过深色 sider token 拿到「深色导航条」的观感，成本几乎为零。这是本文对主案最有价值的贡献。

### 1.2 取舍对比

| 维度 | 方案 A：微信风 token + 保留 Pro 骨架 ✅ | 方案 B：自研微信三栏壳 |
| --- | --- | --- |
| 工作量 | 8-12 人天 | **12-16 人天** |
| 观感 | 微信的**版面语言** | 微信的**骨架**，最像 |
| 导航收敛 | 不需要（11 项侧栏菜单正常显示） | **必须先做**（11 图标塞不进 60px 条，见 §10 D-1） |
| 管理页体验 | 不受损 | **退化**：内容区窄 360px + 13px 小字装不下六列表格 |
| `PageShell` 抽离 | 可选优化 | **强制前置**（工作量相同，均为 15 页） |
| 菜单 i18n 重建 | 不需要（`ProLayout` 白送） | **必须自研**（核心一） |
| `services/**` 改动 | 零 | 零（同样） |
| 后续新页面成本 | 自动继承 token | 每页额外为微信风适配 |
| 主要风险 | 观感「形似神不似」 | 换壳后 ProComponents 上下文缺失，回归不可控 |

> 💡 **核心判断**：真正的微信感来自**版面语言**（灰底分层 / 1px 分隔 / 紧凑密度 / 零阴影），而非骨架本身。微信 PC 不承载表格型管理场景，硬套骨架会牺牲可用性——**换了骨架但内容区里还是六列表格，照样不像微信**。

**边界** —— 做：布局骨架替换、导航结构收敛、15 个页面的容器适配、以及方案 A 的全部 L1/L3 内容。不做：业务逻辑、接口契约、权限口径、后端任何改动。

---

## 2. 📐 微信骨架的量化口径

骨架尺寸与色板需先钉死，否则自研壳会退化成自由发挥。

### 2.1 骨架参数

| 维度 | 微信 PC | 目标取值 | 收口点 |
| --- | --- | --- | --- |
| 导航条宽 | 60px | 60px | `WeChatLayout/index.style.ts` |
| 导航项高 | 48-52px | 50px | 同上 |
| 列表栏宽 | 250-320px | 300px（可折叠至 0） | 同上 |
| 列表项高 | 56-64px | 64px | 同上 |
| 圆角 | 2-4px（近乎直角） | 4px / 6px | `theme/tokens.ts` |
| 正文号 | 13px | 13px | `config/config.ts` |
| 控件高 | 30-32px | 32px（保持） | — |
| 阴影 | **仅浮层使用** | 三栏零阴影，靠 1px 分隔 | `WeChatLayout/index.style.ts` |

### 2.2 色板（与方案 A §2.2 一致，此处仅补骨架专属项）

| 常量 | 明色 | 暗色 | 用途 |
| --- | --- | --- | --- |
| `WECHAT_NAV_BG` | `#2E2E2E` | `#1A1A1A` | **导航条底色（恒深色）** |
| `WECHAT_NAV_ITEM` | `#9A9A9A` | `#8A8A8A` | 导航项未选中图标 |
| `WECHAT_NAV_ITEM_ACTIVE` | `#FFFFFF` | `#FFFFFF` | 导航项选中图标 |
| `WECHAT_BG_LAYOUT` | `#F2F2F2` | `#191919` | 列表栏底色 |
| `WECHAT_BG_CONTENT` | `#FFFFFF` | `#2E2E2E` | 内容区 |
| `WECHAT_BG_HOVER` | `#EFEFEF` | `#3A3A3A` | 列表项 hover |
| `WECHAT_BG_SELECTED` | `#E3E3E3` | `#404040` | 列表项选中（中性灰，非绿底） |
| `WECHAT_DIVIDER` | `#E7E7E7` | `#262626` | 1px 分隔线 |

> ⚠️ `theme/tokens.ts` **必须保持零依赖**（`config/defaultSettings.ts` 在 Node 侧直接 import），新增常量不得引入 antd / react。

> ⚠️ 注意 B 与 A 的底色口径不同：微信 PC 的**列表栏**（`#F2F2F2`）比**页面底色**（`#F7F7F7`）更深一档。若两方案合并推进，需按「列表栏 / 页面底」两个语义拆成两个常量，不要共用 `WECHAT_BG_LAYOUT`。

---

## 3. 🔧 技术核心：四个必须解决的问题

### 3.1 核心一 — 菜单树重建（最硬的一块）

现有 `menuDataRender` 有两条分支：

```ts
// web/src/app.tsx
menuDataRender: (menuData) => {
  const dynamic = toProMenuItems(
    filterMenuByPerm(toMenuData(buildMenuTree(initialState?.menus)), permSet),
  );
  if (dynamic.length > 0) {
    return dynamic;
  }
  return filterProMenuByPerm(menuData, permSet);  // ← 兜底分支
},
```

后端动态菜单（`initialState.menus`）在 D-9 未落地时恒为 `[]`，因此**当前实际生效的是兜底分支**。而兜底分支的入参 `menuData` 由 `ProLayout` 注入，是 Umi 插件已处理好 i18n 与 icon 的树——**自研壳拿不到这个注入**。

这正是 `menu-render.tsx` 注释里的前提：

```ts
// web/src/services/access/menu-render.tsx
 * 静态路由兜底：filterProMenuByPerm —— 直接对 ProLayout 传进来的菜单树
 *   按 resolveRoutePerm 过滤，**保留原对象**
 *   （name/icon/i18n 都是 Umi 处理好的，重建会丢本地化）。
```

自研壳必须自己重建这棵树：

```
config/routes.ts
  → 递归取带 name 的节点
  → name 过 useIntl().formatMessage({ id: `menu.${name}` })
  → icon 过 services/access/menu-icon.tsx 的 menuIconOf()
  → 得到与 ProMenuLike 同构的树
  → 交给 filterProMenuByPerm() 过滤（原样复用）
```

> ✅ **好消息**：`filterProMenuByPerm` / `resolveRoutePerm` / `menuIconOf` / `buildMenuTree` 等**全部可原样复用**，`services/access/**` 零改动。
> ⚠️ **成本所在**：把 Umi 插件内部的「路由树 → i18n 菜单」这段活重做一遍，是本方案最大的隐性工作量，也是相对方案 A 的**净新增**复杂度。

### 3.2 核心二 — 布局钩子迁移

`app.tsx` 的 `layout()` 中共 12 项配置，每项都要有明确归宿，**不允许「顺手留着」**：

| 钩子 | 现状 | 方案 B 归宿 |
| --- | --- | --- |
| `menuDataRender` | 动态菜单优先 + 静态路由兜底 | **自研** `useMenuTree()`（核心一），复用 `filterProMenuByPerm` |
| `menuItemRender` | `<Link>` 包装 | 自研壳 NavRail 内联 `<Link>` |
| `actionsRender` | 5 个组件并列 | 迁到自研壳顶栏，**收敛为 2-3 个**（微信式顶栏放不下 5 个独立图标） |
| `avatarProps` | `AvatarDropdown` | 迁到导航条底部（微信位置） |
| `footerRender` | `<Footer />` | **废弃**（微信无页脚），`components/Footer` 转为「关于」弹层 |
| `onPageChange` | 未登录跳登录 | **迁到自研壳** `useEffect(location)` —— 🔴 **此逻辑不可丢**，是唯一的客户端登录兜底 |
| `links` | dev 态 OpenAPI 入口 | 废弃，或挪进设置菜单 |
| `ErrorBoundary` | 离线感知版 | 保留（注意 `rootContainer` 内已有同款包裹，可去重） |
| `menuHeaderRender` | `undefined` | **废弃**（`ProLayout` 专属） |
| `settingDrawerRender` | dev 态 `SettingDrawer` | **需决策**：废弃后 `persistThemePreference` 失去唯一触发点，须另做明暗切换按钮（见 §10 D-2） |
| `token`（明暗结构色） | `header` / `sider` 两段 | 改写成自研壳的 CSS 变量，**明暗二分逻辑重构**（导航条恒深色） |
| `...initialState?.settings` | 展开 | 仅保留 `navTheme` / `colorPrimary`，其余失效 |

`config/defaultSettings.ts` 的字段存活情况：

| 字段 | B 下是否有效 |
| --- | --- |
| `navTheme` | ✅ 保留（只决定列表栏与内容区明暗） |
| `colorPrimary` | ✅ 保留 |
| `logo` / `title` | ✅ 迁到导航条顶部 |
| `layout: 'mix'` | ❌ 失效 |
| `contentWidth: 'Fluid'` | ❌ 失效 |
| `fixedHeader: true` | ❌ 失效（自研壳自行控制 sticky） |
| `fixSiderbar: true` | ❌ 失效 |
| `token.sider.*` | ❌ 失效（`ProLayout` 专属 token） |

> 🧹 `defaultSettings.ts` 被 `config/config.ts` 的 `layout` 段与 `app.tsx` 的 `getInitialState` **双消费**，清理失效字段时两处都要核对。

### 3.3 核心三 — 15 个页面的容器适配（B 中是强制项）

`PageContainer` 原本依赖 `ProLayout` 提供的 context：面包屑数据源、`ghost` 背景、`header` 的 sticky 定位。脱离 `ProLayout` 后会「裸奔」。

因此方案 A 中的 `PageShell` 抽离（15 个页面），**在 A 里是可选优化，在 B 里是前置必需**——工作量两者相同，B 并不因此省事。

受影响页面：`workbench` · `messages` · `chat` · `file` · `upload` · `shares` · `approval` · `audit` · `permission-map` · `Welcome` · `system/users` · `system/roles` · `system/depts` · `system/groups` · `system/menus`

### 3.4 核心四 — 表格密度冲突（B 的固有代价，无解）

三栏吃掉 `60 + 300 = 360px` 后，11 个表格页的内容区宽度骤减；叠加 13px 小字与紧凑行高，「用户名 / 角色 / 部门 / 状态 / 创建时间 / 操作」这六列**必然横向滚动**。

唯一缓解手段是让列表栏可折叠，但折叠后就不是微信了。**这是 B 无法绕过的取舍，也是主案选择 A 的主要理由。**

---

## 4. 🗂️ 改动分层与文件清单

推进顺序与方案 A 一致（L1 → L2 → L3），但 **L2 被替换为「自研壳」**：

| 层 | 目标 | 文件数 | 工作量 |
| --- | --- | --- | --- |
| **L1** Token | 色板 / 圆角 / 字号（**与方案 A 完全相同**） | 3 | 1 天 |
| **L2** 骨架 | **自研三栏壳 + 12 钩子迁移 + 菜单树重建** | 5 | 5-8 天 |
| **L3** 页面 | `PageShell` 适配 15 页 + 内容型 4 页微信化 | ~19 | 4-6 天 |

### 4.1 新建（6 个）

| 文件 | 职责 |
| --- | --- |
| `web/src/layouts/WeChatLayout/index.tsx` | 三栏壳主体，接管 children 渲染 |
| `web/src/layouts/WeChatLayout/NavRail.tsx` | 60px 导航条：一级图标 + 底部头像 |
| `web/src/layouts/WeChatLayout/SessionList.tsx` | 列表栏：二级菜单 / 会话项 + 搜索 |
| `web/src/layouts/WeChatLayout/index.style.ts` | 三栏尺寸、色板、分隔与零阴影 |
| `web/src/layouts/WeChatLayout/useMenuTree.ts` | 路由树 → i18n 菜单（§3.1 核心一） |
| `web/src/components/PageShell/` | 15 页容器适配（与方案 A §3.2-⑥ 同一产物，两方案共用） |

### 4.2 改动

| 文件 / 范围 | 改动 | 工作量 |
| --- | --- | --- |
| `web/src/app.tsx` | 12 项钩子迁移 / 废弃（§3.2） | **大** |
| `web/config/routes.ts` | 导航口径收敛（§10 D-1） | 小，但**阻塞** |
| `web/config/defaultSettings.ts` | 清理 ProLayout 专属字段 | 小 |
| `web/config/config.ts` | `layout` 段失效，需收敛 | 小 |
| `web/src/global.less` | 第 60-66 行 `.ant-pro-sider*` 两条规则换壳后失效，需替换为自研壳选择器 | 小 |
| 15 个页面 | `PageContainer` → `PageShell` | 2-3 天 |
| 4 个内容页 | `chat` / `messages` / `file` / `workbench`（与方案 A §3.3-⑦ 同一产物） | 4 天 |

### 4.3 零改动

`web/src/services/**`（全部）· `web/src/theme/tokens.ts` 的**既有导出**（仅新增常量）· `web/src/components/**`（除 `PageShell` 新建）· 后端 · `sql/` · 权限契约

> 📎 `SectionCard` / `StatCard` / `PermissionGuard` 等**未在 `components/index.ts` 统一导出**，页面按路径直接引用。改造保持现有引用方式，**不要顺手改导出结构**（会扩大影响面）。

---

## 5. 🗓️ 排期与验收点

| 阶段 | 内容 | 工作量 | 验收点 |
| --- | --- | --- | --- |
| **B0** | 骨架样张（导航条 + 列表栏 + 单个静态页面，**不接真实路由**） | 2 天 | 🛑 **强制停止点**：验证 `ProComponents` 在脱离 `ProLayout` 后无未知依赖 |
| **B1** | 菜单树重建（§3.1）+ 12 钩子迁移 | 3-4 天 | 导航可点、权限过滤正确、未登录跳转生效 |
| **B2** | `PageShell` 抽离 + 15 页 import 切换 | 2-3 天 | 大标题消失，页面不塌陷 |
| **B3** | 视觉收尾（微信色板 / 密度 / 零阴影 / 导航条深色） | 2-3 天 | 🛑 **停下验收样张**，确认后再推进 |
| **B4** | 4 内容页微信化 + 回归 + 测试修复 | 3-4 天 | 全站统一，`npm test` 全绿 |

**合计 12-16 人天。**

> 🚩 **B0 与 B3 是强制停止点**。B0 的样张必须真机跑通——这是全案风险最高的一步，`ProLayout` 移除后可能有预料不到的 `ProComponents` 上下文依赖（`PageContainer` / `ProTable` 的 sticky、`ProForm` 的 `LayoutContext`），**若 B0 受阻则应立即回退到方案 A**。

---

## 6. ✅ 验收标准

| 项 | 标准 |
| --- | --- |
| 骨架 | 三栏结构成立；导航条 60px 且**恒为深色**（明暗模式下均不变）；列表栏可折叠 |
| 观感 | 三栏底色分层（`#2E2E2E` / `#F2F2F2` / `#FFF`）；三栏零阴影；1px 实线分隔 |
| 密度 | 正文 13px；控件高 32px；`ProTable` 表头灰底 |
| 选中态 | 导航项用**白色图标 + 深色底**；列表项用中性灰底 + 深色字；绿色仅用于红点 / 主按钮 / 进度条 |
| 一致性 | 色值全部取自 `theme/tokens.ts`，业务代码零散写十六进制 |
| 功能 | 15 个页面路由、权限、分页、筛选行为**完全不变**；`onPageChange` 的未登录跳转生效 |
| 质量 | `npm test` 全绿；`npm run build` 通过 |
| 暗色 | 明暗两套观感均通过（导航条不变，列表栏与内容区切换） |

---

## 7. 🚨 红线

1. **不碰 `web/src/services/**`。** 与方案 A 同一红线。菜单过滤逻辑一律复用 `filterProMenuByPerm` / `resolveRoutePerm`，若某处需要改 services，说明设计已走偏。
2. **不碰权限提示的语义。** 错误码口径（`1003` = 无权限 / 403 / **策略 D：就地提示、禁止引导登录**；`1006` = Token 无效 / 401 / 跳登录）是已裁决契约，**换导航、换跳转入口时不得把「引导登录」混进 1003**。
3. **`onPageChange` 的登录兜底逻辑必须等价迁移。** 它是自研壳里最容易被漏掉的一处——`ProLayout` 走了，重定向逻辑得自己接。漏掉会导致未登录用户看到空壳。
4. **优先走 token，少覆盖类名。** `@ant-design/pro-components` 内部类名非稳定契约，升版即断。自研壳只负责**自己的**选择器，不得反向覆盖 Pro 组件内部结构。
5. **对比度底线。** 13px 小字 + 深色导航条易撞 WCAG 下限，列表栏正文不得低于 `#333`。微信桌面端自身对比度偏低，管理后台**不要学这一点**。
6. **B0 样张未通过则不得继续 B1。** 见 §5 的强制停止点。

---

## 8. ⚠️ 风险与对策

### 8.1 风险表

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| **移除 `ProLayout` 后 ProComponents 上下文缺失** | `PageContainer` 面包屑、`ProTable` sticky、`ProForm` 布局可能出现未知异常 | 🛑 **B0 样张强制先验**；受阻立即回退方案 A |
| **菜单 i18n 重建丢本地化** | 菜单显示为原始 key（如 `menu.workbench`）而非「工作台」 | B1 阶段对**全部 11 个一级菜单 + 5 个二级菜单**逐项核对中英文 |
| 导航口径未定（§10 D-1） | 11 个图标塞不进 60px 条，导航条溢出 | **开工前必须裁决**，属阻塞项 |
| 表格页横向滚动引发返工 | 11 页需重新调整列宽 / 隐藏次要列 | 产品侧先确认可接受；否则回到方案 A |
| `settingDrawer` 废弃后明暗无法切换 | 用户无法手动切主题，暗色模式形同虚设 | 在导航条底部补明暗切换按钮（§10 D-2） |
| 自研壳与 `global.less` 旧规则冲突 | `.ant-pro-sider*` 残留样式污染新壳 | L2 阶段同步清理 `global.less` 第 60-66 行 |
| 全局样式双入口导致改动失效 | 新样式写进死文件，白干 | 与方案 A 同款治理：**强制先合并** `global.style.ts`（当前为死代码，且键名有笔误）再写新样式 |

### 8.2 测试影响面

前端共 **22 个测试文件**（5 个 `.test.tsx` + 17 个 `.test.ts`，为**本方案撰写时**的规模；2026-09-29 已增至
**73 个 / 828 例**，见本节末批注），绝大部分是纯数据层：

| 文件 | 是否受影响 |
| --- | --- |
| `app.test.tsx` | 🔴 **必然大改**（断言布局渲染与钩子） |
| `pages/approval/index.test.tsx` · `pages/file/index.test.tsx` | 🟡 若断言了 `PageContainer` header 则需改 |
| `pages/user/login/login.test.tsx` | 🟢 不受影响（`layout: false`） |
| 其余 19 个（`services/**` 12 个 + `utils/` · `hooks/` + 2 个页面纯函数测试 + 2 个根级测试） | 🟢 纯数据逻辑，不受影响 |

> 📎 结论：测试影响集中在 **1-3 个文件**，不是主要风险。真正的风险在 §8.1 首两项。

> 🕒 **2026-09-29 刷新**：前端测试规模已增至 **73 个测试文件 / 828 用例**（本方案撰写时为 22 个文件）；
> 上表「受影响文件」判定**仍然成立**——新增测试集中在 `chat` / `notify` 的数据层与组件（`@` 提及、取件回执文案），
> 与三栏壳改版无耦合。

---

## 9. ❓ 待决策项（阻塞开工）

| # | 决策点 | 建议 | 状态 |
| --- | --- | --- | --- |
| **D-1** | **导航口径**：`routes.ts` 注释称 `/welcome` 与 `/upload`「刻意不给 `name`」，但代码中两者**均有 `name`**，导致带 `name` 的一级路由实为 **11 个**而非注释所述 9 个。图标条如何收敛？ | 三选一：**① 按注释原意剔除这两个 `name`**（回归注释意图，得 9 项）；**② 将 `system` 整体降级为底部「设置」区**（11 → 10 项，且与微信一致）；③ 导航条可滚动（体验最差）。**推荐 ① + ②** | 🛑 **阻塞** |
| **D-2** | `SettingDrawer` 是否保留？废弃后明暗切换入口放在哪？ | 微信风不需要换肤抽屉，**建议废弃**，在导航条底部补一个明暗切换按钮承接 `persistThemePreference` | ⏳ 待确认 |
| **D-3** | 是否真的要启动 B？ | 建议**先走方案 A**；仅当 A 的 P2 样张验收不达预期时再启用本文（见 §10） | ⏳ 待确认 |

> ⚠️ **D-1 必须先解决**：它是 B 与 A 的**结构性差异**——方案 A 不需要导航收敛（11 项在侧栏菜单里正常显示），B 不收敛就无法开工。这也从侧面说明：**导航口径本身尚未定死**，此时换骨架风险偏高。

---

## 10. 🧭 结论与启用条件

### 10.1 结论

**当前不采纳方案 B，主案维持方案 A。**

核心理由：B 多出的 4-8 人天全部花在「换骨架」本身，而非「更像微信」——因为真正的微信感来自版面语言。**换了骨架但内容区里还是 13px 小字 + 六列表格，照样不像微信**，却付出了管理页体验退化与菜单 i18n 重建的代价。

### 10.2 启用条件（三条需同时满足）

1. 方案 A 的 P2 样张验收不达预期，且确认「形似神不似」**无法**通过 token 收敛解决；
2. 产品侧**书面接受** 11 个表格页的横向滚动（或愿意同步精简表格列）；
3. 排期有 **4-8 人天**的增量预算，且 §9 D-1 已裁决。

### 10.3 无论是否启用，本文有两条结论应回灌方案 A

| # | 结论 | 回灌动作 |
| --- | --- | --- |
| **①** | **导航条恒为深色**（`#2E2E2E`），不随 `navTheme` 变化 | 方案 A 的侧栏可改为深色 token，零成本拿到最显著的微信骨架观感 |
| **②** | 列表栏底色（`#F2F2F2`）比页面底色（`#F7F7F7`）**深一档** | 方案 A §2.2 的 `WECHAT_BG_LAYOUT` 应拆为「列表栏 / 页面底」两个语义常量 |

> ✅ 这两条是本次评估的净收益：**即使不采纳骨架方案，骨架研究也反哺了主案。**

---

## 附：本文与方案 A 的章节对照

| 方案 A 章节 | 本文对应 | 关系 |
| --- | --- | --- |
| §1 背景与方案取舍 | §1 | 同一组对比表，视角互补 |
| §2 「像微信」的量化口径 | §2 | 色板一致，B 增补骨架参数 |
| §3 改动分层与文件清单 | §3 + §4 | A 的 L2 是「收敛」，B 的 L2 是「替换」 |
| §4 排期与验收点 | §5 | B 多 B0 样张停止点 |
| §5 验收标准 | §6 | B 增「导航条恒深色」一条 |
| §6 红线 | §7 | B 增「登录兜底等价迁移」一条 |
| §7 风险与对策 | §8 | B 增「ProComponents 上下文缺失」为首要风险 |
| §8 待决策项 | §9 | B 的 D-1 是 A 不存在的阻塞项 |
