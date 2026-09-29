/**
 * 「在聊天里发一份文件」的共用草稿机：`/chat` 页与即时通讯抽屉同源。
 *
 * <p>两个入口在这件事上必须完全一致——同样的拖拽投放、同样的用途限制选择器、同样的
 * 授权建立时机与失败处理。其中几条规则错一次就会留下脏数据：幂等键不同源会多建一条
 * 授权，仅预览档位不显式传 0 会让接收方看到永远用不掉的额度。因此规则统一收在这里，
 * 两个入口只保留各自的「发出去之后怎么更新本地状态」。</p>
 *
 * <p>本 hook 只做到「组装出要发的消息」，不负责发送：抽屉是乐观追加一条，
 * `/chat` 页要把响应合并进会话列表并回正未读，落地方式本来就不同。</p>
 *
 * <p>发送失败时刻意<b>不</b>回收已建的授权：若消息其实已落库（只是响应超时），
 * 回收会让那张卡片永久失效；孤儿授权只有接收方本人可取件、且会按期自然失效，
 * 代价小得多。两个入口照此办理的方式相同——失败时保留待发送文件让用户重发。</p>
 */

import { useCallback, useState } from 'react';
import type { DragEvent } from 'react';

import { DEFAULT_CHAT_ATTACHMENT_POLICY } from '@/components/ChatAttachmentPolicy';
import { formatBytes } from '@/components/ChunkUpload';
import { buildFileCardContent } from '@/services/chat/fileCard';
import {
  newClientMsgId,
  type ChatSendPayload,
  type ChatSession,
} from '@/services/chat/types';
import {
  CHAT_ATTACHMENT_USAGE_MODE,
  createChatAttachment,
  type ChatAttachmentPolicy,
} from '@/services/file/chatAttachment';
import { ChatScope, MessageType } from '@/services/notify';
import {
  hasDragPayload,
  readDragPayload,
  type FileDragPayload,
} from '@/utils/dragFile';

/** 投放容器上要挂的拖拽事件。 */
export interface ChatAttachmentDropZoneProps {
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
}

export interface ChatAttachmentDraft {
  /** 待发送文件；`null` = 这次发的是纯文本 */
  attachment: FileDragPayload | null;
  /** 放置待发送文件；传 `null` 即移除 */
  setAttachment: (payload: FileDragPayload | null) => void;
  /** 用途限制，作为发送方偏好跨多条沿用 */
  policy: ChatAttachmentPolicy;
  setPolicy: (next: ChatAttachmentPolicy) => void;
  /** 拖拽悬停中：投放容器据此高亮 */
  dragOver: boolean;
  /** 挂到可投放的容器上（抽屉整体 / 聊天页外壳） */
  dropZoneProps: ChatAttachmentDropZoneProps;
  /**
   * 组装要发的消息（单聊会先建授权）。
   *
   * @param session          发往哪个会话
   * @param text             正文；带附件时是附言，可以为空
   * @param quoteClientMsgId 被引用消息的幂等键（选填，非空即「引用回复」）
   * @param mentionUserIds   {@code @} 提及对象的用户 ID 列表（选填，仅群聊生效）。
   *                         由输入框的回调给出（见 {@code ChatComposer}），
   *                         这里只做「非群聊一律不带」的收敛——单聊没有点名语义，
   *                         让一个永远无效的字段在载荷里流动，排查时只会误导
   * @param mentionAll       是否 {@code @}所有人（选填，仅群聊生效）。
   *                         与 {@code mentionUserIds} 是两个<b>正交</b>的字段：
   *                         前者是「点名了谁」，后者是「提醒全群」，
   *                         可以同时存在（既 @所有人 又单独点名某人），服务端也按两个字段分别落库
   */
  buildMessage: (
    session: ChatSession,
    text: string,
    quoteClientMsgId?: string | null,
    mentionUserIds?: readonly string[] | null,
    mentionAll?: boolean,
  ) => Promise<ChatSendPayload>;
}

/**
 * 维护待发送文件与用途限制，并把它们组装成一条可发送的消息。
 */
