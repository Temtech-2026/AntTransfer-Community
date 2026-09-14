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

import { Alert, App, Form, Input, Modal, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { DataScope } from '@/services/access';
import {
  DATA_SCOPE_OPTIONS,
  createRole,
  dataScopeText,
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
        message.success('角色已更新');
      } else {
        await createRole({
          code: values.code,
          name: values.name,
          dataScope: values.dataScope,
          remark: values.remark || undefined,
        });
        message.success('角色已创建');
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
      title={editing ? `编辑角色 · ${record?.name ?? ''}` : '新建角色'}
      okText={editing ? '保存' : '创建'}
      cancelText="取消"
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
          title="内置角色"
          description="编码与数据范围不可修改，仅可调整名称与备注；权限矩阵在「分配权限」抽屉中维护。"
        />
      )}
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="code"
          label="角色编码"
          rules={
            editing
              ? []
              : [
                  { required: true, message: '请输入角色编码' },
                  { pattern: ROLE_CODE_PATTERN, message: '须为大写字母开头，仅含大写字母/数字/下划线' },
                ]
          }
          extra={editing ? '编码为角色的对外标识，创建后不可修改' : undefined}
        >
          <Input
            disabled={editing}
            maxLength={64}
            placeholder="例如 DEPT_ADMIN"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          name="name"
          label="角色名称"
          rules={[
            { required: true, whitespace: true, message: '请输入角色名称' },
            { max: 64, message: '不超过 64 字符' },
          ]}
        >
          <Input maxLength={64} />
        </Form.Item>

        <Form.Item
          name="dataScope"
          label="数据范围"
          rules={[{ required: true, message: '请选择数据范围' }]}
          extra={
            builtIn
              ? '内置角色的数据范围不可修改'
              : `不得超过你自身的数据范围（当前：${dataScopeText(maxDataScope)}）`
          }
        >
          <Select
            disabled={builtIn}
            options={scopeOptions.map((option) => ({ label: option.label, value: option.value }))}
          />
        </Form.Item>

        <Form.Item
          name="remark"
          label="备注"
          rules={[{ max: 255, message: '不超过 255 字符' }]}
        >
          <Input.TextArea rows={2} maxLength={255} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RoleFormModal;
