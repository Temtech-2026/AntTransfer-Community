/**
 * 「我在各会话里的消息提醒偏好」的**进程内索引**。
 *
 * <p><b>为什么需要这样一个地方：</b>提示音的触发点在全局（与页面无关的 WebSocket 帧），
 * 而偏好是随会话列表 / 群详情下发的。全局触发时若手上没有这份索引，
 * 就只能为了「要不要响」再发一次请求——每来一条消息发一次，显然不可接受。</p>
 *
 * <p><b>它不是状态源，只是一份缓存</b>：真正的事实源是服务端（随 {@code ConversationVO}
 * 与群设置接口下发）。因此这里的写入口都刻意做得很窄：</p>
 * <ul>
 *   <li>{@link setConversationNotifyPreferences}：会话列表加载后整批灌入；</li>
 *   <li>{@link setGroupNotifyPreference}：群设置面板保存成功后单点更新（不必重拉整张列表）。</li>
 * </ul>
 *
 * <p><b>缓存未命中按「没有偏好」处理，即照常提醒</b>（裁决口径见 {@code shouldRemindMessage}）：
 * 宁可多响一声，也不要在列表还没拉到时不响——后者用户会以为提示音坏了。</p>
 *
 * <p><b>登录态切换要清空</b>：键是 {@code (scope, targetId)}，不含用户维度，
 * 换个人登录后旧用户的免打扰设置会造成「这个群明明该响却不响」。
 * 清空时机由挂载全局提示音的应用外壳负责（见 {@code components/NotifySoundAlert}）。</p>
 */

import { ChatScope } from '@/services/notify';

import type { ChatGroupNotifyPreference, Conversation } from './types';

const preferences = new Map<string, ChatGroupNotifyPreference>();

function preferenceKey(chatScope: number, targetId: string): string {
  return `${chatScope}:${targetId}`;
}

/** 会话列表加载后整批灌入（只覆盖列表里出现的会话，未出现的保持原样）。 */
export function setConversationNotifyPreferences(
  list: readonly Conversation[] | null | undefined,
): void {
  if (!list) {
    return;
  }
  for (const item of list) {
    // 单聊没有免打扰语义，不入索引：留着只会让「单聊为什么查得到偏好」变成一个误读
    if (item.chatScope !== ChatScope.GROUP || !item.targetId) {
      continue;
    }
    if (item.notifyPreference) {
      preferences.set(
        preferenceKey(item.chatScope, item.targetId),
        item.notifyPreference,
      );
    } else {
      // 后端明确回了「没有偏好」（已退群 / 被移除）→ 必须删掉旧值，
      // 否则一个已经退出的群仍会按旧偏好静音，用户找不到任何入口去解释这件事
      preferences.delete(preferenceKey(item.chatScope, item.targetId));
    }
  }
}

/** 群设置面板保存成功后单点更新（{@code null} 表示清掉该群的缓存）。 */
export function setGroupNotifyPreference(
  groupId: string,
  preference: ChatGroupNotifyPreference | null | undefined,
): void {
  if (!groupId) {
    return;
  }
  const key = preferenceKey(ChatScope.GROUP, groupId);
  if (preference) {
    preferences.set(key, preference);
  } else {
    preferences.delete(key);
  }
}

/** 取我在该会话的提醒偏好；未命中返回 {@code null}（调用方按「照常提醒」处理）。 */
export function getConversationNotifyPreference(
  chatScope: number,
  targetId: string,
): ChatGroupNotifyPreference | null {
  if (!targetId) {
    return null;
  }
  return preferences.get(preferenceKey(chatScope, targetId)) ?? null;
}

/** 清空索引（登录态切换 / 全局提示音卸载时调用）。 */
export function clearConversationNotifyPreferences(): void {
  preferences.clear();
}
