/**
 * 用户管理（{@code /system/users}，路由权限 {@code system:user:list}）。
 *
 * <p>按钮显隐全部走 {@code useAccess().can(perm)}（{@link SYSTEM_PERM}），
 * 且与后端 {@code @RequiresPerm} 一一对应；前端只负责「不给出点了必然失败的入口」，
 * 强制校验始终在后端。</p>
 *
 * <p><b>受保护账号</b>（{@code UserVO#protectedUser}）由服务端下发，前端据此禁用
 * 停用 / 删除 / 分配角色 —— 不硬编码 {@code admin} 之类的角色码判定。</p>
 *
 * <p><b>对自己操作</b>（停用 / 重置口令 / 分配角色 / 删除自己）后端会明确拒绝，
 * 但登录态里没有可信的「当前用户 ID」（模板 {@code API.CurrentUser.userid} 不是后端主键），
 * 因此此处<b>不猜</b>、只靠服务端拦截 + 全局错误提示，页面顶部用说明文案提前告知。</p>
 */

import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Popconfirm, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { DataScope } from '@/services/access';
import {
  SYSTEM_PERM,
  UserStatus,
  changeUserStatus,
  deleteUser,
  fetchDeptOptions,
  fetchUserRoleOptions,
  pageUsers,
  userStatusTextId,
  type DeptOptionVO,
  type RoleVO,
  type UserVO,
} from '@/services/system';
import { asNumberParam, asStringParam } from '@/utils/query';

import AssignRoleDrawer from './components/AssignRoleDrawer';
import ResetPasswordModal from './components/ResetPasswordModal';
import UserFormModal from './components/UserFormModal';

