/**
 * 群配置面板（「群设置」）——`/chat` 页与即时通讯抽屉共用同一个实现。
 *
 * <p><b>为什么是一个独立组件而不是各写一份：</b>两个入口打开的是同一个群，
 * 能改的东西、能看到的成员、失败后的提示都必须一致。放在页与抽屉里各写一遍，
 * 迟早出现「页面上能改名、抽屉里点了报无权限」这种同一事实两种呈现的局面——
 * 与消息流、会话列表的收口理由完全相同。</p>
 *
 * <p><b>按钮显隐 = 权限点 ∧ 服务端下发的 {@code ability}：</b>
 * 权限点回答「这个账号有没有群管理这项功能」（不足回 1003），
 * {@code ability} 回答「我在这个群里是什么身份」（不足回 1038 / 1041）。
 * 只有两者都成立才显示按钮；只看其一都会做出「按钮在、点了必失败」的界面。
 * 前端显隐只影响体验，<b>不构成安全边界</b>——强制校验在后端。</p>
 *
 * <p><b>危险操作走 {@link useDangerConfirm}：</b>移除 / 退群 / 解散都是不可逆或影响他人的动作，
 * 行内气泡容易被误触，因此统一用弹窗（见组件文件头的三条口径）。
 * 其中解散标 {@code critical}：它会清掉全部成员关系，历史消息此后在服务端不再可读。</p>
 *
 * <p><b>写接口回的是最新群详情：</b>改群名 / 邀请 / 移除成功后直接用响应刷新面板，
 * 不再补一次 {@code GET}——既省一次往返，也避免「写完读到的还是旧值」。</p>
 *
 * <p><b>为什么成员行不显示「我」：</b>前端登录态没有可信的用户主键，拿不到自己的 ID，
 * 因此无法把「我」从名单里摘出来。这里靠另一条事实规避：需要移除按钮的人必定是群主
 * （{@code canRemoveMember} 仅群主为真），而群主那一行已按 {@code member.owner} 去掉按钮——
 * 于是「群主把自己移除」这条必然被服务端 1039 拒绝的路径根本不会出现在界面上。</p>
 */

import {
  DeleteOutlined,
  ReloadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAccess, useIntl } from '@umijs/max';
import {
  App,
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';

import useDangerConfirm from '@/components/DangerConfirm';
import UserAvatar from '@/components/UserAvatar';
import {
  dissolveChatGroup,
  fetchChatGroupDetail,
  inviteChatGroupMembers,
  quitChatGroup,
  removeChatGroupMember,
  renameChatGroup,
  resolveChatTarget,
  updateGroupNotifyPreference,
} from '@/services/chat/api';
import { CHAT_PERM } from '@/services/chat/perm';
import {
  CHAT_GROUP_ROLE,
  isFlagOn,
  NOTIFY_FLAG,
  toFlag,
  type ChatGroupDetail,
  type ChatGroupMember,
  type ChatGroupNotifyPreference,
  type ChatTarget,
} from '@/services/chat/types';
import {
  pageUsers,
  SYSTEM_PERM,
  UserStatus,
  type UserVO,
} from '@/services/system';

const { Text } = Typography;

/** 群名长度上限（`sys_group.name` 列宽 64，与后端 `ChatGroupUpdateDTO` 同源）。 */
const MAX_GROUP_NAME = 64;

/** 邀请选人的检索条数（够挑人即可，上限校验在服务端）。 */
const USER_SEARCH_PAGE_SIZE = 20;

/**
 * 没有偏好行时的界面初值（新建群 / 刚被拉进群，服务端还没为「我」落过偏好）。
 *
 * <p>与 {@code shouldRemindMessage} 的「偏好缺失按提醒处理」是同一口径：
 * 界面显示「免打扰关 + 两类提及都提醒」，与实际的出声行为完全一致。
 * 若这里显示成「全部关闭」，用户会以为提示音被关掉了，然后去拨一个本来就没开的开关。</p>
 */
const DEFAULT_NOTIFY_PREFERENCE: Required<ChatGroupNotifyPreference> = {
  muteStatus: NOTIFY_FLAG.OFF,
  notifyOnMention: NOTIFY_FLAG.ON,
  notifyOnMentionAll: NOTIFY_FLAG.ON,
};

const useStyles = createStyles(({ token, css }) => ({
  body: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  sectionTitle: css`
    margin-bottom: 8px;
    color: ${token.colorText};
    font-size: ${token.fontSize}px;
    font-weight: 600;
  `,
  hint: css`
    display: block;
    margin-top: 6px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  /** 成员名单自带滚动：上限 500 人，让弹窗高度固定而不是把人名铺成一条长卷。 */
  members: css`
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid ${token.colorSplit};
    border-radius: ${token.borderRadiusLG}px;
    padding: 4px 10px;
  `,
  member: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;

    & + & {
      border-top: 1px solid ${token.colorSplit};
    }
  `,
  memberMain: css`
    flex: 1;
    min-width: 0;
  `,
  memberName: css`
    display: flex;
    align-items: center;
    gap: 6px;
    color: ${token.colorText};
  `,
  memberMeta: css`
    color: ${token.colorTextQuaternary};
    font-size: ${token.fontSizeSM}px;
  `,
  dangerZone: css`
    padding-top: 12px;
    border-top: 1px solid ${token.colorSplit};
  `,
  dangerHint: css`
    color: ${token.colorError};
    font-size: ${token.fontSizeSM}px;
  `,
}));

/** 入群时间：只到分钟；解析失败时原样回显（不编造时间）。 */
function formatJoinTime(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw) {
    return '';
  }
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : raw;
}

