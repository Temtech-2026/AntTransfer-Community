/**
 * 文件域领域类型与展示口径（与 `server/at-file` 的 DTO / VO 对齐）。
 *
 * <p>只放「纯」内容：类型、常量、纯函数。任何 `antd` / React 依赖都不许进来，
 * 便于单测直接跑，也避免页面按扩展名自行猜测后端口径（预览策略、密级文案都必须
 * 与服务端下发的字段一致）。</p>
 */

/* ============================ 密级 ============================ */

/** 密级：1-公开 2-内部 3-机密（由服务端判定并下发）。 */
export type DataLevel = 1 | 2 | 3;

export const LEVEL_OPTIONS: Array<{ value: DataLevel; label: string }> = [
  { value: 1, label: '公开' },
  { value: 2, label: '内部' },
  { value: 3, label: '机密' },
];

/** 密级标签色：机密用红，避免和「错误」以外的语义混淆。 */
const LEVEL_COLOR: Record<number, string> = {
  1: 'success',
  2: 'warning',
  3: 'error',
};

export function levelText(level?: number | null): string {
  return LEVEL_OPTIONS.find((item) => item.value === level)?.label ?? '未定级';
}

export function levelColor(level?: number | null): string {
  return LEVEL_COLOR[Number(level)] ?? 'default';
}

/** 申请权限弹窗里的密级风险提示（密级越高，审批链路与限制越严）。 */
export function levelApplyHint(level?: number | null): string {
  switch (level) {
    case 3:
      return '该文件为机密级：申请将进入多级审批，且不会授予下载与外发权限，仅按需临时开放预览。';
    case 2:
      return '该文件为内部级：申请默认只授予预览与下载，外发分享需单独审批。';
    case 1:
      return '该文件为公开级：审批较快，但仍需填写真实使用目的。';
    default:
      return '该文件尚未定级：审批人可能要求先完成定级。';
  }
}

/* ============================ 文件条目 ============================ */

/** 标签（服务端保证空数组而非 null）。 */
export interface TagVO {
  id: number;
  name: string;
  color?: string | null;
}

/** 文件条目（列表 / 回收站 / 详情共用）。 */
export interface FileNode {
  /** 条目 ID，用户侧的「文件 ID」即此值 */
  id: number;
  /** 物理文件 ID（秒传 / 去重排查用） */
  fileId?: number | null;
  /** 所在目录 ID（0 = 根） */
  folderId?: number | null;
  name: string;
  /** 扩展名（小写无点） */
  ext?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  level?: number | null;
  versionNo?: number | null;
  /** 状态：0-正常 1-回收站 */
  status?: number | null;
  recycleTime?: string | null;
  uploadUserId?: number | null;
  createTime?: string | null;
  updateTime?: string | null;
  tags?: TagVO[];
}

/** 目录节点（`/v1/folders/tree` 返回顶层数组，children 递归嵌套）。 */
export interface FolderNode {
  id: number;
  /** 0 = 根 */
  parentId?: number | null;
  name: string;
  children?: FolderNode[] | null;
}

/* ============================ 列表查询 ============================ */

/**
 * 文件列表查询参数。
 *
 * <p>`startTime` / `endTime` 对应服务端的「创建时间」区间过滤；时间统一用
 * `yyyy-MM-dd HH:mm:ss` 字符串，避免 `Date` 对象被序列化成 UTC 造成时区漂移。</p>
 */
export interface FileNodeQuery {
  current?: number;
  pageSize?: number;
  /** 排序表达式 `field,asc|desc` */
  sort?: string;
  folderId?: number;
  tagId?: number;
  tagIds?: number[];
  keyword?: string;
  /** 单个扩展名（小写无点）；服务端不支持多扩展名集合 */
  ext?: string;
  level?: number;
  uploadUserId?: number;
  minSize?: number;
  maxSize?: number;
  startTime?: string;
  endTime?: string;
}

