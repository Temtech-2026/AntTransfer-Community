/**
 * 已读回执的合并规则（纯函数，无 React、无副作用）。
 *
 * <p><b>口径：回执是派生态，不是字段。</b>「谁读过我发的这条」由服务端按写扩散的镜像行算出来，
 * 前端只是在已渲染的气泡上把读者补上去。两条到达路径合流到这里：
 * <ol>
 *   <li><b>历史（权威）</b>：{@code GET /v1/chat/messages} 每条消息自带 {@code readers}
 *       （见 {@code NotifyMessage.readers}）——离线期间发生的阅读只有这条路径能补齐；</li>
 *   <li><b>实时（增量）</b>：对端进入会话时服务端推来的 {@code CHAT_READ} 帧，
 *       见 {@link WsChatReadPayload}。</li>
 * </ol>
 * 因此合并必须是<b>幂等</b>的：同一读者经两条路径各到一次，只能有一个头像。
 *
 * <p><b>为什么按 {@code clientMsgId} 而不是消息 ID 匹配：</b>发送方本地可能还挂着
 * 「只有幂等键、没有服务端 ID」的乐观行（发送响应与回执帧几乎同时到达），按 ID 匹配会漏。
 * 幂等键由发送方生成并随镜像行一起落库，两侧天然一致。</p>
 */

import type { ChatReader, NotifyMessage } from '@/services/notify';

import type { WsChatReadPayload } from '@/services/ws/protocol';

import { isMine, type ChatSession } from './types';

/** 气泡下最多并排画几个读者头像（再多也没有辨识度，只降低可读性）。 */
export const MAX_READER_AVATARS = 3;

/**
 * 这帧回执是不是当前打开的会话产生的。
 *
 * <p>必须判：回执推给发送人，而发送人可能同时开着多个会话窗口（页面 + 抽屉 + 多标签页），
 * 服务端一帧只带一个 `(scope, targetId)`，不判就会把 A 会话的读者画到 B 会话的气泡下。</p>
 *
 * <p>入参放宽成「带 `(chatScope, chatTargetId)` 的任意帧」：撤回帧（`CHAT_RECALL`）
 * 用同一对字段定位会话，判定口径完全一致，没有理由为了名字再抄一遍——
 * 抄一遍的结果是两处过滤规则各自演化，而这类 bug（帧落错会话）在单会话调试时根本看不出来。</p>
 */
export function isReceiptOfSession(
  receipt: Pick<WsChatReadPayload, 'chatScope' | 'chatTargetId'>,
  session: ChatSession | null | undefined,
): boolean {
  if (!session) {
    return false;
  }
  return (
    receipt.chatScope === session.chatScope &&
    receipt.chatTargetId === session.targetId
  );
}

/** 把一位读者并进已有读者列表；已在列表里则原样返回（保证不回退引用，避免无谓重渲染）。 */
export function mergeReaders(
  current: readonly ChatReader[] | null | undefined,
  reader: ChatReader,
): ChatReader[] {
  const list = current ?? [];
  if (list.some((item) => item.userId === reader.userId)) {
    return list as ChatReader[];
  }
  return [...list, reader];
}

/**
 * 把一帧回执合并进消息流。
 *
 * <p>三条约束，缺一条就会出现「头像重复 / 头像串会话 / 无谓重渲染」：
 * <ol>
 *   <li>只认 {@code clientMsgIds} 命中且<b>确实是我发的</b>消息——幂等键理论上全局唯一，
 *       但把判据写死在代码里比依赖「不会撞」的假设便宜；</li>
 *   <li>读者按 {@code userId} 去重，顺序按到达顺序（服务端按行 id 升序推，故稳定）；</li>
 *   <li>没有任何变化时<b>返回原数组引用</b>：本函数在 {@code setState} 的 updater 里被调用，
 *       返回新数组会让 React 认为列表变了并整屏重渲染。</li>
 * </ol>
 */
export function applyReadReceipt(
  list: NotifyMessage[],
  receipt: WsChatReadPayload,
): NotifyMessage[] {
  if (receipt.clientMsgIds.length === 0) {
    return list;
  }
  const targets = new Set(receipt.clientMsgIds);
  let changed = false;
  const next = list.map((message) => {
    if (!message.clientMsgId || !targets.has(message.clientMsgId)) {
      return message;
    }
    if (!isMine(message)) {
      return message;
    }
    const readers = mergeReaders(message.readers, receipt.reader);
    if (readers === message.readers) {
      return message;
    }
    changed = true;
    return { ...message, readers };
  });
  return changed ? next : list;
}

/** 读者头像的展示切分：最多画 {@link MAX_READER_AVATARS} 个，其余折成「+N」。 */
export interface ReaderSummary {
  /** 实际渲染头像的读者（按到达顺序，最多 `max` 位）。 */
  shown: ChatReader[];
  /** 被折叠掉的读者数（0 表示全画得下）。 */
  overflow: number;
}

/** 切分读者列表供气泡下渲染（纯展示口径，不影响数据）。 */
export function summarizeReaders(
  readers: readonly ChatReader[] | null | undefined,
  max: number = MAX_READER_AVATARS,
): ReaderSummary {
  const list = readers ?? [];
  if (max <= 0) {
    return { shown: [], overflow: list.length };
  }
  if (list.length <= max) {
    return { shown: [...list], overflow: 0 };
  }
  return { shown: list.slice(0, max), overflow: list.length - max };
}