const UsersPage = () => {
  const access = useAccess();
  const intl = useIntl();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType | null>(null);

  const [deptOptions, setDeptOptions] = useState<DeptOptionVO[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleVO[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formRecord, setFormRecord] = useState<UserVO | null>(null);
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<UserVO | null>(null);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<UserVO | null>(null);

  const canList = access.can(SYSTEM_PERM.USER_LIST);
  const canCreate = access.can(SYSTEM_PERM.USER_CREATE);
  const canUpdate = access.can(SYSTEM_PERM.USER_UPDATE);
  const canStatus = access.can(SYSTEM_PERM.USER_STATUS);
  const canResetPassword = access.can(SYSTEM_PERM.USER_RESET_PASSWORD);
  const canAssignRole = access.can(SYSTEM_PERM.USER_ASSIGN_ROLE);
  const canDelete = access.can(SYSTEM_PERM.USER_DELETE);

  // 部门选项：进入页面拉一次即可（列表筛选 + 表单共用）
  useEffect(() => {
    if (!canList) {
      return undefined;
    }
    let cancelled = false;
    fetchDeptOptions()
      .then((list) => {
        if (!cancelled) {
          setDeptOptions(list ?? []);
        }
      })
      .catch(() => {
        // 下拉加载失败不阻塞主表；错误提示已由全局 requestErrorConfig 给出
      });
    return () => {
      cancelled = true;
    };
  }, [canList]);

  // 角色选项：仅有分配权限时才请求（该端点需要 system:user:assign-role）
  useEffect(() => {
    if (!canAssignRole) {
      setRoleOptions([]);
      return undefined;
    }
    let cancelled = false;
    fetchUserRoleOptions()
      .then((list) => {
        if (!cancelled) {
          setRoleOptions(list ?? []);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canAssignRole]);

  /**
   * 可分配角色 = 服务端 {@code assertRolesAssignable} 的前端镜像：
   * 数据范围非「全部」时，只能分配自己已持有的角色，否则必然吃 403 提权拒绝。
   */
  const assignableRoles = useMemo(() => {
    if (access.dataScope >= DataScope.ALL) {
      return roleOptions;
    }
    const ownRoles = new Set(access.roles);
    return roleOptions.filter((role) => ownRoles.has(role.code));
  }, [roleOptions, access.dataScope, access.roles]);

  const deptFilterOptions = useMemo(
    () => deptOptions.map((dept) => ({ label: dept.name, value: dept.id })),
    [deptOptions],
  );

  const reload = () => {
    actionRef.current?.reload();
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormRecord(null);
  };

  const handleStatus = async (row: UserVO, disabling: boolean) => {
    try {
      await changeUserStatus(row.id, disabling ? UserStatus.DISABLED : UserStatus.NORMAL);
      message.success(
        intl.formatMessage(
          { id: disabling ? 'system.user.message.disabled' : 'system.user.message.enabled' },
          { name: row.username },
        ),
      );
      reload();
    } catch {
      // 全局错误提示已给出
    }
  };

  const handleDelete = async (row: UserVO) => {
    try {
      await deleteUser(row.id);
      message.success(intl.formatMessage({ id: 'system.user.message.deleted' }, { name: row.username }));
      reload();
    } catch {
      // 全局错误提示已给出
    }
  };

  const hasAnyRowAction =
    canUpdate || canStatus || canResetPassword || canAssignRole || canDelete;

  const columns: ProColumns<UserVO>[] = [
    {
      // 仅用于搜索的列：后端以单个 keyword 同时模糊账号与昵称
      title: intl.formatMessage({ id: 'system.user.column.keyword' }),
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: {
        placeholder: intl.formatMessage({ id: 'system.user.column.keywordPlaceholder' }),
      },
    },
    {
      title: intl.formatMessage({ id: 'system.user.column.username' }),
      dataIndex: 'username',
      search: false,
      copyable: true,
      width: 170,
      render: (_, row) => (
        <Space size={4}>
          <Typography.Text>{row.username}</Typography.Text>
          {row.protectedUser && (
            <Tag color="gold" style={{ marginInlineEnd: 0 }}>
              {intl.formatMessage({ id: 'system.user.protectedTag' })}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: intl.formatMessage({ id: 'system.user.column.nickname' }),
      dataIndex: 'nickname',
      search: false,
      width: 150,
      ellipsis: true,
      render: (_, row) => row.nickname || '--',
    },
    {
      // 仅用于搜索的列：筛选按部门 ID，展示走下面的 deptName
      title: intl.formatMessage({ id: 'system.user.column.dept' }),
      dataIndex: 'deptId',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        options: deptFilterOptions,
        allowClear: true,
        showSearch: true,
        optionFilterProp: 'label',
        placeholder: intl.formatMessage({ id: 'system.user.column.deptPlaceholder' }),
      },
    },
    {
      title: intl.formatMessage({ id: 'system.user.column.dept' }),
      dataIndex: 'deptName',
      search: false,
      width: 180,
      ellipsis: true,
      render: (_, row) => row.deptName || '--',
    },
    {
      title: intl.formatMessage({ id: 'system.user.column.roles' }),
      dataIndex: 'roleCodes',
      search: false,
      width: 220,
      render: (_, row) => {
        const codes = row.roleCodes ?? [];
        if (codes.length === 0) {
          return '--';
        }
        return (
          <Space size={4} wrap>
            {codes.map((code) => (
              <Tag key={code} style={{ marginInlineEnd: 0 }}>
                {code}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: intl.formatMessage({ id: 'system.column.status' }),
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        '0': {
          text: intl.formatMessage({ id: userStatusTextId(UserStatus.NORMAL) }),
          status: 'Success',
        },
        '1': {
          text: intl.formatMessage({ id: userStatusTextId(UserStatus.DISABLED) }),
          status: 'Default',
        },
        '2': {
          text: intl.formatMessage({ id: userStatusTextId(UserStatus.LOCKED) }),
          status: 'Warning',
        },
      },
    },
    {
      title: intl.formatMessage({ id: 'system.user.column.lastLogin' }),
      dataIndex: 'lastLoginTime',
      search: false,
      valueType: 'dateTime',
      width: 180,
      render: (_, row) => row.lastLoginTime || '--',
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
      width: 280,
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

        if (canAssignRole) {
          nodes.push(
            <Button
              key="role"
              type="link"
              size="small"
              disabled={row.protectedUser}
              onClick={() => {
                setRoleTarget(row);
                setRoleDrawerOpen(true);
              }}
            >
              {intl.formatMessage({ id: 'system.user.action.assignRole' })}
            </Button>,
          );
        }

        if (canResetPassword) {
          nodes.push(
            <Button
              key="password"
              type="link"
              size="small"
              onClick={() => {
                setPwdTarget(row);
                setPwdModalOpen(true);
              }}
            >
              {intl.formatMessage({ id: 'system.user.action.resetPassword' })}
            </Button>,
          );
        }

        if (canStatus) {
          const locked = row.status === UserStatus.LOCKED;
          const disabling = row.status === UserStatus.NORMAL;
          nodes.push(
            <Popconfirm
              key="status"
              title={intl.formatMessage({
                id: disabling
                  ? 'system.user.confirm.disableTitle'
                  : 'system.user.confirm.enableTitle',
              })}
              description={
                disabling
                  ? intl.formatMessage({ id: 'system.user.confirm.disableDesc' })
                  : undefined
              }
              okText={intl.formatMessage({ id: 'common.action.confirm' })}
              cancelText={intl.formatMessage({ id: 'common.action.cancel' })}
              disabled={row.protectedUser || locked}
              onConfirm={() => handleStatus(row, disabling)}
            >
              <Button
                type="link"
                size="small"
                danger={disabling}
                disabled={row.protectedUser || locked}
              >
                {intl.formatMessage({
                  id: locked
                    ? 'system.user.action.locked'
                    : disabling
                      ? 'system.user.action.disable'
                      : 'system.user.action.enable',
                })}
              </Button>
            </Popconfirm>,
          );
        }

        if (canDelete) {
          nodes.push(
            <Popconfirm
              key="delete"
              title={intl.formatMessage({ id: 'system.user.confirm.deleteTitle' })}
              description={intl.formatMessage({ id: 'system.user.confirm.deleteDesc' })}
              okText={intl.formatMessage({ id: 'system.action.delete' })}
              okButtonProps={{ danger: true }}
              cancelText={intl.formatMessage({ id: 'common.action.cancel' })}
              disabled={row.protectedUser}
              onConfirm={() => handleDelete(row)}
            >
              <Button type="link" size="small" danger disabled={row.protectedUser}>
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
      title={intl.formatMessage({ id: 'system.user.title' })}
      subTitle={intl.formatMessage({ id: 'system.user.subtitle' })}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={intl.formatMessage({ id: 'system.alert.boundaryTitle' })}
        description={intl.formatMessage({ id: 'system.user.alertBoundary' })}
      />
      <ProTable<UserVO>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        scroll={{ x: 1500 }}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        options={{ density: false, setting: true, reload: true }}
        dateFormatter="string"
        request={async (params) => {
          try {
            const page = await pageUsers({
              keyword: asStringParam(params.keyword),
              status: asNumberParam(params.status),
              deptId: asStringParam(params.deptId),
              current: params.current,
              pageSize: params.pageSize,
            });
            return { data: page.records ?? [], total: page.total ?? 0, success: true };
          } catch {
            // 失败提示由全局处理；这里返回 success:false 让表格保持空态而不是白屏
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
                  {intl.formatMessage({ id: 'system.user.action.create' })}
                </Button>,
              ]
            : []
        }
      />

      <UserFormModal
        open={formOpen}
        record={formRecord}
        deptOptions={deptOptions}
        roleOptions={assignableRoles}
        canAssignRole={canAssignRole}
        onClose={closeForm}
        onSuccess={() => {
          closeForm();
          reload();
        }}
      />

      <AssignRoleDrawer
        open={roleDrawerOpen}
        record={roleTarget}
        roleOptions={assignableRoles}
        onClose={() => {
          setRoleDrawerOpen(false);
          setRoleTarget(null);
        }}
        onSuccess={() => {
          setRoleDrawerOpen(false);
          setRoleTarget(null);
          reload();
        }}
      />

      <ResetPasswordModal
        open={pwdModalOpen}
        record={pwdTarget}
        onClose={() => {
          setPwdModalOpen(false);
          setPwdTarget(null);
        }}
        onSuccess={() => {
          setPwdModalOpen(false);
          setPwdTarget(null);
        }}
      />
    </PageContainer>
  );
};

export default UsersPage;
