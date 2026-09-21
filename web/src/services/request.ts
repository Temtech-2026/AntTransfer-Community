/**
 * 统一请求封装（业务层唯一入口）。
 *
 * <p>职责边界（避免与 {@link '@/requestErrorConfig'} 重复）：
 * <ul>
 *   <li>{@code requestErrorConfig.ts} 负责 <b>传输层横切</b>：注入 {@code Authorization: Bearer}、
 *       识别 {@code Result{code,message,data}}、1002 静默刷新一次（单飞加锁）、业务错误
 *       {@code message.error}、1001 跳登录。所有 {@code @umijs/max} 的 {@code request} 调用都会经过它，
 *       因此本文件<b>不重复实现</b>这些逻辑。</li>
 *   <li>本文件负责 <b>调用点体验</b>：把 {@code Result} 解包成业务数据类型、把失败统一成
 *       {@link BizError}（调用方可以按 code 分支）、分页兜底，以及 axios 覆盖不到的
 *       <b>二进制上传 / 下载进度</b>（XHR，进度事件 + 401 复用同一把刷新锁重放一次）。</li>
 * </ul>
 *
 * <p>关键契约（docs/api/README.md §2 / §5 / §6 / §7、docs/api/error-codes.md）：
 * <ul>
 *   <li>成功码恒为 {@code 0}；只有 {@code code === 0} 才取 {@code data}。</li>
 *   <li>B 类流程分支（1008 Token 过期前提醒 / 1009 需二次确认 / 4001 秒传命中 / 4002 秒传预检）
 *       是<b>正常业务分支</b>而非错误：全局 errorThrower 不会抛，本文件照常返回 {@code data}，
 *       调用方按 code 自行分支（如 upload 服务）。</li>
 *   <li>1003 无权限为策略 D：<b>只就地提示，禁止引导登录</b>；跳登录只用于 1006/1001。</li>
 * </ul>
 */

import { request } from '@umijs/max';
import { message } from 'antd';

import { presentError, refreshTokenOnce, translateMessage } from '@/requestErrorConfig';
import { currentAcceptLanguage } from '@/utils/locale';
import {
  DEFAULT_ERROR_MESSAGE_ID,
  type HandleStrategy,
  type PageResult,
  type Result,
  isFlowBranch,
  isResult,
  isSuccess,
  resolveStrategy,
} from '@/utils/result';
import { tokenStore } from '@/utils/token';

/** 支持的 HTTP 方法。 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * 统一请求选项。
 *
 * <p>{@link RequestOptions.silent} 是 {@code skipErrorHandler} 的语义化别名：为 true 时不弹全局提示，
 * 但错误<b>仍会抛出</b>（由调用方决定如何呈现），避免「静默」被误解为「吞掉错误」。
 */
export interface RequestOptions {
  method?: HttpMethod;
  /** 查询参数（axios params）。 */
  params?: Record<string, unknown>;
  /** 请求体（axios data）。 */
  data?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  /** 静默模式：不弹全局错误提示，错误照常抛出。 */
  silent?: boolean;
}

/**
 * 业务错误（携带后端 error code / traceId），供调用方按 code 分支。
 *
 * <p>典型用法：
 * <pre>{@code
 * try {
 *   await requestData('/api/v1/system/roles', { method: 'POST', data });
 * } catch (e) {
 *   if (e instanceof BizError && e.code === 1015) setConflictTip(e.message);
 * }
 * }</pre>
 */
export class BizError extends Error {
  readonly code: number;

  readonly traceId: string;

  readonly strategy: HandleStrategy;

  readonly info: Result<unknown>;

  constructor(result: Result<unknown>) {
    super(result.message || translateMessage('app.request.failed'));
    this.name = 'BizError';
    this.code = result.code;
    this.traceId = result.traceId;
    this.strategy = resolveStrategy(result.code);
    this.info = result;
  }
}

/**
 * 无统一响应体时的兜底包装（Umi 模板 demo 接口 / 文件流），保证调用方拿到的形状一致。
 *
 * <p>模板接口习惯 {@code { data, success }}，因此优先取 {@code data}；否则原样透出，
 * 避免调用方为了一个 demo 接口写两套取值逻辑。
 */
function wrapRaw<T>(body: unknown): Result<T> {
  const isObject = typeof body === 'object' && body !== null;
  const payload =
    isObject && 'data' in body ? (body as { data: T }).data : (body as T);
  return { code: 0, message: 'ok', data: payload, traceId: '' };
}

