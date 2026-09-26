/**
 * 对端在线状态 + 「正在输入」的订阅 Hook（`/chat` 页与即时通讯抽屉共用）。
 *
 * <p><b>为什么需要这个 Hook 而不是让两个入口各写一遍：</b>会话界面的状态点与输入提示
 * 依赖三件容易写错的事——打开会话时拉一次权威值、打开期间每 30s 续订（否则状态点会停住）、
 * 以及「本端输入的节流上报」。两处各写一份，漂移只是时间问题（抽屉与页面本来就同源，
 * 见 `components/ChatDrawer` 文件头）。</p>
 *
 * <p><b>下行帧的会话过滤在纯规则里</b>（{@link isPresenceOfSession} / {@link isTypingOfSession}）：
 * 本 Hook 只负责把「属于当前会话的帧」翻译成 state，其余帧直接忽略。</p>
 *
 * <p><b>群聊不订阅</b>：群没有单一对端，服务端在入口就拒了（2001）；前端同样不出点、不出提示，
 * 否则会话头会挂一个语义不明的状态点。</p>
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import useWebSocket from '@/hooks/useWebSocket';
import {
  PRESENCE_RENEW_INTERVAL_MS,
  TYPING_IDLE_TIMEOUT_MS,
  createTypingEmitter,
  isPresenceOfSession,
  isTypingOfSession,
  sendTyping,
  watchPeerPresence,
  type ChatSession,
  type TypingEmitter,
} from '@/services/chat';
import { ChatScope } from '@/services/notify';
import type { ChatPresenceStatus } from '@/services/ws/protocol';

export interface UseChatPresenceOptions {
  /** 当前打开的会话；为 null 时状态点与输入提示都收起。 */
  session: ChatSession | null | undefined;
  /**
   * 是否启用订阅（默认 true）。
   *
   * <p>抽屉收起时它的会话 state 仍然保留，靠这个开关停掉续订——
   * 关掉的面板不该继续每 30s 发一次请求。</p>
   */
  enabled?: boolean;
}

export interface UseChatPresenceResult {
  /** 对端三态；尚未取到（加载中 / 非单聊 / 失败）为 null，此时不渲染状态点。 */
  peerStatus: ChatPresenceStatus | null;
  /** 对端是否正在输入。 */
  peerTyping: boolean;
  /**
   * 上报「我在输入 / 我停止输入」。
   *
   * <p>调用方在输入框 `onChange` 里传 `value.trim() !== ''` 即可；内部会节流并自动续订，
   * 重复调用没有额外开销。发送成功后请显式传 `false`，好让对端立刻收起提示。</p>
   */
  notifyTyping: (typing: boolean) => void;
}

export function useChatPresence(
  options: UseChatPresenceOptions,
): UseChatPresenceResult {
  const { session, enabled = true } = options;

  const [peerStatus, setPeerStatus] = useState<ChatPresenceStatus | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const scope = session?.chatScope;
  const targetId = session?.targetId;
  // 只有单聊有「对端」：群聊不订阅也不显示（与服务端入口拒绝的口径一致）
  const subscribable = Boolean(
    enabled && session && scope === ChatScope.PRIVATE && targetId,
  );

  // 接收端空闲兜底：TYPING 丢帧 / 对端崩溃都不会有任何通知，只靠 typing=false 收起
  // 会让提示永久挂住——比不显示更糟（见 services/chat/presence 常量注释）
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTypingIdle = useCallback(() => {
    if (typingIdleRef.current !== null) {
      clearTimeout(typingIdleRef.current);
      typingIdleRef.current = null;
    }
  }, []);

  // 切换会话 / 卸载时清掉兜底定时器，避免在已关闭的会话上改 state
  useEffect(() => clearTypingIdle, [clearTypingIdle]);

  /**
   * 在线状态：打开即拉一次权威值，打开期间每 30s 续订一次。
   *
   * <p>「订阅」与「读取」是同一个动作（服务端一次往返同时完成，见端点注释），
   * 因此这里只有一个调用；续订失败是静默的——下一次会自愈，弹提示反而干扰聊天。</p>
   */
  useEffect(() => {
    if (!subscribable || scope === undefined || !targetId) {
      setPeerStatus(null);
      setPeerTyping(false);
      clearTypingIdle();
      return undefined;
    }
    let cancelled = false;
    const tick = () => {
      watchPeerPresence(scope, targetId)
        .then((presence) => {
          if (!cancelled) {
            setPeerStatus(presence.status);
          }
        })
        .catch(() => undefined);
    };
    // 换会话先清空：否则 B 的会话头会短暂带着 A 的状态点
    setPeerStatus(null);
    setPeerTyping(false);
    tick();
    const timer = setInterval(tick, PRESENCE_RENEW_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [subscribable, scope, targetId, clearTypingIdle]);

  /**
   * 本端上报器：按会话创建，随会话销毁。
   *
   * <p>刻意<b>不</b>复用长生命周期实例：`dispose()` 要发 `typing=false`，
   * 而发送目标必须是「当时正在聊的那个人」。实例与 `(scope, targetId)` 绑定后，
   * 切换会话触发的清理只会对旧会话补发停止信号，不会把 B 的会话误标成停止输入。</p>
   */
  const emitterRef = useRef<TypingEmitter | null>(null);
  useEffect(() => {
    if (!subscribable || scope === undefined || !targetId) {
      return undefined;
    }
    const emitter = createTypingEmitter({
      send: (typing) => {
        // 瞬时信号：失败不重试也不提示，下一次续订帧会自愈
        void sendTyping(scope, targetId, typing).catch(() => undefined);
      },
    });
    emitterRef.current = emitter;
    return () => {
      emitterRef.current = null;
      emitter.dispose();
    };
  }, [subscribable, scope, targetId]);

  // 下行帧：只处理属于当前会话的那些（过滤规则在 services/chat/presence）
  useWebSocket({
    autoConnect: enabled,
    onPresence: (presence) => {
      if (!subscribable || !isPresenceOfSession(presence, sessionRef.current)) {
        return;
      }
      setPeerStatus(presence.status);
    },
    onTyping: (typing) => {
      if (!subscribable || !isTypingOfSession(typing, sessionRef.current)) {
        return;
      }
      clearTypingIdle();
      if (!typing.typing) {
        setPeerTyping(false);
        return;
      }
      setPeerTyping(true);
      typingIdleRef.current = setTimeout(() => {
        typingIdleRef.current = null;
        setPeerTyping(false);
      }, TYPING_IDLE_TIMEOUT_MS);
    },
  });

  const notifyTyping = useCallback((typing: boolean) => {
    const emitter = emitterRef.current;
    if (!emitter) {
      return;
    }
    if (typing) {
      emitter.start();
    } else {
      emitter.stop();
    }
  }, []);

  return { peerStatus, peerTyping, notifyTyping };
}

export default useChatPresence;
