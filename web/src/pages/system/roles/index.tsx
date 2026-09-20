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
import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Popconfirm, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';

import {
  SYSTEM_MAX_PAGE_SIZE,
  SYSTEM_PERM,
  dataScopeColor,
  dataScopeTextId,
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
  const intl = useIntl();
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
      message.success(
        intl.formatMessage({ id: 'system.role.message.deleted' }, { name: row.name }),
      );
      reload();
    } catch {
      // 全局错误提示已给出（含 1020 内置角色 / 角色在用）
    }
  };

  const hasAnyRowAction = canUpdate || canDelete || canAssignPerm;

  const columns: ProColumns<RoleVO>[] = [
    {
      title: intl.formatMessage({ id: 'system.role.column.keyword' }),
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: {
        placeholder: intl.formatMessage({ id: 'system.role.column.keywordPlaceholder' }),
      },
    },
    {
      title: intl.formatMessage({ id: 'system.role.column.name' }),
      dataIndex: 'name',
      search: false,
      width: 200,
      render: (_, row) => (
        <Space size={4}>
          <Typography.Text>{row.name}</Typography.Text>
          {isBuiltInRole(row) && (
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              {intl.formatMessage({ id: 'system.role.builtInTag' })}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: intl.formatMessage({ id: 'system.role.column.code' }),
      dataIndex: 'code',
      search: false,
      copyable: true,
      width: 180,
      render: (_, row) => <Typography.Text code>{row.code}</Typography.Text>,
    },
    {
      title: intl.formatMessage({ id: 'system.role.column.dataScope' }),
      dataIndex: 'dataScope',
      search: false,
      width: 130,
      render: (_, row) => (
        <Tag color={dataScopeColor(row.dataScope)} style={{ marginInlineEnd: 0 }}>
          {intl.formatMessage(
            { id: dataScopeTextId(row.dataScope) },
            { scope: row.dataScope ?? '-' },
          )}
        </Tag>
      ),
    },
    {
      title: intl.formatMessage({ id: 'system.role.column.permissionSet' }),
      dataIndex: 'auditorLocked',
      search: false,
      width: 110,
      render: (_, row) =>
        row.auditorLocked ? (
          <Tag color="warning">{intl.formatMessage({ id: 'system.role.lockedTag' })}</Tag>
        ) : (
          <Tag>{intl.formatMessage({ id: 'system.role.maintainableTag' })}</Tag>
        ),
    },
    {
      title: intl.formatMessage({ id: 'system.column.remark' }),
      dataIndex: 'remark',
      search: false,
      ellipsis: true,
      render: (_, row) => row.remark || '--',
    },
    {
      title: intl.formatMessage({ id: 'system.column.createTime' }),
      dataIndex: 'createTime',
      search: false,
      valueType: 'dateTime',
      width: 180,
    },
  ];

  if (hasAnyRowAction) {
    columns.push({
      title: intl.formatMessage({ id: 'system.column.action' }),
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
              {intl.formatMessage({ id: 'system.action.edit' })}
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
              {intl.formatMessage({ id: 'system.role.action.assignPerm' })}
            </Button>,
          );
        }

        if (canDelete) {
          nodes.push(
            <Popconfirm
              key="delete"
              title={intl.formatMessage({ id: 'system.role.confirm.deleteTitle' })}
              description={intl.formatMessage({ id: 'system.role.confirm.deleteDesc' })}
              okText={intl.formatMessage({ id: 'system.action.delete' })}
              okButtonProps={{ danger: true }}
              cancelText={intl.formatMessage({ id: 'common.action.cancel' })}
              disabled={isBuiltInRole(row)}
              onConfirm={() => handleDelete(row)}
            >
              <Button type="link" size="small" danger disabled={isBuiltInRole(row)}>
                {intl.formatMessage({ id: 'system.action.delete' })}
              </Button>
            </Popconfirm>,
          );
        }

        return nodes;
      },
    });
  }

  return (
    <PageContainer
      title={intl.formatMessage({ id: 'system.role.title' })}
      subTitle={intl.formatMessage({ id: 'system.role.subtitle' })}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={intl.formatMessage({ id: 'system.alert.boundaryTitle' })}
        description={intl.formatMessage({ id: 'system.role.alertBoundary' })}
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
                  {intl.formatMessage({ id: 'system.role.action.create' })}
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