/**
 * 把 axios 抛出的错误统一成 {@link BizError}。
 *
 * <p>HTTP 4xx/5xx 的响应体同样是 {@code Result}（全局 errorThrower 会重建），
 * 这里再兜一层，保证调用方在任何链路上都能用 {@code error.code} 判定。
 */
export function toBizError(error: unknown): unknown {
  const candidate = error as { name?: string; response?: { data?: unknown } } | undefined;
  if (candidate?.name === 'BizError') {
    return error;
  }
  const body = candidate?.response?.data;
  if (isResult(body)) {
    return new BizError(body as Result<unknown>);
  }
  return error;
}

/**
 * 返回完整 {@code Result}（不解包），适用于需要读 code 的流程分支调用点。
 */
export async function requestResult<T>(
  url: string,
  options: RequestOptions = {},
): Promise<Result<T>> {
  const { silent, ...axiosOptions } = options;
  // Umi 的 request 类型签名是 AxiosResponse，但运行时已由拦截器解包成响应体，
  // 因此先落到 unknown 再按 Result 判定，避免把 AxiosResponse.data 的嵌套类型带进来
  const response = await request<Result<T>>(url, {
    ...axiosOptions,
    ...(silent ? { skipErrorHandler: true } : {}),
  } as never);
  const body: unknown = response;

  // 非统一响应体（如 Umi 模板的 /api/currentUser）：原样透出，不强行要求后端迎合 demo 接口
  if (!isResult(body)) {
    return wrapRaw<T>(body);
  }
  // 成功 / B 类流程分支都算「拿到了业务结果」
  if (isSuccess(body.code) || isFlowBranch(body.code)) {
    return body as Result<T>;
  }
  // 仅在 silent 模式下可达（否则全局 errorHandler 已弹出提示并抛出）
  throw new BizError(body);
}

/**
 * 解包 {@code Result.data} —— 业务层默认入口。
 *
 * <p>失败时抛出 {@link BizError}；B 类流程分支正常返回 data（不是错误）。
 */
export async function requestData<T>(url: string, options: RequestOptions = {}): Promise<T> {
  try {
    const result = await requestResult<T>(url, options);
    return result.data;
  } catch (error) {
    throw toBizError(error);
  }
}

/** 分页数据兜底：后端分页字段缺失时给空列表，避免调用方到处写 {@code ?? []}。 */
export function normalizePage<T>(page?: Partial<PageResult<T>> | null): PageResult<T> {
  return {
    records: Array.isArray(page?.records) ? page.records : [],
    total: Number.isFinite(page?.total) ? Number(page?.total) : 0,
    current: Number(page?.current) || 1,
    pageSize: Number(page?.pageSize) || 20,
    pages: Number(page?.pages) || 0,
  };
}

/** 分页查询（自动兜底空页）。 */
export async function requestPage<T>(
  url: string,
  options: RequestOptions = {},
): Promise<PageResult<T>> {
  const data = await requestData<Partial<PageResult<T>> | null>(url, options);
  return normalizePage<T>(data);
}

/** GET。 */
export function get<T>(url: string, options: Omit<RequestOptions, 'method'> = {}) {
  return requestData<T>(url, { ...options, method: 'GET' });
}

/** POST。 */
export function post<T>(
  url: string,
  data?: unknown,
  options: Omit<RequestOptions, 'method' | 'data'> = {},
) {
  return requestData<T>(url, { ...options, method: 'POST', data });
}

/** PUT。 */
export function put<T>(
  url: string,
  data?: unknown,
  options: Omit<RequestOptions, 'method' | 'data'> = {},
) {
  return requestData<T>(url, { ...options, method: 'PUT', data });
}

/** PATCH。 */
export function patch<T>(
  url: string,
  data?: unknown,
  options: Omit<RequestOptions, 'method' | 'data'> = {},
) {
  return requestData<T>(url, { ...options, method: 'PATCH', data });
}

/** DELETE。 */
export function del<T>(url: string, options: Omit<RequestOptions, 'method'> = {}) {
  return requestData<T>(url, { ...options, method: 'DELETE' });
}

/* ============================ 二进制上传 / 下载 ============================ */

/** 进度快照。 */
export interface BinaryProgress {
  loaded: number;
  /** 服务端未给出 Content-Length / 无法计算总长时为 0（此时 percent 恒为 0）。 */
  total: number;
  /** 0~100 的整数；总量未知时为 0。 */
  percent: number;
}

