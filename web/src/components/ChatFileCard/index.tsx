/**
 * 聊天消息里的「文件迷你卡片」。
 *
 * <p>通讯抽屉与 `/chat` 页共用同一个组件：两端读的是同一条消息、同一份数据，
 * 卡片就该是同一份渲染，否则迟早各自漂移（一边能点、一边不能点）。</p>
 *
 * <h3>两条取件路径，卡片按「有没有授权」分派</h3>
 * <ul>
 *   <li><b>带授权</b>（正文有 `#att:{id}`）：发送方在发出前已设定用途档位 / 有效期 / 次数，
 *       接收方<b>免申请</b>即可预览或下载。裁决全在服务端的换票端点完成，卡片只负责发起。</li>
 *   <li><b>不带授权</b>（历史消息、群聊）：沿用旧行为，点击回到文件域按既有权限体系取件，
 *       无权限时在那里走权限申请流程。</li>
 * </ul>
 *
 * <h3>为什么点卡片不再直接下载</h3>
 * <p>下载<b>会消耗一次额度</b>，而额度是发送方给的、用完就没了。把消耗性动作藏在
 * 「点一下卡片」里，用户会在浏览时无意中把次数耗光。因此有授权的卡片把动作显式化成按钮，
 * 并让「仅预览」这类不耗额度的动作用词明显区分。</p>
 */

import {
  DownloadOutlined,
  EyeOutlined,
  FileOutlined,
  InboxOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { history, useIntl } from '@umijs/max';
import { App, Button, Space, Spin, Tag, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import {
  canDownload,
  canResave,
  CHAT_ATTACHMENT_STATUS,
  downloadChatAttachment,
  fetchChatAttachment,
  openChatAttachmentPreview,
  revokeChatAttachment,
  saveChatAttachmentToMyFiles,
  type ChatAttachment,
} from '@/services/file/chatAttachment';
import { buildFileDeepLink } from '@/utils/fileDeepLink';

/** 跳转到文件域并带上条目 ID。文件页负责把 `nodeId` 变成「打开那个条目」。 */
export function openFileNode(nodeId: string): void {
  history.push(buildFileDeepLink(nodeId));
}

const useStyles = createStyles(({ token, css }) => ({
  /**
   * 卡片自带底色（`colorBgElevated`），因此**必须自带文字色**。
   *
   * <p>宿主气泡在「自己发的」一侧是主色底 + 白字（见 `pages/chat/index.style` 的
   * `bubbleSelf`）。若这里的文字色留空，卡片内的文件名会继承气泡的白字，
   * 于是白底上写白字——尺寸（`sub` 有显式色）与图标、按钮都照常可见，
   * 唯独文件名消失，表现为「卡片里没有文件名」。颜色随底色走是这张卡自己的事，
   * 不能指望宿主气泡的文字色恰好可读。</p>
   */
  card: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 180px;
    max-width: 320px;
    padding: 8px 10px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgElevated};
    color: ${token.colorText};
  `,
  clickable: css`
    cursor: pointer;
    &:hover {
      border-color: ${token.colorPrimaryBorder};
    }
    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorder};
      outline-offset: 1px;
    }
  `,
  icon: css`
    flex: none;
    font-size: 20px;
    color: ${token.colorPrimary};
  `,
  meta: css`
    flex: 1;
    min-width: 0;
  `,
  name: css`
    display: block;
    max-width: 220px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  `,
  sub: css`
    display: flex;
    align-items: center;
    gap: 6px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  actions: css`
    flex: none;
  `,
  /** 撤销态整卡降透明度：它是终态，视觉上不该和可取件的卡片一样"活着" */
  inactive: css`
    opacity: 0.6;
  `,
}));

