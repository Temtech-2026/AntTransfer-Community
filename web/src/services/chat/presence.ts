/**
 * 在线状态与「正在输入」的纯规则（无 React、无副作用，便于单测）。
 *
 * <p>三条口径集中在这里，避免散落进两个聊天入口（`/chat` 页与即时通讯抽屉）：
 * <ol>
 *   <li><b>帧与会话的比对是本模块的职责</b>：服务端推的 `PRESENCE` / `TYPING` 帧
 *       都只带一个用户或一个会话目标，而接收方可能同时开着多个会话窗口
 *       （页面 + 抽屉 + 多标签页）。不比对就会把 A 的状态点画到 B 的会话上——
 *       与已读回执（{@link module:services/chat/readReceipt}）同一条纪律。</li>
 *   <li><b>只有单聊有「对端」</b>：群聊没有单一对象，服务端也在入口直接拒了
 *       （2001），前端同样不订阅、不显示——否则群聊会话头会出现一个语义不明的点。</li>
 *   <li><b>输入态是瞬时信号，靠节流 + 续订维持</b>：服务端不落库、不补推，
 *       因此本端必须周期续订，接收端必须有空闲兜底（见 {@link createTypingEmitter}）。</li>
 * </ol>
 */

import { ChatScope } from '@/services/notify';
import type { ChatPresenceStatus, WsTypingPayload } from '@/services/ws/protocol';

import type { ChatPresenceVO, ChatSession } from './types';

/**
 * 续订间隔：与服务端 `WS_PRESENCE_WATCH_TTL_SECONDS`（120s）配合——
 * 每 30s 一次，允许连续丢 3 次续订才过期，弱网下不会闪灰点。
 */
export const PRESENCE_RENEW_INTERVAL_MS = 30_000;

/**
 * 输入态续订间隔（也是本端按键节流窗口）。
 *
 * <p>必须显著小于接收端的空闲兜底（{@link TYPING_IDLE_TIMEOUT_MS}），否则发送方还在打字，
 * 接收方的提示已经自己收起来了。</p>
 */
export const TYPING_THROTTLE_MS = 3_000;

/**
 * 接收端空闲兜底：超过这个时长没再收到 `typing=true` 就自动收起提示。
 *
 * <p>为什么必须有：`TYPING` 是瞬时信号，丢帧、发送方崩溃、网络中断都不会有任何通知，
 * 只靠 `typing=false` 收起会让「对方正在输入…」永久挂在那里——比不显示更糟。</p>
 */
export const TYPING_IDLE_TIMEOUT_MS = 6_000;

/**
 * 这帧在线状态是不是当前会话对端的。
 *
 * <p>只认单聊：群聊没有单一对端（服务端也拒绝订阅），`userId` 无法与群 ID 对应。</p>
 */
export function isPresenceOfSession(
  presence: Pick<ChatPresenceVO, 'userId'> | null | undefined,
  session: ChatSession | null | undefined,
): boolean {
  if (!presence || !session) {
    return false;
  }
  if (session.chatScope !== ChatScope.PRIVATE) {
    return false;
  }
  return presence.userId === session.targetId;
}

/**
 * 这帧输入状态是不是当前会话产生的。
 *
 * <p>比对 `(chatScope, chatTargetId)`：后端下发的 `chatTargetId` 已是<b>接收人视角</b>的
 * 会话目标（单聊＝输入者本人），与前端会话定位的取值口径一致，直接比即可。</p>
 *
 * <p>与 {@link isPresenceOfSession} 一样只认单聊：输入提示端到端都是单聊能力
 * （服务端对群聊直接拒 2001）。把这条约束放在纯规则里，而不是指望每个调用方都记得先判，
 * 是为了让「群聊不出提示」成为不变量——将来多一个调用点时不必重新论证一次。</p>
 */
export function isTypingOfSession(
  typing: Pick<WsTypingPayload, 'chatScope' | 'chatTargetId'> | null | undefined,
  session: ChatSession | null | undefined,
): boolean {
  if (!typing || !session) {
    return false;
  }
  if (session.chatScope !== ChatScope.PRIVATE) {
    return false;
  }
  return (
    typing.chatScope === session.chatScope &&
    typing.chatTargetId === session.targetId
  );
}