/** 计算进度（total 未知时 percent 保持 0，避免出现 NaN / Infinity）。 */
export function progressOf(loaded: number, total: number): BinaryProgress {
  const safeLoaded = Number.isFinite(loaded) && loaded > 0 ? loaded : 0;
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  return {
    loaded: safeLoaded,
    total: safeTotal,
    percent: safeTotal ? Math.min(100, Math.round((safeLoaded / safeTotal) * 100)) : 0,
  };
}

/** 二进制请求选项。 */
export interface BinaryOptions {
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  body?: XMLHttpRequestBodyInit | null;
  /** 上传进度（需要 body 可流式发送）。 */
  onUploadProgress?: (progress: BinaryProgress) => void;
  /** 下载进度（服务端带 Content-Length 时才有意义）。 */
  onDownloadProgress?: (progress: BinaryProgress) => void;
  /** 期望的响应类型：上传用 json（Result），下载用 blob。 */
  responseType?: 'json' | 'blob';
  /** 静默模式：不弹全局提示，错误照常抛出。 */
  silent?: boolean;
  signal?: AbortSignal;
  /** 是否携带 Cookie（CE 默认 JWT，保持 false 与全局实例一致）。 */
  withCredentials?: boolean;
}

/** 可注入依赖（单测用；生产走默认实现）。 */
export interface BinaryDeps {
  createXhr?: () => XMLHttpRequest;
  getToken?: () => string | null;
  /** 401(1002) 时的刷新动作，默认复用全局单飞刷新锁。 */
  refresh?: () => Promise<boolean>;
}

/** 中止错误（与 services/upload 的 isAbortError 判定保持一致）。 */
function abortError(): Error {
  const error = new Error(translateMessage('app.request.aborted'));
  error.name = 'AbortError';
  return error;
}

/** 从 Content-Disposition 解析文件名（RFC 5987 / 简单形式均支持）。 */
export function filenameFromDisposition(disposition?: string | null): string {
  if (!disposition) {
    return '';
  }
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      return encoded[1].trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1]?.trim() ?? '';
}

/**
 * 读取响应体：blob 场景下若服务端其实返回了 Result（错误 / B 类分支），需要转成 JSON 再判定。
 */
async function readBinaryBody(xhr: XMLHttpRequest, responseType: string): Promise<unknown> {
  if (responseType !== 'blob') {
    const text = xhr.responseText;
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  const blob = xhr.response as Blob | null;
  if (!blob) {
    return null;
  }
  const type = blob.type ?? '';
  const maybeJson = type.includes('json') || xhr.status >= 400;
  if (!maybeJson) {
    return blob;
  }
  try {
    return JSON.parse(await blob.text());
  } catch {
    return blob;
  }
}

/** 单次发送（不含重试）。 */
function sendOnce(
  createXhr: () => XMLHttpRequest,
  url: string,
  options: BinaryOptions,
  token: string | null,
): Promise<{ status: number; body: unknown; disposition: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = createXhr();
    const responseType = options.responseType ?? 'json';
    xhr.open(options.method ?? 'POST', url, true);
    xhr.responseType = responseType;
    xhr.withCredentials = options.withCredentials ?? false;
    // 二进制通道绕开了 axios 拦截器，语言头要在这里补一次，保持与 JSON 通道一致
    xhr.setRequestHeader('Accept-Language', currentAcceptLanguage());
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    for (const [key, value] of Object.entries(options.headers ?? {})) {
      xhr.setRequestHeader(key, value);
    }

    if (options.onUploadProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => options.onUploadProgress?.(progressOf(event.loaded, event.total));
    }
    if (options.onDownloadProgress) {
      xhr.onprogress = (event) => options.onDownloadProgress?.(progressOf(event.loaded, event.total));
    }

    let aborted = false;
    const onAbort = () => {
      aborted = true;
      xhr.abort();
    };
    options.signal?.addEventListener('abort', onAbort);
    if (options.signal?.aborted) {
      onAbort();
    }

    xhr.onerror = () => {
      options.signal?.removeEventListener('abort', onAbort);
      reject(new Error(translateMessage(DEFAULT_ERROR_MESSAGE_ID)));
    };
    xhr.ontimeout = () => {
      options.signal?.removeEventListener('abort', onAbort);
      reject(new Error(translateMessage('app.request.timeout')));
    };
    xhr.onabort = () => {
      options.signal?.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    xhr.onload = () => {
      options.signal?.removeEventListener('abort', onAbort);
      if (aborted) {
        reject(abortError());
        return;
      }
      readBinaryBody(xhr, responseType)
        .then((body) => {
          resolve({
            status: xhr.status,
            body,
            disposition: xhr.getResponseHeader('Content-Disposition'),
          });
        })
        .catch(() => reject(new Error(translateMessage('app.request.parseFailed'))));
    };

    xhr.send((options.body ?? null) as XMLHttpRequestBodyInit | null);
  });
}

