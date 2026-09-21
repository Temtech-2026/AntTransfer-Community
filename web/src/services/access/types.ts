/**
 * 权限域类型定义（前端镜像后端契约，字段逐字符对齐，禁止另起一套命名）。
 *
 * <p>契约来源：
 * <ul>
 *   <li>{@code GET /api/v1/permission/my} → {@link MyPermission}
 *       （后端 {@code PermissionView} record，已实现）。</li>
 *   <li>{@code GET /api/v1/permission/menus} → {@link MenuNode}
 *       （D-9 延期登记项，后端 <b>尚未实现</b>；字段按 {@code sys_permission} 的
 *       V4 菜单元数据列 route_path / component / icon / visible / sort_no 预定义）。</li>
 * </ul>
 */

/**
 * 数据范围（与 {@code sys_role.data_scope} 逐值对齐）。
 *
 * <p><b>取值口径来自后端</b>（{@code sql/V1__schema.sql} 列注释、
 * {@code SysRole#dataScope}、{@code AccessControlService.SCOPE_*}）：
 * 1=本人 / 2=本部门及以下 / 3=全部。注意「1 最小、3 最大」——
 * 不要按「1 最大」的直觉赋值，否则 {@code >=} 比较会静默反向。</p>
 */
export const DataScope = {
  /** 仅本人（最保守；接口失败 / 缺省时的兜底）。 */
  SELF: 1,
  /** 本部门及以下。 */
  DEPT_AND_SUB: 2,
  /** 全部数据。 */
  ALL: 3,
} as const;

/** 数据范围取值。 */
export type DataScopeValue = (typeof DataScope)[keyof typeof DataScope];

/**
 * 当前用户权限快照（`/api/v1/permission/my` 的 data）。
 *
 * <p>{@link MyPermission.permCodes} 已由后端剔除显式 Deny 项，前端<b>不需要</b>感知 Deny 逻辑。
 */
export interface MyPermission {
  /** 角色编码（不含 ROLE_ 前缀，如 SUPER_ADMIN / AUDITOR）。 */
  roles: string[];
  /** 放行权限点并集（type=1 菜单 + type=2 操作点混排）。 */
  permCodes: string[];
  /** 数据范围：1 仅本人 / 2 本部门及以下 / 3 全部。 */
  dataScope: number;
}

/** 权限点维度（与 {@code sys_permission.type} 对齐）。 */
export const MenuNodeType = {
  /** 菜单（参与菜单树渲染）。 */
  MENU: 1,
  /** 操作点 / 按钮（只用于判定，不进菜单树）。 */
  ACTION: 2,
  /** 数据范围维度。 */
  DATA_SCOPE: 3,
} as const;

/**
 * 菜单节点（`/api/v1/permission/menus` 的 data 元素）。
 *
 * <p>后端可能下发<b>扁平列表</b>（含 parentId，便于前端按 permissions 树过滤后重组）或<b>已组装好的树</b>，
 * {@link import('./menu').buildMenuTree} 两种都能吃。
 */
export interface MenuNode {
  /** 权限点 ID（sys_permission.id）；19 位雪花 ID，服务端以字符串下发。 */
  id: string;
  /** 父权限点 ID，0 表示根（字符串 '0'）。 */
  parentId: string;
  /** 权限点编码，如 file / system:user:list。 */
  permCode: string;
  /** 权限点名称（后端下发，CE 目前直接展示中文名）。 */
  permName: string;
  /** 维度：1 菜单 / 2 操作点 / 3 数据范围。 */
  type: number;
  /** 前端路由路径（仅 type=1 菜单有值），如 /file。 */
  routePath?: string | null;
  /** 前端组件路径（预留，CE 走静态路由时不用）。 */
  component?: string | null;
  /** 图标键（前端 menu-icon 注册表映射为图标组件，不做字符串直出）。 */
  icon?: string | null;
  /** 是否在菜单显示：0 隐藏 / 1 显示；null 视为显示（V4 列未回填时的兼容口径）。 */
  visible?: number | null;
  /** 同级排序号。 */
  sortNo?: number | null;
  /** 子节点（后端已组装树时存在）。 */
  children?: MenuNode[] | null;
}

/**
 * 渲染层菜单节点（与 ProLayout 的 MenuDataItem 结构兼容）。
 *
 * <p>{@link MenuDataNode.iconKey} 是图标<b>键</b>而非 ReactNode：本类型保持纯数据，
 * 便于单测；由 UI 层（menu-icon.tsx）在渲染时映射成图标组件。
 */
export interface MenuDataNode {
  /** 路由路径（同时作为菜单 key）。 */
  path: string;
  /** 菜单名（后端 permName）。 */
  name: string;
  /** 图标键。 */
  iconKey?: string;
  /** 该菜单可见所需的权限点（无则视为纯容器，跟随子项）。 */
  perm?: string;
  /** 子菜单。 */
  children?: MenuDataNode[];
}
