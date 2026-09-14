/**
 * 文件域端点集中定义。
 *
 * <p>路径里带上 `/api` 前缀：与 `services/upload`、`services/access` 保持一致，
 * 联调时由 `config/proxy.ts` 把 `/api` 转发到 at-bootstrap。</p>
 */

/** 文件条目相关端点。 */
export const FILE_ENDPOINTS = {
  /** 分页列表（支持 keyword / ext / level / 时间区间 / 排序） */
  page: '/api/v1/files',
  detail: (nodeId: number | string) => `/api/v1/files/${nodeId}`,
  /** 预览元信息（服务端下发策略，需 file:preview） */
  preview: (nodeId: number | string) => `/api/v1/files/${nodeId}/preview`,
  /** 换下载票据（需 file:download；票据一次性、绑定单文件） */
  issueTicket: (nodeId: number | string) => `/api/v1/files/${nodeId}/ticket`,
  /** 取件地址（免登录，凭票据；走 downloadUrl 即可） */
  content: (nodeId: number | string) => `/api/v1/files/${nodeId}/content`,
  /** 缩略图（免登录，凭票据） */
  thumbnail: (nodeId: number | string) => `/api/v1/files/${nodeId}/thumbnail`,
  /** 回收站分页（需 file:preview）。注意路径是 `/recycle`，与 `detail` 同级，别被 `{nodeId}` 吃掉 */
  recycle: '/api/v1/files/recycle',
  /** 移入回收站（需 file:edit）——DELETE 语义是「移入回收站」而不是物理删除 */
  remove: (nodeId: number | string) => `/api/v1/files/${nodeId}`,
  /** 批量移入回收站（需 file:edit） */
  batchRecycle: '/api/v1/files/batch/recycle',
  /** 从回收站还原（需 file:edit） */
  restore: (nodeId: number | string) => `/api/v1/files/${nodeId}/restore`,
  /** 彻底销毁（需 file:destroy，不可撤销） */
  destroy: (nodeId: number | string) => `/api/v1/files/${nodeId}/destroy`,
  /** 清空回收站（需 file:destroy，不可撤销） */
  emptyRecycle: '/api/v1/files/recycle/empty',
} as const;

/** 目录端点。 */
export const FOLDER_ENDPOINTS = {
  /** 当前用户的目录树（children 递归嵌套） */
  tree: '/api/v1/folders/tree',
} as const;

/** 外发分享端点（创建者侧，需 file:share）。 */
export const SHARE_ENDPOINTS = {
  create: '/api/v1/shares',
  mine: '/api/v1/shares/mine',
  detail: (token: string) => `/api/v1/shares/${encodeURIComponent(token)}`,
  revoke: (token: string) => `/api/v1/shares/${encodeURIComponent(token)}`,
} as const;

/** 权限申请 / 审批端点。 */
export const PERMISSION_APP_ENDPOINTS = {
  create: '/api/v1/permission/applications',
  mine: '/api/v1/permission/applications/mine',
  pending: '/api/v1/permission/applications/pending',
  approve: (id: number | string) => `/api/v1/permission/applications/${id}/approve`,
  reject: (id: number | string) => `/api/v1/permission/applications/${id}/reject`,
  transfer: (id: number | string) => `/api/v1/permission/applications/${id}/transfer`,
} as const;

/** 外发访问的访客侧路径前缀（免登录页面，供拼装分享链接）。 */
export const SHARE_VISIT_PATH = '/share';
