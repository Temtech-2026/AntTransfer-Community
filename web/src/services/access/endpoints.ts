/**
 * 权限域端点常量（唯一改动点：新增 / 调整接口只改这里）。
 *
 * <p>与后端 {@code at-permission} 的 {@code @RequestMapping("/api/v1/...")} 逐字符对齐。
 */

export const ACCESS_ENDPOINTS = {
  /**
   * 当前用户权限快照：{@code Result<{roles, permCodes, dataScope}>}。
   *
   * <p>与后端 `PermissionController#myPermissions` 对应，<b>已实现</b>。
   */
  myPermission: '/api/v1/permission/my',

  /**
   * 当前用户可见菜单树：{@code Result<MenuNode[]>}。
   *
   * <p>对应 architecture.md §4 的 D-9 延期登记项，后端<b>尚未实现</b>；
   * 未就绪时前端自动回退为「静态路由菜单 + perm_code 过滤」，见 app.tsx menuDataRender。
   */
  myMenus: '/api/v1/permission/menus',

  /**
   * 权限地图：当前用户的「授权来源 + 有效期」。
   *
   * <p>对应后端 `PermissionController#myPermissionMap`，**已实现**。返回
   * {@code Result<PermissionMapView>}：
   * <pre>{@code
   * {
   *   userId, roleCodes: string[], permCodes: string[], dataScope: string,
   *   approvalGrants: [{ grantId, grantType, resourceType, resourceId, expireAt, applicationId }]
   * }
   * }</pre>
   *
   * <p>注意：`permCodes` 只给「有哪些权限点」，**不区分来源**（角色 vs 审批授权）；
   * 逐点来源只能由 `roleCodes` 与 `approvalGrants` 两条线分别呈现。
   */
  permissionMap: '/api/v1/permission/map',
} as const;
