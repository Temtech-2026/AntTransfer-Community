/**
 * 角色授权抽屉（{@code PUT /api/v1/roles/{id}/permissions}，整集替换）。
 *
 * <p>三条后端红线决定了本组件的交互形态：
 * <ol>
 *   <li><b>AUDITOR 权限集锁定只读</b>：{@code RoleVO#auditorLocked} 由服务端下发
 *       （服务层按角色码判定，前端不硬编码 {@code 'AUDITOR'}），
 *       锁定态下整个抽屉只读，提交必然吃 1021。</li>
 *   <li><b>防自锁</b>：{@code assertSuperAdminKeepsControl} 要求 SUPER_ADMIN 角色
 *       在提交后的权限集中必须仍包含 {@link SUPER_ADMIN_REQUIRED_PERMS} 三枚
 *       「管理能力的入口」。这里把对应节点置为 {@code disabled} 让 rc-tree 的
 *       conduct 跳过它们，并在提交前再校验一次（双保险，不依赖 rc-tree 的内部行为）。</li>
 *   <li><b>防提权</b>：数据范围非「全部」时，服务层用
 *       {@code snapshot.permCodes().containsAll(requestedCodes)} 拒绝授予自己没有的权限点。
 *       前端据此把「自己没持有的叶子节点」置灰——判定规则与服务端完全同源
 *       （菜单节点的编码必然在 permCodes 中，否则菜单根本渲染不出来）。</li>
 * </ol></p>
 *
 * <p><b>提交口径</b>：checked + halfChecked。权限点是树，父节点代表「能看见入口」，
 * 只提交 checkedKeys 会导致「授权了叶子操作点、却看不见所属菜单」；
 * 而 {@code selectPermissionIdsByRoleId} 回填的正是整棵含父节点的集合，两者一致。</p>
 */

import { Alert, App, Button, Drawer, Empty, Space, Spin, Tag, Tooltip, Tree, Typography } from 'antd';
import type { TreeDataNode } from 'antd';
import type { Key } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { DataScope } from '@/services/access';
import {
  SUPER_ADMIN_REQUIRED_PERMS,
  assignRolePermissions,
  fetchPermissionPointTree,
  fetchRolePermissionIds,
  type PermissionPointVO,
  type RoleVO,
} from '@/services/system';

/** 权限点维度标签（1-菜单 2-操作 3-数据范围）。 */
const TYPE_META: Readonly<Record<number, { text: string; color: string }>> = {
  1: { text: '菜单', color: 'blue' },
  2: { text: '操作', color: 'geekblue' },
  3: { text: '数据范围', color: 'purple' },
};

export interface RolePermissionDrawerProps {
  open: boolean;
  record?: RoleVO | null;
  /** 是否持有 {@code system:role:assign-perm}；否则只读。 */
  canAssign: boolean;
  /** 操作者已持有的权限点编码集合（防提权判定用）。 */
  permSet: ReadonlySet<string>;
  /** 操作者自身数据范围；{@code < ALL} 时启用防提权置灰。 */
  dataScope: number;
  onClose: () => void;
  onSuccess: () => void;
}

/** 打平权限点树（用于按编码建索引）。 */
function flattenPoints(nodes: readonly PermissionPointVO[]): PermissionPointVO[] {
  const result: PermissionPointVO[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flattenPoints(node.children));
  }
  return result;
}

