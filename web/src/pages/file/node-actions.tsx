/**
 * 文件条目的行内动作清单（**单一事实源**）。
 *
 * <p>为什么必须抽出来：这些动作是 `docs/development/frontend-permission-map.md`
 * 在前端最直接的投影。列表视图与网格视图各写一遍的话，某天有人只给其中一处加了权限点，
 * 就会出现「列表里没有删除入口、网格里却有」这种**用视图切换就能绕开显隐**的漏洞。
 * 因此判定逻辑只有这一份，两个视图都从这里取。</p>
 *
 * <p>再次强调：这里只是<b>渲染层显隐</b>。隐藏按钮是为了避免「看得见必然失败」的坏体验，
 * 真正的边界永远是服务端的 `@RequiresPerm`。</p>
 */

import { useIntl } from '@umijs/max';
import type { CSSProperties, ReactElement } from 'react';

import { Access } from '@/components/Access';
import type { PermCode } from '@/services/access';
import type { FileNode } from '@/services/file';

import useStyles from './index.style';

/** 单个行内动作。 */
export interface NodeAction {
  key: string;
  /** 文案 id：动作清单是纯数据，不持有任何语言，渲染时才由 `intl` 解析。 */
  labelId: string;
  /**
   * 所需权限点。
   *
   * <p>缺省表示**对所有人开放**——目前只有「申请权限」属于此类：没有权限的人正是要申请的人，
   * 若给它加门禁就形成了死锁。</p>
   */
  perm?: PermCode;
  /** 危险动作（删除 / 彻底销毁），用语义红而非主色 */
  danger?: boolean;
  onClick: () => void;
}

/** 动作回调集合；由页面注入，动作清单本身不碰任何服务。 */
export interface NodeActionHandlers {
  onPreview: (node: FileNode) => void;
  onDownload: (node: FileNode) => void;
  onShare: (node: FileNode) => void;
  onSendToChat: (node: FileNode) => void;
  onApply: (node: FileNode) => void;
  onRecycle: (node: FileNode) => void;
  onRestore: (node: FileNode) => void;
  onDestroy: (node: FileNode) => void;
}

/**
 * 生成一个条目的可用动作。
 *
 * @param recycleMode 回收站视角：预览 / 下载 / 分享对已移入回收站的文件没有意义，
 *   只保留「还原 / 彻底销毁」。
 */
export function buildNodeActions(
  node: FileNode,
  handlers: NodeActionHandlers,
  recycleMode: boolean,
): NodeAction[] {
  if (recycleMode) {
    return [
      {
        key: 'restore',
        labelId: 'file.action.restore',
        perm: 'file:edit',
        onClick: () => handlers.onRestore(node),
      },
      {
        key: 'destroy',
        labelId: 'file.action.destroy',
        perm: 'file:destroy',
        danger: true,
        onClick: () => handlers.onDestroy(node),
      },
    ];
  }
  return [
    {
      key: 'preview',
      labelId: 'file.action.preview',
      perm: 'file:preview',
      onClick: () => handlers.onPreview(node),
    },
    {
      key: 'download',
      labelId: 'file.action.download',
      perm: 'file:download',
      onClick: () => handlers.onDownload(node),
    },
    {
      key: 'share',
      labelId: 'file.action.share',
      perm: 'file:share',
      onClick: () => handlers.onShare(node),
    },
    {
      // 无权限点门禁：发送的只是「条目引用」，真正的取件边界在接收方那一侧
      // （他要有 file:download 才能换票）。给这里加门禁只会让能看见文件的人发不出去，
      // 与「申请权限」同理——它不触碰文件内容，不该被文件权限拦下。
      key: 'sendToChat',
      labelId: 'file.action.sendToChat',
      onClick: () => handlers.onSendToChat(node),
    },
    {
      key: 'apply',
      labelId: 'file.action.applyPerm',
      onClick: () => handlers.onApply(node),
    },
    {
      key: 'recycle',
      labelId: 'file.action.delete',
      perm: 'file:edit',
      danger: true,
      onClick: () => handlers.onRecycle(node),
    },
  ];
}

export interface NodeActionLinksProps {
  node: FileNode;
  handlers: NodeActionHandlers;
  recycleMode: boolean;
  /** 危险动作用的语义色（从主题 token 取，不写死十六进制） */
  dangerColor?: string;
}

/** 把动作清单渲染成一排链接，供列表与网格共用。 */
export function NodeActionLinks({
  node,
  handlers,
  recycleMode,
  dangerColor,
}: NodeActionLinksProps): ReactElement {
  const intl = useIntl();
  const { styles } = useStyles();
  const style: CSSProperties | undefined = dangerColor
    ? { color: dangerColor }
    : undefined;
  return (
    <div className={styles.actionLinks}>
      {buildNodeActions(node, handlers, recycleMode).map((action) => {
        // key 直接落在 <a> 上（而不是外层包一层 span）：lint 的
        // useJsxKeyInIterable 只看迭代器里直接产出的元素，包一层会被判成缺 key
        const link = (
          <a
            key={action.key}
            onClick={action.onClick}
            style={action.danger ? style : undefined}
          >
            {intl.formatMessage({ id: action.labelId })}
          </a>
        );
        return action.perm ? (
          <Access key={action.key} perm={action.perm}>
            {link}
          </Access>
        ) : (
          link
        );
      })}
    </div>
  );
}

export default NodeActionLinks;
