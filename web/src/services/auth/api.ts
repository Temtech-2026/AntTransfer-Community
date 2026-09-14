/**
 * 认证域 API。
 *
 * <p>全部走 `services/request` 统一封装（Bearer 注入、Result 识别、1002 静默刷新一次），
 * 这里只负责「路径 + 参数 + 令牌落盘」三件事。</p>
 */

import { requestData } from '@/services/request';
import { tokenStore } from '@/utils/token';

import { AUTH_ENDPOINTS } from './endpoints';
import type { AuthUserSummary, TokenResponse } from './types';

/**
 * 账号密码登录，成功后立即落盘双令牌。
 *
 * <p>刻意使用 silent：登录失败（1007 账号或密码错误 / 1004 锁定 / 1005 禁用）必须由登录页
 * 就地呈现（锁定还要挂倒计时），不能被全局 `message.error` 抢先弹一次、然后页面再弹一次。</p>
 *
 * <p>令牌落盘放在这一层而不是页面：登录态的唯一事实源是本地令牌，任何调用方（登录页、
 * 未来的扫码登录）都应得到「返回即已具备会话」的保证。</p>
 *
 * @returns 登录用户摘要（后端未返回时为 undefined，调用方可回退到 /me）
 */
export async function loginByPassword(
  username: string,
  password: string,
): Promise<AuthUserSummary | undefined> {
  const data = await requestData<TokenResponse>(AUTH_ENDPOINTS.login, {
    method: 'POST',
    data: { username, password },
    silent: true,
  });
  if (data?.accessToken && data?.refreshToken) {
    tokenStore.setTokens(data.accessToken, data.refreshToken);
  }
  return data?.user ?? undefined;
}

/** 当前登录用户摘要（刷新页面后恢复会话）。 */
export function fetchProfile(): Promise<AuthUserSummary> {
  return requestData<AuthUserSummary>(AUTH_ENDPOINTS.me, { method: 'GET', silent: true });
}

/**
 * 注销（本地 + 服务端）。
 *
 * <p>服务端吊销放在 try、清本地令牌放在 finally：无论吊销请求是否成功，本地令牌都必须清掉，
 * 否则会留下「已经点了退出、但本地仍能继续发请求」的假会话。服务端失败只影响其它端的
 * 立即吊销，不影响本端登出。</p>
 */
export async function logout(): Promise<void> {
  try {
    await requestData<void>(AUTH_ENDPOINTS.logout, { method: 'POST', silent: true });
  } finally {
    tokenStore.clear();
  }
}
