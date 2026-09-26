import { describe, expect, it } from 'vitest';

import { ChatScope } from '@/services/notify';
import type { ChatSession } from '@/services/chat/types';

import {
  PRESENCE_RENEW_INTERVAL_MS,
  TYPING_IDLE_TIMEOUT_MS,
  TYPING_THROTTLE_MS,
  createTypingEmitter,
  isPresenceOfSession,
  isTypingOfSession,
  presenceLabelId,
  type TypingEmitter,
} from './presence';

const PEER = '1000000000000000002';
const OTHER = '1000000000000000003';

function session(over: Partial<ChatSession> = {}): ChatSession {
  return { chatScope: ChatScope.PRIVATE, targetId: PEER, ...over };
}

describe('isPresenceOfSession', () => {
  it('userId 与当前会话对端一致才算命中', () => {
    expect(isPresenceOfSession({ userId: PEER }, session())).toBe(true);
  });

  it('别的用户的状态不得画到本会话上（多标签页各看一个人）', () => {
    expect(isPresenceOfSession({ userId: OTHER }, session())).toBe(false);
  });

  it('群聊没有单一对端，一律不认', () => {
    expect(
      isPresenceOfSession({ userId: PEER }, session({ chatScope: ChatScope.GROUP })),
    ).toBe(false);
  });

  it('没有打开的会话时一律不认', () => {
    expect(isPresenceOfSession({ userId: PEER }, null)).toBe(false);
    expect(isPresenceOfSession(null, session())).toBe(false);
  });
});

describe('isTypingOfSession', () => {
  it('scope 与 targetId 都对上才算同一会话', () => {
    expect(
      isTypingOfSession(
        { chatScope: ChatScope.PRIVATE, chatTargetId: PEER },
        session(),
      ),
    ).toBe(true);
  });

  it('别人的输入帧不得点亮本会话', () => {
    expect(
      isTypingOfSession(
        { chatScope: ChatScope.PRIVATE, chatTargetId: OTHER },
        session(),
      ),
    ).toBe(false);
  });

  it('单聊与群聊不串台', () => {
    expect(
      isTypingOfSession(
        { chatScope: ChatScope.GROUP, chatTargetId: PEER },
        session(),
      ),
    ).toBe(false);
  });

  it('群聊一律不认（输入提示端到端只做单聊）', () => {
    expect(
      isTypingOfSession(
        { chatScope: ChatScope.GROUP, chatTargetId: '77' },
        session({ chatScope: ChatScope.GROUP, targetId: '77' }),
      ),
    ).toBe(false);
  });

  it('没有打开的会话时一律不认', () => {
    expect(
      isTypingOfSession({ chatScope: ChatScope.PRIVATE, chatTargetId: PEER }, null),
    ).toBe(false);
    expect(isTypingOfSession(null, session())).toBe(false);
  });
});

describe('presenceLabelId', () => {
  it('三态各有独立文案键，未知值回落离线（不显示「在线」这种乐观假设）', () => {
    expect(presenceLabelId('ONLINE')).toBe('chat.presence.online');
    expect(presenceLabelId('OFFLINE')).toBe('chat.presence.offline');
    expect(presenceLabelId('UNSTABLE')).toBe('chat.presence.unstable');
  });
});

/** 可手动推进的合成定时器：让「续订」与「空闲兜底」在测试里确定性地发生。 */
function fakeTimers() {
  let seq = 0;
  const handlers = new Map<number, () => void>();
  return {
    setInterval(handler: () => void) {
      seq += 1;
      handlers.set(seq, handler);
      return seq as unknown as ReturnType<typeof setInterval>;
    },
    clearInterval(handle: ReturnType<typeof setInterval>) {
      handlers.delete(handle as unknown as number);
    },
    /** 触发一次所有在册的定时器（等价于「时间推进了一个节流窗口」）。 */
    tick() {
      [...handlers.values()].forEach((handler) => {
        handler();
      });
    },
    pending: () => handlers.size,
  };
}

function setup() {
  const sent: boolean[] = [];
  const timers = fakeTimers();
  let now = 0;
  const emitter: TypingEmitter = createTypingEmitter({
    send: (typing) => sent.push(typing),
    now: () => now,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
  });
  return {
    emitter,
    sent,
    timers,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe('createTypingEmitter', () => {
  it('开始输入发一帧 true，并在节流窗口内不重复发（连续按键不该顶到限流）', () => {
    const { emitter, sent, advance } = setup();

    emitter.start();
    advance(100);
    emitter.start();
    emitter.start();

    expect(sent).toEqual([true]);
    expect(emitter.isTyping()).toBe(true);
  });

  it('持续输入时按节流窗口自动续订（否则接收端 6s 后自行收起）', () => {
    const { emitter, sent, advance, timers } = setup();

    emitter.start();
    advance(TYPING_THROTTLE_MS);
    timers.tick();
    advance(TYPING_THROTTLE_MS);
    timers.tick();

    expect(sent).toEqual([true, true, true]);
  });

  it('窗口未到就 tick 不补发（节流对续订同样生效）', () => {
    const { emitter, sent, advance, timers } = setup();

    emitter.start();
    advance(TYPING_THROTTLE_MS - 1);
    timers.tick();

    expect(sent).toEqual([true]);
  });

  it('停止输入立刻发一帧 false 并撤掉续订定时器', () => {
    const { emitter, sent, advance, timers } = setup();

    emitter.start();
    advance(TYPING_THROTTLE_MS);
    emitter.stop();
    timers.tick();
    advance(TYPING_THROTTLE_MS);
    timers.tick();

    expect(sent).toEqual([true, false]);
    expect(timers.pending()).toBe(0);
    expect(emitter.isTyping()).toBe(false);
  });

  it('重复 stop 只发一次 false（清空输入框会多次触发）', () => {
    const { emitter, sent } = setup();

    emitter.start();
    emitter.stop();
    emitter.stop();

    expect(sent).toEqual([true, false]);
  });

  it('未开始输入就 stop / dispose 不发任何帧（避免凭空给对端发信号）', () => {
    const { emitter, sent } = setup();

    emitter.stop();
    emitter.dispose();

    expect(sent).toEqual([]);
  });

  it('dispose 时仍在输入则补发 false：卸载不该让对端提示永久挂住', () => {
    const { emitter, sent, timers } = setup();

    emitter.start();
    emitter.dispose();

    expect(sent).toEqual([true, false]);
    expect(timers.pending()).toBe(0);
  });

  it('停止后再 dispose 不重复发 false', () => {
    const { emitter, sent } = setup();

    emitter.start();
    emitter.stop();
    emitter.dispose();

    expect(sent).toEqual([true, false]);
  });

  it('stop 之后重新 start 是新一轮输入（会再发一帧 true）', () => {
    const { emitter, sent } = setup();

    emitter.start();
    emitter.stop();
    emitter.start();

    expect(sent).toEqual([true, false, true]);
    expect(emitter.isTyping()).toBe(true);
  });
});

describe('时间常量口径', () => {
  it('续订间隔小于服务端 2min 订阅窗口，允许连续丢 3 次续订才过期', () => {
    expect(PRESENCE_RENEW_INTERVAL_MS).toBe(30_000);
    expect(PRESENCE_RENEW_INTERVAL_MS * 3).toBeLessThanOrEqual(120_000);
  });

  it('续订间隔显著小于接收端空闲兜底（否则发送方还在打字，接收端已收起提示）', () => {
    expect(TYPING_THROTTLE_MS).toBeLessThan(TYPING_IDLE_TIMEOUT_MS);
  });
});
