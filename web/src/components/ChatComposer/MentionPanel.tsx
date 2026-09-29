/**
 * {@code @} 提及的候选面板：从输入框下方展开，列出可点名的群成员。
 *
 * <p><b>为什么单独成文件而不是内联进 {@code ChatComposer}：</b>输入框组件已经同时承担
 * 「正文输入 + 表情面板 + 工具栏插槽」三件事，再把候选列表的渲染塞进去，它的每一次改动
 * 都需要重新确认另外两件事。面板本身是纯粹的「给数据、给回调、渲染」，没有状态，
 * 独立开后调用方（输入框）只需维护「谁是当前高亮项」。</p>
 *
 * <p><b>为什么不给面板键盘事件：</b>焦点始终留在 textarea 上（用户是在打字的过程中选人），
 * 面板抢焦点会让正在输入的拼音丢失。因此上下键与回车的处理留在输入框的
 * {@code onKeyDown} 里，面板只负责 {@code onMouseDown} 阻止默认行为以免焦点跑掉，
 * 与表情面板同一口径。</p>
 */

import { Avatar } from 'antd';
import { createStyles } from 'antd-style';

import { isMentionAllId, type MentionCandidate } from './composer';

const useStyles = createStyles(({ token }) => ({
  /** 面板外框：与表情面板同一形态（贴输入框下沿、带阴影），用户不必学两套视觉。 */
  panel: {
    marginTop: 8,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgElevated,
    boxShadow: token.boxShadowTertiary,
  },

  /**
   * 列表：高度随视口收敛，理由与表情网格相同——聊天页的外壳是固定高度，
   * 面板写死高度会把消息流挤没。
   */
  list: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'min(240px, 32vh)',
    padding: 4,
    overflowY: 'auto',
  },

  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    border: 'none',
    borderRadius: token.borderRadiusSM,
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': {
      background: token.colorFillTertiary,
    },
  },

  /** 当前高亮项：鼠标悬停与键盘上下键共用同一套「选中」表现。 */
  itemActive: {
    background: token.colorFillSecondary,
  },

  name: {
    overflow: 'hidden',
    color: token.colorText,
    fontSize: token.fontSize,
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },

  /**
   * 「@所有人」的头像：用主色底 + 「@」字符，与成员的真实头像在一列里立刻区分开。
   *
   * <p>不取名字首字（会显示成「所」，像某个成员）、也不用图标（`@ant-design/icons` 里没有 `At`，
   * 找一个「大概像」的图标反而要靠猜）：`@` 就是提及本身的语义符号。</p>
   */
  mentionAllAvatar: {
    background: token.colorPrimary,
    fontSize: 14,
    fontWeight: 600,
  },

  /** 无匹配成员时的占位：面板不消失，否则用户会以为「@ 功能坏了」。 */
  empty: {
    padding: '10px 12px',
    color: token.colorTextTertiary,
    fontSize: token.fontSizeSM,
  },
}));

export interface MentionPanelProps {
  /** 已按查询词过滤后的候选（调用方负责过滤与截断）。 */
  candidates: readonly MentionCandidate[];
  /** 当前高亮项下标；出界时按 0 处理。 */
  activeIndex: number;
  /** 面板的无障碍名（已翻译）。 */
  panelLabel: string;
  /** 无匹配成员时的提示文案（已翻译）。 */
  emptyLabel: string;
  /** 鼠标掠过某一项：把高亮切过去，让键鼠两套操作共享同一个「当前项」。 */
  onHover: (index: number) => void;
  /** 点击选中某个成员。 */
  onPick: (member: MentionCandidate) => void;
}

const MentionPanel = ({
  candidates,
  activeIndex,
  panelLabel,
  emptyLabel,
  onHover,
  onPick,
}: MentionPanelProps) => {
  const { styles } = useStyles();
  const active = activeIndex >= 0 && activeIndex < candidates.length ? activeIndex : 0;

  return (
    <div className={styles.panel}>
      {candidates.length === 0 ? (
        <div className={styles.empty}>{emptyLabel}</div>
      ) : (
        <div className={styles.list} role="listbox" aria-label={panelLabel}>
          {candidates.map((member, index) => (
            /*
              无障碍名只取昵称：头像里的首字符是纯装饰，不覆写的话读屏会念出
              「张 张三」，而「@ 到谁」这件事只需要名字本身
            */
            <button
              key={member.userId}
              type="button"
              role="option"
              aria-selected={index === active}
              aria-label={member.displayName}
              className={[styles.item, index === active ? styles.itemActive : '']
                .filter(Boolean)
                .join(' ')}
              // 与表情面板同口径：不抢焦点，否则正在输入的拼音会丢
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => onHover(index)}
              onClick={() => onPick(member)}
            >
              {/*
                「@所有人」是伪候选：没有头像，用「@」字符占位而不是取名字首字。
                取首字会得到「所」，在一列人名里看起来就是某个叫「所…」的成员，
                与它「作用于全群」的含义完全不搭。
              */}
              {isMentionAllId(member.userId) ? (
                <Avatar size={24} className={styles.mentionAllAvatar}>
                  @
                </Avatar>
              ) : (
                <Avatar size={24} src={member.avatarUrl ?? undefined}>
                  {member.displayName.slice(0, 1)}
                </Avatar>
              )}
              <span className={styles.name}>{member.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionPanel;
