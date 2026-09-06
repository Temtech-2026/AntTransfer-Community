# 🗺️ 前端路由 / 按钮 ↔ perm_code 映射（Phase 5 使用）

> 本文档是 Phase 5 前端接入 RBAC 的**单一事实源**：前端每个受保护的路由与按钮
> 必须且只能对应一个后端 perm_code，判定口径以 `GET /api/v1/permission/my`
> 返回的 `permCodes` 并集为准（登录后拉取一次 + 变更后重新拉取）。
> 后端实现：`@RequiresPerm` 注解（`server/at-permission`），前端**不得**在前端
> 硬编码角色判断，只映射 perm_code——角色只是聚合单位，可随时换绑。

## 约定

| 项 | 约定 |
| --- | --- |
| 请求 | 登录成功即调 `GET /api/v1/permission/my`，得到 `{ roles: string[], permCodes: string[], dataScope: 1\|2\|3 }` |
| 路由守卫 | 路由 meta 声明 `perm: 'file:download'`；无权限跳 403 页（不回登录页，策略 D） |
| 按钮显隐 | 统一 `usePerm('file:download')` hook；**只藏不决定安全**，后端仍强制校验 |
| 命名 | 与后端 `perm_code` **逐字符一致**，禁止前端另起一套 |
| Deny | 后端 `permCodes` 已剔除显式 Deny 项，前端无需感知 Deny 逻辑 |
| 数据范围 | 列表页请求携带查询范围；后端按 `dataScope` 收敛结果（前端不用自己拼部门条件） |

## 映射表

| 菜单 / 路由 | 页面元素（按钮） | perm_code | 角色现状（V2） |
| --- | --- | --- | --- |
| 文件列表 `/file` | 页面可见（菜单） | —（type=1 菜单，随子项） | SUPER_ADMIN / DEPT_ADMIN / USER |
| 文件列表 `/file` | 下载 | `file:download` | 全部业务角色 |
| 文件列表 `/file` | 上传 / 秒传 | `file:upload` | 全部业务角色 |
| 文件列表 `/file` | 预览 | `file:preview` | 全部业务角色 |
| 文件列表 `/file` | 编辑 / 重命名 / 移动 | `file:edit` | 全部业务角色 |
| 文件列表 `/file` | 历史版本 / 回滚 | `file:version` | 全部业务角色 |
| 文件列表 `/file` | 创建外发链接 | `file:share` | 全部业务角色 |
| 文件列表 `/file` | 删除并销毁（回收站之上） | `file:destroy` | 仅 SUPER_ADMIN / DEPT_ADMIN（USER 不授予） |
| 审计日志 `/audit` | 页面可见 + 查询 / 导出 | `audit:log:read` | 仅 SUPER_ADMIN / AUDITOR |
| （不存在）日志清除 | 任何入口都**不渲染** | 后端从不签发 `audit:log:clear` | 任何角色（含 SUPER_ADMIN）都无 |

## 前端使用示例（伪代码，Phase 5 实现时按实际脚手架落位）

```ts
// usePerm hook 语义
const canDownload = usePerm('file:download');

// 路由 meta
{ path: '/file', perm: 'file:download' }

// 守卫
if (!hasPerm(route.perm)) redirect('/403');
```

## 后端对照

- 权限点全量枚举：`sql/V2__init_data.sql`（sys_permission，type=2 为操作点）；
- 判定注解：`server/at-permission` 的 `@RequiresPerm`（服务端强制，前端显隐仅是体验层）。