/** ProTable 的查询表单字段（与列的 dataIndex 对齐）。 */
export interface FileTableParams {
  current?: number;
  pageSize?: number;
  /** 文件名关键字 */
  name?: string;
  ext?: string;
  /** 密级：ProTable 的 select 表单项会给出字符串，这里统一归一 */
  level?: number | string;
  /** 创建时间区间（列上已用 search.transform 归一为 `YYYY-MM-DD` 字符串） */
  createTimeRange?: Array<string | undefined> | null;
  /**
   * 当前目录 id。
   *
   * <p>它**不是**查询表单字段，只是挂在 `ProTable.params` 上用来触发「目录切换 → 重新请求」
   * （ProTable 仅在 params 变化时重发）。真正的查询参数由页面通过 `buildFileQuery` 的
   * `ctx.folderId` 注入，这里声明只是为了让 `params={{ folderId }}` 通过类型检查。
   */
  folderId?: number;
  /**
   * 是否为回收站视角。
   *
   * <p>与 {@link FileTableParams.folderId} 同理，它**不是**查询表单字段，只是挂在
   * `ProTable.params` 上用来触发「我的文件 ↔ 回收站」切换时的重新请求；真正的请求分派
   * 由页面在 `request` 里按此标志走 `pageRecycleFiles`。
   */
  recycle?: boolean;
}

/** 宽松数字归一：空串 / 非数字 / undefined 一律视为「未传」。 */
export function toOptionalNumber(value?: number | string | null): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** ProTable 排序状态（`request` 的第二个入参）。 */
export type TableSorter = Record<string, 'ascend' | 'descend' | null | undefined>;

export interface FileQueryContext {
  folderId?: number;
  sorter?: TableSorter;
}

/** 把 ProTable 的排序状态压成服务端的 `field,asc|desc` 表达式。 */
export function sortExprOf(sorter?: TableSorter): string | undefined {
  if (!sorter) {
    return undefined;
  }
  const hit = Object.entries(sorter).find(
    ([, order]) => order === 'ascend' || order === 'descend',
  );
  if (!hit) {
    return undefined;
  }
  const [field, order] = hit;
  return `${field},${order === 'ascend' ? 'asc' : 'desc'}`;
}

/**
 * 组装文件列表查询体。
 *
 * <p>空字符串 / 空区间一律不下发：服务端把「参数存在但为空」与「参数不存在」当同一件事，
 * 但多余的空参会污染网关侧的查询缓存键。</p>
 */
export function buildFileQuery(
  params: FileTableParams = {},
  ctx: FileQueryContext = {},
): FileNodeQuery {
  const query: FileNodeQuery = {
    current: toOptionalNumber(params.current) ?? 1,
    pageSize: toOptionalNumber(params.pageSize) ?? 20,
  };
  // 与 level 同一口径归一：NaN / 非数字一律视为「未传」，避免下发脏的 folderId=NaN
  const folderId = toOptionalNumber(ctx.folderId);
  if (folderId !== undefined) {
    query.folderId = folderId;
  }
  const keyword = params.name?.trim();
  if (keyword) {
    query.keyword = keyword;
  }
  if (params.ext) {
    query.ext = params.ext;
  }
  const level = toOptionalNumber(params.level);
  if (level !== undefined) {
    query.level = level;
  }
  const [startTime, endTime] = params.createTimeRange ?? [];
  if (startTime) {
    query.startTime = `${startTime} 00:00:00`;
  }
  if (endTime) {
    query.endTime = `${endTime} 23:59:59`;
  }
  const sort = sortExprOf(ctx.sorter);
  if (sort) {
    query.sort = sort;
  }
  return query;
}

/* ============================ 类型（扩展名）筛选 ============================ */

/**
 * 扩展名分组。
 *
 * <p>服务端的 `ext` 是单个值，因此筛选项按「具体扩展名」提交，分组只负责下拉里的视觉归类，
 * 不做前端聚合过滤——否则会出现「选了图片却只过滤出当前页里的图片」这类假筛选。</p>
 */
