/**
 * 移动条目：选一个目标目录，逐个调用 `PATCH /files/{id}/move`。
 *
 * <p>几个刻意的选择：</p>
 * <ul>
 *   <li><b>逐个串行而不是并发</b>：批量移动是低频操作，并发换不来体感收益，却会
 *       把「哪个失败了」这件事变成一团糊涂账。串行能让失败条目被精确点名。</li>
 *   <li><b>部分失败要说出来</b>：成功 N 个、失败 M 个各报一次，而不是「移动失败」
 *       一刀切——用户据此才知道该去哪些文件上重试。</li>
 *   <li><b>目标与当前位置相同的不发请求</b>：服务端对此没有明确的幂等约定，
 *       前端能省掉的无效写就别发出去。</li>
 *   <li><b>文案只说确定的事</b>：移动只改存放位置，不动密级 / 分享链接 / 已授权限。</li>
 * </ul>
 */

import { useIntl } from '@umijs/max';
import { Alert, Modal, TreeSelect, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { type FileNode, type FolderNode, moveNode } from '@/services/file';

import { folderPathText } from '../folder-tree';

const { Text } = Typography;

/**
 * 根目录在服务端用 0 表示（`MoveRequest#targetFolderId`）。
 *
 * <p>这里刻意写成**字符串** `'0'`：目录 ID 是 19 位雪花 ID，前端一律以字符串承载与下发
 * （见 `services/file/types` 的 ID 语境说明），根目录哨兵值也用同一形态，
 * 免得混着写时又有人顺手 `Number()` 一下。</p>
 */
const ROOT_FOLDER_ID = '0';

/** 目录树转换的防御性深度上限：脏数据成环时不能把选择器递归挂死。 */
const MAX_TREE_DEPTH = 16;

/** 失败条目最多点名几个，避免 toast 过长。 */
const FAILED_NAME_LIMIT = 3;

interface TreeOption {
  title: string;
  value: string;
  children?: TreeOption[];
}

function toTreeData(nodes: FolderNode[], depth = 0): TreeOption[] {
  if (depth >= MAX_TREE_DEPTH) {
    return [];
  }
  return nodes.map((node) => {
    const children = toTreeData(node.children ?? [], depth + 1);
    return {
      title: node.name,
      value: node.id,
      ...(children.length > 0 ? { children } : {}),
    };
  });
}

export interface MoveModalProps {
  open: boolean;
  /** 待移动条目；空数组表示没有目标（弹窗内容按空处理） */
  nodes: FileNode[];
  tree: FolderNode[];
  onClose: () => void;
  /** 移动流程结束后（无论成功几个）由页面决定是否刷新列表 */
  onMoved: () => void;
}

export default function MoveModal({
  open,
  nodes,
  tree,
  onClose,
  onMoved,
}: MoveModalProps) {
  const intl = useIntl();
  const [targetFolderId, setTargetFolderId] = useState<string>(ROOT_FOLDER_ID);
  const [submitting, setSubmitting] = useState(false);

  // 每次都从根目录开始选：保留上次选择会让「移动」这种破坏性动作更容易误操作
  useEffect(() => {
    if (open) {
      setTargetFolderId(ROOT_FOLDER_ID);
      setSubmitting(false);
    }
  }, [open]);

  const treeData = useMemo<TreeOption[]>(() => {
    const children = toTreeData(tree);
    return [
      {
        title: intl.formatMessage({ id: 'file.folder.root' }),
        value: ROOT_FOLDER_ID,
        ...(children.length > 0 ? { children } : {}),
      },
    ];
  }, [tree, intl]);

  /** 已经在目标目录里的条目：不算失败，只是不需要再动 */
  const pending = useMemo(
    () => nodes.filter((node) => (node.folderId ?? ROOT_FOLDER_ID) !== targetFolderId),
    [nodes, targetFolderId],
  );
  const unchangedCount = nodes.length - pending.length;

  const targetText = useMemo(
    () =>
      folderPathText(
        tree,
        targetFolderId,
        intl.formatMessage({ id: 'file.breadcrumb.all' }),
      ),
    [tree, targetFolderId, intl],
  );

  const handleMove = async () => {
    if (pending.length === 0) {
      message.info(intl.formatMessage({ id: 'file.move.noop' }));
      return;
    }
    setSubmitting(true);
    let moved = 0;
    const failed: string[] = [];
    for (const node of pending) {
      try {
        await moveNode(node.id, targetFolderId);
        moved += 1;
      } catch {
        // 请求层已弹过错误提示，这里只负责把「哪个条目」记下来
        failed.push(node.name);
      }
    }
    setSubmitting(false);

    if (moved > 0) {
      message.success(
        intl.formatMessage(
          { id: 'file.move.done' },
          { count: moved, target: targetText },
        ),
      );
    }
    if (failed.length > 0) {
      const shown = failed.slice(0, FAILED_NAME_LIMIT).join(
        intl.formatMessage({ id: 'common.listSeparator' }),
      );
      message.warning(
        intl.formatMessage(
          { id: 'file.move.failed' },
          {
            count: failed.length,
            names:
              failed.length > FAILED_NAME_LIMIT
                ? `${shown}${intl.formatMessage({ id: 'file.move.etc' })}`
                : shown,
          },
        ),
      );
    }
    onMoved();
    onClose();
  };

  return (
    <Modal
      open={open}
      title={intl.formatMessage({ id: 'file.move.title' })}
      width={520}
      okText={intl.formatMessage({ id: 'file.move.ok' })}
      okButtonProps={{ disabled: nodes.length === 0, loading: submitting }}
      onOk={handleMove}
      onCancel={onClose}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title={intl.formatMessage({ id: 'file.move.alertTitle' })}
        description={intl.formatMessage({ id: 'file.move.alertDescription' })}
      />

      <TreeSelect
        style={{ width: '100%' }}
        value={targetFolderId}
        treeData={treeData}
        treeDefaultExpandAll
        treeLine
        placeholder={intl.formatMessage({ id: 'file.move.placeholder' })}
        // 不做 Number() 归一：目录 ID 是雪花 ID，转 number 会丢末位（见 `services/file/types`）
        onChange={(value) => setTargetFolderId(String(value ?? ROOT_FOLDER_ID))}
      />

      <div style={{ marginTop: 12 }}>
        <Text type="secondary">
          {intl.formatMessage(
            { id: 'file.move.pending' },
            { count: pending.length },
          )}
          {nodes.length > 0
            ? intl.formatMessage(
                { id: 'file.move.pendingNames' },
                {
                  names: `${nodes
                    .slice(0, FAILED_NAME_LIMIT)
                    .map((node) => node.name)
                    .join(intl.formatMessage({ id: 'common.listSeparator' }))}${
                    nodes.length > FAILED_NAME_LIMIT
                      ? intl.formatMessage({ id: 'file.move.etc' })
                      : ''
                  }`,
                },
              )
            : ''}
          {unchangedCount > 0
            ? intl.formatMessage(
                { id: 'file.move.unchanged' },
                { count: unchangedCount },
              )
            : ''}
        </Text>
      </div>
    </Modal>
  );
}
