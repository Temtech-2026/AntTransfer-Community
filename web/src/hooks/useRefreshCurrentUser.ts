/**
 * 让「当前登录用户」的全局状态立即跟上服务端。
 *
 * <p><b>为什么需要它：</b>顶栏头像（`components/RightContent`）与头像下拉里的个人信息弹窗
 * 读的都是 `initialState.currentUser`，而这份状态在登录时拉一次之后就没有任何刷新时机。
 * 于是「改了当前登录用户的资料」这类操作会出现一个很别扭的现象——接口已经成功、
 * 数据库已经变了，界面上却还是旧值，只有刷新整页才更新。刷新整页这个动作本身
 * 又会让用户丢掉当前的表单 / 筛选 / 分页状态。</p>
 *
 * <p><b>为什么不自己拼一个用户对象塞进状态：</b>头像地址由服务端拼（含 `?v=` 缓存版本号），
 * 前端无法凭「刚上传成功」这件事推出新的地址。凡是「客户端猜服务端下发的值」，
 * 迟早会与真实值分叉，所以这里一律重新拉一次 `/auth/me`。</p>
 *
 * <p><b>失败时不清空：</b>`fetchUserInfo` 在会话失效时会清登录态并跳登录页，
 * 此时返回 `undefined`；若把 `undefined` 写进状态，正常页面会先闪一次「未登录」。
 * 因此只在拿到结果时才更新。</p>
 */
import { useCallback } from 'react';
import { useModel } from '@umijs/max';

/**
 * @returns 一个异步刷新函数：重新拉取当前用户并写入全局状态；调用方无需关心失败
 *   （会话仍有效时它一定会成功；失效时登录跳转已经由请求链路接管）。
 */
export default function useRefreshCurrentUser() {
  const { initialState, setInitialState } = useModel('@@initialState');

  return useCallback(async () => {
    const fetchUserInfo = initialState?.fetchUserInfo;
    if (!fetchUserInfo) {
      // 极早期渲染（登录页）没有 initialState：没有「当前用户」可刷新，静默返回
      return;
    }
    const currentUser = await fetchUserInfo();
    if (!currentUser) {
      // 拉取失败：登录链路已接管跳转，此处保持原状态，避免渲染出「未登录」的瞬时中间态
      return;
    }
    setInitialState((state) => (state ? { ...state, currentUser } : state));
  }, [initialState?.fetchUserInfo, setInitialState]);
}