export interface ChatFileCardProps {
  name: string;
  sizeText: string;
  /** 文件条目 ID；缺省（历史消息）时卡片只展示、不可点击 */
  nodeId?: string;
  /** 会话附件授权 ID；有值时提供免申请取件入口 */
  attachmentId?: string;
  /**
   * 是否为自己发出的消息。
   *
   * <p>方向判定沿用会话域的既有口径（{@code senderUserId === recipientUserId}），
   * 不比「当前用户 ID」：登录态里没有可信的用户主键（见 `services/notify/types`）。</p>
   */
  mine?: boolean;
  /** 取件 / 撤销成功后回调，宿主据此刷新会话或角标 */
  onAttachmentChange?: () => void;
}

/** 消息正文里的文件卡片。 */
const ChatFileCard = ({
  name,
  sizeText,
  nodeId,
  attachmentId,
  mine,
  onAttachmentChange,
}: ChatFileCardProps): ReactElement => {
  const { styles } = useStyles();
  const intl = useIntl();
  const { message: toast, modal } = App.useApp();
  const [detail, setDetail] = useState<ChatAttachment | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * 回表一次授权详情，并把它交给调用方。
   *
   * <p>之所以要有返回值：「预览不支持内联」时的提示措辞取决于授权档位，
   * 而详情是异步到的——只 setState 的话，调用方在详情未就绪时就只能"猜"档位，
   * 会在明明可下载的情况下说「发送方未允许下载」。</p>
   *
   * @returns 拉到的详情；未登录态或请求失败时为 `null`
   */
  const refresh = useCallback(async (): Promise<ChatAttachment | null> => {
    if (!attachmentId) {
      return null;
    }
    try {
      const latest = await fetchChatAttachment(attachmentId);
      setDetail(latest);
      return latest;
    } catch {
      // 详情是辅助信息（次数 / 有效期），拉不到也要让卡片照常显示文件名与尺寸
      return null;
    }
  }, [attachmentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const revoked = detail?.status === CHAT_ATTACHMENT_STATUS.REVOKED;
  const expired =
    detail?.status === CHAT_ATTACHMENT_STATUS.EXPIRED ||
    (detail?.expireAt != null && dayjs(detail.expireAt).isBefore(dayjs()));
  const inactive = revoked || expired;
  const downloadable = canDownload(detail?.usageMode);
  const resavable = canResave(detail?.usageMode);

  const handlePreview = async () => {
    if (!attachmentId) {
      return;
    }
    setBusy(true);
    try {
      const ticket = await openChatAttachmentPreview(attachmentId);
      if (!ticket.previewSupported) {
        // 服务端不会把内联请求降级成下载（那会绕过「仅预览」档位），而是直接拒绝，
        // 因此这里没有打开任何页面，必须由提示补上「为什么没反应」。
        // 提示什么取决于用户还能不能下载：仅预览档位下「请下载后查看」是一句做不到的建议。
        //
        // 档位来自异步拿到的详情，而用户完全可能在详情回来之前就点了预览。此时宁可就地补一次
        // 请求、晚一拍作答，也不要说一句与事实相反的话（可下载却被告知"发送方未允许下载"）。
        const usageMode = detail?.usageMode ?? (await refresh())?.usageMode;
        toast.info(
          intl.formatMessage({
            id: canDownload(usageMode)
              ? 'chat.attachCard.previewUnsupported'
              : 'chat.attachCard.previewUnsupportedNoDownload',
          }),
        );
      }
    } catch {
      // 错误提示由请求层统一负责（含撤销 / 过期 / 次数用尽的具体原因）
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!attachmentId) {
      return;
    }
    setBusy(true);
    try {
      await downloadChatAttachment(attachmentId);
      // 下载成功无需提示：浏览器自身的下载条就是反馈；这里只回表，好让剩余次数刷新
      await refresh();
      onAttachmentChange?.();
    } catch {
      // 同上：错误提示由请求层负责
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!attachmentId) {
      return;
    }
    setBusy(true);
    try {
      await saveChatAttachmentToMyFiles(attachmentId);
      toast.success(intl.formatMessage({ id: 'chat.attachCard.saveSuccess' }));
      onAttachmentChange?.();
    } catch {
      // 同上
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = () => {
    if (!attachmentId) {
      return;
    }
    modal.confirm({
      title: intl.formatMessage({ id: 'chat.attachCard.revokeConfirmTitle' }),
      content: intl.formatMessage({ id: 'chat.attachCard.revokeConfirmDesc' }),
      okButtonProps: { danger: true },
      onOk: async () => {
        await revokeChatAttachment(attachmentId);
        toast.success(intl.formatMessage({ id: 'chat.attachCard.revokeOk' }));
        await refresh();
        onAttachmentChange?.();
      },
    });
  };

  /** 限制摘要：仅预览 / 剩余次数 / 有效期。发送方与接收方看同一份，避免"我看到的限制不是他看到的"。 */
  const renderLimits = (): ReactElement | null => {
    if (!detail) {
      return null;
    }
    if (revoked) {
      return <Tag color="default">{intl.formatMessage({ id: 'chat.attachCard.revoked' })}</Tag>;
    }
    if (expired) {
      return <Tag color="default">{intl.formatMessage({ id: 'chat.attachCard.expired' })}</Tag>;
    }
    const quota =
      detail.remaining == null
        ? intl.formatMessage({ id: 'chat.attachCard.unlimited' })
        : intl.formatMessage(
            { id: 'chat.attachCard.remaining' },
            { count: detail.remaining },
          );
    const validity = detail.expireAt
      ? intl.formatMessage(
          { id: 'chat.attachCard.expireAt' },
          { date: dayjs(detail.expireAt).format('YYYY-MM-DD HH:mm') },
        )
      : intl.formatMessage({ id: 'chat.attachCard.neverExpire' });
    return (
      <>
        {downloadable && <span>{quota}</span>}
        {downloadable && <span>·</span>}
        <span>{validity}</span>
      </>
    );
  };

  const renderActions = (): ReactElement | null => {
    if (!attachmentId || inactive || busy) {
      return null;
    }
    if (mine) {
      return (
        <Button
          type="text"
          size="small"
          danger
          icon={<UndoOutlined />}
          onClick={handleRevoke}
        >
          {intl.formatMessage({ id: 'chat.attachCard.revoke' })}
        </Button>
      );
    }
    return (
      <Space size={0}>
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={handlePreview}
        >
          {intl.formatMessage({ id: 'chat.attachCard.preview' })}
        </Button>
        {downloadable && (
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            {intl.formatMessage({ id: 'chat.attachCard.download' })}
          </Button>
        )}
        {resavable && (
          <Tooltip title={intl.formatMessage({ id: 'chat.attachCard.save' })}>
            <Button
              type="text"
              size="small"
              icon={<InboxOutlined />}
              onClick={handleSave}
            />
          </Tooltip>
        )}
      </Space>
    );
  };

  // 有授权时卡片不再整体可点：动作已显式化成按钮，整体点击只会带来误触
  const open = !attachmentId && nodeId ? () => openFileNode(nodeId) : undefined;
  const limits = renderLimits();
  const actions = renderActions();

  return (
    <div
      className={[
        styles.card,
        open ? styles.clickable : '',
        inactive ? styles.inactive : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role={open ? 'button' : undefined}
      tabIndex={open ? 0 : undefined}
      title={open ? intl.formatMessage({ id: 'chat.fileCard.open' }, { name }) : name}
      onClick={open}
      onKeyDown={
        open
          ? (event) => {
              // 卡片是 div，键盘可达性要自己补：Enter / 空格等价于一次点击
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open();
              }
            }
          : undefined
      }
    >
      <FileOutlined className={styles.icon} />
      <div className={styles.meta}>
        <span className={styles.name} title={name}>
          {name}
        </span>
        <span className={styles.sub}>
          <span>{sizeText}</span>
          {busy && <Spin size="small" />}
          {limits}
        </span>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
};

export default ChatFileCard;