/**
 * 二进制请求（上传 / 下载）：进度事件 + 401 静默刷新一次后重放。
 *
 * <p>刷新复用 {@link refreshTokenOnce} 的<b>全局单飞锁</b>：与 axios 链路并发时只会真正刷新一次，
 * 不会因为「上传 + 列表接口同时 401」把 refreshToken 用废。
 */
export async function binaryRequest<T>(
  url: string,
  options: BinaryOptions = {},
  deps: BinaryDeps = {},
): Promise<T> {
  const createXhr = deps.createXhr ?? (() => new XMLHttpRequest());
  const getToken = deps.getToken ?? (() => tokenStore.getAccessToken());
  const refresh = deps.refresh ?? refreshTokenOnce;

  let attempt = 0;
  for (;;) {
    const { status, body } = await sendOnce(createXhr, url, options, getToken());

    if (isResult(body)) {
      const result = body as Result<T>;
      if (isSuccess(result.code) || isFlowBranch(result.code)) {
        return result.data;
      }
      // 1002 = Token 过期：静默刷新一次后重放（只在第一次尝试时刷新）
      if (result.code === 1002 && attempt === 0) {
        attempt += 1;
        const refreshed = await refresh();
        if (refreshed) {
          continue;
        }
      }
      if (!options.silent) {
        presentError(result);
      }
      throw new BizError(result);
    }

    if (status >= 200 && status < 300) {
      return body as T;
    }
    // 非 Result 形态的 HTTP 错误（网关 / 静态资源 / 非契约端点）：
    // 文案与全局 errorHandler 的网络层兜底一致，且不把 HTTP 状态码塞进业务码空间
    const error = new Error(
      translateMessage('app.request.http', {
        message: translateMessage(DEFAULT_ERROR_MESSAGE_ID),
        status,
      }),
    );
    if (!options.silent) {
      message.error(error.message);
    }
    throw error;
  }
}

/** 上传（响应体为 Result JSON）。 */
export function uploadBinary<T>(
  url: string,
  body: XMLHttpRequestBodyInit | null,
  options: Omit<BinaryOptions, 'body' | 'responseType' | 'method'> & { method?: 'POST' | 'PUT' } = {},
  deps: BinaryDeps = {},
) {
  return binaryRequest<T>(
    url,
    { ...options, method: options.method ?? 'POST', body, responseType: 'json' },
    deps,
  );
}

/**
 * 下载（响应体为 Blob）。
 *
 * <p>注意：下载失败时后端返回的是 JSON {@code Result}（Content-Type 为 json），
 * {@link binaryRequest} 已按 Content-Type 自动分支解析，不会把错误页当成文件保存。
 */
export function downloadBinary(
  url: string,
  options: Omit<BinaryOptions, 'responseType' | 'method'> & { method?: 'GET' } = {},
  deps: BinaryDeps = {},
) {
  return binaryRequest<Blob>(url, { ...options, method: 'GET', responseType: 'blob' }, deps);
}

/**
 * objectURL 的释放延迟。
 *
 * <p>浏览器不提供「下载管理器已接管这份 blob」的事件，只能按经验延后释放。火狐对 `blob:`
 * 下载是<b>异步接管</b>的：`click()` 之后同步 `revokeObjectURL` 会让它在读取数据前失效，
 * 表现为下载中断或文件名丢失——而 Chrome 多数情况下侥幸不出问题（同步释放时它已经把数据
 * 取走了），所以这类 bug 只在火狐上暴露。</p>
 */
export const OBJECT_URL_REVOKE_DELAY_MS = 60_000;

/**
 * 触发浏览器保存（非浏览器环境返回 false，便于单测）。
 *
 * <p>只用于<b>必须在 JS 里拿到内容</b>的场景（导出报表等）。普通文件下载请走
 * {@link startNativeDownload}：把整份文件读成 Blob 会绕开浏览器的下载管理器。</p>
 */
