/**
 * 文件网格视图（卡片流）。
 *
 * <p>与列表视图**共享同一份数据与同一份动作清单**（{@link NodeActionLinks}），
 * 只是排版不同：列表适合按列比较大小 / 时间，网格适合靠图标与文件名快速扫视。
 * 因此这里不做任何额外请求，也不做任何额外的权限判定。</p>
 *
 * <p><b>卡片点击 = 切换勾选</b>，而不是直接打开预览：密级文件一点就渲染内容风险太大，
 * 且与列表视图的「点操作列才生效」不一致。预览必须走明确的「预览」动作，
 * 那里带着 `file:preview` 门禁。</p>
 */

import { useIntl } from '@umijs/max';
import { Checkbox, Empty, Spin, Tag, Tooltip } from 'antd';

import { formatBytes } from '@/components/ChunkUpload';
import { type FileNode, levelColor, levelTextId } from '@/services/file';

import useStyles from '../index.style';
import { type NodeActionHandlers, NodeActionLinks } from '../node-actions';
import FileIcon from './FileIcon';
import SecurityBadges from './SecurityBadges';

export interface FileGridProps {
  nodes: FileNode[];
  loading?: boolean;
  recycleMode: boolean;
  /**
   * 是否显示勾选框。
   *
   * <p>回收站里恒为 false：服务端只有「批量移入回收站」，没有批量还原 / 批量销毁，
   * 勾上一堆却没有批量动作可用，等于给用户一个死胡同。</p>
   */
  selectable: boolean;
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  handlers: NodeActionHandlers;
  dangerColor?: string;
}

export default function FileGrid({
  nodes,
  loading = false,
  recycleMode,
  selectable,
  selectedIds,
  onToggleSelect,
  handlers,
  dangerColor,
}: FileGridProps) {
  const intl = useIntl();
  const { styles } = useStyles();

  return (
    <Spin spinning={loading}>
      {nodes.length === 0 ? (
        <Empty
          style={{ padding: '32px 0' }}
          description={intl.formatMessage({
            id: recycleMode ? 'file.grid.emptyRecycle' : 'file.grid.emptyFolder',
          })}
        />
      ) : (
        <div className={styles.grid}>
          {nodes.map((node) => {
            const selected = selectedIds.includes(node.id);
            return (
              <div
                key={node.id}
                className={[styles.gridCard, selected ? styles.gridCardSelected : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  if (selectable) {
                    onToggleSelect(node.id);
                  }
                }}
              >
                {selectable ? (
                  <Checkbox
                    className={styles.gridCheck}
                    checked={selected}
                    onChange={() => onToggleSelect(node.id)}
                    // 勾选框自己处理点击，别让事件冒到卡片上导致「点一次翻两次」
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : null}

                <div className={styles.gridIcon}>
                  <FileIcon ext={node.ext} size={30} />
                </div>

                <Tooltip title={node.name}>
                  <div className={styles.gridName}>{node.name}</div>
                </Tooltip>

                <div className={styles.gridMeta}>
                  {formatBytes(node.sizeBytes ?? 0)} · {node.updateTime ?? '-'}
                </div>

                <div className={styles.gridMeta}>
                  <Tag color={levelColor(node.level)}>
                    {intl.formatMessage({ id: levelTextId(node.level) })}
                  </Tag>
                  <SecurityBadges node={node} compact />
                  {node.tags?.map((tag) => (
                    <Tag key={tag.id} color={tag.color ?? undefined}>
                      {tag.name}
                    </Tag>
                  ))}
                </div>

                <div
                  className={styles.gridActions}
                  // 动作区自成一格：点「下载」不该顺带把卡片勾上
                  onClick={(event) => event.stopPropagation()}
                >
                  <NodeActionLinks
                    node={node}
                    handlers={handlers}
                    recycleMode={recycleMode}
                    dangerColor={dangerColor}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Spin>
  );
}
