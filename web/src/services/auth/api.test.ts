/**
 * 认证域 API 单测（重点：自助改密的「成功才清令牌」语义）。
 *
 * <p>为什么这条必须有回归：后端改密成功 = `token_epoch + 1` 全端吊销，本地令牌若不清，
 * 页面会拿着已作废的令牌继续发请求，用户看到的是一连串 401 而不是「请重新登录」；
 * 反过来，失败（1029/1030/1005）时若误清令牌，一次输错口令就被强制登出——
 * 两个方向都是可见故障，因此断言必须成对写。</p>
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }));

vi.mock('@/services/request', () => ({
  requestData,
}));

import { tokenStore } from '@/utils/token';

import { changePassword } from './api';
import { AUTH_ENDPOINTS } from './endpoints';

const PAYLOAD = { oldPassword: 'OldPass123', newPassword: 'NewPass456' };

describe('services/auth #changePassword', () => {
  beforeEach(() => {
    requestData.mockReset();
    tokenStore.clear();
  });

  it('PUT /v1/auth/password，走 silent 通道（错误由表单就地呈现）', async () => {
    requestData.mockResolvedValue(undefined);
    await changePassword(PAYLOAD);

    expect(requestData).toHaveBeenCalledWith(AUTH_ENDPOINTS.changePassword, {
      method: 'PUT',
      data: PAYLOAD,
      silent: true,
    });
    expect(AUTH_ENDPOINTS.changePassword).toBe('/api/v1/auth/password');
  });

  it('成功后立即清空本地双令牌（服务端已全端吊销，含当前会话）', async () => {
    tokenStore.setTokens('old-access', 'old-refresh');
    requestData.mockResolvedValue(undefined);

    await changePassword(PAYLOAD);

    expect(tokenStore.getAccessToken()).toBeNull();
    expect(tokenStore.getRefreshToken()).toBeNull();
  });

  it('失败时保留令牌：请求被拒不等于会话失效，弹窗应留在原地让用户修正', async () => {
    tokenStore.setTokens('live-access', 'live-refresh');
    requestData.mockRejectedValue(new Error('原密码不正确'));

    await expect(changePassword(PAYLOAD)).rejects.toThrow('原密码不正确');

    expect(tokenStore.getAccessToken()).toBe('live-access');
    expect(tokenStore.getRefreshToken()).toBe('live-refresh');
  });
});
