/**
 * 对端资料面板（单聊）：看对方是谁 + 给他起 / 改 / 取消备注。
 *
 * <p><b>为什么是一个独立面板而不是「改备注」一个小弹窗：</b>备注是<b>私有称呼</b>，
 * 用户按下保存前必须先确认「我改的是谁」。把「当前生效的称呼」与「对方的真实昵称」
 * 并排放在同一屏，才能让「备注不会改到对方账号」这件事被看见——这恰好是微信 / QQ
 * 里最容易误解的一处（很多人以为改备注等于改对方昵称）。因此面板里两件事缺一不可：
 * 只读的真实昵称 + 可写的备注。</p>
 *
 * <p><b>备注是「我这边叫什么」，不是改昵称：</b>服务端只写 {@code (我, 他)} 那一行的私有属性，
 * 不碰 {@code sys_user}，对方与其他任何人的界面都不变。面板上因此明确写出这条口径，
 * 而不是让用户自己猜。也正因为它是私有的，<b>不需要任何权限点</b>——
 * 归属者由服务端按登录态写死，前端没有「替别人设备注」这个入参面。</p>
 *
 * <p><b>成功后就地生效，不重拉会话列表：</b>写接口回吐操作后的状态，调用方把它交给
 * 备注覆盖表（`services/chat/peerAlias`），会话列表、标题、消息署名一次刷新全部跟着变。
 * 若改用「重拉列表」，用户会看到列表闪烁 + 分页 / 筛选状态丢失，只为改三个字。</p>
 *
 * <p><b>展示名一律经 {@link conversationTitle} 取值：</b>面板顶部显示的名字必须与列表、
 * 标题完全一致（备注优先于真实昵称）。在这里自己拼字符串，迟早出现
 * 「列表写着备注、面板写着昵称」这种同一事实两种呈现。</p>
 */

