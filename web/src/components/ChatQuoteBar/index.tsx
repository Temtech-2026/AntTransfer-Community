/**
 * 输入框上方的「正在引用」提示条：引用块 + 取消按钮。
 *
 * <p><b>为什么引用块本体要复用 {@link ChatMessageQuote}：</b>发送前看到的那块预览
 * 与发出去之后气泡里的那块必须长得一模一样。两处各写一份样式的话，
 * 「刚才引的明明是这句」会变成一个无法自证的问题——用户只能怀疑自己点错了。</p>
 *
 * <p><b>取消按钮是这个草稿唯一的回头路：</b>右键「引用」之后引用态一直挂着，
 * 直到发送成功或点这里。把出口放在最显眼处（而不是再右键一次或清空输入框），
 * 是因为「我改主意了」和「我打错字了」在用户心里是两件事。</p>
 *
 * <p>纯展示：引用内容与取消回调都由调用方给，本组件不认识消息流
 * （`/chat` 页与即时通讯抽屉的草稿状态各自维护，见 services/chat/quote）。</p>
 */

import { CloseCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Button } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';

import ChatMessageQuote from '@/components/ChatMessageQuote';
import type { ChatQuoteDraft } from '@/services/chat/quote';

const useStyles = createStyles(() => ({
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  /** 引用块占满剩余宽度：长摘要由它自己内部截断，不要把取消按钮挤出去。 */
  quote: {
    flex: 1,
    minWidth: 0,
  },
}));

export interface ChatQuoteBarProps {
  /** 正在引用的消息草稿（发送时随 `quoteClientMsgId` 回传）。 */
  draft: ChatQuoteDraft;
  onCancel: () => void;
  /** 发送中：不允许再改动本次发送的引用目标。 */
  disabled?: boolean;
}

const ChatQuoteBar: React.FC<ChatQuoteBarProps> = ({
  draft,
  onCancel,
  disabled = false,
}) => {
  const intl = useIntl();
  const { styles } = useStyles();
  const cancelLabel = intl.formatMessage({ id: 'chat.composer.quote.cancel' });

  return (
    <div className={styles.bar} data-testid="chat-quote-bar">
      <div className={styles.quote}>
        <ChatMessageQuote
          senderName={draft.senderName}
          summary={draft.summary}
        />
      </div>
      <Button
        type="text"
        size="small"
        icon={<CloseCircleOutlined />}
        aria-label={cancelLabel}
        title={cancelLabel}
        disabled={disabled}
        onClick={onCancel}
      />
    </div>
  );
};

export default ChatQuoteBar;
