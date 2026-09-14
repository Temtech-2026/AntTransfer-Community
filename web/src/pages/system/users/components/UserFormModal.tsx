/**
 * 用户新建 / 编辑弹窗。
 *
 * <p>字段约束逐条对齐后端 {@code UserCreateDTO} / {@code UserUpdateDTO} 的校验注解，
 * 避免「前端放行、后端 400」或反过来的体验割裂。表单校验只是体验，
 * 服务端仍会重新校验。</p>
 *
 * <p><b>编辑态刻意不含</b>：账号名（不可改）、口令（独立接口）、状态（独立接口）、
 * 角色（独立接口）、备注（{@code UserVO} 不回显备注，提交就成了「盲写」，宁可不可改）。</p>
 */

import { Alert, App, Form, Input, Modal, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import {
  SYSTEM_PERM,
  createUser,
  dataScopeText,
  updateUser,
  type DeptOptionVO,
  type RoleVO,
  type UserVO,
} from '@/services/system';

/** 与 {@code UserCreateDTO#username} 的 {@code @Pattern} 逐字一致。 */
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,64}$/;

export interface UserFormModalProps {
  open: boolean;
  /** 有值 = 编辑；null / undefined = 新建。 */
  record?: UserVO | null;
  deptOptions: readonly DeptOptionVO[];
  /** 可分配的角色（页面已按操作者数据范围收敛）。 */
  roleOptions: readonly RoleVO[];
  /** 是否展示「初始角色」字段（需 {@code system:user:assign-role}）。 */
  canAssignRole: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UserFormValues {
  username: string;
  password?: string;
  nickname: string;
  deptId?: number;
  email?: string;
  mobile?: string;
  roleIds?: number[];
  remark?: string;
}

const UserFormModal = ({
  open,
  record,
  deptOptions,
  roleOptions,
  canAssignRole,
  onClose,
  onSuccess,
}: UserFormModalProps) => {
  const [form] = Form.useForm<UserFormValues>();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const editing = record != null;

  const deptSelectOptions = useMemo(
    () => deptOptions.map((dept) => ({ label: dept.name, value: dept.id })),
    [deptOptions],
  );

  const roleSelectOptions = useMemo(
    () =>
      roleOptions.map((role) => ({
        label: `${role.name}（${role.code}·${dataScopeText(role.dataScope)}）`,
        value: role.id,
      })),
    [roleOptions],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    if (record) {
      form.setFieldsValue({
        username: record.username,
        nickname: record.nickname,
        deptId: record.deptId ?? undefined,
        email: record.email ?? undefined,
        mobile: record.mobile ?? undefined,
      });
      return;
    }
    form.resetFields();
  }, [open, record, form]);

  const handleSubmit = async () => {
    let values: UserFormValues;
    try {
      values = await form.validateFields();
    } catch {
      // 校验失败：Ant Design 已在字段下方给出错误文案
      return;
    }

    setSubmitting(true);
    try {
      if (record) {
        await updateUser(record.id, {
          nickname: values.nickname,
          // 留空 = 不修改（表主 emptyToNull + updateById 只更新非 null 字段）
          email: values.email || undefined,
          mobile: values.mobile || undefined,
          // 部门必须显式提交：与原值不同即触发调岗 + 审批授权回收；null = 解除部门分配
          deptId: values.deptId ?? null,
        });
        message.success('用户资料已更新');
      } else {
        await createUser({
          username: values.username,
          password: values.password ?? '',
          nickname: values.nickname,
          email: values.email || undefined,
          mobile: values.mobile || undefined,
          deptId: values.deptId,
          remark: values.remark,
          roleIds: canAssignRole ? values.roleIds : undefined,
        });
        message.success('用户已创建');
      }
      onSuccess();
    } catch {
      // 失败提示由全局 requestErrorConfig 统一给出；此处只负责收尾 loading
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={editing ? `编辑用户 · ${record?.username ?? ''}` : '新建用户'}
      okText={editing ? '保存' : '创建'}
      cancelText="取消"
      confirmLoading={submitting}
      onOk={handleSubmit}
      onCancel={onClose}
      maskClosable={false}
      width={560}
    >
      {editing && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="账号名、状态、角色、口令均不在本表单内"
          description="账号名不可改；状态 / 口令 / 角色请用列表中的对应按钮。备注因接口不回显，暂不提供编辑。"
        />
      )}
      <Form form={form} layout="vertical" preserve={false} requiredMark>
        <Form.Item
          name="username"
          label="登录账号"
          rules={
            editing
              ? []
              : [
                  { required: true, message: '请输入登录账号' },
                  { pattern: USERNAME_PATTERN, message: '须为 3~64 位字母/数字/下划线/点/横线' },
                ]
          }
        >
          <Input
            disabled={editing}
            maxLength={64}
            placeholder={editing ? undefined : '3~64 位字母/数字/下划线/点/横线'}
            autoComplete="off"
          />
        </Form.Item>

        {!editing && (
          <Form.Item
            name="password"
            label="初始口令"
            rules={[
              { required: true, message: '请输入初始口令' },
              { min: 8, max: 64, message: '口令长度须为 8~64 位' },
            ]}
          >
            <Input.Password
              maxLength={64}
              placeholder="8~64 位"
              autoComplete="new-password"
            />
          </Form.Item>
        )}

        <Form.Item
          name="nickname"
          label="昵称 / 姓名"
          rules={[
            { required: true, whitespace: true, message: '请输入昵称' },
            { max: 64, message: '不超过 64 字符' },
          ]}
        >
          <Input maxLength={64} />
        </Form.Item>

        <Form.Item
          name="deptId"
          label="所属部门"
          extra={
            editing
              ? '改动部门即视为调岗：会回收该用户「审批获得」的全部生效授权'
              : '留空 = 未分配部门'
          }
        >
          <Select
            allowClear
            showSearch
            placeholder="未分配"
            options={deptSelectOptions}
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          name="email"
          label="邮箱"
          rules={[
            { type: 'email', message: '邮箱格式不正确' },
            { max: 128, message: '不超过 128 字符' },
          ]}
          extra={editing ? '留空 = 不修改（后端保守策略，邮箱无法被清空）' : undefined}
        >
          <Input maxLength={128} autoComplete="off" />
        </Form.Item>

        <Form.Item
          name="mobile"
          label="手机号"
          rules={[{ max: 32, message: '不超过 32 字符' }]}
          extra={editing ? '留空 = 不修改' : undefined}
        >
          <Input maxLength={32} autoComplete="off" />
        </Form.Item>

        {!editing && canAssignRole && (
          <Form.Item
            name="roleIds"
            label="初始角色"
            extra={`可不分配。数据范围非「全部」时只能分配自己已持有的角色（需 ${SYSTEM_PERM.USER_ASSIGN_ROLE}）。`}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="不分配角色"
              options={roleSelectOptions}
              optionFilterProp="label"
            />
          </Form.Item>
        )}

        {!editing && (
          <Form.Item
            name="remark"
            label="备注"
            rules={[{ max: 255, message: '不超过 255 字符' }]}
          >
            <Input.TextArea rows={2} maxLength={255} showCount />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default UserFormModal;
