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
| 文件列表 `/file` | 删除并销毁（回收站之上） | `file:destroy` | **仅 SUPER_ADMIN**（`sql/V8__restrict_file_destroy_to_super_admin.sql` 已从 DEPT_ADMIN 回收该点；高敏感 `level>=3` 文件还须关联一张已通过的高敏感审批单，`level` 由文件详情给出） |
| 文件列表 `/file` | 标签 CRUD / 打标 | `file:preview`（读）/ `file:edit`（写） | 全部业务角色（不另立 `tag:*` 权限点） |
| 文件列表 `/file` | 批量打包下载 | `file:download` | 全部业务角色 |
| 审计日志 `/audit` | 页面可见 + 查询 / 导出 | `audit:log:read` | 仅 SUPER_ADMIN / AUDITOR |
| （不存在）日志清除 | 任何入口都**不渲染** | 后端从不签发 `audit:log:clear` | 任何角色（含 SUPER_ADMIN）都无 |
| 系统管理 `/system/users` | 页面可见（菜单） | `system:user:list` | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 新建用户 | `system:user:create` | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 编辑资料 / 调岗 | `system:user:update` | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 启用 / 停用 | `system:user:status` | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 重置口令 | `system:user:reset-password` | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 分配角色 | `system:user:assign-role` | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 删除用户 | `system:user:delete` | 仅 SUPER_ADMIN |
| 系统管理 `/system/roles` | 页面可见（菜单） | `system:role:list` | 仅 SUPER_ADMIN |
| 系统管理 `/system/roles` | 新建角色 | `system:role:create` | 仅 SUPER_ADMIN |
| 系统管理 `/system/roles` | 编辑角色 | `system:role:update` | 仅 SUPER_ADMIN |
| 系统管理 `/system/roles` | 删除角色 | `system:role:delete` | 仅 SUPER_ADMIN |
| 系统管理 `/system/roles` | 分配权限点 | `system:role:assign-perm` | 仅 SUPER_ADMIN |

> 🔐 **系统管理面四条红线的前端职责**：后端已强制（`RoleAdminService` / `UserAdminService`），前端**只需如实呈现**，不要「猜」：
> ① 内置角色（`SUPER_ADMIN` / `AUDITOR` / `DEPT_ADMIN` / `USER`）禁用删除入口与数据范围选择器（`1020`）；
> ② `AUDITOR` 的授权弹窗置为只读——**不要硬编码角色码**，读接口下发的 `auditorLocked` 标记（`1021`）；
> ③ 数据范围非「全部」时，角色数据范围下拉**只列 ≤ 自身**的选项、权限点树**置灰自身没有的点**（`1027`）——
> 这只是少挨一次 403 的体验优化，**安全由后端兜底**；
> ④ 对自己隐藏停用 / 删除 / 重置口令 / 改角色四个按钮（`1023`），违背后端必拒。
>
> 🔁 **调岗 / 离职的交互提示**：改部门（调岗）或停用（离职）会**回收该用户全部审批类授权并吊销在途会话**，
> 属不可逆副作用，前端须二次确认并明示后果（不要只写「确定保存吗」）。
>
> ❗ `1020` / `1021` / `1023` / `1024` / `1027` 均为**策略 D**：就地提示，**禁止引导重新登录**。

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

- 权限点全量枚举：`sql/V2__init_data.sql`（sys_permission，type=2 为操作点）
  + `sql/V9__system_admin_permission_points.sql`（系统管理面 `system:user:*` / `system:role:*`，**仅授 SUPER_ADMIN**）；
- 判定注解：`server/at-permission` 的 `@RequiresPerm`（服务端强制，前端显隐仅是体验层）；
- 数据范围收敛（能管到哪些部门）由 `AccessControlService` 在服务端按 `dataScope` 落地，
  前端**不要自己拼部门查询条件**；
- 用户管理端点在 `at-permission` 的 `/api/v1/system/users`（**不是** at-auth 的 `/api/v1/users`，
  后者是个人中心自助，见 [api/README.md §1](../api/README.md)）。
