/**
 * 新消息提示音的**全局落地处**（不渲染任何 UI）。
 *
 * <p><b>为什么必须挂在布局上而不是聊天页里：</b>提示音要覆盖「我在任何页面」的所有会话消息；
 * 只挂在聊天页会让「在文件页 / 审批页收到消息」彻底无声，而这恰恰是提示音最该起作用的场景。</p>
 *
 * <p><b>为什么直接订阅 {@code wsStore} 而不是用 {@code useWebSocket}：</b>
 * 那个 Hook 的回调是按页面语义组织的（聊天页要用它更新消息流、滚动位置等）；
 * 提示音只关心「有没有一条该响的消息」，独立订阅既不会和页面争抢回调，
 * 也不会在页面卸载时被一起拆掉。多订阅者共享同一条帧流，不产生额外连接。</p>
 *
 * <p><b>出声与否的唯一裁决口径是 {@code shouldRemindMessage}</b>（免打扰 + 提及档位 + 自己发的），
 * 这里只负责把「偏好」从索引里取出来喂给它——不要把判断抄一份到这里，
 * 否则「列表角标按免打扰、提示音却不按」这类不一致迟早出现。</p>
 */

import { useEffect } from 'react';

import {
  clearConversationNotifyPreferences,
  getConversationNotifyPreference,
} from '@/services/chat/notifyPreference';
import { shouldRemindMessage } from '@/services/chat/types';
import { isChatNotify, isSelfSentMessage } from '@/services/notify';
import {
  disposeNotifySound,
  loadNotifySoundSetting,
  playNotifySound,
  primeNotifySound,
} from '@/services/notify/soundPlayer';
import { wsStore } from '@/services/ws';

const NotifySoundAlert: React.FC = () => {
  useEffect(() => {
    // 偏好索引的键是 (scope, targetId)，不含用户维度：换个人登录后必须清掉，
    // 否则上一个账号的免打扰设置会继续生效（表现为「这个群该响却不响」，且用户找不到原因）
    clearConversationNotifyPreferences();
    // 先解锁音频通道：浏览器的自动播放限制只认「用户手势」，而这里正是全局手势的落点。
    // 必须早于第一条消息到达，否则第一声永远不响（见 primeNotifySound 的注释）
    primeNotifySound();
    // 设置只拉一次：开关与音色不是高频变化的数据，面板改完会就地回填缓存
    void loadNotifySoundSetting();

    const unsubscribe = wsStore.subscribeMessage((message) => {
      if (!isChatNotify(message.notifyType)) {
        return;
      }
      const selfSent = isSelfSentMessage(message);
      if (selfSent) {
        // 写扩散会把自己发的那一行原样推回给自己，不拦住就会「自己发消息自己响」
        return;
      }
      const chatTargetId = message.chatTargetId;
      if (!chatTargetId) {
        return;
      }
      const remind = shouldRemindMessage({
        chatScope: message.chatScope ?? 0,
        mentionType: message.mentionType,
        preference: getConversationNotifyPreference(
          message.chatScope ?? 0,
          chatTargetId,
        ),
        selfSent,
      });
      if (remind) {
        void playNotifySound();
      }
    });

    return () => {
      unsubscribe();
      // 释放已取的 Blob URL、停掉在播的音频并丢掉设置缓存：
      // 这个组件随登录态布局挂载，卸载即意味着换人 / 退出，留着缓存会让下一个人「不响」
      disposeNotifySound();
    };
  }, []);

  return null;
};

export default NotifySoundAlert;
