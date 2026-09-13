/**
 * 网络层统一契约配置（Umi Max request / axios 底座）
 *
 * 契约来源：
 * - `docs/api/README.md` §2 统一响应体、§3 分页、§5 鉴权、§6 错误处理、§7 前端对接约定；
 * - `docs/api/error-codes.md` §二 处理策略分类（A~H）。
 *
 * 核心原则：
 * 1. **业务判据是 `body.code`，不是 HTTP 状态**——HTTP 状态只决定「是否进入错误通道」
 *    （Umi 的 axios 实例对非 2xx 直接 reject）；
 * 2. **B 类流程分支码（1008/1009/4001/4002）绝不是错误**：它们 HTTP 200 且携带 `data`
 *    供前端走业务分支（已有生效授权 / 已有在审申请 / 秒传未命中 / 分片缺失），
 *    任何位置都不得对其弹错误提示；
 * 3. 其余非 0 码统一经 {@link presentError} 按策略提示，5xxx 附 `traceId` 便于上报排障。
 */
import type { RequestConfig } from '@umijs/max';
import { history, request } from '@umijs/max';
import { message, notification } from 'antd';

import {
  BAD_CREDENTIALS_CODE,
  DEFAULT_ERROR_MESSAGE,
  HandleStrategy,
  isFlowBranch,
  isResult,
  isSuccess,
  type Result,
  resolveStrategy,
  TOKEN_EXPIRED_CODE,
  type TokenPair,
} from './utils/result';
import { tokenStore } from './utils/token';

/** 登录页路径（Ant Design Pro 模板） */
const LOGIN_PATH = '/user/login';
/** 刷新令牌端点（契约 §5；请求体字段名以后端最终实现为准） */
const REFRESH_URL = '/api/v1/auth/token/refresh';

/** 重放标记：防止 401 重试死循环 */
const RETRY_FLAG = '__anttransferRetried';

/**
 * refresh 单飞（single-flight）：并发多个 401 时只发一次刷新请求，
 * 其余请求共享同一个 Promise，避免 refresh 轮换导致的「后到者拿旧令牌」竞态。
 */
let refreshing: Promise<boolean> | null = null;