export function saveBlob(blob: Blob, fileName: string): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return false;
  }
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName || 'download';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 不能紧跟 click 同步撤销，原因见 OBJECT_URL_REVOKE_DELAY_MS
  setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_REVOKE_DELAY_MS);
  return true;
}

/**
 * 把取件地址交给**浏览器原生下载通道**（非浏览器环境返回 false，便于单测）。
 *
 * <p><b>为什么必须走原生，而不是「XHR 取整份 → Blob → {@link saveBlob}」：</b></p>
 * <ul>
 *   <li><b>下载提示</b>：只有被下载管理器接管的传输才会进入浏览器的下载面板 / 下载列表并给出
 *       进度。Blob 落盘是「内存 → 磁盘」的拷贝，火狐不会为它显示任何下载提示——这正是
 *       「文件确实下来了、浏览器却毫无反应」的原因；</li>
 *   <li><b>Range 续传</b>：服务端对本类端点声明了 `Accept-Ranges: bytes` 并实现了 206/416
 *       （见 `FileDownloadService`），而「先整份读进 Blob」用不上任何一条——天然无法断点续传；</li>
 *   <li><b>内存</b>：`responseType: 'blob'` 会让整个文件驻留内存，服务端辛苦做的分块流式限速
 *       在客户端被一次性重新缓冲；</li>
 *   <li><b>文件名</b>：服务端已下发 RFC 5987 的 `filename*`（中文名不乱码），原生下载直接沿用；
 *       Blob 路径只能用前端自己拼的名字。</li>
 * </ul>
 *
 * <p><b>为什么是「隐藏 {@code <a>} 点击」而不是隐藏 iframe：</b>整个应用都挂在 Spring Security
 * 之下，其默认响应头会给<b>所有</b>响应（含免登录的取件端点）写 {@code X-Frame-Options: DENY}；
 * 该头<b>只约束框架</b>，iframe 会被直接拒载——表现为「点了下载，但什么都没发生」
 * （同源的 {@code <img>} 不受该头影响，所以缩略图一直是好的，容易误判成「取件本身有问题」）。
 * {@code <a>} 不创建框架，不在 X-Frame-Options 的管辖范围内；配合下面的 {@code download} 属性，
 * 浏览器直接把它交给下载管理器并留在当前页面，与分享页访客侧的下载入口是同一套做法。</p>
 *
 * <p><b>必须带 {@code download} 属性，不能只靠服务端的 {@code Content-Disposition}：</b>
 * 不带时浏览器在点击那一刻只能把它当<b>顶层导航</b>（`attachment` 要等响应头回来才知道），
 * 于是当前文档开始卸载、页面里的 WebSocket 被断开，开发服务器的 HMR 客户端据此误判
 * 「服务重启」并触发整页 reload —— 这次 reload 会把尚在飞行中的取件导航取消掉。
 * 火狐稳定复现（`NS_BINDING_ABORTED`，点完什么都不落盘），Chrome 只是抢先到达下载管理器，
 * 所以同一个 bug 只在火狐上暴露；分享页访客侧同理。{@code download} 对<b>同源</b>地址一定
 * 生效（取件地址正是同源），且它<b>不要求用户激活态</b>——本函数总是在 {@code await} 换票之后
 * 才被调用，激活态可能已经过期，这一点与 {@code target="_blank"} 不同。</p>
 *
 * <p>代价：带 {@code download} 后，取件端点返回 JSON 错误体时会被落成一个文件而不是渲染成页面
 * （错误只可能来自「票据刚签发就失效」，TTL 5 分钟、当次即刻取件，风险可忽略）。</p>
 *
 * <p><b>已知取舍：</b>交出去之后前端拿不到回执（浏览器没有「下载已开始」事件），因此调用方
 * 只能提示「已开始下载」，百分比进度改由浏览器自己呈现。</p>
 *
 * @param fileName 兜底文件名。服务端已下发 RFC 5987 的 {@code filename*} 时以服务端为准，
 *   这里只在响应头缺失文件名时生效
 */
export function startNativeDownload(url: string, fileName?: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  const link = document.createElement('a');
  link.href = url;
  // 同源取件也显式切断 opener：这一跳要么是下载要么是错误体，都不该拿到对本站窗口的引用
  link.rel = 'noopener';
  // 见上方说明：这个属性的存在与否，决定浏览器把取件当「下载」还是「顶层导航」
  link.download = fileName || '';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  // 只在这一次点击期间需要它；留在 DOM 里会让后续 querySelector / 表单提交带上一个游离链接
  document.body.removeChild(link);
  return true;
}

export { request };