const RolePermissionDrawer = ({
  open,
  record,
  canAssign,
  permSet,
  dataScope,
  onClose,
  onSuccess,
}: RolePermissionDrawerProps) => {
  const { message } = App.useApp();
  const [tree, setTree] = useState<PermissionPointVO[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<number[]>([]);
  const [halfCheckedKeys, setHalfCheckedKeys] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const auditorLocked = Boolean(record?.auditorLocked);
  const readOnly = !canAssign || auditorLocked;
  const narrowScope = dataScope < DataScope.ALL;

  useEffect(() => {
    if (!open || !record) {
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchPermissionPointTree(), fetchRolePermissionIds(record.id)])
      .then(([nodes, ids]) => {
        if (cancelled) {
          return;
        }
        setTree(nodes);
        setCheckedKeys(Array.isArray(ids) ? ids : []);
        setHalfCheckedKeys([]);
      })
      .catch(() => {
        // 全局错误提示已给出；保持空树 + 空选，不渲染半截数据
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, record]);

  /** 全部节点（打平），用于编码索引与统计。 */
  const allPoints = useMemo(() => flattenPoints(tree), [tree]);

  const pointById = useMemo(() => {
    const map = new Map<number, PermissionPointVO>();
    for (const point of allPoints) {
      map.set(point.id, point);
    }
    return map;
  }, [allPoints]);

  /** SUPER_ADMIN 防自锁：必须保留的权限点 ID。 */
  const requiredIds = useMemo(() => {
    const ids = new Set<number>();
    if (record?.code !== 'SUPER_ADMIN') {
      return ids;
    }
    for (const point of allPoints) {
      if (SUPER_ADMIN_REQUIRED_PERMS.includes(point.permCode)) {
        ids.add(point.id);
      }
    }
    return ids;
  }, [allPoints, record]);

  const treeData = useMemo(() => {
    // 递归建树走内部函数声明：写成 useCallback 会在依赖数组里自引用（TDZ 直接抛错）
    const build = (nodes: readonly PermissionPointVO[]): TreeDataNode[] =>
      nodes.map((node) => {
        const isLeaf = node.children.length === 0;
        const required = requiredIds.has(node.id);
        // 防提权：非全量数据范围时，自己没持有的叶子节点不可勾选
        const notHeld = narrowScope && isLeaf && !permSet.has(node.permCode);
        const typeMeta = TYPE_META[node.type];
        return {
          key: node.id,
          disabled: readOnly || required || notHeld,
          title: (
            <Space size={6} wrap>
              <span>{node.permName}</span>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {node.permCode}
              </Typography.Text>
              {typeMeta && (
                <Tag color={typeMeta.color} style={{ marginInlineEnd: 0 }}>
                  {typeMeta.text}
                </Tag>
              )}
              {required && (
                <Tooltip title="防自锁：超级管理员必须保留这枚「管理能力的入口」，服务端会拒绝对它的摘除">
                  <Tag color="gold" style={{ marginInlineEnd: 0 }}>
                    必留
                  </Tag>
                </Tooltip>
              )}
              {notHeld && (
                <Tooltip title="你的数据范围不是「全部」，不能授予自己未持有的权限点（服务端防提权）">
                  <Tag style={{ marginInlineEnd: 0 }}>不可授</Tag>
                </Tooltip>
              )}
            </Space>
          ),
          children: build(node.children),
        };
      });

    return build(tree);
  }, [tree, requiredIds, narrowScope, permSet, readOnly]);

  const handleCheck = (
    checked: Key[] | { checked: Key[]; halfChecked: Key[] },
    info: { halfCheckedKeys?: Key[] },
  ) => {
    const nextChecked = Array.isArray(checked) ? checked : checked.checked;
    const nextHalf = Array.isArray(checked) ? (info.halfCheckedKeys ?? []) : checked.halfChecked;
    setCheckedKeys(nextChecked.map(Number));
    setHalfCheckedKeys(nextHalf.map(Number));
  };

  const handleSubmit = async () => {
    if (!record) {
      return;
    }

    // checked + halfChecked：父节点代表「能看见入口」，漏掉会出现「有操作点权限但看不到菜单」
    const desired = Array.from(new Set([...checkedKeys, ...halfCheckedKeys]));

    if (requiredIds.size > 0) {
      const missing = [...requiredIds].filter((id) => !desired.includes(id));
      if (missing.length > 0) {
        const codes = missing
          .map((id) => pointById.get(id)?.permCode ?? `#${id}`)
          .join('、');
        message.error(`超级管理员角色必须保留这些权限点：${codes}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await assignRolePermissions(record.id, desired);
      message.success('角色权限已更新');
      onSuccess();
    } catch {
      // 全局错误提示已给出
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = new Set([...checkedKeys, ...halfCheckedKeys]).size;

  return (
    <Drawer
      open={open}
      width={560}
      title={`分配权限 · ${record?.name ?? ''}`}
      onClose={onClose}
      footer={
        readOnly ? null : (
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              保存
            </Button>
          </Space>
        )
      }
    >
      {auditorLocked && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title="审计员角色的权限集被锁定"
          description="服务层拒绝对该角色的权限集做任何变更（1021），本抽屉只读。"
        />
      )}
      {!canAssign && !auditorLocked && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="只读"
          description="你没有角色授权权限点（system:role:assign-perm），仅可查看当前权限矩阵。"
        />
      )}
      {!readOnly && record?.code === 'SUPER_ADMIN' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title="防自锁：三枚权限点不可摘除"
          description={`必须保留 ${SUPER_ADMIN_REQUIRED_PERMS.join('、')}，否则将无人能再管理权限，服务端会直接拒绝。`}
        />
      )}
      {!readOnly && narrowScope && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="防提权：只能授予自己已持有的权限点"
          description="你的数据范围不是「全部」，标为「不可授」的节点提交后会被服务端拒绝。"
        />
      )}

      <Space style={{ marginBottom: 12 }} size={8}>
        <Typography.Text type="secondary">
          已选 {selectedCount} / 共 {allPoints.length} 个权限点
        </Typography.Text>
        <Typography.Text type="secondary">（父节点计入 = 可见入口）</Typography.Text>
      </Space>

      <Spin spinning={loading}>
        {treeData.length === 0 && !loading ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="权限点目录为空" />
        ) : (
          <Tree
            checkable
            selectable={false}
            defaultExpandAll
            disabled={readOnly}
            treeData={treeData}
            checkedKeys={checkedKeys}
            onCheck={handleCheck}
          />
        )}
      </Spin>
    </Drawer>
  );
};

export default RolePermissionDrawer;