/**
 * 服务端偏好 → 界面三分量（缺失 / {@code null} 一律取 {@link DEFAULT_NOTIFY_PREFERENCE}）。
 *
 * <p>逐字段兜底而不是整体覆盖：后端可能只回其中一两个字段（历史行 / 后续新增字段），
 * 整体覆盖会让「没下发的那一个」变成 `undefined`，`Switch` 的 `checked` 就成了假值——
 * 即悄悄把「提醒」显示成「不提醒」。</p>
 */
function toNotifyPreference(
  preference: ChatGroupNotifyPreference | null | undefined,
): Required<ChatGroupNotifyPreference> {
  return {
    muteStatus: preference?.muteStatus ?? DEFAULT_NOTIFY_PREFERENCE.muteStatus,
    notifyOnMention:
      preference?.notifyOnMention ?? DEFAULT_NOTIFY_PREFERENCE.notifyOnMention,
    notifyOnMentionAll:
      preference?.notifyOnMentionAll ?? DEFAULT_NOTIFY_PREFERENCE.notifyOnMentionAll,
  };
}

/** 群配置面板入参。 */
export interface ChatGroupPanelProps {
  /** 面板是否展开。 */
  open: boolean;
  /** 目标群 ID（19 位雪花 ID 字符串）；为空时面板不发任何请求。 */
  groupId: string | null | undefined;
  /** 关闭面板。 */
  onClose: () => void;
  /** 群资料发生变化（改名 / 邀请 / 移除）后回调，调用方据此同步标题与会话列表。 */
  onUpdated?: (detail: ChatGroupDetail) => void;
  /** 我已不在该群（退出 / 解散）后回调，调用方须关闭该会话并刷新列表。 */
  onLeft?: (groupId: string) => void;
}

/**
 * 群配置面板：群资料（群名）+ 成员名单 + 邀请 + 危险操作。
 */
