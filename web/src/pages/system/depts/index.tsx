/**
 * 部门管理（{@code /system/depts}）—— <b>只读</b>。
 *
 * <p><b>为什么没有增删改</b>：CE 版 at-permission 只有
 * {@code GET /api/v1/system/users/dept-options} 这一个部门端点（供用户表单的部门下拉与
 * 数据范围判定使用），没有部门维护控制器。前端不提供「点了必然 404」的按钮，
 * 也不伪造本地数据，因此本页只呈现组织架构现状。</p>
 *
 * <p>数据源是<b>打平</b>列表，树由前端组装（{@link buildDeptTree}），
 * 脏数据（父不存在 / 自引 / 成环）在纯函数里已兜底，不会把表格递归打挂。</p>
 */

import {
  ApartmentOutlined,
  ClusterOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Col, Row, Tag } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import StatCard from '@/components/StatCard';
import {
  type DeptOptionVO,
  fetchDeptOptions,
  SYSTEM_PERM,
} from '@/services/system';

import { buildDeptTree, type DeptTreeNode } from './dept-tree';

/** 表格行（tree table 需要 children 存在时才渲染展开箭头，故空数组要剔除）。 */
interface DeptRow {
  id: string;
  parentId: string;
  name: string;
  depth: number;
  childCount: number;
  children?: DeptRow[];
}

function toRows(nodes: readonly DeptTreeNode[]): DeptRow[] {
  return nodes.map((node) => {
    const row: DeptRow = {
      id: node.id,
      parentId: node.parentId,
      name: node.name,
      depth: node.depth,
      childCount: node.children.length,
    };
    if (node.children.length > 0) {
      row.children = toRows(node.children);
    }
    return row;
  });
}

function collectStats(
  nodes: readonly DeptTreeNode[],
  depth = 0,
): { total: number; maxDepth: number } {
  let total = 0;
  let maxDepth = depth;
  for (const node of nodes) {
    total += 1;
    if (node.children.length > 0) {
      const sub = collectStats(node.children, depth + 1);
      total += sub.total;
      maxDepth = Math.max(maxDepth, sub.maxDepth);
    }
  }
  return { total, maxDepth };
}

const DeptPage = () => {
  const access = useAccess();
  const intl = useIntl();
  const { message } = App.useApp();
  const [depts, setDepts] = useState<DeptOptionVO[]>([]);
  const [loading, setLoading] = useState(false);

  // 端点允许 user:list / create / update 任一权限点
  const canRead = access.canAny([
    SYSTEM_PERM.USER_LIST,
    SYSTEM_PERM.USER_CREATE,
    SYSTEM_PERM.USER_UPDATE,
  ]);

  const load = useCallback(async () => {
    if (!canRead) {
      return;
    }
    setLoading(true);
    try {
      const list = await fetchDeptOptions();
      setDepts(Array.isArray(list) ? list : []);
    } catch {
      // 全局错误提示已给出
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  const tree = useMemo(() => buildDeptTree(depts), [depts]);
  const rows = useMemo(() => toRows(tree), [tree]);
  const stats = useMemo(() => collectStats(tree), [tree]);

  const columns: ProColumns<DeptRow>[] = [
    {
      title: intl.formatMessage({ id: 'system.dept.column.name' }),
      dataIndex: 'name',
      search: false,
      render: (_, row) => (
        <span>
          {row.name}
          {row.depth === 0 && (
            <Tag color="blue" style={{ marginInlineStart: 6 }}>
              {intl.formatMessage({ id: 'system.dept.rootTag' })}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: intl.formatMessage({ id: 'system.dept.column.id' }),
      dataIndex: 'id',
      search: false,
      width: 160,
      render: (_, row) => <span>{row.id}</span>,
    },
    {
      title: intl.formatMessage({ id: 'system.dept.column.parentId' }),
      dataIndex: 'parentId',
      search: false,
      width: 140,
    },
    {
      title: intl.formatMessage({ id: 'system.dept.column.depth' }),
      dataIndex: 'depth',
      search: false,
      width: 100,
      render: (_, row) =>
        intl.formatMessage({ id: 'system.dept.depthValue' }, { depth: row.depth + 1 }),
    },
    {
      title: intl.formatMessage({ id: 'system.dept.column.childCount' }),
      dataIndex: 'childCount',
      search: false,
      width: 120,
      render: (_, row) => (row.childCount > 0 ? row.childCount : '--'),
    },
  ];

  return (
    <PageContainer
      title={intl.formatMessage({ id: 'system.dept.title' })}
      subTitle={intl.formatMessage({ id: 'system.dept.subtitle' })}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={intl.formatMessage({ id: 'system.dept.alert.title' })}
        description={intl.formatMessage({ id: 'system.dept.alert.desc' })}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <StatCard
            title={intl.formatMessage({ id: 'system.dept.stat.total' })}
            value={stats.total}
            suffix={intl.formatMessage({ id: 'system.dept.suffix.count' })}
            icon={<ApartmentOutlined />}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title={intl.formatMessage({ id: 'system.dept.stat.roots' })}
            value={tree.length}
            suffix={intl.formatMessage({ id: 'system.dept.suffix.count' })}
            tone="blue"
            icon={<ClusterOutlined />}
            footer={intl.formatMessage({ id: 'system.dept.stat.rootsFooter' })}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title={intl.formatMessage({ id: 'system.dept.stat.maxDepth' })}
            value={stats.total === 0 ? 0 : stats.maxDepth + 1}
            suffix={intl.formatMessage({ id: 'system.dept.suffix.level' })}
            tone="purple"
            icon={<NodeIndexOutlined />}
          />
        </Col>
      </Row>

      <ProTable<DeptRow>
        rowKey="id"
        headerTitle={intl.formatMessage({ id: 'system.dept.headerTitle' })}
        columns={columns}
        dataSource={rows}
        loading={loading}
        search={false}
        pagination={false}
        options={false}
        expandable={{ defaultExpandAllRows: true }}
        toolBarRender={() => [
          <Button
            key="reload"
            icon={<ReloadOutlined />}
            onClick={() => {
              void load();
              message.success(intl.formatMessage({ id: 'system.dept.message.reloaded' }));
            }}
          >
            {intl.formatMessage({ id: 'common.action.refresh' })}
          </Button>,
        ]}
      />
    </PageContainer>
  );
};

export default DeptPage;
