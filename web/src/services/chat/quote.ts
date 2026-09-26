/**
 * 「引用回复」的草稿模型与构造口径（纯逻辑，可单测）。
 *
 * <p><b>为什么要有草稿这一层，而不是右键后直接把消息对象塞进输入框状态：</b>
 * 输入框需要的只是「怎么把这段话显示出来 + 发送时回传哪个键」三项信息，
 * 而消息对象里带着 19 位 id、读者列表、已读状态等一堆与引用无关的东西。
 * 隔一层之后，「用户选好引用、等发送成功、期间原消息被撤回」这类时序问题
 * 只影响草稿的三个字段，不会牵动消息流的任何逻辑。</p>
 *
 * <p><b>摘要取本地已有的正文，不回查服务端：</b>被引用消息一定在本地消息流里
 * （右键菜单只挂在已渲染的气泡上），再发一次请求既要处理失败分支、
 * 又会与「服务端写入时另存快照」形成两份来源。服务端那边的快照才是权威，
 * 它负责后续被撤回后的可读性；这里这份只负责<b>发送前</b>输入框里的预览。</p>
 */

import { isRecalled, messageSummary } from './types';
import type { NotifyMessage } from '@/services/notify';

/** 引用块里被引用正文的截断长度（比气泡正文短：它是「提示」，不是内容本体）。 */
export const QUOTE_SUMMARY_MAX = 60;

/** 输入框上方的「正在引用」草稿。 */
export interface ChatQuoteDraft {
  /** 被引用消息的幂等键（发送时随 `quoteClientMsgId` 回传，服务端据此取快照）。 */
  clientMsgId: string;
  /** 被引用消息的发送人展示名（引用块顶行「谁说的」）。 */
  senderName: string;
  /** 被引用消息的正文摘要（引用块第二行）。 */
  summary: string;
}

/**
 * 由消息构造引用草稿。
 *
 * @param senderName 发送人展示名（由调用方按当前会话的名字口径解析，本函数不猜）
 * @returns 无法引用的消息（已撤回、无幂等键）返回 `null`——调用方据此不显示「引用」菜单项
 */
export function toQuoteDraft(
  message: NotifyMessage,
  senderName: string,
  maxLength = QUOTE_SUMMARY_MAX,
): ChatQuoteDraft | null {
  if (!message.clientMsgId || isRecalled(message)) {
    return null;
  }
  return {
    clientMsgId: message.clientMsgId,
    senderName,
    // 不带 mine 标记：引用块上方已经写了「谁说的」，正文再来一个「我：」是重复
    summary: messageSummary(
      {
        content: message.content,
        messageType: message.messageType,
      },
      maxLength,
    ),
  };
}
