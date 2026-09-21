import { describe, expect, it } from 'vitest';

import { SHARE_VISIT_ENDPOINTS } from './endpoints';

describe('SHARE_VISIT_ENDPOINTS', () => {
  it('换票端点把 token 嵌进路径', () => {
    expect(SHARE_VISIT_ENDPOINTS.verify('AbC123')).toBe('/api/v1/shares/AbC123/verify');
  });

  it('核销端点是固定路径（票据走请求体，不进 URL）', () => {
    expect(SHARE_VISIT_ENDPOINTS.redeem).toBe('/api/v1/shares/redeem');
  });

  it('取件地址同时转义 token 与票据', () => {
    expect(SHARE_VISIT_ENDPOINTS.content('AbC123', 'plain')).toBe(
      '/api/v1/shares/AbC123/content?ticket=plain',
    );
  });

  it('票据含 + / = 时按查询串转义（不转义会被截断成另一个票据）', () => {
    const url = SHARE_VISIT_ENDPOINTS.content('AbC123', 'a+b/c=');

    expect(url).toBe('/api/v1/shares/AbC123/content?ticket=a%2Bb%2Fc%3D');
    // 断言解析回来的票据与原文一致，而不是只看字符串长得像
    const query = url.slice(url.indexOf('?') + 1);
    expect(new URLSearchParams(query).get('ticket')).toBe('a+b/c=');
  });

  it('token 含保留字符时同样转义（避免越出单段路径）', () => {
    expect(SHARE_VISIT_ENDPOINTS.verify('a/b?c')).toBe('/api/v1/shares/a%2Fb%3Fc/verify');
  });
});
