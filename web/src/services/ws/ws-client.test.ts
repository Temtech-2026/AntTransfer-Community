import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotifyMessage, UnreadCount } from '@/services/notify/types';

import {
  WsClient,
  type WsClientEvents,
  type WsClientOptions,
  type WsSocketLike,
} from './ws-client';

/** 可脚本化的假 socket：不依赖 jsdom 的 WebSocket 实现。 */
class FakeSocket implements WsSocketLike {
  readyState = 0;
  sent: string[] = [];
  closed: Array<{ code?: number; reason?: string }> = [];
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closed.push({ code, reason });
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  receive(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  serverClose(code: number, reason = ''): void {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }

  lastSent(): { type?: string } {
    return JSON.parse(this.sent[this.sent.length - 1] ?? '{}');
  }
}

let sockets: FakeSocket[] = [];
let urls: string[] = [];

function createClient(over: Partial<WsClientOptions> = {}) {
  const recorder = {
    statuses: [] as string[],
    unreads: [] as UnreadCount[],
    messages: [] as NotifyMessage[],
    reconnects: 0,
    errors: [] as unknown[],
  };
  const events: WsClientEvents = {
    status: (status) => recorder.statuses.push(status),
    unread: (unread) => recorder.unreads.push(unread),
    message: (message) => recorder.messages.push(message),
    reconnected: () => {
      recorder.reconnects += 1;
    },
    error: (detail) => recorder.errors.push(detail),
  };
  const client = new WsClient({
    getToken: () => 'tok',
    location: { protocol: 'http:', host: 'localhost:8000' },
    createSocket: (url) => {
      urls.push(url);
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    // 恒定中点 → 抖动系数为 0，退避可精确断言
    random: () => 0.5,
    events,
    ...over,
  });
  return { client, recorder, events };
}

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  urls = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('握手', () => {
  it('connect 生成带令牌的同源地址并进入 connecting', () => {
    const { client, recorder } = createClient();

    client.connect();

    expect(urls).toEqual(['ws://localhost:8000/api/ws/notify?token=tok']);
    expect(client.getStatus()).toBe('connecting');
    expect(recorder.statuses).toEqual(['connecting']);
  });

  it('重复 connect 幂等（不建第二条连接）', () => {
    const { client } = createClient();

    client.connect();
    sockets[0].open();
    client.connect();

    expect(sockets).toHaveLength(1);
  });

  it('无令牌不建连也不进入重连循环（等登录后再次 connect）', () => {
    const { client, recorder } = createClient({ getToken: () => null });

    client.connect();

    expect(sockets).toHaveLength(0);
    expect(client.getStatus()).toBe('closed');
    expect(recorder.errors).toHaveLength(1);

    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(0);
  });

  it('open 后状态为 open，且 CONNECTED 快照覆盖本地未读', () => {
    const { client, recorder } = createClient();

    client.connect();
    sockets[0].open();
    sockets[0].receive({ type: 'CONNECTED', data: { userId: 7, unread: { inbox: 2, todo: 1, chat: 3 } } });

    expect(client.getStatus()).toBe('open');
    expect(recorder.statuses).toEqual(['connecting', 'open']);
    expect(client.getUnread()).toEqual({ inbox: 2, todo: 1, chat: 3 });
  });

  it('CONNECTED 未带快照时保留本地值（后端查询失败不把红点清零）', () => {
    const { client } = createClient();

    client.connect();
    sockets[0].open();
    sockets[0].receive({ type: 'UNREAD', data: { inbox: 5, todo: 0, chat: 0 } });
    sockets[0].receive({ type: 'CONNECTED', data: { userId: 7, unread: null } });

    expect(client.getUnread()).toEqual({ inbox: 5, todo: 0, chat: 0 });
  });
});

describe('心跳（30s）', () => {
  it('每 30s 上行一帧 PING', () => {
    const { client } = createClient();

    client.connect();
    sockets[0].open();
    expect(sockets[0].sent).toHaveLength(0);

    vi.advanceTimersByTime(30_000);
    expect(sockets[0].lastSent()).toMatchObject({ type: 'PING', data: null });

    vi.advanceTimersByTime(30_000);
    expect(sockets[0].sent).toHaveLength(2);
  });

  it('收到服务端 PING 立即回一帧（任何下行帧都刷新存活时间）', () => {
    const { client } = createClient();

    client.connect();
    sockets[0].open();
    sockets[0].receive({ type: 'PING' });

    expect(sockets[0].lastSent()).toMatchObject({ type: 'PING' });
  });

  it('90s 无任何下行帧 → 本地判定假死，以 4002 断开并进入重连', () => {
    const { client } = createClient();

    client.connect();
    sockets[0].open();
    vi.advanceTimersByTime(100_000);

    expect(sockets[0].closed.at(-1)?.code).toBe(4002);
    expect(client.getStatus()).toBe('reconnecting');
  });
});

describe('未读维护', () => {
  it('NOTIFY 加 inbox（待办段同时加 todo），CHAT 只加 chat', () => {
    const { client, recorder } = createClient();

    client.connect();
    sockets[0].open();
    sockets[0].receive({ type: 'UNREAD', data: { inbox: 1, todo: 0, chat: 0 } });
    sockets[0].receive({ type: 'NOTIFY', data: { id: 9, notifyType: 8 } });
    sockets[0].receive({ type: 'CHAT', data: { id: 10, notifyType: 6 } });

    expect(client.getUnread()).toEqual({ inbox: 2, todo: 1, chat: 1 });
    expect(recorder.messages.map((message) => message.id)).toEqual([9, 10]);
  });

  it('缺 notifyType 的脏帧不改变未读也不抛消息', () => {
    const { client, recorder } = createClient();

    client.connect();
    sockets[0].open();
    sockets[0].receive({ type: 'NOTIFY', data: { id: 1 } });

    expect(recorder.messages).toHaveLength(0);
    expect(client.getUnread()).toEqual({ inbox: 0, todo: 0, chat: 0 });
  });

  it('非法下行内容被丢弃（不崩）', () => {
    const { client } = createClient();

    client.connect();
    sockets[0].open();
    sockets[0].onmessage?.({ data: '<html>502</html>' });

    expect(client.getStatus()).toBe('open');
  });

  it('disconnect({resetUnread:true}) 清空角标', () => {
    const { client } = createClient();

    client.connect();
    sockets[0].open();
    sockets[0].receive({ type: 'UNREAD', data: { inbox: 5, todo: 2, chat: 1 } });
    client.disconnect({ resetUnread: true });

    expect(client.getUnread()).toEqual({ inbox: 0, todo: 0, chat: 0 });
    expect(client.getStatus()).toBe('closed');
  });
});

describe('断线重连（指数退避）', () => {
  it('异常断开按 1s 退避，重连成功后触发 reconnected 且退避归零', () => {
    const { client, recorder } = createClient();

    client.connect();
    sockets[0].open();

    sockets[0].serverClose(4003, 'server restart');
    expect(client.getStatus()).toBe('reconnecting');

    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    sockets[1].open();
    expect(recorder.reconnects).toBe(1);

    // 连上过一次后 attempt 归零：下次断线仍从 1s 起（不会因历史失败被罚长等待）
    sockets[1].serverClose(1006);
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(3);
  });

  it('一直连不上时退避翻倍：1s → 2s', () => {
    const { client } = createClient();

    client.connect();
    expect(client.getStatus()).toBe('connecting');
    sockets[0].serverClose(1006);

    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);

    sockets[1].serverClose(1006);
    expect(client.getStatus()).toBe('reconnecting');
    vi.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
  });

  it('4001 鉴权失败不重连（重连必然再被拒，交给 HTTP 层刷新 / 跳登录）', () => {
    const { client } = createClient();

    client.connect();
    sockets[0].open();
    sockets[0].serverClose(4001, 'unauthorized');

    expect(client.getStatus()).toBe('closed');
    vi.advanceTimersByTime(120_000);
    expect(sockets).toHaveLength(1);
  });

  it('主动 disconnect 后不得再自动重连', () => {
    const { client } = createClient();

    client.connect();
    sockets[0].open();
    client.disconnect();

    vi.advanceTimersByTime(120_000);
    expect(sockets).toHaveLength(1);
    expect(client.getStatus()).toBe('closed');
  });

  it('reconnectNow 跳过退避立即重连', () => {
    const { client } = createClient();

    client.connect();
    sockets[0].open();
    sockets[0].serverClose(4003);

    client.reconnectNow();

    expect(sockets).toHaveLength(2);
    // 已连上过，故状态是「重连中」而不是首次的 connecting
    expect(client.getStatus()).toBe('reconnecting');
  });

  it('重连时重新读取令牌（静默刷新后旧令牌已失效）', () => {
    let token = 'old-token';
    const { client } = createClient({ getToken: () => token });

    client.connect();
    sockets[0].open();
    sockets[0].serverClose(4003);

    token = 'new-token';
    vi.advanceTimersByTime(1000);

    expect(urls[1]).toContain('token=new-token');
  });

  it('建连抛错（如 URL 非法）时进入退避而不是卡死', () => {
    let calls = 0;
    const { client, recorder } = createClient({
      createSocket: () => {
        calls += 1;
        if (calls === 1) {
          throw new Error('bad url');
        }
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    });

    client.connect();
    expect(client.getStatus()).toBe('reconnecting');
    expect(recorder.errors).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(1);
  });
});