import { useIntl } from '@umijs/max';
import { App, Button, Input, Modal, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { useCallback, useEffect, useMemo, useState } from 'react';

import UserAvatar from '@/components/UserAvatar';
import { clearPeerAlias, setPeerAlias } from '@/services/chat/api';
import { conversationInitial, conversationTitle } from '@/services/chat/types';
import { ChatScope } from '@/services/notify';

const { Text } = Typography;

/**
 * 备注名长度上限。
 *
 * <p>与后端 {@code ChatPeerAliasDTO} 的校验、`sys_chat_peer_alias.alias` 的列宽同源。
 * 前端限长只为不让用户白打一遍，<b>不是安全边界</b>，超长由服务端拒绝。</p>
 */
const MAX_PEER_ALIAS = 32;

const useStyles = createStyles(({ token, css }) => ({
  profile: css`
    display: flex;
    align-items: center;
    gap: 12px;
  `,
  profileMain: css`
    min-width: 0;
  `,
  profileName: css`
    overflow: hidden;
    color: ${token.colorText};
    font-size: ${token.fontSizeLG}px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  profileMeta: css`
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  section: css`
    margin-top: 20px;
  `,
  hint: css`
    display: block;
    margin-top: 6px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  actions: css`
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  `,
}));

/** 对端资料面板入参。 */
export interface ChatPeerPanelProps {
  /** 面板是否展开。 */
  open: boolean;
  /** 对端用户 ID（19 位雪花 ID 字符串）；为空时面板不渲染内容、也不发请求。 */
  peerId: string | null | undefined;
  /** 对端真实昵称（页面已按 `会话名回落链` 兜过底），只读展示。 */
  nickname: string;
  /** 对端头像地址（页面数据；被覆盖表命中时由 {@link UserAvatar} 替换）。 */
  avatarUrl?: string | null;
  /** 当前备注；`null` = 现在没有备注。 */
  alias: string | null;
  /** 关闭面板。 */
  onClose: () => void;
  /** 备注变更成功后回调：设置成功给新值，取消成功给 `null`。 */
  onChanged?: (peerId: string, alias: string | null) => void;
}

/**
 * 对端资料面板：只读的真实昵称 + 可写的私有备注。
 */
const ChatPeerPanel: React.FC<ChatPeerPanelProps> = ({
  open,
  peerId,
  nickname,
  avatarUrl,
  alias,
  onClose,
  onChanged,
}) => {
  const intl = useIntl();
  const { message: toast } = App.useApp();
  const { styles } = useStyles();

  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const target = peerId?.trim() ?? '';
  const currentAlias = alias?.trim() ? alias.trim() : null;

  // 每次展开（或备注在别处被改）都以「当前备注」重开草稿：留着上一次的输入，
  // 用户会以为已经改过了（尤其上次保存失败时）
  useEffect(() => {
    if (open) {
      setDraft(currentAlias ?? '');
    }
  }, [open, currentAlias, target]);

  /**
   * 面板顶部的展示对象：与列表 / 标题同一套取值口径。
   *
   * <p>喂进 {@link conversationTitle} 而不是自己写 `alias || nickname`，
   * 是为了让「备注优先于昵称」这条规则只有一处实现——两处实现就有分叉的那天。</p>
   */
  const displaySession = useMemo(
    () => ({
      chatScope: ChatScope.PRIVATE as number,
      targetId: target,
      targetName: nickname,
      peerAlias: currentAlias,
    }),
    [target, nickname, currentAlias],
  );
  const effectiveName = conversationTitle(displaySession);
  const initial = conversationInitial(displaySession);

  const trimmedDraft = draft.trim();
  // 无 peerId（不该出现：面板只在单聊打开）时不给保存，避免打到 `/contacts//alias`
  const canSave =
    Boolean(target) && Boolean(trimmedDraft) && trimmedDraft !== currentAlias;

  const handleSave = useCallback(async () => {
    if (!target || !trimmedDraft || trimmedDraft === currentAlias) {
      return;
    }
    setSaving(true);
    try {
      const result = await setPeerAlias(target, trimmedDraft);
      // 以服务端回吐的值为准；响应缺字段时不把「保存成功」误判成「已取消备注」
      onChanged?.(target, result.alias ?? trimmedDraft);
      toast.success(intl.formatMessage({ id: 'chat.peer.alias.saved' }));
    } catch {
      // 失败原因（1013 账号不存在或不可用等）由请求层提示，这里只保持面板打开
    } finally {
      setSaving(false);
    }
  }, [target, trimmedDraft, currentAlias, onChanged, toast, intl]);

  const handleClear = useCallback(async () => {
    if (!target || !currentAlias) {
      return;
    }
    setClearing(true);
    try {
      const result = await clearPeerAlias(target);
      onChanged?.(target, result.alias);
      setDraft('');
      toast.success(intl.formatMessage({ id: 'chat.peer.alias.cleared' }));
    } catch {
      // 同上：错误提示由请求层给出
    } finally {
      setClearing(false);
    }
  }, [target, currentAlias, onChanged, toast, intl]);

  const busy = saving || clearing;

  return (
    <Modal
      open={open}
      title={intl.formatMessage({ id: 'chat.peer.title' })}
      width={440}
      onCancel={onClose}
      footer={
        <Button onClick={onClose}>
          {intl.formatMessage({ id: 'chat.peer.close' })}
        </Button>
      }
    >
      {target ? (
        <>
          <div className={styles.profile}>
            <UserAvatar size={56} userId={target} src={avatarUrl}>
              {initial}
            </UserAvatar>
            <div className={styles.profileMain}>
              {/* 当前生效的称呼：与列表 / 标题同源，不是「备注字段当前值」 */}
              <div className={styles.profileName}>{effectiveName}</div>
              <div className={styles.profileMeta}>
                {intl.formatMessage(
                  { id: 'chat.peer.nickname.label' },
                  { name: nickname },
                )}
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onPressEnter={() => {
                if (canSave && !busy) {
                  void handleSave();
                }
              }}
              maxLength={MAX_PEER_ALIAS}
              showCount
              allowClear
              disabled={busy}
              placeholder={intl.formatMessage({
                id: 'chat.peer.alias.placeholder',
              })}
              aria-label={intl.formatMessage({ id: 'chat.peer.alias.label' })}
            />
            {/*
              口径写在界面上而不是只写在注释里：用户对「备注会不会改到对方」的疑问
              只能靠界面回答，说不清就会有人不敢用、或以为改了对方昵称
            */}
            <Text className={styles.hint}>
              {intl.formatMessage({ id: 'chat.peer.alias.hint' })}
            </Text>
            <div className={styles.actions}>
              {/*
                取消备注只在确实有备注时出现：没有备注却摆一个按钮，
                点下去只是再发一次幂等请求，用户却要猜它做了什么
              */}
              {currentAlias ? (
                <Button
                  danger
                  loading={clearing}
                  disabled={saving}
                  onClick={() => void handleClear()}
                >
                  {intl.formatMessage({ id: 'chat.peer.alias.clear' })}
                </Button>
              ) : null}
              <Button
                type="primary"
                loading={saving}
                disabled={!canSave || clearing}
                onClick={() => void handleSave()}
              >
                {intl.formatMessage({ id: 'chat.peer.alias.save' })}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </Modal>
  );
};

export default ChatPeerPanel;
