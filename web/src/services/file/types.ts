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

export const LEVEL_OPTIONS: Array<{ value: DataLevel; labelId: string }> = [
  { value: 1, labelId: 'file.level.public' },
  { value: 2, labelId: 'file.level.internal' },
  { value: 3, labelId: 'file.level.classified' },
];

/** 密级标签色：机密用红，避免和「错误」以外的语义混淆。 */
const LEVEL_COLOR: Record<number, string> = {
  1: 'success',
  2: 'warning',
  3: 'error',
};

const LEVEL_TEXT_ID: Record<number, string> = {
  1: 'file.level.public',
  2: 'file.level.internal',
  3: 'file.level.classified',
};

/** 密级文案 id（未知密级按「未定级」）。 */
export function levelTextId(level?: number | null): string {
  return LEVEL_TEXT_ID[Number(level)] ?? 'file.level.unknown';
}

export function levelColor(level?: number | null): string {
  return LEVEL_COLOR[Number(level)] ?? 'default';
}

/** 申请权限弹窗里的密级风险提示 id（密级越高，审批链路与限制越严）。 */
export function levelApplyHintId(level?: number | null): string {
  switch (level) {
    case 3:
      return 'file.level.applyHint.classified';
    case 2:
      return 'file.level.applyHint.internal';
    case 1:
      return 'file.level.applyHint.public';
    default:
      return 'file.level.applyHint.unknown';
  }
}

/* ============================ 文件条目 ============================ */

/**
 * 雪花 ID 的字符串形态。
 *
 * <p>用于在函数签名上表达「这里要的是 ID」，而不是任意字符串——提醒调用方
 * 不要把 ID 转成 `number`（见 {@link TagVO} 的 ID 语境说明）。</p>
 */
export type SnowflakeId = string;

/**
 * 标签（服务端保证空数组而非 null）。
 *
 * <p><b>ID 语境统一说明</b>：文件域的所有 ID（条目 / 目录 / 标签 / 版本 / 分享 / 审批单）
 * 都是 19 位雪花 ID，服务端已按「ID 以字符串过线」下发（对齐
 * `PrecheckResultVO` / `MergeResultVO` 的口径）。JS 的 number 只有 53 位整数精度，
 * 19 位 ID 一旦被 `JSON.parse` 成 number，末位会被静默取整；再拿它去拼
 * `/v1/files/{nodeId}/preview`、`/ticket` 之类的路径，服务端就查不到资源
 * ——典型症状正是「列表能看到文件，预览 / 下载却失败」。
 *
 * <p>因此这些字段一律用 `string` 承接，<b>禁止 `Number()` / `parseInt()` 归一</b>；
 * 需要「未传」语义时用 {@link toOptionalId}。</p>
 */
export interface TagVO {
  id: string;
  name: string;
  color?: string | null;
}

/** 文件条目（列表 / 回收站 / 详情共用）。 */
export interface FileNode {
  /** 条目 ID，用户侧的「文件 ID」即此值（雪花 ID，以字符串承接，见 {@link TagVO}） */
  id: string;
  /** 物理文件 ID（秒传 / 去重排查用） */
  fileId?: string | null;
  /** 所在目录 ID（0 = 根） */
  folderId?: string | null;
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
  uploadUserId?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
  tags?: TagVO[];
}

/**
 * 安全状态徽标。
 *
 * <p>与密级标签刻意分开：**标签说「内容有多敏感」，徽标说「当下受什么额外约束」**。
 * 机密文件一定有密级标签，但只有真的开了水印、或真的快到失效期时，才多出对应徽标。</p>
 */
export type SecurityMarkKind = 'classified' | 'watermark' | 'expiring';

/** 单个安全徽标（图标由展示层按 kind 决定，这里只给语义与文案 id）。 */
export interface SecurityMark {
  kind: SecurityMarkKind;
  /** 徽标上的短文案 id */
  labelId: string;
  /** 悬浮解释的文案 id：说明这条约束对用户意味着什么，而不是复述 label */
  hintId: string;
  /** 文案里的插值（如剩余天数），由展示层交给 `intl` 填充 */
  values?: Record<string, number>;
}

