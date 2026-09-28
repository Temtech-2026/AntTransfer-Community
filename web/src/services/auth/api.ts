/**
 * 认证域 API。
 *
 * <p>全部走 `services/request` 统一封装（Bearer 注入、Result 识别、1002 静默刷新一次），
 * 这里只负责「路径 + 参数 + 令牌落盘」三件事。</p>
 */

import { requestData, uploadBinary } from '@/services/request';
import { tokenStore } from '@/utils/token';

import { AUTH_ENDPOINTS } from './endpoints';
import type { AuthUserSummary, ChangePasswordRequest, TokenResponse } from './types';

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

/**
 * 本人自助改密（原口令再确认 + 强度校验）。
 *
 * <p>成功后<b>服务端已全端吊销</b>（`token_epoch + 1` 并在提交后清 Redis 会话 / 纪元镜像键），连
 * 发起本次请求的 access token 也当场作废。因此这里在成功分支立即清本地令牌——与 `loginByPassword` 对称，
 * 「令牌落盘 / 清盘」都收敛在 API 层，调用方只需负责清内存态并回登录页。</p>
 *
 * <p>失败时（1029 原口令不符 / 1030 强度不合规 / 1005 账号停用）<b>不清令牌</b>：请求本身
 * 被拒，会话仍然有效，弹窗应保持打开让用户就地修正。用 `silent` 是为了让这些码由表单
 * 就地呈现，而不是被全局 `message.error` 抢先弹一次。</p>
 */
export async function changePassword(payload: ChangePasswordRequest): Promise<void> {
  await requestData<void>(AUTH_ENDPOINTS.changePassword, {
    method: 'PUT',
    data: payload,
    silent: true,
  });
  tokenStore.clear();
}

/**
 * 本人更换头像（multipart，<b>上传即生效</b>，无需再点「保存」）。
 *
 * <p>走 {@link uploadBinary} 而不是 `post`：multipart 必须由 XHR 直接发（axios 实例会把
 * FormData 再包一层，服务端拿不到 `file` 部件），且这条通道自带 401 静默刷新重放，
 * 与 JSON 通道共用同一把单飞锁。</p>
 *
 * <p><b>刻意不设置 `Content-Type`</b>：boundary 必须由浏览器生成，手写会丢掉 boundary
 * 导致服务端 400（或解析出空文件）。</p>
 *
 * <p><b>与 `services/system#uploadUserAvatar` 的区别不只是路径：</b>那条需要
 * `system:user:update` 权限点、用于管理员改<b>他人</b>；本条无权限点、只改<b>自己</b>。
 * 两者都回变更后的用户摘要，调用方据此就地换图。</p>
 *
 * @param file 已通过 `checkAvatarFile` 预检的图片；服务端仍会按文件头魔数复核类型，
 *   客户端 MIME 不是判定依据
 * @returns 变更后的本人摘要（含新的头像地址，已带 `?v=` 缓存版本号；服务端未返回时为 undefined）
 */
export function uploadMyAvatar(file: File): Promise<AuthUserSummary> {
  const form = new FormData();
  // 字段名固定 file：与后端 @RequestPart("file") 逐字一致
  form.append('file', file);
  return uploadBinary<AuthUserSummary>(AUTH_ENDPOINTS.myAvatar, form);
}