const ChatGroupPanel: React.FC<ChatGroupPanelProps> = ({
  open,
  groupId,
  onClose,
  onUpdated,
  onLeft,
}) => {
  const intl = useIntl();
  const access = useAccess();
  const { message: toast } = App.useApp();
  const { confirm } = useDangerConfirm();
  const { styles } = useStyles();

  const [detail, setDetail] = useState<ChatGroupDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  /** 我的消息提醒偏好（三个开关）。与 detail 分开存：它是「我」的属性，可以独立于群资料被改。 */
  const [pref, setPref] = useState<Required<ChatGroupNotifyPreference>>(
    DEFAULT_NOTIFY_PREFERENCE,
  );
  const [savingPref, setSavingPref] = useState(false);

  // —— 邀请 ——
  const [selected, setSelected] = useState<ChatTarget[]>([]);
  const [users, setUsers] = useState<UserVO[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [accountQuery, setAccountQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [inviting, setInviting] = useState(false);

  /** 用户检索是管理员能力（`system:user:list`）；普通账号改走「账号 → 目标」解析。 */
  const canPickUser = access.can(SYSTEM_PERM.USER_LIST);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setFailed(false);
    try {
      const next = await fetchChatGroupDetail(id);
      setDetail(next);
      setNameDraft(next.name);
      // 偏好随群详情一起下发，不额外发一次请求：少一次往返，也不可能出现
      // 「群资料是新的、开关是旧的」这种两个请求交错出来的拼装状态
      setPref(toNotifyPreference(next.notifyPreference));
    } catch {
      // 失败原因（1012 已不在群 / 1037 群不存在）由请求层给出，这里只切错误态
      setDetail(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // 每次展开（或换群）都重新拉：群可能在这期间被别人改过名、加过人
  useEffect(() => {
    if (!open || !groupId) {
      return;
    }
    setSelected([]);
    setAccountQuery('');
    setUsers([]);
    setDetail(null);
    setFailed(false);
    // 先回默认值再拉：否则换群时会短暂沿用上一个群的开关状态，
    // 用户在这一瞬间拨动就会把 A 群的偏好写到 B 群上
    setPref(DEFAULT_NOTIFY_PREFERENCE);
    void load(groupId);
  }, [open, groupId, load]);

  /** 写接口返回最新详情后统一落库并通知调用方（省掉一次回读，也避免读到旧值）。 */
  const applyDetail = useCallback(
    (next: ChatGroupDetail) => {
      setDetail(next);
      setNameDraft(next.name);
      onUpdated?.(next);
    },
    [onUpdated],
  );

  /**
   * 提交我的消息提醒偏好（三个开关<b>整体覆盖</b>）。
   *
   * <p>与后端口径一致地整体提交：三个开关在界面上是同时存在的一份状态，
   * 逐字段提交会让「拨 A 开关的请求在路上、B 开关的旧值又写回去」这类交错
   * 产生界面与库不一致；整体覆盖天然幂等，重试与多端并发都以最后一次为准。</p>
   *
   * <p><b>乐观更新 + 失败回退</b>：拨开关是高频轻量动作，等一个 RTT 才动会明显「粘手」；
   * 失败时回退到失败前的值而不是回读服务端，是因为这里是「三个字段一起写」，
   * 回退到已知的旧值即可收敛，回读反而多一次往返且结果相同。</p>
   */
  const submitPref = async (next: Required<ChatGroupNotifyPreference>) => {
    if (!detail || savingPref) {
      return;
    }
    const previous = pref;
    setPref(next);
    setSavingPref(true);
    try {
      const saved = await updateGroupNotifyPreference(detail.id, next);
      setPref(toNotifyPreference(saved));
      // 把新偏好一并交给调用方（会话列表与提示音索引都读它），
      // 其余群资料原样带过去——这里只改了偏好，不该顺手「刷新」群名与人数
      onUpdated?.({ ...detail, notifyPreference: saved });
    } catch {
      // 1012 已不在群 / 网络失败：开关不能「拨了又弹回去」却不留任何解释，
      // 请求层已弹过具体原因，这里负责把界面拉回失败前的事实
      setPref(previous);
    } finally {
      setSavingPref(false);
    }
  };

  /** 已在群成员 ID：邀请时用于排除，避免把注定被跳过的 ID 发出去。 */
  const memberIds = useMemo(
    () => new Set((detail?.members ?? []).map((member) => member.userId)),
    [detail],
  );

  const canRename = access.can(CHAT_PERM.GROUP_UPDATE) && Boolean(detail?.ability.canRename);
  const canInvite = access.can(CHAT_PERM.GROUP_INVITE) && Boolean(detail?.ability.canInvite);
  const canRemove =
    access.can(CHAT_PERM.GROUP_REMOVE) && Boolean(detail?.ability.canRemoveMember);
  const canDissolve =
    access.can(CHAT_PERM.GROUP_DISSOLVE) && Boolean(detail?.ability.canDissolve);
  // 退群不挂权限点（作用对象恒为登录人自己），身份维度说了算
  const canQuit = Boolean(detail?.ability.canQuit);

  const memberLimit = detail?.memberLimit ?? 0;
  const memberCount = detail?.memberCount ?? 0;
  /** 还能再进多少人；邀请按钮据此提前拦一道（权威判定仍是服务端的 1032）。 */
  const remaining = Math.max(memberLimit - memberCount, 0);
  const overLimit = selected.length > remaining;

  const memberName = (member: ChatGroupMember): string =>
    member.displayName?.trim() ||
    intl.formatMessage({ id: 'chat.group.member.unknown' });

  /**
   * 邀请选人的选项（管理员路径）。
   *
   * <p>选项 = 本次检索结果 ∪ 已选成员，且剔除已在群里的人：检索词一换，
   * 上一批结果就被覆盖，此时先选中的人会失去名字只能显示裸 ID，故用「已选」兜底。</p>
   */
  const memberOptions = useMemo(() => {
    const byId = new Map<string, { name: string; username?: string }>();
    users.forEach((user) => {
      byId.set(user.id, {
        name: user.nickname || user.username,
        username: user.username,
      });
    });
    selected.forEach((member) => {
      if (!byId.has(member.targetId)) {
        byId.set(member.targetId, { name: member.displayName });
      }
    });
    return [...byId]
      .filter(([value]) => !memberIds.has(value))
      .map(([value, meta]) => ({
        value,
        label: meta.username
          ? intl.formatMessage(
              { id: 'chat.new.user.optionLabel' },
              { name: meta.name, username: meta.username },
            )
          : meta.name,
        displayName: meta.name,
      }));
  }, [intl, memberIds, selected, users]);

  const searchUsers = async (keyword: string) => {
    if (!canPickUser) {
      return;
    }
    setUsersLoading(true);
    try {
      const page = await pageUsers({
        keyword: keyword.trim() || undefined,
        status: UserStatus.NORMAL,
        current: 1,
        pageSize: USER_SEARCH_PAGE_SIZE,
      });
      setUsers(page.records ?? []);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  /** 解析一位成员并加入待邀请列表（非管理员路径：登录账号 → 会话目标）。 */
  const resolveMember = async () => {
    const query = accountQuery.trim();
    if (!query || resolving) {
      return;
    }
    setResolving(true);
    try {
      const target = await resolveChatTarget(query);
      if (memberIds.has(target.targetId)) {
        toast.warning(
          intl.formatMessage(
            { id: 'chat.group.invite.alreadyMember' },
            { name: target.displayName },
          ),
        );
        return;
      }
      setSelected((prev) =>
        prev.some((item) => item.targetId === target.targetId)
          ? prev
          : [...prev, target],
      );
      setAccountQuery('');
    } catch {
      // 1013 账号不存在：请求层已提示，保留输入便于改账号重试
    } finally {
      setResolving(false);
    }
  };

  const submitRename = async () => {
    const name = nameDraft.trim();
    if (!detail || savingName) {
      return;
    }
    if (!name) {
      toast.warning(intl.formatMessage({ id: 'chat.group.name.required' }));
      return;
    }
    if (name === detail.name) {
      // 同名不必写库：省一次无意义的往返，也让「保存」按钮的禁用状态与结果一致
      return;
    }
    setSavingName(true);
    try {
      applyDetail(await renameChatGroup(detail.id, name));
      toast.success(intl.formatMessage({ id: 'chat.group.name.success' }));
    } catch {
      // 1038 身份不足 / 1003 无权限：请求层已提示，面板保持原值
    } finally {
      setSavingName(false);
    }
  };

  const submitInvite = async () => {
    if (!detail || inviting || selected.length === 0) {
      return;
    }
    setInviting(true);
    try {
      const next = await inviteChatGroupMembers(
        detail.id,
        selected.map((member) => member.targetId),
      );
      const added = next.memberCount - detail.memberCount;
      setSelected([]);
      applyDetail(next);
      // 服务端对「已在群里的人」幂等跳过（不算失败），因此新增为 0 时如实说明
      toast.success(
        added > 0
          ? intl.formatMessage({ id: 'chat.group.invite.success' }, { count: added })
          : intl.formatMessage({ id: 'chat.group.invite.none' }),
      );
    } catch {
      // 1032 超成员上限 / 1033 受邀者不可用 / 1038 身份不足：请求层已提示
    } finally {
      setInviting(false);
    }
  };

  const confirmRemove = (member: ChatGroupMember) => {
    if (!detail) {
      return;
    }
    const name = memberName(member);
    confirm({
      title: intl.formatMessage(
        { id: 'chat.group.member.removeConfirmTitle' },
        { name },
      ),
      content: intl.formatMessage({ id: 'chat.group.member.removeConfirmDesc' }),
      successMessage: intl.formatMessage(
        { id: 'chat.group.member.removed' },
        { name },
      ),
      onOk: async () => {
        applyDetail(await removeChatGroupMember(detail.id, member.userId));
      },
    });
  };

  const confirmQuit = () => {
    if (!detail) {
      return;
    }
    const id = detail.id;
    confirm({
      title: intl.formatMessage({ id: 'chat.group.quitConfirmTitle' }),
      content: intl.formatMessage({ id: 'chat.group.quitConfirmDesc' }),
      successMessage: intl.formatMessage({ id: 'chat.group.quit.success' }),
      onOk: async () => {
        await quitChatGroup(id);
        // 服务端已清掉我的成员行：会话必须一起关掉，之后读历史会得到 1012
        onLeft?.(id);
        onClose();
      },
    });
  };

  const confirmDissolve = () => {
    if (!detail) {
      return;
    }
    const id = detail.id;
    confirm({
      level: 'critical',
      title: intl.formatMessage({ id: 'chat.group.dissolveConfirmTitle' }),
      content: intl.formatMessage({ id: 'chat.group.dissolveConfirmDesc' }),
      successMessage: intl.formatMessage({ id: 'chat.group.dissolve.success' }),
      onOk: async () => {
        await dissolveChatGroup(id);
        onLeft?.(id);
        onClose();
      },
    });
  };

  const renderMembers = () => {
    const members = detail?.members ?? [];
    if (members.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={intl.formatMessage({ id: 'chat.group.emptyMembers' })}
        />
      );
    }
    return (
      <div className={styles.members}>
        {members.map((member) => {
          const name = memberName(member);
          const joinedAt = formatJoinTime(member.joinTime);
          return (
            <div key={member.userId} className={styles.member}>
              {/* 成员头像走 `UserAvatar`（覆盖表优先）：群里有人换头像时，
                  资料变更帧到达即换图，不必重拉群详情 */}
              <UserAvatar size={32} userId={member.userId} src={member.avatarUrl}>
                {name.slice(0, 1).toUpperCase()}
              </UserAvatar>
              <div className={styles.memberMain}>
                <div className={styles.memberName}>
                  <span>{name}</span>
                  {member.owner ? (
                    <Tag color="gold">
                      {intl.formatMessage({ id: 'chat.group.member.owner' })}
                    </Tag>
                  ) : member.memberRole === CHAT_GROUP_ROLE.ADMIN ? (
                    <Tag color="blue">
                      {intl.formatMessage({ id: 'chat.group.member.admin' })}
                    </Tag>
                  ) : member.memberRole === CHAT_GROUP_ROLE.READONLY ? (
                    <Tag>
                      {intl.formatMessage({ id: 'chat.group.member.readonly' })}
                    </Tag>
                  ) : null}
                </div>
                {joinedAt ? (
                  <span className={styles.memberMeta}>
                    {intl.formatMessage(
                      { id: 'chat.group.member.joinedAt' },
                      { time: joinedAt },
                    )}
                  </span>
                ) : null}
              </div>
              {/* 群主那一行不放移除：群主不可被移除（服务端 1039），
                  「我」若是群主正好就是这一行，于是也不会看到「移除自己」 */}
              {canRemove && !member.owner ? (
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={() => confirmRemove(member)}
                >
                  {intl.formatMessage({ id: 'chat.group.member.remove' })}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const renderInvite = () => {
    if (!detail || !canInvite) {
      return null;
    }
    const full = remaining === 0;
    return (
      <div>
        <div className={styles.sectionTitle}>
          {intl.formatMessage({ id: 'chat.group.invite.label' })}
        </div>
        {canPickUser ? (
          <Select
            mode="multiple"
            showSearch
            style={{ width: '100%' }}
            value={selected.map((member) => member.targetId)}
            disabled={inviting || full}
            loading={usersLoading}
            placeholder={intl.formatMessage({ id: 'chat.new.user.placeholder' })}
            filterOption={false}
            onSearch={(value) => void searchUsers(value)}
            onChange={(ids: string[]) => {
              const names = new Map(
                memberOptions.map((option) => [option.value, option.displayName]),
              );
              setSelected(
                ids.map((id) => ({
                  targetId: id,
                  // 名字依次回退：本次选项 → 裸 ID（宁可难看也别显示空）
                  displayName: names.get(id) ?? id,
                })),
              );
            }}
            notFoundContent={
              usersLoading ? (
                <Spin size="small" />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={intl.formatMessage({ id: 'chat.group.invite.noCandidate' })}
                />
              )
            }
            options={memberOptions}
          />
        ) : (
          <>
            <Input
              value={accountQuery}
              disabled={inviting || resolving || full}
              placeholder={intl.formatMessage({
                id: 'chat.group.invite.placeholder',
              })}
              onChange={(event) => setAccountQuery(event.target.value)}
              onPressEnter={() => void resolveMember()}
              onBlur={() => void resolveMember()}
            />
            {selected.length > 0 ? (
              <Space size={[6, 6]} wrap style={{ marginTop: 8 }}>
                {selected.map((member) => (
                  <Tag
                    key={member.targetId}
                    closable={!inviting}
                    onClose={() =>
                      setSelected((prev) =>
                        prev.filter((item) => item.targetId !== member.targetId),
                      )
                    }
                  >
                    {member.displayName}
                  </Tag>
                ))}
              </Space>
            ) : null}
          </>
        )}
        <Text className={styles.hint}>
          {full
            ? intl.formatMessage(
                { id: 'chat.group.invite.full' },
                { max: memberLimit },
              )
            : intl.formatMessage(
                { id: 'chat.group.invite.hint' },
                { count: remaining, max: memberLimit },
              )}
        </Text>
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          style={{ marginTop: 8 }}
          loading={inviting}
          disabled={selected.length === 0 || overLimit || full}
          onClick={() => void submitInvite()}
        >
          {intl.formatMessage({ id: 'chat.group.invite.button' })}
        </Button>
        {overLimit ? (
          <Text className={styles.dangerHint} style={{ display: 'block', marginTop: 6 }}>
            {intl.formatMessage(
              { id: 'chat.group.invite.limit' },
              { max: memberLimit, count: remaining },
            )}
          </Text>
        ) : null}
      </div>
    );
  };

  /**
   * 我的消息提醒设置（免打扰 + 两类提及）。
   *
   * <p>两类提及开关在免打扰关闭时<b>置灰而不是隐藏</b>：它们此时确实不生效
   * （所有消息都会提醒），但偏好本身要能被预先设置好；隐藏会让用户以为
   * 「这个群根本没有 @ 提醒这个设置」，置灰 + 一句说明才说得清「开了免打扰才轮到它们说话」。
   * 置灰同时避免了「关了 @我提醒却看不出任何变化」这种无反馈的写入。</p>
   */
  const renderNotifySection = () => {
    const muted = isFlagOn(pref.muteStatus);
    return (
      <div>
        <div className={styles.sectionTitle}>
          {intl.formatMessage({ id: 'chat.group.notify.title' })}
        </div>
        <Space direction="vertical" size={6} style={{ display: 'flex' }}>
          <Space size={8}>
            <Switch
              size="small"
              checked={muted}
              loading={savingPref}
              onChange={(checked) =>
                void submitPref({ ...pref, muteStatus: toFlag(checked) })
              }
            />
            <Text>{intl.formatMessage({ id: 'chat.group.notify.mute' })}</Text>
          </Space>
          <Space size={8}>
            <Switch
              size="small"
              checked={isFlagOn(pref.notifyOnMention)}
              disabled={!muted || savingPref}
              onChange={(checked) =>
                void submitPref({ ...pref, notifyOnMention: toFlag(checked) })
              }
            />
            <Text type={muted ? undefined : 'secondary'}>
              {intl.formatMessage({ id: 'chat.group.notify.mention' })}
            </Text>
          </Space>
          <Space size={8}>
            <Switch
              size="small"
              checked={isFlagOn(pref.notifyOnMentionAll)}
              disabled={!muted || savingPref}
              onChange={(checked) =>
                void submitPref({ ...pref, notifyOnMentionAll: toFlag(checked) })
              }
            />
            <Text type={muted ? undefined : 'secondary'}>
              {intl.formatMessage({ id: 'chat.group.notify.mentionAll' })}
            </Text>
          </Space>
          <Text className={styles.hint}>
            {intl.formatMessage({
              id: muted ? 'chat.group.notify.muteHint' : 'chat.group.notify.mentionHint',
            })}
          </Text>
        </Space>
      </div>
    );
  };

  const renderDangerZone = () => {
    if (!detail || (!canQuit && !canDissolve)) {
      return null;
    }
    return (
      <div className={styles.dangerZone}>
        <div className={styles.sectionTitle}>
          {intl.formatMessage({ id: 'chat.group.dangerZone' })}
        </div>
        <Space wrap>
          {canQuit ? (
            <Button danger icon={<DeleteOutlined />} onClick={confirmQuit}>
              {intl.formatMessage({ id: 'chat.group.quit' })}
            </Button>
          ) : null}
          {canDissolve ? (
            <Button
              danger
              type="primary"
              icon={<DeleteOutlined />}
              onClick={confirmDissolve}
            >
              {intl.formatMessage({ id: 'chat.group.dissolve' })}
            </Button>
          ) : null}
        </Space>
      </div>
    );
  };

  const renderBody = () => {
    // 首帧也在这一支：open 刚翻成 true 时 effect 尚未执行，detail 为 null 而 failed 为 false。
    // 若只判 loading，「没有详情」会先落进下面的失败分支——面板一打开先闪一下
    // 「加载失败 + 重试」再被替换成转圈，用户看到的是「群设置坏了」。
    // 因此「无详情且未失败」一律按加载中渲染：失败态必须由 failed 显式点亮。
    if (loading || (!detail && !failed)) {
      return (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <Spin />
        </div>
      );
    }
    if (failed || !detail) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={intl.formatMessage({ id: 'chat.group.loadFailed' })}
        >
          <Button
            icon={<ReloadOutlined />}
            onClick={() => (groupId ? void load(groupId) : undefined)}
          >
            {intl.formatMessage({ id: 'common.empty.error.action' })}
          </Button>
        </Empty>
      );
    }
    return (
      <div className={styles.body}>
        <div>
          <div className={styles.sectionTitle}>
            {intl.formatMessage({ id: 'chat.group.info' })}
          </div>
          {canRename ? (
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={nameDraft}
                maxLength={MAX_GROUP_NAME}
                showCount
                disabled={savingName}
                placeholder={intl.formatMessage({
                  id: 'chat.group.name.placeholder',
                })}
                onChange={(event) => setNameDraft(event.target.value)}
                onPressEnter={() => void submitRename()}
              />
              <Button
                type="primary"
                loading={savingName}
                disabled={nameDraft.trim() === detail.name}
                onClick={() => void submitRename()}
              >
                {intl.formatMessage({ id: 'chat.group.name.save' })}
              </Button>
            </Space.Compact>
          ) : (
            <Text>{detail.name}</Text>
          )}
          <Text className={styles.hint}>
            {intl.formatMessage(
              { id: 'chat.group.meta' },
              { count: detail.memberCount, max: detail.memberLimit },
            )}
          </Text>
        </div>

        {renderNotifySection()}

        <div>
          <div className={styles.sectionTitle}>
            {intl.formatMessage({ id: 'chat.group.members.label' })}
          </div>
          {renderMembers()}
        </div>

        {renderInvite()}
        {renderDangerZone()}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      title={intl.formatMessage({ id: 'chat.group.title' })}
      width={560}
      onCancel={onClose}
      footer={
        <Button onClick={onClose}>
          {intl.formatMessage({ id: 'chat.group.close' })}
        </Button>
      }
    >
      {renderBody()}
    </Modal>
  );
};

export default ChatGroupPanel;
