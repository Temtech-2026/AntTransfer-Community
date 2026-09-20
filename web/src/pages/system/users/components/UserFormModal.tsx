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

import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, Modal, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import {
  SYSTEM_PERM,
  createUser,
  dataScopeTextId,
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
  const intl = useIntl();
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
        label: intl.formatMessage(
          { id: 'system.userForm.roleOption' },
          {
            name: role.name,
            code: role.code,
            scope: intl.formatMessage(
              { id: dataScopeTextId(role.dataScope) },
              { scope: role.dataScope ?? '-' },
            ),
          },
        ),
        value: role.id,
      })),
    [roleOptions, intl],
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
        message.success(intl.formatMessage({ id: 'system.userForm.message.updated' }));
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
        message.success(intl.formatMessage({ id: 'system.userForm.message.created' }));
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
      title={
        editing
          ? intl.formatMessage(
              { id: 'system.userForm.title.edit' },
              { name: record?.username ?? '' },
            )
          : intl.formatMessage({ id: 'system.userForm.title.create' })
      }
      okText={intl.formatMessage({
        id: editing ? 'common.action.save' : 'system.action.create',
      })}
      cancelText={intl.formatMessage({ id: 'common.action.cancel' })}
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
          title={intl.formatMessage({ id: 'system.userForm.alert.title' })}
          description={intl.formatMessage({ id: 'system.userForm.alert.desc' })}
        />
      )}
      <Form form={form} layout="vertical" preserve={false} requiredMark>
        <Form.Item
          name="username"
          label={intl.formatMessage({ id: 'system.userForm.field.username' })}
          rules={
            editing
              ? []
              : [
                  {
                    required: true,
                    message: intl.formatMessage({ id: 'system.userForm.rule.usernameRequired' }),
                  },
                  {
                    pattern: USERNAME_PATTERN,
                    message: intl.formatMessage({ id: 'system.userForm.rule.usernamePattern' }),
                  },
                ]
          }
        >
          <Input
            disabled={editing}
            maxLength={64}
            placeholder={
              editing
                ? undefined
                : intl.formatMessage({ id: 'system.userForm.placeholder.username' })
            }
            autoComplete="off"
          />
        </Form.Item>

        {!editing && (
          <Form.Item
            name="password"
            label={intl.formatMessage({ id: 'system.userForm.field.password' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({ id: 'system.userForm.rule.passwordRequired' }),
              },
              {
                min: 8,
                max: 64,
                message: intl.formatMessage({ id: 'system.userForm.rule.passwordLength' }),
              },
            ]}
          >
            <Input.Password
              maxLength={64}
              placeholder={intl.formatMessage({ id: 'system.userForm.placeholder.password' })}
              autoComplete="new-password"
            />
          </Form.Item>
        )}

        <Form.Item
          name="nickname"
          label={intl.formatMessage({ id: 'system.userForm.field.nickname' })}
          rules={[
            {
              required: true,
              whitespace: true,
              message: intl.formatMessage({ id: 'system.userForm.rule.nicknameRequired' }),
            },
            {
              max: 64,
              message: intl.formatMessage({ id: 'system.userForm.rule.nicknameMax' }),
            },
          ]}
        >
          <Input maxLength={64} />
        </Form.Item>

        <Form.Item
          name="deptId"
          label={intl.formatMessage({ id: 'system.userForm.field.dept' })}
          extra={
            editing
              ? intl.formatMessage({ id: 'system.userForm.extra.deptEdit' })
              : intl.formatMessage({ id: 'system.userForm.extra.deptCreate' })
          }
        >
          <Select
            allowClear
            showSearch
            placeholder={intl.formatMessage({ id: 'system.userForm.placeholder.dept' })}
            options={deptSelectOptions}
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          name="email"
          label={intl.formatMessage({ id: 'system.userForm.field.email' })}
          rules={[
            {
              type: 'email',
              message: intl.formatMessage({ id: 'system.userForm.rule.emailInvalid' }),
            },
            {
              max: 128,
              message: intl.formatMessage({ id: 'system.userForm.rule.emailMax' }),
            },
          ]}
          extra={
            editing ? intl.formatMessage({ id: 'system.userForm.extra.emailEdit' }) : undefined
          }
        >
          <Input maxLength={128} autoComplete="off" />
        </Form.Item>

        <Form.Item
          name="mobile"
          label={intl.formatMessage({ id: 'system.userForm.field.mobile' })}
          rules={[
            { max: 32, message: intl.formatMessage({ id: 'system.userForm.rule.mobileMax' }) },
          ]}
          extra={
            editing ? intl.formatMessage({ id: 'system.userForm.extra.mobileEdit' }) : undefined
          }
        >
          <Input maxLength={32} autoComplete="off" />
        </Form.Item>

        {!editing && canAssignRole && (
          <Form.Item
            name="roleIds"
            label={intl.formatMessage({ id: 'system.userForm.field.roleIds' })}
            extra={intl.formatMessage(
              { id: 'system.userForm.extra.roleIds' },
              { perm: SYSTEM_PERM.USER_ASSIGN_ROLE },
            )}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder={intl.formatMessage({ id: 'system.userForm.placeholder.roleIds' })}
              options={roleSelectOptions}
              optionFilterProp="label"
            />
          </Form.Item>
        )}

        {!editing && (
          <Form.Item
            name="remark"
            label={intl.formatMessage({ id: 'system.column.remark' })}
            rules={[
              { max: 255, message: intl.formatMessage({ id: 'system.userForm.rule.remarkMax' }) },
            ]}
          >
            <Input.TextArea rows={2} maxLength={255} showCount />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default UserFormModal;