/** 三态对应的 i18n 键（展示层据此出文案，不在纯函数里硬编码语言）。 */
export function presenceLabelId(status: ChatPresenceStatus): string {
  switch (status) {
    case 'ONLINE':
      return 'chat.presence.online';
    case 'UNSTABLE':
      return 'chat.presence.unstable';
    default:
      return 'chat.presence.offline';
  }
}

/** 定时器句柄（`setInterval` 在 DOM / Node 两种类型定义下的返回类型不同，这里只取不透明句柄）。 */
type IntervalHandle = ReturnType<typeof setInterval>;

export interface TypingEmitterOptions {
  /** 真正发出去的动作（调用方负责注入会话与 HTTP）。 */
  send: (typing: boolean) => void;
  /** 节流/续订间隔，默认 {@link TYPING_THROTTLE_MS}。 */
  throttleMs?: number;
  /** 时钟（单测注入假时钟）。 */
  now?: () => number;
  /** 定时器实现（单测注入假实现）。 */
  setInterval?: (handler: () => void, timeout: number) => IntervalHandle;
  clearInterval?: (handle: IntervalHandle) => void;
}

export interface TypingEmitter {
  /** 开始 / 继续输入（每次按键调用；内部节流并自动续订）。 */
  start(): void;
  /** 停止输入（发出 `typing=false`；重复调用只发一次）。 */
  stop(): void;
  /** 卸载：若仍在输入态，补一帧 `typing=false`，避免对端提示挂住。 */
  dispose(): void;
  /** 当前是否处于「输入中」意图位。 */
  isTyping(): boolean;
}

/**
 * 「我正在输入」上报器：把连续按键折算成「开始 + 每 {@link TypingEmitterOptions.throttleMs} 续订
 * + 结束」三段流量。
 *
 * <p><b>为什么不能只在按键时直接发：</b>一次输入会触发几十次 onChange，
 * 每次都发就是几十个 HTTP 请求（还会顶到服务端 60s / 120 次的限流）；
 * 而只在第一次发又会让接收端 6s 后自行收起——用户还在写，提示却没了。</p>
 *
 * <p><b>为什么结束要单独发一帧：</b>让接收端在对方点「发送」的瞬间就收起提示，
 * 而不是等空闲兜底的那几秒——那几秒里提示与刚到达的消息同屏，像是没反应过来。</p>
 */
export function createTypingEmitter(options: TypingEmitterOptions): TypingEmitter {
  const throttleMs = options.throttleMs ?? TYPING_THROTTLE_MS;
  const now = options.now ?? (() => Date.now());
  const setTimer =
    options.setInterval ??
    ((handler: () => void, timeout: number) =>
      setInterval(handler, timeout) as unknown as IntervalHandle);
  const clearTimer =
    options.clearInterval ??
    ((handle: IntervalHandle) => clearInterval(handle));

  let active = false;
  let lastSentAt = 0;
  let handle: IntervalHandle | null = null;

  const emit = (typing: boolean) => {
    lastSentAt = now();
    options.send(typing);
  };

  const clearRenewTimer = () => {
    if (handle !== null) {
      clearTimer(handle);
      handle = null;
    }
  };

  return {
    isTyping: () => active,

    start() {
      if (active) {
        // 已在输入态：按键不各自成帧，由续订定时器按节流窗口补齐
        if (now() - lastSentAt >= throttleMs) {
          emit(true);
        }
        return;
      }
      active = true;
      emit(true);
      handle = setTimer(() => {
        if (active && now() - lastSentAt >= throttleMs) {
          emit(true);
        }
      }, throttleMs);
    },

    stop() {
      if (!active) {
        return;
      }
      active = false;
      clearRenewTimer();
      emit(false);
    },

    dispose() {
      const wasActive = active;
      active = false;
      clearRenewTimer();
      if (wasActive) {
        emit(false);
      }
    },
  };
}