async function doRefreshToken(): Promise<boolean> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) {
    return false;
  }
  try {
    // skipErrorHandler：刷新失败由本函数静默吞掉并降级为「需要重新登录」，
    // 不触发全局错误提示（用户无感知的后台续期）
    const body = await request<Result<TokenPair>>(REFRESH_URL, {
      method: 'POST',
      data: { refreshToken },
      skipErrorHandler: true,
    });
    if (isResult(body) && isSuccess(body.code) && body.data?.accessToken) {
      // refresh 轮换：新令牌对覆盖旧令牌对，旧 refresh 即刻失效
      tokenStore.setTokens(body.data.accessToken, body.data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function refreshTokenOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = doRefreshToken().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** 清除令牌并跳转登录（若已在登录页则不重复跳转） */
function redirectToLogin(): void {
  tokenStore.clear();
  if (
    typeof window !== 'undefined' &&
    window.location?.pathname === LOGIN_PATH
  ) {
    return;
  }
  try {
    history?.push?.(LOGIN_PATH);
  } catch {
    if (typeof window !== 'undefined') {
      window.location.href = LOGIN_PATH;
    }
  }
}

/** 为 axios 配置写入（或覆盖）Authorization 头，兼容 AxiosHeaders 与普通对象两种形态 */
function withAuthHeader(config: any, token: string): any {
  const value = `Bearer ${token}`;
  if (config.headers && typeof config.headers.set === 'function') {
    config.headers.set('Authorization', value);
  } else {
    config.headers = { ...(config.headers ?? {}), Authorization: value };
  }
  return config;
}

/**
 * 按处理策略呈现错误（B/A 类直接返回，不提示）。
 */
function presentError(result: Result, opts?: { silent?: boolean }): void {
  if (opts?.silent) {
    return;
  }
  const { code, message: text, traceId } = result;
  const strategy = resolveStrategy(code);

  switch (strategy) {
    // A 成功 / B 流程分支：绝不提示。B 类 HTTP 200 且 code≠0 属正常分支，
    // 若被误当错误弹窗，会打断「秒传未命中→继续上传」「已有在审申请→跳待办」等主流程。
    case HandleStrategy.SUCCESS:
    case HandleStrategy.FLOW_BRANCH:
      return;

    case HandleStrategy.CREDENTIAL: {
      // 1007 由登录接口自身返回：只提示「账号或密码错误」，不得清令牌或跳转
      if (code === BAD_CREDENTIALS_CODE) {
        message.error(text);
        return;
      }
      // 1001 未登录 / 1006 令牌无效 / 1002 且刷新失败：清理会话后跳登录
      redirectToLogin();
      return;
    }

    case HandleStrategy.DENY:
      // 403：无权限 / 已锁定 / 已禁用 / 提取码错误，就地提示且不引导登录
      message.warning(text);
      return;

    case HandleStrategy.STATE_CONFLICT:
      // 409 / 410：状态已失效，提示用户刷新后重试
      message.warning(text);
      return;

    case HandleStrategy.THROTTLE:
      // 429：限流或锁定，提示退避
      message.warning(`${text}，请稍后重试`);
      return;

    case HandleStrategy.SYSTEM:
      // 5xx：统一兜底文案 + traceId，便于用户上报
      notification.error({
        message: text,
        description: traceId ? `traceId：${traceId}` : undefined,
        placement: 'topRight',
      });
      return;

    // E 类（400/404/413/415）与任何未覆盖情形：提示具体原因
    default:
      message.error(text);
  }
}

/** 构造业务错误（携带 code / traceId / 策略，供调用方按需处理） */
function createBizError(result: Result): Error {
  const error: any = new Error(result.message);
  error.name = 'BizError';
  error.info = {
    code: result.code,
    message: result.message,
    data: result.data,
    traceId: result.traceId,
    strategy: resolveStrategy(result.code),
  };
  return error;
}

/**
 * 响应成功拦截：只做可观测性，**绝不对 B 类分支码做错误提示**。
 */
const responseInterceptor = (response: any): any => {
  const body = response?.data;
  if (isResult(body) && !isSuccess(body.code) && !isFlowBranch(body.code)) {
    // 契约要求：非 A/B 类响应不得使用 HTTP 200（否则前端无法进入错误通道）
    console.warn(
      `[anttransfer] HTTP 200 但 code=${body.code}（traceId=${body.traceId}）：非 A/B 类错误码不应返回 200，请检查后端 HTTP 映射`,
    );
  }
  return response;
};

/**
 * 响应失败拦截：1002 静默刷新令牌后**重放原请求**（透明续期，调用方无感知）。
 *
 * 放在响应拦截器而非 errorHandler 的原因：errorHandler 执行后 Umi 仍会 reject，
 * 只有在这里恢复才能让原始 Promise 拿到重放结果。
 */
const responseErrorInterceptor = async (error: any): Promise<any> => {
  const config = error?.config;
  const body = error?.response?.data;
  const url = typeof config?.url === 'string' ? config.url : '';

  const isTokenExpired =
    error?.response?.status === 401 &&
    isResult(body) &&
    body.code === TOKEN_EXPIRED_CODE;
  // 认证端点自身返回 401 不得重放（否则登录失败会无限循环）
  const isAuthEndpoint = url.includes('/auth/token');

  if (!isTokenExpired || isAuthEndpoint || !config || config[RETRY_FLAG]) {
    return Promise.reject(error);
  }

  const refreshed = await refreshTokenOnce();
  if (!refreshed) {
    return Promise.reject(error);
  }

  config[RETRY_FLAG] = true;
  const accessToken = tokenStore.getAccessToken();
  if (accessToken) {
    withAuthHeader(config, accessToken);
  }

  // 重放结果需为 AxiosResponse 形态：Umi 内部对响应取 res.data
  const data = await request(config.url, { ...config, skipErrorHandler: true });
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};

export const errorConfig: RequestConfig = {
  errorConfig: {
    /**
     * 业务错误抛出器：仅对非 A、非 B 的响应抛错。
     * 说明：Umi 只会在 `data.success === false` 时调用它，而后端统一响应体不含 success 字段，
     * 因此该分支主要用于兼容模板接口；契约接口的错误统一走 errorHandler。
     */
    errorThrower: (res: any) => {
      if (!isResult(res)) {
        if (res?.success === false) {
          throw createBizError({
            code: res.errorCode ?? 5001,
            message: res.errorMessage ?? DEFAULT_ERROR_MESSAGE,
            data: res.data,
            traceId: '',
          });
        }
        return;
      }
      if (isSuccess(res.code) || isFlowBranch(res.code)) {
        return;
      }
      throw createBizError(res);
    },

    /**
     * 错误处理器：按策略呈现，网络层异常走兜底文案。
     */
    errorHandler: (error: any, opts: any) => {
      if (opts?.skipErrorHandler) {
        throw error;
      }

      // ① 业务错误（errorThrower 抛出）
      if (error?.name === 'BizError' && error?.info) {
        presentError(
          {
            code: error.info.code,
            message: error.info.message,
            data: error.info.data,
            traceId: error.info.traceId,
          },
          opts,
        );
        return;
      }

      // ② 带统一响应体的 HTTP 错误（401/403/4xx/5xx）
      const body = error?.response?.data;
      if (isResult(body)) {
        presentError(body, opts);
        return;
      }

      // ③ 无响应体：网络层异常
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        message.error('网络不可用，请检查网络连接后重试');
        return;
      }
      if (error?.response?.status) {
        message.error(
          `${DEFAULT_ERROR_MESSAGE}（HTTP ${error.response.status}）`,
        );
        return;
      }
      message.error(DEFAULT_ERROR_MESSAGE);
    },
  },

  requestInterceptors: [
    (config: any) => {
      const accessToken = tokenStore.getAccessToken();
      if (accessToken) {
        return withAuthHeader(config, accessToken);
      }
      return config;
    },
  ],

  responseInterceptors: [[responseInterceptor, responseErrorInterceptor]],
};

// 便于单测与调用方复用
export { presentError, redirectToLogin, resolveStrategy };
