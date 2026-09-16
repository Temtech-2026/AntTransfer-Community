/**
 * 用户角色分配抽屉（{@code PUT /api/v1/system/users/{id}/roles}，整集替换）。
 *
 * <p>契约要点（决定本组件的交互形态）：
 * <ul>
 *   <li>后端 {@code UserRoleAssignDTO#roleIds} 带 {@code @NotEmpty} —— <b>空集合会被拒绝</b>，
 *       所以「一个角色都不选」时要直接禁用提交按钮，而不是让用户提交后吃一个 400；</li>
 *   <li>服务端会校验「不得授予自己未持有的角色」（防提权），
 *       因此选项已由页面按操作者数据范围预筛（见 users/index.tsx）；</li>
 *   <li>对受保护账号摘除 SUPER_ADMIN 会被拒 —— 提前给出警示文案。</li>
 * </ul></p>
 */

import { Alert, App, Button, Checkbox, Drawer, Empty, Input, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { assignUserRoles, dataScopeColor, dataScopeText, type RoleVO, type UserVO } from '@/services/system';

export interface AssignRoleDrawerProps {
  open: boolean;
  record?: UserVO | null;
  /** 可分配角色（页面已按操作者数据范围收敛）。 */
  roleOptions: readonly RoleVO[];
  onClose: () => void;
  onSuccess: () => void;
}

const AssignRoleDrawer = ({ open, record, roleOptions, onClose, onSuccess }: AssignRoleDrawerProps) => {
  const { message } = App.useApp();
  const [selected, setSelected] = useState<number[]>([]);
  const [keyword, setKeyword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected(record?.roleIds ?? []);
    setKeyword('');
  }, [open, record]);

  const visibleRoles = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) {
      return roleOptions;
    }
    return roleOptions.filter(
      (role) =>
        role.name.toLowerCase().includes(trimmed) || role.code.toLowerCase().includes(trimmed),
    );
  }, [roleOptions, keyword]);

  const handleSubmit = async () => {
    if (!record) {
      return;
    }
    setSubmitting(true);
    try {
      await assignUserRoles(record.id, selected);
      message.success('角色已更新');
      onSuccess();
    } catch {
      // 全局错误提示已给出
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      width={480}
      title={`分配角色 · ${record?.nickname ?? record?.username ?? ''}`}
      onClose={onClose}
      footer={
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            loading={submitting}
            disabled={selected.length === 0}
            onClick={handleSubmit}
          >
            保存
          </Button>
        </Space>
      }
    >
      {record?.protectedUser && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title="受保护账号"
          description="必须保留超级管理员角色；摘除会被服务端拒绝。"
        />
      )}

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="整集替换 + 至少保留一个角色"
        description="提交后以本次勾选为准（非增量）。后端要求角色集合非空，故至少勾选一个。"
      />

      <Input.Search
        allowClear
        placeholder="按角色名 / 编码过滤"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        style={{ marginBottom: 12 }}
      />

      {visibleRoles.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            roleOptions.length === 0
              ? '没有可分配的角色（可能因数据范围受限）'
              : '没有匹配的角色'
          }
        />
      ) : (
        <Checkbox.Group
          value={selected}
          onChange={(values) => setSelected(values as number[])}
          style={{ width: '100%' }}
        >
          <Space orientation="vertical" style={{ width: '100%' }} size={4}>
            {visibleRoles.map((role) => (
              <Checkbox key={role.id} value={role.id} style={{ width: '100%' }}>
                <Space size={6} wrap>
                  <Typography.Text strong>{role.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {role.code}
                  </Typography.Text>
                  <Tag color={dataScopeColor(role.dataScope)} style={{ marginInlineEnd: 0 }}>
                    {dataScopeText(role.dataScope)}
                  </Tag>
                  {role.builtIn === 1 && <Tag style={{ marginInlineEnd: 0 }}>内置</Tag>}
                </Space>
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      )}

      {selected.length === 0 && (
        <Typography.Text type="danger" style={{ display: 'block', marginTop: 12 }}>
          至少勾选一个角色：后端对角色集合做了非空校验。
        </Typography.Text>
      )}
    </Drawer>
  );
};

export default AssignRoleDrawer;