/**
 * 安全态的**前端预留**扩展字段。
 *
 * <p>服务端 {@code FileNodeVO} 目前没有这些字段（已登记到后端扩展点清单）。
 * 这里声明为可选并「有则显示、无则整条徽标不渲染」——前端**不猜**服务端未下发的能力，
 * 否则会给用户一个「以为被水印保护了」的假安全感。</p>
 */
export interface FileNodeSecurityExt {
  /** 预览 / 下载是否叠加动态水印 */
  watermarkEnabled?: boolean | null;
  /** 条目失效时间（`yyyy-MM-dd HH:mm:ss` 或 ISO 串） */
  expireAt?: string | null;
}

/** 距失效期不足该天数时亮起「即将失效」徽标。 */
export const EXPIRING_THRESHOLD_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 解析服务端时间串为毫秒时间戳。
 *
 * <p>`yyyy-MM-dd HH:mm:ss` 里用空格分隔的形态在部分 JS 引擎（Safari）无法被 `new Date` 解析，
 * 因此手工归一为 ISO 风格；解析不出就返回 undefined，由调用方当作「没有该信息」处理。</p>
 */
function parseDateTimeMs(value?: string | null): number | undefined {
  const raw = value?.trim();
  if (!raw) {
    return undefined;
  }
  const ms = Date.parse(raw.replace(' ', 'T'));
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * 汇总一个条目的安全徽标（纯函数，便于单测）。
 *
 * <p>判定口径：</p>
 * <ul>
 *   <li><b>机密</b>（红锁）：密级 = 3。这是唯一由现有字段就能判定的徽标。</li>
 *   <li><b>水印</b>（水滴）：服务端下发 `watermarkEnabled = true` 才显示。</li>
 *   <li><b>即将失效</b>（沙漏）：`expireAt` 剩余不足 {@link EXPIRING_THRESHOLD_DAYS} 天；
 *       已过期同样显示，且文案换成「已失效」——过期文件仍躺在列表里，正是需要提醒的场景。</li>
 * </ul>
 *
 * @param nowMs 当前时刻（可注入，便于单测确定性）
 */
export function securityMarks(
  node: FileNode & FileNodeSecurityExt,
  nowMs: number = Date.now(),
): SecurityMark[] {
  const marks: SecurityMark[] = [];
  if (Number(node.level) === 3) {
    marks.push({
      kind: 'classified',
      labelId: 'file.security.classified.label',
      hintId: 'file.security.classified.hint',
    });
  }
  if (node.watermarkEnabled === true) {
    marks.push({
      kind: 'watermark',
      labelId: 'file.security.watermark.label',
      hintId: 'file.security.watermark.hint',
    });
  }
  const expireMs = parseDateTimeMs(node.expireAt);
  if (expireMs !== undefined) {
    const remainDays = Math.ceil((expireMs - nowMs) / DAY_MS);
    if (remainDays <= EXPIRING_THRESHOLD_DAYS) {
      // 过期与原样保留两种语义分开：过期文件仍躺在列表里，正是需要提醒的场景
      marks.push(
        remainDays > 0
          ? {
              kind: 'expiring',
              labelId: 'file.security.expiring.label',
              hintId: 'file.security.expiring.hint',
              values: { days: remainDays },
            }
          : {
              kind: 'expiring',
              labelId: 'file.security.expired.label',
              hintId: 'file.security.expired.hint',
            },
      );
    }
  }
  return marks;
}

/**
 * 条目移入回收站至今已过去的天数（时间串解析不出时返回 undefined）。
 *
 * <p>**为什么展示「已停留 N 天」而不是「剩余 N 天」：** 保留期由服务端
 * `at.file.recycle-retention-days` 决定（默认 30 天，PRD US-09），是**可配置项**。
 * 前端若把 30 写死，管理员一改配置，界面就会自信地说错话；
 * 而「已停留 N 天」只依赖 `recycleTime` 一个时间戳，永远为真。
 * 要给出剩余天数，需服务端下发保留期或直接下发清理时刻（已登记 GAP-09）。</p>
 */
export function recycleElapsedDays(
  recycleTime?: string | null,
  nowMs: number = Date.now(),
): number | undefined {
  const ms = parseDateTimeMs(recycleTime);
  if (ms === undefined) {
    return undefined;
  }
  // 时钟回拨或服务端时间略超前时会出现负数，按 0 处理而不是显示「-1 天」
  return Math.max(0, Math.floor((nowMs - ms) / DAY_MS));
}

/** 目录节点（`/v1/folders/tree` 返回顶层数组，children 递归嵌套）。 */
export interface FolderNode {
  id: string;
  /** 0 = 根 */
  parentId?: string | null;
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
  folderId?: string;
  tagId?: string;
  tagIds?: string[];
  keyword?: string;
  /** 单个扩展名（小写无点）；服务端不支持多扩展名集合 */
  ext?: string;
  level?: number;
  uploadUserId?: string;
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
   *
   * <p>雪花 ID，以字符串承接（见 {@link TagVO}）——它只用于触发重发，不会进入查询串。</p>
   */
  folderId?: string;
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

/**
 * 宽松 ID 归一：空串 / 非纯数字一律视为「未传」。
 *
 * <p><b>刻意不做 `Number()` 转换</b>：19 位雪花 ID 超出 JS 安全整数范围，转成 number
 * 会丢末位（详见 {@link TagVO} 的 ID 语境说明），因此这里只校验格式、原样保留字符串。</p>
 */
export function toOptionalId(value?: string | number | null): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const raw = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value.trim();
  return /^\d+$/.test(raw) ? raw : undefined;
}

/** ProTable 排序状态（`request` 的第二个入参）。 */
export type TableSorter = Record<string, 'ascend' | 'descend' | null | undefined>;

export interface FileQueryContext {
  /** 当前目录 ID（雪花 ID，字符串，见 {@link TagVO}） */
  folderId?: string;
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
  // 与 level 同一口径归一，但**不做 Number() 转换**：folderId 是 19 位雪花 ID，
  // 转 number 会丢末位，表现为「进入目录后列表空白」（详见 TagVO 的 ID 语境说明）。
  const folderId = toOptionalId(ctx.folderId);
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
export const EXT_GROUPS: Array<{ labelId: string; exts: string[] }> = [
  {
    labelId: 'file.extGroup.doc',
    exts: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv'],
  },
  {
    labelId: 'file.extGroup.image',
    exts: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
  },
  { labelId: 'file.extGroup.video', exts: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
  { labelId: 'file.extGroup.audio', exts: ['mp3', 'wav', 'flac', 'aac', 'ogg'] },
  { labelId: 'file.extGroup.archive', exts: ['zip', 'rar', '7z', 'tar', 'gz'] },
];

/** ProTable 搜索项用的分组下拉数据（`options[].options`）；`labelId` 由展示层翻译。 */
export const EXT_SELECT_OPTIONS = EXT_GROUPS.map((group) => ({
  labelId: group.labelId,
  options: group.exts.map((ext) => ({ label: `.${ext}`, value: ext })),
}));

/* ============================ 预览 ============================ */

/** 预览策略（服务端判定，前端不得自行猜测）。 */
export type PreviewStrategy = 'text' | 'pdf' | 'image' | 'download-only' | 'none';

/** 预览元信息。 */
export interface PreviewInfo {
  /** 条目 ID（雪花 ID，字符串，见 {@link TagVO}）；预览路径须与之一致 */
  nodeId: string;
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
  /** 绑定的文件条目 ID（雪花 ID，字符串，见 {@link TagVO}）：取件路径须与之一致，否则 `4018` */
  nodeId: string;
  /** 票据有效期（秒，默认 300）；**在该窗口内可重复取件** */
  expiresInSeconds: number;
  /** 取件地址（相对路径，前端补 host）；支持 `Range` 续传（`206` / `416`） */
  downloadUrl: string;
}

/* ========================== 外发分享：访客侧 ========================== */

/** 访客换票请求（`POST /v1/shares/{token}/verify`）。 */
export interface VerifySharePayload {
  /** 明文提取码（服务端 BCrypt 比对，只进不出） */
  extractCode: string;
  /** 访问类型：download=下载 / preview=在线预览（省略则按 download） */
  accessType?: 'download' | 'preview';
}

/**
 * 访客换票结果（`POST /v1/shares/{token}/verify`）。
 *
 * <p>`ticket` 是<b>一次性</b>票据：核销时服务端 `GETDEL` 取用即焚，重放只会拿到 `4004`。
 * 前端唯一正确用法是「拿到就立刻核销」，不要缓存、不要复用。</p>
 */
export interface ShareAccessTicket {
  /** 一次性票据（高熵随机） */
  ticket: string;
  /** 票据对应的分享令牌 */
  shareToken?: string | null;
  /** 访问类型：download / preview */
  accessType?: string | null;
  /** 票据到期时间 */
  expireAt?: string | null;
  /** 票据剩余有效秒数 */
  ttlSeconds?: number | null;
  /** 换票时快照的剩余次数（核销时才是真实扣减点，并发下以核销结果为准） */
  remainingCount?: number | null;
}

/**
 * 访客核销结果（`POST /v1/shares/redeem`）：文件元信息 + 取件票。
 *
 * <p>`contentTicket` 与换票阶段的一次性票据是<b>两张票</b>：前者只用于把这一次取件读完
 * （可重复读，撑 `Range` 断点续传与浏览器重试），后者负责「谁有权取件」（一次即焚）。
 * 两者任一缺失都会让下载退化成 401/4004，故字段可空仅用于兼容旧后端。</p>
 */
export interface SharePayload {
  /** 分享链接 ID（雪花 ID，字符串） */
  shareId?: string | null;
  /** 物理文件 ID（雪花 ID，字符串） */
  fileId?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  contentType?: string | null;
  /** 本次访问类型：download / preview */
  accessType?: string | null;
  /** 取件票：拼 `content` 地址用 */
  contentTicket?: string | null;
  /** 取件票剩余有效期（秒） */
  expiresInSeconds?: number | null;
}

/* ============================ 外发分享 ============================ */

/** 创建外发分享的请求体（提取码只进不出，任何接口都不回显）。 */
export interface CreateSharePayload {
  /** 物理文件 ID（雪花 ID，字符串，见 {@link TagVO}） */
  fileId: string;
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
  /** 物理文件 ID（雪花 ID，字符串，见 {@link TagVO}） */
  fileId?: string | null;
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

/** 分享状态文案 id。 */
export function shareStatusId(status?: number | null): string {
  switch (status) {
    case 0:
      return 'file.shareStatus.active';
    case 1:
      return 'file.shareStatus.revoked';
    case 2:
      return 'file.shareStatus.expired';
    default:
      return 'file.shareStatus.unknown';
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

/**
 * 有效期快捷选项（天数）。
 *
 * <p>只给数值，文案由 `file.share.presetDays` 插值——中文是「7 天」、英文是「7 days」，
 * 若在这里写死就会在英文界面漏出中文。</p>
 */
export const SHARE_EXPIRE_PRESETS = [1, 7, 30];

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

/**
 * 分享链接里承载提取码的 fragment 键名。
 *
 * <p><b>写（创建者复制）与读（访客取件页预填）共用这一个常量。</b>两侧各写一遍字符串的话，
 * 一旦拼写漂移，症状会是「复制出去的链接看着正常、取件页却永远不预填」——不报错、不崩溃，
 * 只能靠人肉比对两处代码才能发现。</p>
 */
export const SHARE_CODE_FRAGMENT_KEY = 'code';

/**
 * 带提取码的分享链接，也就是「复制链接和提取码」真正写进剪贴板的那串文本。
 *
 * <p><b>为什么必须是「单行链接」，而不是「链接 + 提取码」的多行文本：</b>
 * 用户拿到复制内容后的动作是「粘贴进浏览器地址栏并回车」。地址栏对多行文本的既定处理是
 * <b>当成搜索词交给默认搜索引擎</b>——于是页面跳去百度（或任何默认搜索站），而不是取件页。
 * 这不是某个浏览器的怪癖，而是「多行 = 不是 URL」的通用口径：只有整段文本本身就是一条
 * 合法 URL，粘贴后才会直接导航。</p>
 *
 * <p><b>为什么提取码放 fragment（`#`）而不是 query（`?`）：</b>fragment 只留在浏览器本地，
 * <b>不会进入请求行</b>，因此不会落进 Nginx / 网关的访问日志与 `Referer`。
 * 外发分享的安全模型是「链接与提取码分两个渠道送达」；把提取码塞进 query，
 * 等于让服务端日志同时拿到两个因子，把双因子降级成单因子。</p>
 *
 * <p>代价是链接里能直接看到提取码（地址栏可见）。这是「点开即自动预填」的必然代价：
 * 用户要的就是一次粘贴直达，而不是打开页面后再手输一遍 6~32 位码。</p>
 *
 * @param url 由 {@link buildShareUrl} 生成的分享链接
 * @param extractCode 本次创建的明文提取码（服务端不回显，只能由前端拼）
 */
export function buildShareLinkWithCode(
  url: string,
  extractCode?: string,
): string {
  const code = extractCode?.trim();
  return code
    ? `${url}#${SHARE_CODE_FRAGMENT_KEY}=${encodeURIComponent(code)}`
    : url;
}

/**
 * 从地址栏 fragment 读回提取码：{@link buildShareLinkWithCode} 的逆运算，供取件页预填。
 *
 * <p>只接受<b>形状合法</b>的提取码（长度与字符集见 {@link isValidExtractCode}），
 * 碎片里的其它内容一律当作「没带」，让访客自己输入。否则一段被聊天工具截断或改写的链接，
 * 会把乱七八糟的字符串预填进输入框——访客点「提取文件」后收到「提取码错误」，
 * 却完全看不出问题其实出在链接上。</p>
 *
 * @param hash 形如 `#code=ABC123` 的 fragment（带不带前导 `#` 都可以）
 * @returns 合法提取码；没带 / 形状不合法时返回 `undefined`
 */
export function readShareCodeFromHash(
  hash?: string | null,
): string | undefined {
  if (!hash) {
    return undefined;
  }
  const code = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
    .get(SHARE_CODE_FRAGMENT_KEY)
    ?.trim();
  return code && isValidExtractCode(code) ? code : undefined;
}

/* ============================ 权限申请 ============================ */

/** 申请类型（权限类型）。 */
export type ApplyType = 'ACCESS' | 'DOWNLOAD' | 'EDIT' | 'SHARE';

export const APPLY_TYPE_OPTIONS: Array<{
  value: ApplyType;
  labelId: string;
  hintId: string;
}> = [
  {
    value: 'ACCESS',
    labelId: 'file.applyType.access.label',
    hintId: 'file.applyType.access.hint',
  },
  {
    value: 'DOWNLOAD',
    labelId: 'file.applyType.download.label',
    hintId: 'file.applyType.download.hint',
  },
  {
    value: 'EDIT',
    labelId: 'file.applyType.edit.label',
    hintId: 'file.applyType.edit.hint',
  },
  {
    value: 'SHARE',
    labelId: 'file.applyType.share.label',
    hintId: 'file.applyType.share.hint',
  },
];

/** 资源类型：本页固定为文件。 */
export type ResourceType = 'FILE' | 'SPACE' | 'GROUP';

/** 提交权限申请的请求体（申请人身份由登录态推导，不从请求体传）。 */
export interface PermissionApplicationPayload {
  applyType: ApplyType;
  resourceType: ResourceType;
  /** 资源 ID（本页即条目 ID，雪花 ID 以字符串提交，见 {@link TagVO}） */
  resourceId: string;
  /** 资源密级快照，供审批链路判定层级 */
  level?: number;
  /** 使用目的（必填） */
  purpose: string;
  /** 期望有效期；为空表示不申请限期权限 */
  desiredExpireAt?: string;
}

/** 审批单视图对象（待我审批 / 我发起 列表与详情共用）。 */
export interface ApprovalRequest {
  /** 申请单主键：19 位雪花 ID，服务端以字符串下发。 */
  id: string;
  /** 申请单号，展示给用户便于线下催办 */
  applicationNo?: string | null;
  applicantId?: string | null;
  applyType?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  level?: number | null;
  purpose?: string | null;
  desiredExpireAt?: string | null;
  status?: number | null;
  approverId?: string | null;
  opinion?: string | null;
  decidedAt?: string | null;
  createdAt?: string | null;
}
