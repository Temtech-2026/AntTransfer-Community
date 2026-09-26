/**
 * 输入框上方的待发附件条：`/chat` 页与即时通讯抽屉共用同一份。
 *
 * <p>为什么单独抽成一个组件：这条窄窄的横条承载了「这份文件要按什么限制发出去」这件事，
 * 而两个入口都必须给出完全相同的选项与措辞——同一条限制在抽屉里叫「可转发转存」、
 * 在页面上叫别的说法，用户会以为两个地方发的文件不是一回事。</p>
 *
 * <p>没有待发送文件时退化成一条投放提示。两个入口都只支持「从文件区拖进来」，
 * 不放选择文件的按钮：抽屉只有 380px 宽、页面上也不缺文件入口，多一个按钮会让
 * 同一件事在两处的手感重新分叉——真要做，应该两个入口一起做。</p>
 */

import { CloseCircleOutlined, FileOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { createStyles } from 'antd-style';
import { Alert, Button } from 'antd';

import ChatAttachmentPolicyPicker from '@/components/ChatAttachmentPolicy';
import { formatBytes } from '@/components/ChunkUpload';
import type { ChatAttachmentPolicy } from '@/services/file/chatAttachment';
import { MAX_FILE_SIZE } from '@/services/upload/constants';
import type { FileDragPayload } from '@/utils/dragFile';

const useStyles = createStyles(({ token }) => ({
  /** 待发文件条：虚线框，与正式的输入框区分开。 */
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    padding: '6px 8px',
    border: `1px dashed ${token.colorBorder}`,
    borderRadius: token.borderRadius,
    background: token.colorFillQuaternary,
    fontSize: token.fontSizeSM,
  },

  /** 文件名占了绝大部分宽度，长名字必须能截断（否则整条会把选择器挤出去）。 */
  name: {
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },

  hint: {
    marginBottom: 8,
  },
}));

export interface ChatAttachmentHeaderProps {
  /** 待发送文件；`null` 时渲染投放提示 */
  attachment: FileDragPayload | null;
  policy: ChatAttachmentPolicy;
  onPolicyChange: (next: ChatAttachmentPolicy) => void;
  onRemove: () => void;
  /** 是否给出用途限制选择器：群聊本期不建授权，传 `false` 免得给出一组无效选项 */
  showPolicy: boolean;
  /** 发送中：不允许再改限制或撤下附件 */
  disabled?: boolean;
}

const ChatAttachmentHeader = ({
  attachment,
  policy,
  onPolicyChange,
  onRemove,
  showPolicy,
  disabled = false,
}: ChatAttachmentHeaderProps) => {
  const intl = useIntl();
  const { styles } = useStyles();

  if (!attachment) {
    // 大小上限跟着投放提示一起说：拖进来与从回形针进来看到的是同一个数
    return (
      <Alert
        className={styles.hint}
        type="info"
        showIcon
        banner
        title={intl.formatMessage(
          { id: 'chat.attach.dropHint' },
          { size: formatBytes(MAX_FILE_SIZE) },
        )}
      />
    );
  }

  return (
    <div className={styles.bar}>
      <FileOutlined />
      <span className={styles.name} title={attachment.fileName}>
        {attachment.fileName}
      </span>
      <span>{formatBytes(attachment.sizeBytes)}</span>
      {showPolicy && (
        <ChatAttachmentPolicyPicker
          value={policy}
          onChange={onPolicyChange}
          disabled={disabled}
        />
      )}
      <Button
        type="text"
        size="small"
        icon={<CloseCircleOutlined />}
        aria-label={intl.formatMessage({ id: 'chat.attach.remove' })}
        disabled={disabled}
        onClick={onRemove}
      />
    </div>
  );
};

export default ChatAttachmentHeader;
