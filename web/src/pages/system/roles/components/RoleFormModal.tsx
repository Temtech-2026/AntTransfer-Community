/**
 * 角色新建 / 编辑弹窗。
 *
 * <p><b>编辑态刻意不含 code</b>：{@code RoleUpdateDTO} 里就没有这个字段（编码是角色的对外标识，
 * 改了等于换一个角色，历史授权与审计记录都会对不上）。</p>
 *
 * <p><b>内置角色的 dataScope 不可改</b>：服务端 {@code RoleAdminService.updateRole} 对
 * {@code builtIn=1} 的角色显式拒绝改动数据范围（1020 BUILT_IN_ROLE_LOCKED），
 * 前端置灰并提交原值，避免「看起来能改、提交才报错」。</p>
 *
 * <p><b>数据范围只能授出不高于自己的</b>：{@code assertRoleDataScopeAssignable} 要求
 * 新建 / 编辑角色的 {@code data_scope} 不得超过操作者自身数据范围（否则即为放大授权）。
 * 故下拉选项按操作者数据范围裁剪。</p>
 */

import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, Modal, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { DataScope } from '@/services/access';
import {
  DATA_SCOPE_OPTIONS,
  createRole,
  dataScopeTextId,
  isBuiltInRole,
  updateRole,
  type RoleVO,
} from '@/services/system';

/** 与 {@code RoleCreateDTO#code} 的 {@code @Pattern} 逐字一致。 */
const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

export interface RoleFormModalProps {
  open: boolean;
  /** 有值 = 编辑；null / undefined = 新建。 */
  record?: RoleVO | null;
  /** 操作者自身数据范围，用于裁剪可授出的取值。 */
  maxDataScope: number;
  onClose: () => void;
  onSuccess: () => void;
}

interface RoleFormValues {
  code: string;
  name: string;
  dataScope: number;
  remark?: string;
}

const RoleFormModal = ({ open, record, maxDataScope, onClose, onSuccess }: RoleFormModalProps) => {
  const [form] = Form.useForm<RoleFormValues>();
  const intl = useIntl();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const editing = record != null;
  const builtIn = isBuiltInRole(record);

  const scopeOptions = useMemo(
    () => DATA_SCOPE_OPTIONS.filter((option) => option.value <= maxDataScope),
    [maxDataScope],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    if (record) {
      form.setFieldsValue({
        code: record.code,
        name: record.name,
        dataScope: record.dataScope,
        remark: record.remark ?? undefined,
      });
      return;
    }
    form.resetFields();
    form.setFieldsValue({ dataScope: DataScope.SELF });
  }, [open, record, form]);

  const handleSubmit = async () => {
    let values: RoleFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      if (record) {
        await updateRole(record.id, {
          name: values.name,
          // 内置角色提交原值：服务端会比对 data_scope，改动即拒
          dataScope: builtIn ? record.dataScope : values.dataScope,
          // 显式传空串以支持「清空备注」（RoleUpdateDTO.remark 无 @NotBlank）
          remark: values.remark ?? '',
        });
        message.success(intl.formatMessage({ id: 'system.roleForm.message.updated' }));
      } else {
        await createRole({
          code: values.code,
          name: values.name,
          dataScope: values.dataScope,
          remark: values.remark || undefined,
        });
        message.success(intl.formatMessage({ id: 'system.roleForm.message.created' }));
      }
      onSuccess();
    } catch {
      // 全局错误提示已给出
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
              { id: 'system.roleForm.title.edit' },
              { name: record?.name ?? '' },
            )
          : intl.formatMessage({ id: 'system.roleForm.title.create' })
      }
      okText={intl.formatMessage({
        id: editing ? 'common.action.save' : 'system.action.create',
      })}
      cancelText={intl.formatMessage({ id: 'common.action.cancel' })}
      confirmLoading={submitting}
      onOk={handleSubmit}
      onCancel={onClose}
      maskClosable={false}
      width={520}
    >
      {builtIn && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={intl.formatMessage({ id: 'system.roleForm.alert.title' })}
          description={intl.formatMessage({ id: 'system.roleForm.alert.desc' })}
        />
      )}
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="code"
          label={intl.formatMessage({ id: 'system.roleForm.field.code' })}
          rules={
            editing
              ? []
              : [
                  {
                    required: true,
                    message: intl.formatMessage({ id: 'system.roleForm.rule.codeRequired' }),
                  },
                  {
                    pattern: ROLE_CODE_PATTERN,
                    message: intl.formatMessage({ id: 'system.roleForm.rule.codePattern' }),
                  },
                ]
          }
          extra={
            editing ? intl.formatMessage({ id: 'system.roleForm.extra.codeEdit' }) : undefined
          }
        >
          <Input
            disabled={editing}
            maxLength={64}
            placeholder={intl.formatMessage({ id: 'system.roleForm.placeholder.code' })}
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          name="name"
          label={intl.formatMessage({ id: 'system.roleForm.field.name' })}
          rules={[
            {
              required: true,
              whitespace: true,
              message: intl.formatMessage({ id: 'system.roleForm.rule.nameRequired' }),
            },
            {
              max: 64,
              message: intl.formatMessage({ id: 'system.roleForm.rule.nameMax' }),
            },
          ]}
        >
          <Input maxLength={64} />
        </Form.Item>

        <Form.Item
          name="dataScope"
          label={intl.formatMessage({ id: 'system.roleForm.field.dataScope' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'system.roleForm.rule.dataScopeRequired' }),
            },
          ]}
          extra={
            builtIn
              ? intl.formatMessage({ id: 'system.roleForm.extra.dataScopeBuiltIn' })
              : intl.formatMessage(
                  { id: 'system.roleForm.extra.dataScopeMax' },
                  {
                    scope: intl.formatMessage(
                      { id: dataScopeTextId(maxDataScope) },
                      { scope: maxDataScope ?? '-' },
                    ),
                  },
                )
          }
        >
          <Select
            disabled={builtIn}
            options={scopeOptions.map((option) => ({
              label: intl.formatMessage({ id: option.labelId }),
              value: option.value,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="remark"
          label={intl.formatMessage({ id: 'system.column.remark' })}
          rules={[
            { max: 255, message: intl.formatMessage({ id: 'system.userForm.rule.remarkMax' }) },
          ]}
        >
          <Input.TextArea rows={2} maxLength={255} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RoleFormModal;
