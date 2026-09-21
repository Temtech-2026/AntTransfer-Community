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
  /** 换下载票据（需 file:download；票据绑定 userId + nodeId，在 TTL 内可重复取件，非一次即焚） */
  issueTicket: (nodeId: number | string) => `/api/v1/files/${nodeId}/ticket`,
  /** 取件地址（免登录，凭票据；走 downloadUrl 即可。支持 Range 续传：单段 206 / 起点越界 416） */
  content: (nodeId: number | string) => `/api/v1/files/${nodeId}/content`,
  /** 缩略图（免登录，凭票据） */
  thumbnail: (nodeId: number | string) => `/api/v1/files/${nodeId}/thumbnail`,
  /** 回收站分页（需 file:preview）。注意路径是 `/recycle`，与 `detail` 同级，别被 `{nodeId}` 吃掉 */
  recycle: '/api/v1/files/recycle',
  /** 移入回收站（需 file:edit）——DELETE 语义是「移入回收站」而不是物理删除 */
  remove: (nodeId: number | string) => `/api/v1/files/${nodeId}`,
  /** 批量移入回收站（需 file:edit，单次上限 200） */
  batchRecycle: '/api/v1/files/batch/recycle',
  /** 移动条目到目标父目录（需 file:edit；targetFolderId=0 表示根） */
  move: (nodeId: number | string) => `/api/v1/files/${nodeId}/move`,
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
  /** 批量失效所选链接（需 file:share，单次上限 200）；响应体为实际失效条数 */
  batchRevoke: '/api/v1/shares/batch/revoke',
  /**
   * 一键失效「我的全部」生效中链接（需 file:share）。
   *
   * <p>刻意<b>不</b>做成 {@link revoke} 的「批量重载」：作用域由服务端按登录主体决定，
   * 请求里既没有 token 也没有范围参数——范围一旦能从请求侧控制，就有
   * 「以为全撤了、其实只撤了一页」的口子。</p>
   */
  revokeAll: '/api/v1/shares/all/revoke',
} as const;

/**
 * 外发分享端点（<b>访客侧，免登录</b>）。
 *
 * <p>与 {@link SHARE_ENDPOINTS} 的区别不只是路径：创建者侧端点要登录态 + `file:share` 权限，
 * 访客侧凭「高熵令牌 + 提取码」自证身份，故两端点集合必须分开维护，
 * 避免哪天有人顺手把访客端点塞进需要权限的那一组（或反之）。</p>
 *
 * <p>三步走：`verify` 换一次性票据 → `redeem` 核销换元信息 + 取件票 → `content` 凭取件票取字节。
 * `content` 返回的地址直接交给浏览器原生 `<a href>`（`Content-Disposition: attachment`），
 * 因此它必须能带 `ticket` 查询串自行鉴权，不能依赖请求头里的登录态。</p>
 */
export const SHARE_VISIT_ENDPOINTS = {
  /** 校验令牌 / 提取码 / 次数，换取一次性票据（票据 GETDEL 取用即焚） */
  verify: (token: string) =>
    `/api/v1/shares/${encodeURIComponent(token)}/verify`,
  /** 核销一次性票据，返回文件元信息 + 取件票（同时扣减下载次数、写审计） */
  redeem: '/api/v1/shares/redeem',
  /**
   * 取件地址（凭核销后的取件票取字节，支持 `Range` 续传）。
   *
   * <p>路径与查询串都做 `encodeURIComponent`：token 与票据都是 base64url 之外的随机串，
   * 但一旦有人把票据改成含 `+`/`/` 的编码，不转义就会在查询串里被截断成另一个值。</p>
   */
  content: (token: string, ticket: string) =>
    `/api/v1/shares/${encodeURIComponent(token)}/content?ticket=${encodeURIComponent(ticket)}`,
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
