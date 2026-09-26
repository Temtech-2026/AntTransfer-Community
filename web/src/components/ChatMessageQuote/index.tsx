/**
 * 消息气泡里的「引用块」：顶行是「引用了谁」，第二行是被引用正文的摘要。
 *
 * <p><b>纯展示组件，不做任何回查。</b>摘要与发送人都来自消息本体
 * （服务端写入时抄下的快照，或输入框上方那份本地草稿）：被引用消息可能随后被撤回，
 * 届时原消息正文已清空，任何「按 id 回查原文」的渲染都会让引用块在几秒后集体变空白。</p>
 *
 * <p><b>为什么两个聊天界面共用它：</b>聊天页与会话抽屉各自维护消息流，
 * 但「引用长什么样」必须一致——否则同一段引用在页面里和在抽屉里长得不一样，
 * 用户会以为看错了。样式收敛在这里，两个调用方只负责传两个字符串。</p>
 */

import { createStyles } from 'antd-style';
import React from 'react';

const useStyles = createStyles(({ css, token }) => ({
  quote: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 6px;
    padding: 4px 8px;
    border-left: 3px solid ${token.colorSplit};
    border-radius: 2px;
    background: ${token.colorFillQuaternary};
    font-size: 12px;
    line-height: 18px;
    text-align: left;
  `,
  sender: css`
    color: ${token.colorTextSecondary};
    font-weight: 500;
  `,
  summary: css`
    overflow: hidden;
    color: ${token.colorTextTertiary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

export interface ChatMessageQuoteProps {
  /** 被引用消息的发送人展示名。 */
  senderName: string;
  /** 被引用消息的正文摘要（调用方已截断）。 */
  summary: string;
}

const ChatMessageQuote: React.FC<ChatMessageQuoteProps> = ({
  senderName,
  summary,
}) => {
  const { styles } = useStyles();
  return (
    <div className={styles.quote} data-testid="chat-quote">
      <span className={styles.sender}>{senderName}</span>
      <span className={styles.summary}>{summary}</span>
    </div>
  );
};

export default ChatMessageQuote;
