/**
 * 统一响应体契约（对应 docs/api/README.md §2 / §3 与 docs/api/error-codes.md）
 *
 * 单一事实源在后端 `server/at-common/.../result/`，本文件为前端镜像：
 * - 响应体恒为 `Result{code,message,data,traceId}`，前端以 `body.code` 为业务主判据；
 * - HTTP 状态只表达传输/资源层语义，业务分支一律看 `code`。
 */

/** 统一响应体 */
export interface Result<T = unknown> {
  /** 业务状态码：0 成功，非 0 见错误码表 */
  code: number;
  /** 人类可读提示（成功或失败原因） */
  message: string;
  /** 业务载荷，无数据为 null */
  data: T;
  /** 链路追踪 ID，一次请求内唯一，排障凭证 */
  traceId: string;
}

/** 统一分页结构（Result.data 的固定形态） */
export interface PageResult<T = unknown> {
  /** 当前页数据（无数据时为空数组） */
  records: T[];
  /** 总记录数 */
  total: number;
  /** 当前页码（从 1 开始） */
  current: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  pages: number;
}

/** 双令牌（JWT） */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** 成功码 */
export const SUCCESS_CODE = 0;
/** access token 过期：唯一允许「静默刷新后重放一次」的错误码 */
export const TOKEN_EXPIRED_CODE = 1002;
/** 账号或密码错误：由登录接口返回，不得触发跳登录 */
export const BAD_CREDENTIALS_CODE = 1007;
/** 网络异常等拿不到响应体时的兜底文案 */
export const DEFAULT_ERROR_MESSAGE = '网络异常，请检查网络后重试';

/**
 * 处理策略（docs/api/error-codes.md §二）
 *
 * 分类依据是「前端该做什么」，而非 HTTP 状态或数字分段——
 * 同一个 HTTP 200 既可能是成功，也可能是「秒传未命中，请继续上传」的流程分支。
 */
export const HandleStrategy = {
  /** A：成功，读 data */
  SUCCESS: 'A',
  /** B：流程分支（HTTP 200 + code≠0），不提示错误，按 data 走业务分支 */
  FLOW_BRANCH: 'B',
  /** C：凭证失效（401），静默刷新或跳登录 */
  CREDENTIAL: 'C',
  /** D：拒绝且不跳登录（403），就地提示 */
  DENY: 'D',
  /** E：请求需修正（400/404/413/415），定位字段或资源后重新发起 */
  BAD_REQUEST: 'E',
  /** F：状态失效/冲突（409/410），刷新状态后重试 */
  STATE_CONFLICT: 'F',
  /** G：限流/锁定（429），退避后重试 */
  THROTTLE: 'G',
  /** H：系统兜底（500/502），统一提示并展示 traceId */
  SYSTEM: 'H',
} as const;

export type HandleStrategy =
  (typeof HandleStrategy)[keyof typeof HandleStrategy];

/**
 * 错误码 → 处理策略映射（与后端 ErrorCode 枚举逐条对齐）。
 * 新增错误码必须同时登记到此表，否则会退化为兜底策略。
 */
const STRATEGY_BY_CODE: Record<number, HandleStrategy> = {
  0: HandleStrategy.SUCCESS,

  // 1xxx 认证授权
  1001: HandleStrategy.CREDENTIAL,
  1002: HandleStrategy.CREDENTIAL,
  1003: HandleStrategy.DENY, // 无权限：403 就地提示，绝不跳登录
  1004: HandleStrategy.DENY, // 账号锁定
  1005: HandleStrategy.DENY, // 账号禁用
  1006: HandleStrategy.CREDENTIAL, // 令牌无效：清会话并跳登录
  1007: HandleStrategy.CREDENTIAL,
  1008: HandleStrategy.FLOW_BRANCH,
  1009: HandleStrategy.FLOW_BRANCH,
  1010: HandleStrategy.BAD_REQUEST,

  // 2xxx 参数校验
  2001: HandleStrategy.BAD_REQUEST,
  2002: HandleStrategy.BAD_REQUEST,
  2003: HandleStrategy.BAD_REQUEST,
  2004: HandleStrategy.BAD_REQUEST,
  2005: HandleStrategy.BAD_REQUEST,

  // 4xxx 文件 / 传输
  4001: HandleStrategy.FLOW_BRANCH,
  4002: HandleStrategy.FLOW_BRANCH,
  4003: HandleStrategy.STATE_CONFLICT,
  4004: HandleStrategy.STATE_CONFLICT,
  4005: HandleStrategy.BAD_REQUEST,
  4006: HandleStrategy.BAD_REQUEST,
  4007: HandleStrategy.BAD_REQUEST,
  4008: HandleStrategy.BAD_REQUEST,
  4009: HandleStrategy.BAD_REQUEST,
  4010: HandleStrategy.DENY,
  4011: HandleStrategy.THROTTLE,
  4012: HandleStrategy.STATE_CONFLICT,
  4040: HandleStrategy.BAD_REQUEST,
  4101: HandleStrategy.BAD_REQUEST,
  4102: HandleStrategy.STATE_CONFLICT,
  4103: HandleStrategy.THROTTLE,
  4290: HandleStrategy.THROTTLE, // @RateLimit 通用限流

  // 5xxx 系统异常
  5001: HandleStrategy.SYSTEM,
  5002: HandleStrategy.SYSTEM,
  5003: HandleStrategy.SYSTEM,
  5999: HandleStrategy.SYSTEM,
};

/**
 * 解析错误码对应的处理策略。
 *
 * 未登记的码按首段数字降级推断（1→D、2/4→E、其余→H），
 * 并在开发期告警——未登记即意味着后端违反了「错误码须先入表」的约定。
 */
export function resolveStrategy(code?: number): HandleStrategy {
  if (code === undefined || code === null || Number.isNaN(code)) {
    return HandleStrategy.SYSTEM;
  }
  const mapped = STRATEGY_BY_CODE[code];
  if (mapped) {
    return mapped;
  }
  if (code === SUCCESS_CODE) {
    return HandleStrategy.SUCCESS;
  }
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      `[anttransfer] 错误码 ${code} 未登记处理策略，已降级处理；请同步 docs/api/error-codes.md 与本文件 STRATEGY_BY_CODE`,
    );
  }
  if (code >= 1000 && code < 2000) {
    return HandleStrategy.DENY;
  }
  if (code >= 2000 && code < 5000) {
    return HandleStrategy.BAD_REQUEST;
  }
  return HandleStrategy.SYSTEM;
}

/** 是否业务成功（A 类） */
export function isSuccess(code?: number): boolean {
  return code === SUCCESS_CODE;
}

/**
 * 是否流程分支码（B 类）。
 *
 * B 类虽然 `code≠0`，但 HTTP 仍为 200，属于「正常业务分支」而非失败：
 * 1008 已有生效授权、1009 已有在审申请、4001 秒传未命中、4002 分片缺失。
 * 拦截器对这类响应**禁止弹错误提示**，由调用方按 `data` 走分支。
 */
export function isFlowBranch(code?: number): boolean {
  return resolveStrategy(code) === HandleStrategy.FLOW_BRANCH;
}

/** 是否统一响应体结构（用于识别非 Result 的第三方/模板接口响应） */
export function isResult(body: unknown): body is Result {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Result).code === 'number' &&
    'message' in body &&
    'data' in body
  );
}
