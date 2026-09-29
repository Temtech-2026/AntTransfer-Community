/**
 * 会话（IM）数据访问。
 *
 * <p><b>静默策略</b>：会话列表、会话历史、「我加入的群」属「页面主数据」，
 * 失败由页面自己渲染错误态并给「重试」，因此不弹全局 toast（`silent`），
 * 避免一次网络抖动叠出两个提示；发送消息、建群、撤回是用户主动动作，失败必须给出明确反馈
 * （含 1012 非群成员 / 1013 目标无效 / 1031~1033 建群校验 / 1034 撤回超窗 / 1035 撤回目标不存在
 * / 1036 引用目标不可用），保留全局提示。
 */

import type { NotifyMessage } from '@/services/notify';
import { requestData } from '@/services/request';

import { CHAT_ENDPOINTS } from './endpoints';
import type {
  ChatGroup,
  ChatGroupDetail,
  ChatPeer,
  ChatPresenceVO,
  ChatSendPayload,
  ChatTarget,
  Conversation,
} from './types';

/**
 * 会话列表。
 *
 * @param limit 条数（不传取服务端 `notify.chat-conversation-limit`）
 */
export async function fetchConversations(
  limit?: number,
): Promise<Conversation[]> {
  const list = await requestData<Conversation[] | null>(
    CHAT_ENDPOINTS.conversations,
    {
      method: 'GET',
      params: limit ? { limit } : undefined,
      silent: true,
    },
  );
  return Array.isArray(list) ? list : [];
}

/**
 * 会话历史（倒序）。
 *
 * @param beforeId 游标：只取 id 小于它的消息（首页不传）
 * @param limit    条数（服务端按 `notify.chat-history-limit` 收敛）
 */
