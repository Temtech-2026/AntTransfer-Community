import { describe, expect, it } from 'vitest';

import {
  WS_DEFAULTS,
  WsCloseCode,
  WsFrameType,
  buildWsUrl,
  createClientPingFrame,
  isWsFrame,
  nextBackoffDelay,
  parseWsFrame,
  shouldReconnect,
} from './protocol';

describe('buildWsUrl', () => {
  it('http → ws，https → wss，同源不硬编码域名', () => {
    expect(buildWsUrl('/api/ws/notify', null, { protocol: 'http:', host: 'localhost:8000' })).toBe(
      'ws://localhost:8000/api/ws/notify',
    );
    expect(buildWsUrl('/api/ws/notify', null, { protocol: 'https:', host: 'at.example.com' })).toBe(
      'wss://at.example.com/api/ws/notify',
    );
  });

  it('令牌走查询串且做 URL 编码', () => {
    const url = buildWsUrl(undefined, 'a+b/c=', { protocol: 'http:', host: 'h' });

    expect(url).toBe(`ws://h${WS_DEFAULTS.path}?token=a%2Bb%2Fc%3D`);
  });

  it('无令牌时不追加查询串', () => {
    expect(buildWsUrl('/api/ws/notify', '', { protocol: 'http:', host: 'h' })).toBe(
      'ws://h/api/ws/notify',
    );
  });
});

describe('shouldReconnect', () => {
  it('4001 鉴权失败与 1001 主动离开不重连，其余都重连', () => {
    expect(shouldReconnect(WsCloseCode.UNAUTHORIZED)).toBe(false);
    expect(shouldReconnect(1001)).toBe(false);
    expect(shouldReconnect(WsCloseCode.HEARTBEAT_TIMEOUT)).toBe(true);
    expect(shouldReconnect(WsCloseCode.SERVER_SHUTDOWN)).toBe(true);
    expect(shouldReconnect(1006)).toBe(true);
  });
});

describe('nextBackoffDelay', () => {
  it('指数增长：1s → 2s → 4s（random 取中点无抖动）', () => {
    const random = () => 0.5;
    expect(nextBackoffDelay(0, { random })).toBe(1000);
    expect(nextBackoffDelay(1, { random })).toBe(2000);
    expect(nextBackoffDelay(2, { random })).toBe(4000);
  });

  it('封顶 30s', () => {
    expect(nextBackoffDelay(20, { random: () => 0.5 })).toBe(30_000);
  });

  it('抖动在下界/上界内且不为负', () => {
    expect(nextBackoffDelay(0, { random: () => 0 })).toBe(800);
    expect(nextBackoffDelay(0, { random: () => 1 })).toBe(1200);
    expect(nextBackoffDelay(0, { jitterRatio: 0 })).toBe(1000);
  });

  it('负数 attempt 视为 0', () => {
    expect(nextBackoffDelay(-3, { random: () => 0.5 })).toBe(1000);
  });
});

describe('信封解析', () => {
  it('合法信封通过，非法 / 非字符串返回 undefined（服务端加新帧不崩旧客户端）', () => {
    expect(isWsFrame({ type: 'PING' })).toBe(true);
    expect(isWsFrame(null)).toBe(false);
    expect(isWsFrame({ data: 1 })).toBe(false);

    expect(parseWsFrame('{"type":"UNREAD","data":{"inbox":1}}')).toEqual({
      type: 'UNREAD',
      data: { inbox: 1 },
    });
    expect(parseWsFrame('not-json')).toBeUndefined();
    expect(parseWsFrame('{"data":1}')).toBeUndefined();
    expect(parseWsFrame('')).toBeUndefined();
    expect(parseWsFrame(null)).toBeUndefined();
  });

  it('心跳帧形状固定', () => {
    expect(createClientPingFrame(123)).toEqual({ type: WsFrameType.PING, data: null, ts: 123 });
  });
});
