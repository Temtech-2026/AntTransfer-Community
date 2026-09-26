import { describe, expect, it } from 'vitest';

import {
  ChatPresenceStatus,
  WS_DEFAULTS,
  WsCloseCode,
  WsFrameType,
  buildWsUrl,
  createClientPingFrame,
  isPresenceStatus,
  isWsFrame,
  nextBackoffDelay,
  parseChatReadPayload,
  parsePresencePayload,
  parseProfilePayload,
  parseTypingPayload,
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

describe('parseChatReadPayload', () => {
  const valid = {
    chatScope: 1,
    chatTargetId: '1000000000000000002',
    reader: {
      userId: '1000000000000000002',
      displayName: '张三',
      avatarUrl: 'http://localhost:8080/v1/users/1000000000000000002/avatar?v=3',
    },
    clientMsgIds: ['c-1', 'c-2'],
  };

  it('合法载荷原样通过', () => {
    expect(parseChatReadPayload(valid)).toEqual(valid);
  });

  it('缺字段 / 类型不对一律丢弃（一帧脏数据不能崩掉聊天页）', () => {
    expect(parseChatReadPayload(null)).toBeUndefined();
    expect(parseChatReadPayload('x')).toBeUndefined();
    expect(parseChatReadPayload({ ...valid, chatScope: '1' })).toBeUndefined();
    expect(parseChatReadPayload({ ...valid, chatTargetId: '' })).toBeUndefined();
    expect(parseChatReadPayload({ ...valid, reader: null })).toBeUndefined();
    expect(parseChatReadPayload({ ...valid, reader: { userId: '2' } })).toBeUndefined();
    expect(parseChatReadPayload({ ...valid, reader: { userId: '2', displayName: '' } })).toBeUndefined();
    expect(parseChatReadPayload({ ...valid, clientMsgIds: 'c-1' })).toBeUndefined();
  });

  it('clientMsgIds 里的脏元素被剔除；全脏则整帧丢弃', () => {
    expect(parseChatReadPayload({ ...valid, clientMsgIds: ['c-1', '', 2, null] })?.clientMsgIds).toEqual([
      'c-1',
    ]);
    expect(parseChatReadPayload({ ...valid, clientMsgIds: [] })).toBeUndefined();
    expect(parseChatReadPayload({ ...valid, clientMsgIds: [1, 2] })).toBeUndefined();
  });

  it('reader 多余字段不进结果（帧格式演化时不把未知字段带进渲染层）', () => {
    const parsed = parseChatReadPayload({
      ...valid,
      reader: { userId: '2', displayName: '张三', avatarKey: 'http://x' },
    });

    expect(parsed?.reader).toEqual({ userId: '2', displayName: '张三', avatarUrl: null });
  });

  it('读者头像缺失 / 空串 / 类型不对都归一为 null（空串进 img src 会渲染成破图）', () => {
    const readerOf = (avatarUrl: unknown) =>
      parseChatReadPayload({
        ...valid,
        reader: { userId: '2', displayName: '张三', avatarUrl },
      })?.reader;

    expect(readerOf(undefined)?.avatarUrl).toBeNull();
    expect(readerOf(null)?.avatarUrl).toBeNull();
    expect(readerOf('')?.avatarUrl).toBeNull();
    expect(readerOf(123)?.avatarUrl).toBeNull();
    expect(readerOf('http://x/a.png?v=1')?.avatarUrl).toBe('http://x/a.png?v=1');
  });
});

describe('parseProfilePayload', () => {
  const valid = {
    userId: '1000000000000000002',
    avatarUrl: 'http://localhost:8080/v1/users/1000000000000000002/avatar?v=4',
  };

  it('合法载荷原样通过', () => {
    expect(parseProfilePayload(valid)).toEqual(valid);
  });

  it('没有头像（null / 缺失 / 空串）归一为 null，而不是丢弃整帧——「换成默认头像」也是有效变更', () => {
    expect(parseProfilePayload({ userId: valid.userId, avatarUrl: null })).toEqual({
      userId: valid.userId,
      avatarUrl: null,
    });
    expect(parseProfilePayload({ userId: valid.userId })).toEqual({
      userId: valid.userId,
      avatarUrl: null,
    });
    expect(parseProfilePayload({ userId: valid.userId, avatarUrl: '' })).toEqual({
      userId: valid.userId,
      avatarUrl: null,
    });
  });

  it('缺 userId / userId 非字符串 / 非对象一律丢弃（推给本人的帧不该无法归属）', () => {
    expect(parseProfilePayload(null)).toBeUndefined();
    expect(parseProfilePayload('x')).toBeUndefined();
    expect(parseProfilePayload({})).toBeUndefined();
    expect(parseProfilePayload({ userId: '' })).toBeUndefined();
    expect(parseProfilePayload({ userId: 123 })).toBeUndefined();
  });
});

describe('isPresenceStatus', () => {
  it('只认三个已知状态', () => {
    expect(isPresenceStatus(ChatPresenceStatus.ONLINE)).toBe(true);
    expect(isPresenceStatus(ChatPresenceStatus.OFFLINE)).toBe(true);
    expect(isPresenceStatus(ChatPresenceStatus.UNSTABLE)).toBe(true);
  });

  it('未知状态 / 非字符串一律不认（服务端新增第四态不能崩旧客户端）', () => {
    expect(isPresenceStatus('BUSY')).toBe(false);
    expect(isPresenceStatus('online')).toBe(false);
    expect(isPresenceStatus(null)).toBe(false);
    expect(isPresenceStatus(1)).toBe(false);
  });
});

describe('parsePresencePayload', () => {
  const valid = {
    userId: '1000000000000000002',
    status: ChatPresenceStatus.ONLINE,
    lastActiveAt: 1_700_000_000_000,
  };

  it('合法载荷原样通过', () => {
    expect(parsePresencePayload(valid)).toEqual(valid);
  });

  it('缺 userId / 状态非法一律丢弃（状态点宁可不更新，也不能崩聊天页）', () => {
    expect(parsePresencePayload(null)).toBeUndefined();
    expect(parsePresencePayload('x')).toBeUndefined();
    expect(parsePresencePayload({ ...valid, userId: '' })).toBeUndefined();
    expect(parsePresencePayload({ ...valid, userId: 123 })).toBeUndefined();
    expect(parsePresencePayload({ ...valid, status: 'BUSY' })).toBeUndefined();
    expect(parsePresencePayload({ status: ChatPresenceStatus.ONLINE })).toBeUndefined();
  });

  it('lastActiveAt 缺失或非数字归一为 null（离线本就没有活跃时刻）', () => {
    expect(parsePresencePayload({ ...valid, lastActiveAt: undefined })?.lastActiveAt).toBeNull();
    expect(parsePresencePayload({ ...valid, lastActiveAt: 'yesterday' })?.lastActiveAt).toBeNull();
    expect(parsePresencePayload({ ...valid, lastActiveAt: null })?.lastActiveAt).toBeNull();
  });
});

describe('parseTypingPayload', () => {
  const valid = {
    chatScope: 1,
    chatTargetId: '1000000000000000002',
    typing: true,
  };

  it('合法载荷原样通过', () => {
    expect(parseTypingPayload(valid)).toEqual(valid);
  });

  it('缺字段一律丢弃', () => {
    expect(parseTypingPayload(null)).toBeUndefined();
    expect(parseTypingPayload([valid])).toBeUndefined();
    expect(parseTypingPayload({ ...valid, chatScope: '1' })).toBeUndefined();
    expect(parseTypingPayload({ ...valid, chatTargetId: '' })).toBeUndefined();
    expect(parseTypingPayload({ ...valid, typing: undefined })).toBeUndefined();
  });

  it('typing 只认布尔原始值：字符串 "false" 在条件判断里恒为真', () => {
    expect(parseTypingPayload({ ...valid, typing: 'false' })).toBeUndefined();
    expect(parseTypingPayload({ ...valid, typing: 0 })).toBeUndefined();
    expect(parseTypingPayload({ ...valid, typing: false })).toEqual({
      ...valid,
      typing: false,
    });
  });
});
