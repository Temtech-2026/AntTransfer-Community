import { message } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BizError,
  filenameFromDisposition,
  normalizePage,
  progressOf,
  saveBlob,
  startNativeDownload,
  toBizError,
  uploadBinary,
} from './request';
import { HandleStrategy } from '@/utils/result';

vi.mock('antd', () => ({
  message: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
  notification: {
    error: vi.fn(),
    open: vi.fn(),
  },
}));

vi.mock('@umijs/max', async () => {
  // services/request 的非 Result 兜底文案走 getIntl()，接真实 zh-CN 语言包
  const { testFormatMessage } = await vi.importActual<
    typeof import('@/locales/testTranslate')
  >('@/locales/testTranslate');
  return {
    request: vi.fn(),
    history: {
      push: vi.fn(),
      replace: vi.fn(),
    },
    // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
    getIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => testFormatMessage({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
  };
});

/** 可脚本化的假 XHR（只实现 request.ts 用到的成员）。 */
class FakeXhr {
  upload: { onprogress: ((event: { loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  };
  onprogress: ((event: { loaded: number; total: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  onload: (() => void) | null = null;

  status = 0;
  responseType = '';
  responseText = '';
  response: unknown = null;
  withCredentials = false;
  readonly requestHeaders: Record<string, string> = {};

  constructor(private readonly respond: (self: FakeXhr) => void) {}

  open(): void {}
  setRequestHeader(key: string, value: string): void {
    this.requestHeaders[key] = value;
  }
  getResponseHeader(): string | null {
    return null;
  }
  send(): void {
    this.respond(this);
  }
  abort(): void {
    this.onabort?.();
  }
}

function asXhr(xhr: FakeXhr): XMLHttpRequest {
  return xhr as unknown as XMLHttpRequest;
}

/** 依次弹出脚本响应的 XHR 工厂。 */
function scriptedXhr(responses: Array<{ status: number; body: unknown }>) {
  const created: FakeXhr[] = [];
  let index = 0;
  return {
    created,
    createXhr: () => {
      const response = responses[index] ?? responses[responses.length - 1];
      index += 1;
      const xhr = new FakeXhr((self) => {
        self.status = response.status;
        self.responseText = JSON.stringify(response.body);
        self.onload?.();
      });
      created.push(xhr);
      return asXhr(xhr);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('progressOf', () => {
  it('正常计算百分比', () => {
    expect(progressOf(50, 200)).toEqual({ loaded: 50, total: 200, percent: 25 });
  });

  it('总量未知 / 脏数据不产生 NaN / Infinity', () => {
    expect(progressOf(10, 0)).toEqual({ loaded: 10, total: 0, percent: 0 });
    expect(progressOf(Number.NaN, Number.NaN)).toEqual({ loaded: 0, total: 0, percent: 0 });
    expect(progressOf(-1, 100)).toEqual({ loaded: 0, total: 100, percent: 0 });
  });

  it('百分比封顶 100', () => {
    expect(progressOf(300, 200).percent).toBe(100);
  });
});

describe('filenameFromDisposition', () => {
  it('支持 filename*=UTF-8 编码形式', () => {
    expect(filenameFromDisposition("attachment; filename*=UTF-8''%E4%B8%AD%E6%96%87.zip")).toBe(
      '中文.zip',
    );
  });

  it('支持简单带引号 / 不带引号形式', () => {
    expect(filenameFromDisposition('attachment; filename="a.zip"')).toBe('a.zip');
    expect(filenameFromDisposition('attachment; filename=b.zip')).toBe('b.zip');
  });

  it('缺失或空返回空串', () => {
    expect(filenameFromDisposition(null)).toBe('');
    expect(filenameFromDisposition(undefined)).toBe('');
    expect(filenameFromDisposition('attachment')).toBe('');
  });
});

describe('normalizePage', () => {
  it('字段缺失时给安全默认值', () => {
    expect(normalizePage(null)).toEqual({
      records: [],
      total: 0,
      current: 1,
      pageSize: 20,
      pages: 0,
    });
  });

  it('保留后端分页字段', () => {
    expect(
      normalizePage({ records: [{ id: 1 }], total: 1, current: 2, pageSize: 50, pages: 1 }),
    ).toEqual({
      records: [{ id: 1 }],
      total: 1,
      current: 2,
      pageSize: 50,
      pages: 1,
    });
  });

  it('records 非数组时归零为数组', () => {
    expect(normalizePage({ records: undefined, total: 3 }).records).toEqual([]);
  });
});

describe('toBizError', () => {
  it('响应体是 Result 时重建为 BizError（保留 code / traceId / 策略）', () => {
    const error = toBizError({
      response: { data: { code: 1003, message: '无操作权限', data: null, traceId: 't1' } },
    }) as BizError;

    expect(error).toBeInstanceOf(BizError);
    expect(error.code).toBe(1003);
    expect(error.traceId).toBe('t1');
    expect(error.strategy).toBe(HandleStrategy.DENY);
  });

  it('已是 BizError 时原样透出（不重复包装）', () => {
    const biz = new BizError({ code: 4006, message: '超限', data: null, traceId: 't2' });

    expect(toBizError(biz)).toBe(biz);
  });

  it('非 Result 错误原样返回（网络层错误交给全局处理）', () => {
    const raw = new Error('Network Error');

    expect(toBizError(raw)).toBe(raw);
    expect(toBizError(undefined)).toBeUndefined();
  });
});

describe('uploadBinary（进度 + 401 刷新重放）', () => {
  it('成功时解包 data 并注入 Bearer', async () => {
    const { createXhr, created } = scriptedXhr([
      { status: 200, body: { code: 0, message: 'ok', data: { id: 1 }, traceId: '' } },
    ]);

    const data = await uploadBinary<{ id: number }>('/api/v1/files', null, {}, {
      createXhr,
      getToken: () => 'access-token',
    });

    expect(data).toEqual({ id: 1 });
    expect(created[0].requestHeaders.Authorization).toBe('Bearer access-token');
  });

  it('1002 令牌过期：静默刷新一次后重放，调用方无感', async () => {
    const { createXhr, created } = scriptedXhr([
      { status: 401, body: { code: 1002, message: '令牌过期', data: null, traceId: '' } },
      { status: 200, body: { code: 0, message: 'ok', data: { id: 2 }, traceId: '' } },
    ]);
    const refresh = vi.fn(async () => true);

    const data = await uploadBinary<{ id: number }>('/api/v1/files', null, {}, {
      createXhr,
      getToken: () => 'access-token',
      refresh,
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(2);
    expect(data).toEqual({ id: 2 });
  });

  it('刷新失败则抛 BizError 且不无限重放', async () => {
    const { createXhr, created } = scriptedXhr([
      { status: 401, body: { code: 1002, message: '令牌过期', data: null, traceId: '' } },
    ]);
    const refresh = vi.fn(async () => false);

    await expect(
      uploadBinary('/api/v1/files', null, { silent: true }, { createXhr, getToken: () => 't', refresh }),
    ).rejects.toBeInstanceOf(BizError);
    expect(created).toHaveLength(1);
  });

  it('业务错误非静默时弹提示（B 类流程分支不弹）', async () => {
    const { createXhr } = scriptedXhr([
      { status: 200, body: { code: 4006, message: '文件大小超出限制', data: null, traceId: '' } },
    ]);

    await expect(
      uploadBinary('/api/v1/files', null, {}, { createXhr, getToken: () => 't' }),
    ).rejects.toThrow('文件大小超出限制');
    expect(message.error).toHaveBeenCalledWith('文件大小超出限制');
  });

  it('非 Result 形态的 HTTP 错误不污染业务码空间', async () => {
    const { createXhr } = scriptedXhr([{ status: 502, body: '<html>bad gateway</html>' }]);

    await expect(
      uploadBinary('/api/v1/files', null, {}, { createXhr, getToken: () => 't' }),
    ).rejects.toThrow('（HTTP 502）');
    expect(message.error).toHaveBeenCalledTimes(1);
  });
});

describe('startNativeDownload（浏览器原生下载载体）', () => {
  it('用隐藏 <a download> 点击取件地址，并清掉游离节点', () => {
    // happy-dom 会真按 href 发一次导航，这里只关心「点的是谁、点的时候它在哪」
    const clicks: Array<{ href: string | null; connected: boolean; download: string }> = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicks.push({
          href: this.getAttribute('href'),
          connected: this.isConnected,
          download: this.download,
        });
      });
    const anchorsBefore = document.querySelectorAll('a').length;

    try {
      expect(startNativeDownload('/api/v1/files/1/content?ticket=t1', '季度报表.xlsx')).toBe(
        true,
      );

      expect(clicks).toEqual([
        {
          href: '/api/v1/files/1/content?ticket=t1',
          // 必须在文档里才点得动（未挂载的 <a> 点击不触发导航）
          connected: true,
          // 回归护栏：必须带 download。不带时浏览器只能把取件当「顶层导航」——当前文档
          // 随之卸载，开发服务器的 HMR 客户端据此触发整页 reload 并取消这次取件，
          // 火狐上必现（NS_BINDING_ABORTED），Chrome 只是抢先到达下载管理器
          download: '季度报表.xlsx',
        },
      ]);
      // 点完即移除，不把游离链接留在 body 里
      expect(document.querySelectorAll('a')).toHaveLength(anchorsBefore);
    } finally {
      clickSpy.mockRestore();
    }
  });

  it('未给兜底文件名时 download 属性依然存在（属性在不在才是下载 / 导航的分界）', () => {
    const downloads: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        // 取值用 getAttribute：属性缺失得到 null，空值得到 ''，两者语义不同
        downloads.push(this.getAttribute('download') ?? 'MISSING');
      });

    try {
      expect(startNativeDownload('/api/v1/files/1/content?ticket=t1')).toBe(true);
      // 服务端仍会下发 filename*，这里空值只表示「文件名交给服务端」
      expect(downloads).toEqual(['']);
    } finally {
      clickSpy.mockRestore();
    }
  });

  it('非浏览器环境直接返回 false，不抛异常', () => {
    // 服务端渲染 / 单测环境没有 document 时，调用方据此走降级分支
    vi.stubGlobal('document', undefined);
    try {
      expect(startNativeDownload('/api/v1/files/1/content?ticket=t1')).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('saveBlob（Blob 落盘的释放时机）', () => {
  it('点击后延迟撤销 objectURL，不在同一个任务里释放', () => {
    vi.useFakeTimers();
    const revoked: string[] = [];
    const original = {
      create: URL.createObjectURL,
      revoke: URL.revokeObjectURL,
    };
    URL.createObjectURL = () => 'blob:fake';
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
    };

    try {
      expect(saveBlob(new Blob(['x']), 'a.csv')).toBe(true);
      // 回归护栏：火狐对 blob 下载是异步接管的，同步撤销会让它在读到数据前就失效
      // （表现为下载中断或文件名丢失，且只在火狐上暴露）
      expect(revoked).toEqual([]);

      vi.runAllTimers();
      // 仍然要释放，否则每导出一次就泄漏一份 objectURL
      expect(revoked).toEqual(['blob:fake']);
    } finally {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
      vi.useRealTimers();
    }
  });
});
