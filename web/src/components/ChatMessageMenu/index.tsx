/**
 * 消息气泡的右键菜单：撤回、引用。
 *
 * <p><b>为什么是右键而不是悬浮一排小按钮：</b>气泡本身很窄（群聊里还有头像与发送人），
 * 悬浮按钮会盖住正文、且在触屏上没有「悬浮」这个状态。右键菜单不占版面，
 * 与微信 / 飞书的操作习惯一致。</p>
 *
 * <p><b>不可用项直接不出现，而不是置灰：</b>「撤回」只有在「自己发的 + 2 分钟内 +
 * 未撤回」时才存在；如果置灰，「为什么我这条撤不了」会变成一个没人能回答的问题
 * （用户看不到 2 分钟这个规则，也看不到服务端的判定）。不显示则是明确的沉默：
 * 这条消息本来就没有这个操作。同理，已撤回的消息不提供「引用」。</p>
 *
 * <p><b>这两个判断<u>都不是安全边界</u></b>：撤回的归属与时间窗由服务端判定
 * （`1034/1035`），引用目标是否可用也由服务端校验（`1036`）。
 * 这里只决定「菜单里露不露这一项」，挡不住任何构造请求。</p>
 */

import { MessageOutlined, UndoOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import React from 'react';

export interface ChatMessageMenuProps {
  /** 是否提供「撤回」（自己发的 + 时间窗内 + 未撤回）。 */
  canRecall: boolean;
  /** 是否提供「引用」（已撤回的消息不可引用）。 */
  canQuote: boolean;
  onRecall: () => void;
  onQuote: () => void;
  /**
   * 气泡本身（必须是单个元素，且能吃 ref —— `Dropdown` 会克隆它挂事件与 ref）。
   *
   * <p><b>为什么不再包一层 div：</b>气泡的宽度受百分比约束（抽屉里是 `max-width: 78%`），
   * 而百分比是相对<b>直接父级</b>算的。多包一层就会让「100% 宽的壳」再乘一次百分比，
   * 中长消息会凭空多折几行；右键区域也会与气泡视觉范围不一致。
   * 直接把气泡交给 `Dropdown` 克隆，既不改布局，右键范围又正好是气泡本身。</p>
   */
  children: React.ReactElement;
}

const ChatMessageMenu: React.FC<ChatMessageMenuProps> = ({
  canRecall,
  canQuote,
  onRecall,
  onQuote,
  children,
}) => {
  const intl = useIntl();

  // 两项都不可用时不包 Dropdown：右键弹出一个空菜单比没有反应更让人困惑
  if (!canRecall && !canQuote) {
    return <>{children}</>;
  }

  const items: MenuProps['items'] = [];
  if (canQuote) {
    items.push({
      key: 'quote',
      icon: <MessageOutlined />,
      label: intl.formatMessage({ id: 'chat.message.action.quote' }),
      onClick: onQuote,
    });
  }
  if (canRecall) {
    items.push({
      key: 'recall',
      icon: <UndoOutlined />,
      danger: true,
      label: intl.formatMessage({ id: 'chat.message.action.recall' }),
      onClick: onRecall,
    });
  }

  return (
    // 不再套壳：`Dropdown` 自己会克隆 children 并合并 onContextMenu 与 ref，
    // 气泡因此仍是原来那个盒子（宽度约束、右键范围都不变，见 props 注释）
    <Dropdown menu={{ items }} trigger={['contextMenu']}>
      {children}
    </Dropdown>
  );
};

export default ChatMessageMenu;
