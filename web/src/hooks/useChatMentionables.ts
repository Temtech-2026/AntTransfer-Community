/**
 * 「本会话可以 {@code @} 谁」——把群成员名单折算成输入框需要的候选列表。
 *
 * <p><b>为什么必须由 Hook 出、而不是塞进 {@code ChatComposer}：</b>输入框是纯展示 + 输入逻辑，
 * 自己去拉数据会让它在单测里必须先备好网络；而「谁是本会话成员」是会话上下文，
 * 聊天页与即时通讯抽屉本就持有会话，两处各自拉一次又会写出两份缓存规则。
 * 收在一个 Hook 里，两个入口只需要把结果透传给输入框。</p>
 *
 * <p><b>三条口径：</b></p>
 * <ol>
 *   <li><b>只有群聊有候选</b>：单聊没有点名语义，返回空名单（空名单 = 输入框不显示 {@code @} 入口，
 *       见 {@code ChatComposer.mentionEnabled}）。</li>
 *   <li><b>缺展示名的成员不进名单</b>：提及的正文形态是 {@code @昵称}，客户端要把它写进正文
 *       才能让人读懂，服务端也只认 ID；一个没有展示名的成员（账号已删除 / 已禁用）<b>写不出</b>
 *       可读的 {@code @}，放进列表只会让用户选中后得到一个莫名其妙的 {@code @null}。</li>
 *   <li><b>不做「剔除自己」的本地判定</b>：登录态里没有可信的用户主键
 *       （口径见 {@code services/approval/types.ts}，模板的 {@code currentUser.userid} 不是后端 userId），
 *       拿它比对会假阴性地把真人剔掉。服务端对「@ 自己」是<b>静默剔除</b>的，代价只是自己那条不亮标记，
 *       比误剔他人小得多。</li>
 * </ol>
 *
 * <p><b>缓存按群 ID 常驻、不随会话切换失效</b>：反复在两个群之间来回切是最常见的操作，
 * 每次切都重拉一次成员列表，输入框的候选面板会先空一拍再填上。名单的时效性由服务端兜底——
 * 发送时 {@code ChatService} 会对 ID 做成员交集校验，过期项被静默丢弃（见后端
 * {@code resolveMentionTargets}），因此这里不需要为「刚有人退群」做实时对齐。</p>
 */

import { useEffect, useRef, useState } from 'react';

import type { MentionCandidate } from '@/components/ChatComposer/composer';
import { fetchChatGroupDetail } from '@/services/chat/api';
import type { ChatGroupMember, ChatSession } from '@/services/chat/types';
import { ChatScope } from '@/services/notify';

/** 空名单常量：保持引用稳定，避免「非群聊」时每次渲染都换一个新数组。 */
const EMPTY_MENTIONABLES: readonly MentionCandidate[] = [];

/**
 * 空结果常量：同上，非群聊 / 未选中会话时返回同一个对象引用。
 *
 * <p>`canMentionAll` 为 `false` 是这里的**唯一正确默认值**：拿不到群能力时
 * 不能假设自己能 @所有人——那会让非群主也看到一个点下去必然 1042 的入口。
 * 反过来说，能力是**服务端下发**的，前端只据此显隐，不做身份推断。</p>
 */
const EMPTY_RESULT: ChatMentionables = {
  mentionables: EMPTY_MENTIONABLES,
  canMentionAll: false,
};

/** 输入框 @ 功能所需的两份数据。 */
export interface ChatMentionables {
  /** 可 @ 的成员候选。 */
  mentionables: readonly MentionCandidate[];
  /**
   * 我能否 {@code @}所有人。
   *
   * <p>取值来自群详情里服务端下发的 {@code ability.canMentionAll}（只有群主为 true）；
   * 前端据此显隐入口，<b>真正的门槛在服务端</b>（越权会得 1042）。</p>
   */
  canMentionAll: boolean;
}

/**
 * 群成员 → 输入框候选。
 *
 * <p>导出为纯函数是为了可单测：过滤规则（缺名 / 去重 / 裁空白）不依赖 React 与网络。</p>
 */
export function toMentionCandidates(
  members: readonly ChatGroupMember[],
): MentionCandidate[] {
  const seen = new Set<string>();
  const result: MentionCandidate[] = [];
  for (const member of members) {
    const userId = member.userId?.trim();
    // 展示名去首尾空白：插入正文的是 `@昵称 `，名字自带尾空格会写出两个空格
    const displayName = member.displayName?.trim();
    if (!userId || !displayName || seen.has(userId)) {
      continue;
    }
    seen.add(userId);
    result.push({
      userId,
      displayName,
      avatarUrl: member.avatarUrl ?? null,
    });
  }
  return result;
}

/**
 * 取当前会话可提及的成员名单与 {@code @}所有人 能力。
 *
 * <p>两者合在一个 Hook 里返回，是因为它们<b>出自同一次群详情请求</b>
 * （成员名单与 {@code ability} 都在 `GET /chat/groups/{id}` 里）。
 * 拆成两个 Hook 就会对同一个群发两次完全相同的请求，还会带来
 * 「名单到了、能力还没到」这种半成品状态——输入框此时要么少一个入口、要么多一个必然失败的入口。</p>
 *
 * @param session 当前打开的会话；`null`（未选中）或单聊时返回空结果
 */
export default function useChatMentionables(
  session: ChatSession | null,
): ChatMentionables {
  const groupId =
    session?.chatScope === ChatScope.GROUP ? session.targetId : null;

  /** 已拉到的结果，按群 ID 常驻：切走再切回不重拉。 */
  const cacheRef = useRef(new Map<string, ChatMentionables>());
  /**
   * 与 {@link groupId} 绑定的状态。
   *
   * <p>不写成「一个裸对象」是因为切群时组件会先渲染一次：裸对象会把<b>上一个群</b>的名单
   * 画进新会话的候选面板（一闪而过的错名单），更糟的是会把上一个群的
   * {@code canMentionAll} 带到新会话——在有权限的群里点开又切到另一个群，
   * 面板上那个「@所有人」会短暂出现，用户一点就是 1042。
   * 绑上群 ID 后，派生值在群 ID 对不上时立刻回落到空结果，宁可晚一拍也不给错状态。</p>
   */
  const [entry, setEntry] = useState<{
    groupId: string;
    result: ChatMentionables;
  } | null>(null);

  useEffect(() => {
    if (!groupId) {
      return undefined;
    }
    const cached = cacheRef.current.get(groupId);
    if (cached) {
      setEntry({ groupId, result: cached });
      return undefined;
    }
    let cancelled = false;
    fetchChatGroupDetail(groupId)
      .then((detail) => {
        const result: ChatMentionables = {
          mentionables: toMentionCandidates(detail.members ?? []),
          canMentionAll: detail.ability?.canMentionAll === true,
        };
        cacheRef.current.set(groupId, result);
        if (!cancelled) {
          setEntry({ groupId, result });
        }
      })
      .catch(() => {
        // 拉不到成员（不在群 / 群已解散 / 网络）：不出 @ 入口即可，
        // 不必打扰用户——真正的发送并不依赖这份名单（服务端自己会校验）。
        // 这里连同 canMentionAll 一起回落为 false：能力不明时「不显示入口」是安全的那个方向
        if (!cancelled) {
          setEntry({ groupId, result: EMPTY_RESULT });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return entry && entry.groupId === groupId ? entry.result : EMPTY_RESULT;
}