export function fetchChatHistory(params: {
  scope: number;
  /** 会话目标 ID（19 位雪花 ID，字符串）；禁止 `Number()` 归一，否则会取错人。 */
  targetId: string;
  /** 游标：只取 id 小于它的消息（同样为字符串 ID）。 */
  beforeId?: string;
  limit?: number;
}): Promise<NotifyMessage[]> {
  return requestData<NotifyMessage[]>(CHAT_ENDPOINTS.history, {
    method: 'GET',
    params: {
      scope: params.scope,
      targetId: params.targetId,
      ...(params.beforeId ? { beforeId: params.beforeId } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
    },
    silent: true,
  }).then((list) => (Array.isArray(list) ? list : []));
}

/**
 * 解析单聊目标：把登录账号（或 19 位用户 ID）翻译成可发起会话的对端。
 *
 * <p><b>为什么必须有这一步：</b>发送 / 历史 / 已读都以 `targetId`（19 位雪花 ID）为前提，
 * 而用户目录只对系统管理面开放——非管理员既搜不到人，也无从知道别人的 ID。
 * 只让用户「手填 ID」等于让他们填一个自己拿不到的标识。</p>
 *
 * <p>失败（1013 账号不存在或该账号不可用）保留全局提示：这是用户主动触发的动作
 * （失焦核对 / 点「发起」），必须给出明确反馈，不能静默吞掉。</p>
 *
 * @param query 对方登录账号，或用户 ID（服务端按「账号优先」解析）
 */
export function resolveChatTarget(query: string): Promise<ChatTarget> {
  return requestData<ChatTarget>(CHAT_ENDPOINTS.resolveTarget, {
    method: 'GET',
    params: { query },
  });
}

/**
 * 给单聊对端设置（或修改）备注。
 *
 * <p><b>备注是「我这边的称呼」，不是改昵称</b>：服务端只写 {@code (我, 他)} 那一行的私有属性，
 * 不碰 {@code sys_user}，对方与其他人的界面都不变。因此<b>不需要任何权限点</b>——
 * 归属者写死为登录态，调用方无法替别人设备注，也不存在「改到他人数据」的入参面。</p>
 *
 * <p><b>不静默</b>：这是用户主动提交的动作，失败必须说清原因——
 * 1013「账号不存在或不可用」（含给自己设备注），以及参数为空白。</p>
 *
 * <p>返回值就是操作后的状态（{@code alias} 为写入值），调用方据此更新本地覆盖表，
 * 界面立刻变，不必重拉会话列表。</p>
 *
 * @param peerId 对端用户 ID（19 位雪花 ID 字符串，禁止 `Number()` 归一）
 * @param alias  备注名（服务端会裁掉首尾空白并拒绝空白值；长度上限 32 字）
 */
export function setPeerAlias(
  peerId: string,
  alias: string,
): Promise<ChatPeer> {
  return requestData<ChatPeer>(CHAT_ENDPOINTS.peerAlias(peerId), {
    method: 'PUT',
    data: { alias },
  });
}

/**
 * 取消对端备注——回到「看到对方的真实昵称」。
 *
 * <p><b>幂等</b>：本来就没设备注时同样返回成功（期望终态已达成），重试与多端并发取消都不报错，
 * 因此调用方不必先查一次「现在有没有备注」。</p>
 *
 * <p>单独一个端点而不是「PUT 一个空串」：那会让「主动取消」与「手滑提交了空输入框」
 * 共用同一种入参，而这两件事的意图相反，服务端只能猜。</p>
 *
 * @param peerId 对端用户 ID（19 位雪花 ID 字符串，禁止 `Number()` 归一）
 */
export function clearPeerAlias(peerId: string): Promise<ChatPeer> {
  return requestData<ChatPeer>(CHAT_ENDPOINTS.peerAlias(peerId), {
    method: 'DELETE',
  });
}

/**
 * 发送消息。
 *
 * <p>返回的 `NotifyMessageVO` 是「发送人自己那一行」（已置读），
 * 因此发送成功后可以把它直接并入消息流而不必再拉一次历史；
 * 发送人的其他标签页也会收到同一帧（推送按用户广播到其全部连接）。</p>
 */
export function sendChatMessage(
  payload: ChatSendPayload,
): Promise<NotifyMessage> {
  return requestData<NotifyMessage>(CHAT_ENDPOINTS.send, {
    method: 'POST',
    data: payload,
  });
}

/** 会话已读（返回本次置读条数；0 表示本来就没有未读）。 */
export function markChatRead(scope: number, targetId: string): Promise<number> {
  return requestData<number>(CHAT_ENDPOINTS.read, {
    method: 'POST',
    params: { scope, targetId },
    silent: true,
  });
}

/**
 * 撤回一条自己发出的消息（2 分钟内）。
 *
 * <p><b>不静默</b>：撤回是用户主动动作，失败必须说清楚是哪一种——
 * 超窗（`1034`）与「消息不存在或不是你发的」（`1035`）的处理方式不同，
 * 且用户需要立刻知道「这条到底撤掉没有」，不能只让气泡悄悄不动。</p>
 *
 * <p>入参是 {@code clientMsgId} 而不是消息 id：写扩散下同一条消息在每个参与人那里
 * 是不同的行，只有幂等键跨行、跨端一致（乐观行更是只有幂等键）。
 * 服务端据此把该逻辑消息的全部落库行一起翻转。</p>
 *
 * @param clientMsgId 被撤回消息的幂等键
 */
export function recallChatMessage(clientMsgId: string): Promise<void> {
  return requestData<void>(CHAT_ENDPOINTS.recall, {
    method: 'POST',
    params: { clientMsgId },
  });
}

/**
 * 订阅对端在线状态，并同时取回当前三态（单聊）。
 *
 * <p><b>静默</b>：状态点属辅助信息，失败只表现为「没有点 / 停在上一次的值」，
 * 不能因为它在会话打开时弹一个 toast——用户此时的动作是聊天，不是订阅状态。
 * 下一次 30s 续订会自动重试。</p>
 *
 * @param scope    会话范围：仅 1-单聊（群聊服务端返回 2001）
 * @param targetId 对端用户 ID（19 位雪花 ID 字符串，禁止 `Number()` 归一）
 */
export function watchPeerPresence(
  scope: number,
  targetId: string,
): Promise<ChatPresenceVO> {
  return requestData<ChatPresenceVO>(CHAT_ENDPOINTS.presenceWatch, {
    method: 'POST',
    params: { scope, targetId },
    silent: true,
  });
}

/**
 * 上报「我在输入 / 我停止输入」（单聊）。
 *
 * <p><b>静默且不重试</b>：这是瞬时信号，丢了只表现为对端少看到一次提示，
 * 下一个续订帧会补上；调用方按键节流后约每 3s 一次。</p>
 */
export function sendTyping(
  scope: number,
  targetId: string,
  typing: boolean,
): Promise<void> {
  return requestData<void>(CHAT_ENDPOINTS.typing, {
    method: 'POST',
    params: { scope, targetId, typing },
    silent: true,
  });
}

/**
 * 我加入的群（聊天弹窗的群聊选择器 / 建群后回显）。
 *
 * <p><b>为什么普通用户也需要这个接口：</b>群聊会话以 `targetId = 群组 ID` 定位，
 * 而用户目录只对系统管理面开放——被拉进群的人既搜不到群，也无从知道群的 19 位雪花 ID。
 * 只让用户「手填群组 ID」等于让他们填一个自己拿不到的标识，
 * 而这正是此前群聊分支走不通的直接原因。</p>
 *
 * <p><b>静默</b>：与 {@link fetchConversations} 同属「页面主数据」，失败由弹窗渲染空列表 +
 * 重试，不叠全局 toast。`null` 归一为空数组：后端未取到群不是错误，
 * 前端据空数组隐藏「我加入的群」分区即可。</p>
 */
export async function fetchChatGroups(): Promise<ChatGroup[]> {
  const list = await requestData<ChatGroup[] | null>(CHAT_ENDPOINTS.groups, {
    method: 'GET',
    silent: true,
  });
  return Array.isArray(list) ? list : [];
}

/**
 * 创建群聊（建群 + 拉成员 + 我成为群主）。
 *
 * <p><b>保留全局提示</b>：这是用户主动点「创建」触发的动作，失败必须明确反馈——
 * 1031 无有效受邀成员、1032 超成员上限、1033 受邀成员不可用、1003 无建群权限，
 * 每一条都对应一个用户可自行修正的动作，静默会让用户反复点击同一个按钮。</p>
 *
 * <p><b>`memberIds` 不含自己</b>：服务端会把创建者自动作为群主入群，
 * 传或不传、传不传自己都不影响结果（服务端按 ID 去重并剔除创建者）。</p>
 *
 * <p>返回的 `id` 可直接作为群聊会话的 `targetId`，因此建群成功后可立即进入会话，
 * 不必再拉一次会话列表。</p>
 */
export function createChatGroup(payload: {
  /** 群名（服务端会裁掉首尾空白；空名被拒）。 */
  name: string;
  /** 受邀成员用户 ID（19 位雪花 ID 字符串；不含自己）。 */
  memberIds: string[];
}): Promise<ChatGroup> {
  return requestData<ChatGroup>(CHAT_ENDPOINTS.groups, {
    method: 'POST',
    data: payload,
  });
}

/**
 * 群详情（群配置面板的唯一数据源）。
 *
 * <p><b>静默</b>：与 {@link fetchChatGroups} 同属「面板主数据」，失败由面板渲染错误态 +
 * 重试按钮，不叠全局 toast。</p>
 *
 * <p>返回体里的 `ability` 决定按钮显隐（服务端在已知登录人的前提下算好）——
 * 前端登录态没有可信用户主键，拿不到自己的 ID，也就无法自行判断「我是不是群主」。</p>
 *
 * @param groupId 群 ID（19 位雪花 ID 字符串）
 */
export function fetchChatGroupDetail(groupId: string): Promise<ChatGroupDetail> {
  return requestData<ChatGroupDetail>(CHAT_ENDPOINTS.group(groupId), {
    method: 'GET',
    silent: true,
  });
}

/**
 * 修改群名（群主 / 管理员）。
 *
 * <p><b>不静默</b>：用户主动提交，失败必须说清是哪一种——1038 群内身份不足、
 * 1003 无群管理权限、1037 群已解散，三者的自救动作完全不同。</p>
 *
 * <p>返回最新群详情：面板据此直接刷新，省掉一次 `GET`，也避免「写完读到的还是旧值」。</p>
 */
export function renameChatGroup(
  groupId: string,
  name: string,
): Promise<ChatGroupDetail> {
  return requestData<ChatGroupDetail>(CHAT_ENDPOINTS.group(groupId), {
    method: 'PATCH',
    data: { name },
  });
}

/**
 * 邀请成员入群（群主 / 管理员）。
 *
 * <p><b>调用方不必先去重</b>：已在群里的 ID 由服务端幂等跳过（不是错误），
 * 被移除过又重新邀请的走「复活」路径，对外同样是成功。
 * 因此失败一定是真的失败：1032 超成员上限、1033 受邀者不可用、1038 身份不足。</p>
 */
export function inviteChatGroupMembers(
  groupId: string,
  memberIds: string[],
): Promise<ChatGroupDetail> {
  return requestData<ChatGroupDetail>(CHAT_ENDPOINTS.groupMembers(groupId), {
    method: 'POST',
    data: { memberIds },
  });
}

/**
 * 移除群成员（仅群主）。
 *
 * <p>不静默：1041 非群主 / 1040 目标不在群 / 1039 目标是群主本人，
 * 都要给出明确原因——尤其 1039（想移除群主）需要引导到「先解散」这条路上。</p>
 */
export function removeChatGroupMember(
  groupId: string,
  userId: string,
): Promise<ChatGroupDetail> {
  return requestData<ChatGroupDetail>(
    CHAT_ENDPOINTS.groupMember(groupId, userId),
    { method: 'DELETE' },
  );
}

/**
 * 退出群聊。
 *
 * <p><b>不静默</b>：退群是用户的明确决定，失败必须反馈——群主退群会被 1039 拒绝
 * （须先解散），静默会让按钮表现为「点了没反应」。</p>
 *
 * <p>成功后调用方须把该群会话从界面移除：服务端已清掉成员行，
 * 之后再打开该会话读历史会得到 1012。</p>
 */
export function quitChatGroup(groupId: string): Promise<void> {
  return requestData<void>(CHAT_ENDPOINTS.groupQuit(groupId), {
    method: 'POST',
  });
}

/**
 * 解散群聊（仅群主，不可逆）。
 *
 * <p><b>调用方必须先二次确认</b>：解散会清空全部成员关系，
 * 所有成员（含群主自己）此后读写该群均 1012，历史消息在服务端不再可读。</p>
 */
export function dissolveChatGroup(groupId: string): Promise<void> {
  return requestData<void>(CHAT_ENDPOINTS.group(groupId), {
    method: 'DELETE',
  });
}
