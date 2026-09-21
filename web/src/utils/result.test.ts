/**
 * 错误提示归属判定：`isErrorHandledByRequestLayer`。
 *
 * <p>这个判定存在的唯一理由是**避免同一句话弹两遍**：全局错误链路
 * （`requestErrorConfig` 的 `errorHandler`）对「业务错误 / 带响应体的 HTTP 错误 /
 * 无响应体的网络异常」三类都会提示，而 `errorHandler` 执行完 Umi 仍会 reject、
 * 页面的 `catch` 照样会跑到。若页面再无脑 `message.error` 一次，用户就会看到
 * 两条一模一样的提示（并误以为操作被提交了两次）。</p>
 *
 * <p>因此把「哪些形态算已被提示」当成契约钉住：只有不经 request 通道的同步异常
 * 才需要页面就地兜底。</p>
 */
import { describe, expect, it } from 'vitest';

import { isErrorHandledByRequestLayer } from './result';

describe('isErrorHandledByRequestLayer', () => {
  it('业务错误（errorThrower 构造的 BizError）视为已提示', () => {
    expect(
      isErrorHandledByRequestLayer({
        name: 'BizError',
        message: '无权限',
        info: { code: 1003 },
      }),
    ).toBe(true);
  });

  it('带响应体的 axios 错误（HTTP 4xx/5xx）视为已提示', () => {
    expect(
      isErrorHandledByRequestLayer({
        isAxiosError: true,
        message: '请求体格式错误，请检查 JSON 与字段类型',
        response: { status: 400, data: { code: 2004 } },
      }),
    ).toBe(true);
  });

  it('无响应体的网络异常（仅有 request）视为已提示', () => {
    expect(isErrorHandledByRequestLayer({ request: {} })).toBe(true);
  });

  it('组件自身抛出的同步异常需要页面兜底', () => {
    expect(isErrorHandledByRequestLayer(new Error('本地校验失败'))).toBe(false);
  });

  it('非对象入参需要页面兜底', () => {
    expect(isErrorHandledByRequestLayer(undefined)).toBe(false);
    expect(isErrorHandledByRequestLayer(null)).toBe(false);
    expect(isErrorHandledByRequestLayer('boom')).toBe(false);
  });
});
