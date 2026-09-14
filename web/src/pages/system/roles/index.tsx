/**
 * 角色管理（{@code /system/roles}，路由权限 {@code system:role:list}）。
 *
 * <p>角色是「权限点的聚合单位」：本页负责角色本体（编码 / 名称 / 数据范围）与
 * 权限矩阵入口，真正的权限点勾选在 {@link RolePermissionDrawer}。</p>
 *
 * <p><b>内置角色</b>（{@code builtIn=1}）不可删除，且数据范围不可改；
 * <b>AUDITOR</b> 的权限集由服务端锁定只读（{@code auditorLocked} 下发，前端不硬编码角色码）。
 * 两条都以「禁用按钮 + 抽屉只读」呈现，服务端仍有 1020 / 1021 兜底。</p>
 */

import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { Alert, App, Button, Popconfirm, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';

import {
  SYSTEM_MAX_PAGE_SIZE,
  SYSTEM_PERM,
  dataScopeColor,
  dataScopeText,
  deleteRole,
  isBuiltInRole,
  pageRoles,
  type RoleVO,
} from '@/services/system';
import { asStringParam } from '@/utils/query';

import RoleFormModal from './components/RoleFormModal';
import RolePermissionDrawer from './components/RolePermissionDrawer';

const RolesPage = () => {
  const access = useAccess();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formRecord, setFormRecord] = useState<RoleVO | null>(null);
  const [permOpen, setPermOpen] = useState(false);
  const [permTarget, setPermTarget] = useState<RoleVO | null>(null);

  const canCreate = access.can(SYSTEM_PERM.ROLE_CREATE);
  const canUpdate = access.can(SYSTEM_PERM.ROLE_UPDATE);
  const canDelete = access.can(SYSTEM_PERM.ROLE_DELETE);
  const canAssignPerm = access.can(SYSTEM_PERM.ROLE_ASSIGN_PERM);

  const reload = () => {
    actionRef.current?.reload();
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormRecord(null);
  };

  const closePerm = () => {
    setPermOpen(false);
    setPermTarget(null);
  };

  const handleDelete = async (row: RoleVO) => {
    try {
      await deleteRole(row.id);
      message.success(`已删除角色 ${row.name}`);
      reload();
    } catch {
      // 全局错误提示已给出（含 1020 内置角色 / 角色在用）
    }
  };

  const hasAnyRowAction = canUpdate || canDelete || canAssignPerm;

  const columns: ProColumns<RoleVO>[] = [
    {
      title: '角色名称 / 编码',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '名称或编码，模糊匹配' },
    },
    {
      title: '角色名称',
      dataIndex: 'name',
      search: false,
      width: 200,
      render: (_, row) => (
        <Space size={4}>
          <Typography.Text>{row.name}</Typography.Text>
          {isBuiltInRole(row) && (
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              内置
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '编码',
      dataIndex: 'code',
      search: false,
      copyable: true,
      width: 180,
      render: (_, row) => <Typography.Text code>{row.code}</Typography.Text>,
    },
    {
      title: '数据范围',
      dataIndex: 'dataScope',
      search: false,
      width: 130,
      render: (_, row) => (
        <Tag color={dataScopeColor(row.dataScope)} style={{ marginInlineEnd: 0 }}>
          {dataScopeText(row.dataScope)}
        </Tag>
      ),
    },
    {
      title: '权限集',
      dataIndex: 'auditorLocked',
      search: false,
      width: 110,
      render: (_, row) =>
        row.auditorLocked ? <Tag color="warning">锁定只读</Tag> : <Tag>可维护</Tag>,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      search: false,
      ellipsis: true,
      render: (_, row) => row.remark || '--',
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      search: false,
      valueType: 'dateTime',
      width: 180,
    },
  ];

  if (hasAnyRowAction) {
    columns.push({
      title: '操作',
      valueType: 'option',
      key: 'option',
      fixed: 'right',
      width: 220,
      render: (_, row) => {
        const nodes: ReactNode[] = [];

        if (canUpdate) {
          nodes.push(
            <Button
              key="edit"
              type="link"
              size="small"
              onClick={() => {
                setFormRecord(row);
                setFormOpen(true);
              }}
            >
              编辑
            </Button>,
          );
        }

        if (canAssignPerm) {
          nodes.push(
            <Button
              key="perm"
              type="link"
              size="small"
              onClick={() => {
                setPermTarget(row);
                setPermOpen(true);
              }}
            >
              分配权限
            </Button>,
          );
        }

        if (canDelete) {
          nodes.push(
            <Popconfirm
              key="delete"
              title="确认删除该角色？"
              description="内置角色、有关联权限或仍被用户持有的角色会被服务端拒绝。"
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              disabled={isBuiltInRole(row)}
              onConfirm={() => handleDelete(row)}
            >
              <Button type="link" size="small" danger disabled={isBuiltInRole(row)}>
                删除
              </Button>
            </Popconfirm>,
          );
        }

        return nodes;
      },
    });
  }

  return (
    <PageContainer title="角色管理" subTitle="角色本体与权限矩阵">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="操作边界"
        description={
          <span>
            内置角色不可删除、数据范围不可改；系统管理面的权限点只授予超级管理员。
            数据范围非「全部」时，新建角色只能授出不高于自身的数据范围，
            分配权限也只能勾选自己已持有的权限点（服务端防提权兜底）。
          </span>
        }
      />
      <ProTable<RoleVO>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        scroll={{ x: 1200 }}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        pagination={{ defaultPageSize: 20, pageSizeOptions: [10, 20, 50, SYSTEM_MAX_PAGE_SIZE] }}
        options={{ density: false, setting: true, reload: true }}
        dateFormatter="string"
        request={async (params) => {
          try {
            const page = await pageRoles({
              keyword: asStringParam(params.keyword),
              current: params.current,
              pageSize: params.pageSize,
            });
            return { data: page.records ?? [], total: page.total ?? 0, success: true };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        toolBarRender={() =>
          canCreate
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setFormRecord(null);
                    setFormOpen(true);
                  }}
                >
                  新建角色
                </Button>,
              ]
            : []
        }
      />

      <RoleFormModal
        open={formOpen}
        record={formRecord}
        maxDataScope={access.dataScope}
        onClose={closeForm}
        onSuccess={() => {
          closeForm();
          reload();
        }}
      />

      <RolePermissionDrawer
        open={permOpen}
        record={permTarget}
        canAssign={canAssignPerm}
        permSet={access.permSet}
        dataScope={access.dataScope}
        onClose={closePerm}
        onSuccess={() => {
          closePerm();
          reload();
        }}
      />
    </PageContainer>
  );
};

export default RolesPage;
