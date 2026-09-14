/**
 * 菜单 / 权限点目录（{@code /system/menus}）—— <b>只读</b>。
 *
 * <p>数据源 {@code GET /api/v1/permission-points}（树形，服务端已组装 children）。
 * 权限点在本项目里<b>同时承载菜单与操作</b>（{@code type}：1-菜单 2-操作 3-数据范围），
 * 所以「菜单管理」在 CE 版就是「权限点目录浏览」——权限点的增删改属于权限模型本身，
 * 目前只由 SQL 迁移脚本维护，没有写接口，前端不提供假入口。</p>
 *
 * <p>本页是角色授权抽屉的「对照视图」：授权时按树勾选，这里可以按编码反查某个权限点
 * 挂在哪个菜单下、属于哪个维度。</p>
 */

import { ReloadOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { Alert, Button, Card, Col, Empty, Input, Row, Space, Statistic, Tag, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SYSTEM_PERM, fetchPermissionPointTree, type PermissionPointVO } from '@/services/system';

/** 权限点维度（1-菜单 2-操作 3-数据范围）。 */
const TYPE_META: Readonly<Record<number, { text: string; color: string }>> = {
  1: { text: '菜单', color: 'blue' },
  2: { text: '操作', color: 'geekblue' },
  3: { text: '数据范围', color: 'purple' },
};

/** 表格行：tree table 只在 children 非空时渲染展开箭头。 */
interface PointRow {
  id: number;
  permCode: string;
  permName: string;
  type: number;
  sortNo: number;
  children?: PointRow[];
}

function toRows(nodes: readonly PermissionPointVO[]): PointRow[] {
  return nodes.map((node) => {
    const row: PointRow = {
      id: node.id,
      permCode: node.permCode,
      permName: node.permName,
      type: node.type,
      sortNo: node.sortNo,
    };
    if (node.children.length > 0) {
      row.children = toRows(node.children);
    }
    return row;
  });
}

/**
 * 关键字过滤（命中节点保留其完整子树，未命中但后代命中的节点保留在路径上）。
 *
 * <p>不能简单地把树打平再过滤——那会丢掉父子关系，表格缩进就没意义了。</p>
 */
function filterTree(
  nodes: readonly PermissionPointVO[],
  keyword: string,
): PermissionPointVO[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) {
    return [...nodes];
  }
  const walk = (list: readonly PermissionPointVO[]): PermissionPointVO[] =>
    list.flatMap((node) => {
      const hit =
        node.permName.toLowerCase().includes(kw) || node.permCode.toLowerCase().includes(kw);
      if (hit) {
        // 命中：整棵子树都保留，便于看清它带了哪些下级权限
        return [node];
      }
      const children = walk(node.children);
      return children.length > 0 ? [{ ...node, children }] : [];
    });
  return walk(nodes);
}

function countByType(
  nodes: readonly PermissionPointVO[],
): { total: number; menu: number; action: number; scope: number } {
  const result = { total: 0, menu: 0, action: 0, scope: 0 };
  const walk = (list: readonly PermissionPointVO[]) => {
    for (const node of list) {
      result.total += 1;
      if (node.type === 1) {
        result.menu += 1;
      } else if (node.type === 2) {
        result.action += 1;
      } else if (node.type === 3) {
        result.scope += 1;
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

const MenuPage = () => {
  const access = useAccess();
  const [tree, setTree] = useState<PermissionPointVO[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  // 端点允许 role:list 或 role:assign-perm 任一权限点
  const canRead = access.canAny([SYSTEM_PERM.ROLE_LIST, SYSTEM_PERM.ROLE_ASSIGN_PERM]);

  const load = useCallback(async () => {
    if (!canRead) {
      return;
    }
    setLoading(true);
    try {
      const nodes = await fetchPermissionPointTree();
      setTree(nodes);
    } catch {
      // 全局错误提示已给出
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => filterTree(tree, keyword), [tree, keyword]);
  const rows = useMemo(() => toRows(filtered), [filtered]);
  const stats = useMemo(() => countByType(tree), [tree]);

  const columns: ProColumns<PointRow>[] = [
    {
      title: '权限点名称',
      dataIndex: 'permName',
      search: false,
      width: 260,
    },
    {
      title: '权限编码',
      dataIndex: 'permCode',
      search: false,
      copyable: true,
      render: (_, row) => <Typography.Text code>{row.permCode}</Typography.Text>,
    },
    {
      title: '维度',
      dataIndex: 'type',
      search: false,
      width: 110,
      render: (_, row) => {
        const meta = TYPE_META[row.type];
        return meta ? <Tag color={meta.color}>{meta.text}</Tag> : <Tag>未知({row.type})</Tag>;
      },
    },
    {
      title: '排序',
      dataIndex: 'sortNo',
      search: false,
      width: 90,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      search: false,
      width: 160,
    },
  ];

  return (
    <PageContainer title="菜单 / 权限点目录" subTitle="权限模型现状（只读）">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="只读页：权限点的增删改由 SQL 迁移脚本维护"
        description={
          <span>
            本项目把「菜单」与「操作」统一建模为<b>权限点</b>（
            <code>type</code>：1-菜单 2-操作 3-数据范围）。当前只有目录读取端点（
            <code>GET /api/v1/permission-points</code>），没有权限点维护接口。
            要给某个角色勾选权限，请到「角色管理 → 分配权限」。
          </span>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="权限点总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="菜单节点" value={stats.menu} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="操作节点" value={stats.action} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="数据范围节点" value={stats.scope} />
          </Card>
        </Col>
      </Row>

      {!canRead && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="缺少权限：需要 system:role:list 或 system:role:assign-perm"
        />
      )}

      {canRead && (
        <ProTable<PointRow>
          rowKey="id"
          headerTitle="权限点树"
          columns={columns}
          dataSource={rows}
          loading={loading}
          search={false}
          pagination={false}
          options={false}
          expandable={{ defaultExpandAllRows: true }}
          toolBarRender={() => [
            <Space key="tools" size={8}>
              <Input.Search
                allowClear
                placeholder="按名称 / 编码过滤"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                style={{ width: 260 }}
              />
              <Button icon={<ReloadOutlined />} onClick={() => void load()}>
                刷新
              </Button>
            </Space>,
          ]}
        />
      )}
    </PageContainer>
  );
};

export default MenuPage;