const useChatAttachmentDraft = (): ChatAttachmentDraft => {
  const [attachment, setAttachment] = useState<FileDragPayload | null>(null);
  // 用途限制保留为用户偏好：同一个人连续发几份文件时，通常想沿用同一档限制，
  // 每份都重设一遍会让人干脆不改——那默认值就成了事实上的唯一选项
  const [policy, setPolicy] = useState<ChatAttachmentPolicy>(
    DEFAULT_CHAT_ATTACHMENT_POLICY,
  );
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const payload = readDragPayload(event.dataTransfer);
    // 拖进来的可能不是文件条目（比如别处的普通文本）：解析不出就保持原样，不清空已有的待发文件
    if (payload) {
      setAttachment(payload);
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasDragPayload(event.dataTransfer)) {
      return;
    }
    // 必须阻止默认行为，否则浏览器不会派发 drop
    event.preventDefault();
    setDragOver(true);
  }, []);

  const buildMessage = useCallback(
    async (
      session: ChatSession,
      text: string,
      // 引用回复：被引用消息的幂等键（选填）。放在这一层而不是让调用方自己拼 payload，
      // 是为了让「引用」与「附件授权」共用同一个 clientMsgId——两者同源是既定口径
      // （见下方幂等键注释），分成两处拼接早晚会漂移
      quoteClientMsgId?: string | null,
      // @ 提及对象（选填，仅群聊）。它不影响 clientMsgId / 授权的任何口径，
      // 只是随正文一起过线的「点名名单」，故单独作为末位参数而不并入上面的对象
      mentionUserIds?: readonly string[] | null,
      // @所有人（选填，仅群聊）。与上面的名单并列成两个参数而不是合成一个对象，
      // 是为了让调用方在「没有名单、只想 @所有人」时不必凭空构造一个空对象
      mentionAll?: boolean,
    ): Promise<ChatSendPayload> => {
      // 幂等键同源：一条消息与它携带的授权必须共用同一个键。各生成一个随机键的话，
      // 重试时消息被去重了、授权却会多出一条，发送方列表里凭空多一份额度
      const clientMsgId = newClientMsgId();
      let attachmentId: string | undefined;
      if (attachment && session.chatScope === ChatScope.PRIVATE) {
        // 单聊：先建授权（用途档位 / 有效期 / 次数由服务端落库）再发消息。
        // 群聊本期不做免申请取件，维持「跳文件域走权限申请」的老路径，
        // 因此正文里只有 #file: 尾注
        const created = await createChatAttachment({
          nodeId: attachment.nodeId,
          receiverUserId: session.targetId,
          usageMode: policy.usageMode,
          expireHours: policy.neverExpire ? undefined : policy.expireHours,
          neverExpire: policy.neverExpire,
          // 仅预览档位不消耗下载次数，显式传 0：留一个用不到的额度上限只会让
          // 接收方在卡片上看到「剩余 5 次」却永远无法下载
          downloadLimit:
            policy.usageMode === CHAT_ATTACHMENT_USAGE_MODE.PREVIEW_ONLY
              ? 0
              : policy.downloadLimit,
          clientMsgKey: clientMsgId,
        });
        attachmentId = String(created.id);
      }

      return {
        scope: session.chatScope,
        targetId: session.targetId,
        messageType: attachment ? MessageType.FILE : MessageType.TEXT,
        content: attachment
          ? buildFileCardContent(
              attachment.fileName,
              formatBytes(attachment.sizeBytes),
              attachment.nodeId,
              attachmentId,
            )
          : text,
        clientMsgId,
        quoteClientMsgId: quoteClientMsgId ?? undefined,
        // 非群聊一律不带：服务端对单聊的提及是静默忽略的，前端也不该把无效字段发出去
        mentionUserIds:
          session.chatScope === ChatScope.GROUP && mentionUserIds?.length
            ? [...mentionUserIds]
            : undefined,
        // 只在真为 true 时才带上字段；不 @ 任何人时不发一个 `mentionAll: false`：
        // 「默认不打扰全群」这件事应该由「字段缺席」表达，而不是靠每个调用点都记得传 false
        mentionAll:
          session.chatScope === ChatScope.GROUP && mentionAll === true
            ? true
            : undefined,
      };
    },
    [attachment, policy],
  );

  return {
    attachment,
    setAttachment,
    policy,
    setPolicy,
    dragOver,
    // 与文本一并清除时由调用方调 setAttachment(null)；这里不做「发送后自动清空」，
    // 因为发送失败必须保留附件让用户能重发
    dropZoneProps: {
      onDrop: handleDrop,
      onDragOver: handleDragOver,
      onDragLeave: () => setDragOver(false),
    },
    buildMessage,
  };
};

export default useChatAttachmentDraft;