export const EXT_GROUPS: Array<{ label: string; exts: string[] }> = [
  { label: '文档', exts: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv'] },
  { label: '图片', exts: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] },
  { label: '视频', exts: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
  { label: '音频', exts: ['mp3', 'wav', 'flac', 'aac', 'ogg'] },
  { label: '压缩包', exts: ['zip', 'rar', '7z', 'tar', 'gz'] },
];

/** ProTable 搜索项用的分组下拉数据（`options[].options`）。 */
export const EXT_SELECT_OPTIONS = EXT_GROUPS.map((group) => ({
  label: group.label,
  options: group.exts.map((ext) => ({ label: `.${ext}`, value: ext })),
}));

/* ============================ 预览 ============================ */

/** 预览策略（服务端判定，前端不得自行猜测）。 */
export type PreviewStrategy = 'text' | 'pdf' | 'image' | 'download-only' | 'none';

/** 预览元信息。 */
export interface PreviewInfo {
  nodeId: number;
  name: string;
  ext?: string | null;
  contentType?: string | null;
  strategy: PreviewStrategy;
  /** 仅 text 策略有意义 */
  truncated?: boolean;
  /** 仅 text 策略非空 */
  content?: string | null;
  /** 仅 image 策略非空 */
  thumbnailUrl?: string | null;
  /** 仅 pdf 策略非空（服务端已带短时票据，iframe 无 Authorization 头） */
  contentUrl?: string | null;
  sizeBytes?: number | null;
}

/* ============================ 下载票据 ============================ */

/**
 * 登录用户的短时下载票据（换票后凭 `downloadUrl` 取件）。
 *
 * **可重复使用至过期，不是一次即焚**：服务端核销只校验、不销毁，过期由 TTL 兜底。
 * 重试、`Range` 断点续传、多线程分段拉取都会重复取件，若按一次即焚实现，
 * 这些正常行为会被判成 `4018`。这与分享域**访客**票据的「一次即焚（`GETDEL`）」
 * 刻意相反，两域不可互相套用。
 *
 * 票据绑定 `userId + nodeId`，核销时逐项比对，任一不符即 `4018`（对外统一文案，
 * 不区分「不存在」与「绑定不符」）；条目归属以取件时**重新读库**的结果为准，
 * 不信票据里的归属快照。
 */
export interface DownloadTicket {
  ticket: string;
  /** 绑定的文件条目 ID：取件路径须与之一致，否则 `4018` */
  nodeId: number;
  /** 票据有效期（秒，默认 300）；**在该窗口内可重复取件** */
  expiresInSeconds: number;
  /** 取件地址（相对路径，前端补 host）；支持 `Range` 续传（`206` / `416`） */
  downloadUrl: string;
}

/* ============================ 外发分享 ============================ */

/** 创建外发分享的请求体（提取码只进不出，任何接口都不回显）。 */
export interface CreateSharePayload {
  fileId: number;
  /** 明文提取码，服务端立即 BCrypt 散列入库 */
  extractCode: string;
  /** 下载次数上限；省略取默认 10，超出硬上限以 2005 拒绝 */
  downloadLimit?: number;
  /** 到期时间；省略取默认 7 天，超出硬上限（30 天）以 2005 拒绝 */
  expireAt?: string;
}

/** 外发分享链接元信息（刻意不含提取码：服务端 BCrypt 散列入库，无法也不得回显）。 */
export interface ShareLink {
  /** 拼装分享 URL 用 */
  token: string;
  fileId?: number | null;
  fileName?: string | null;
  expireAt?: string | null;
  downloadLimit?: number | null;
  downloadedCount?: number | null;
  /** 剩余可下载次数（服务端算好，避免前端减法口径不一致） */
  remainingCount?: number | null;
  /** 状态：0-生效 1-已撤销 2-已失效 */
  status?: number | null;
  revokeAt?: string | null;
  /** 是否必须提取码（当前恒为 true） */
  extractCodeRequired?: boolean | null;
  createTime?: string | null;
}

/** 分享状态文案。 */
export function shareStatusText(status?: number | null): string {
  switch (status) {
    case 0:
      return '生效中';
    case 1:
      return '已撤销';
    case 2:
      return '已失效';
    default:
      return '未知';
  }
}

/** 分享口径硬约束（与 server 配置默认值对齐，仅用于前端提前拦截）。 */
export const SHARE_LIMITS = {
  /** 到期时间硬上限（天） */
  maxExpireDays: 30,
  /** 默认到期（天） */
  defaultExpireDays: 7,
  /** 次数硬上限 */
  maxDownloadLimit: 1000,
  /** 默认次数 */
  defaultDownloadLimit: 10,
  /** 提取码长度区间 */
  extractCodeMin: 6,
  extractCodeMax: 32,
  /** 提取码默认长度 */
  extractCodeDefault: 6,
} as const;

/** 有效期快捷选项。 */
export const SHARE_EXPIRE_PRESETS = [
  { label: '1 天', value: 1 },
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
];

/** 提取码字符集：去掉 0/O/1/l/I 等易混字符，便于人工口头转达。 */
const EXTRACT_CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** 生成随机提取码（`random` 可注入，便于单测确定性）。 */
export function randomExtractCode(
  length: number = SHARE_LIMITS.extractCodeDefault,
  random: () => number = Math.random,
): string {
  const size = Math.min(
    Math.max(Math.floor(length) || SHARE_LIMITS.extractCodeDefault, SHARE_LIMITS.extractCodeMin),
    SHARE_LIMITS.extractCodeMax,
  );
  let code = '';
  for (let i = 0; i < size; i += 1) {
    const index = Math.floor(random() * EXTRACT_CODE_CHARSET.length);
    code += EXTRACT_CODE_CHARSET[index % EXTRACT_CODE_CHARSET.length];
  }
  return code;
}

/** 提取码校验：长度 6~32 且仅字母数字（服务端另有下限配置二次校验）。 */
export function isValidExtractCode(code?: string | null): boolean {
  if (!code) {
    return false;
  }
  return (
    code.length >= SHARE_LIMITS.extractCodeMin &&
    code.length <= SHARE_LIMITS.extractCodeMax &&
    /^[A-Za-z0-9]+$/.test(code)
  );
}

/**
 * 拼装外发访问链接。
 *
 * <p>`origin` 可注入（单测 / 非浏览器环境），默认取当前站点。</p>
 */
export function buildShareUrl(token: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  return `${base}/share/${encodeURIComponent(token)}`;
}

/** 分享卡片的复制文案：链接与提取码必须一起给出（提取码不回显，只能由前端拼）。 */
export function buildShareCopyText(url: string, extractCode?: string, expireAt?: string): string {
  const lines = [`链接：${url}`];
  if (extractCode) {
    lines.push(`提取码：${extractCode}`);
  }
  if (expireAt) {
    lines.push(`有效期至：${expireAt}`);
  }
  return lines.join('\n');
}

/* ============================ 权限申请 ============================ */

/** 申请类型（权限类型）。 */
export type ApplyType = 'ACCESS' | 'DOWNLOAD' | 'EDIT' | 'SHARE';

export const APPLY_TYPE_OPTIONS: Array<{ value: ApplyType; label: string; hint: string }> = [
  { value: 'ACCESS', label: '访问（预览）', hint: '仅在线预览，不能下载或外发' },
  { value: 'DOWNLOAD', label: '下载', hint: '可下载原件，使用需留痕' },
  { value: 'EDIT', label: '编辑', hint: '可改名 / 移动 / 新增版本' },
  { value: 'SHARE', label: '外发分享', hint: '可创建外发链接，风险最高' },
];

/** 资源类型：本页固定为文件。 */
export type ResourceType = 'FILE' | 'SPACE' | 'GROUP';

/** 提交权限申请的请求体（申请人身份由登录态推导，不从请求体传）。 */
export interface PermissionApplicationPayload {
  applyType: ApplyType;
  resourceType: ResourceType;
  resourceId: number;
  /** 资源密级快照，供审批链路判定层级 */
  level?: number;
  /** 使用目的（必填） */
  purpose: string;
  /** 期望有效期；为空表示不申请限期权限 */
  desiredExpireAt?: string;
}

/** 审批单视图对象（待我审批 / 我发起 列表与详情共用）。 */
export interface ApprovalRequest {
  id: number;
  /** 申请单号，展示给用户便于线下催办 */
  applicationNo?: string | null;
  applicantId?: number | null;
  applyType?: string | null;
  resourceType?: string | null;
  resourceId?: number | null;
  level?: number | null;
  purpose?: string | null;
  desiredExpireAt?: string | null;
  status?: number | null;
  approverId?: number | null;
  opinion?: string | null;
  decidedAt?: string | null;
  createdAt?: string | null;
}
