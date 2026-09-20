/**
 * 管理员重置口令弹窗（{@code POST /api/v1/system/users/{id}/reset-password}）。
 *
 * <p>后端在重置时递增 {@code token_epoch} 以<b>吊销该用户全部在途会话</b>，
 * 所以这一步是「破坏性」的：文案必须提前说清楚，不能让管理员以为只是改个密码。</p>
 */

import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, Modal } from 'antd';
import { useState } from 'react';

import { resetUserPassword, type UserVO } from '@/services/system';

export interface ResetPasswordModalProps {
  open: boolean;
  record?: UserVO | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface ResetPasswordFormValues {
  newPassword: string;
  confirmPassword: string;
}

const ResetPasswordModal = ({
  open,
  record,
  onClose,
  onSuccess,
}: ResetPasswordModalProps) => {
  const [form] = Form.useForm<ResetPasswordFormValues>();
  const intl = useIntl();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!record) {
      return;
    }
    let values: ResetPasswordFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      await resetUserPassword(record.id, values.newPassword);
      message.success(intl.formatMessage({ id: 'system.resetPassword.message.done' }));
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
      title={intl.formatMessage(
        { id: 'system.resetPassword.title' },
        { name: record?.nickname ?? record?.username ?? '' },
      )}
      okText={intl.formatMessage({ id: 'system.resetPassword.ok' })}
      okButtonProps={{ danger: true }}
      cancelText={intl.formatMessage({ id: 'common.action.cancel' })}
      confirmLoading={submitting}
      onOk={handleSubmit}
      onCancel={onClose}
      maskClosable={false}
      width={480}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        title={intl.formatMessage({ id: 'system.resetPassword.alert.title' })}
        description={intl.formatMessage({ id: 'system.resetPassword.alert.desc' })}
      />
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="newPassword"
          label={intl.formatMessage({ id: 'system.resetPassword.field.newPassword' })}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'system.resetPassword.rule.newRequired' }),
            },
            {
              min: 8,
              max: 64,
              message: intl.formatMessage({ id: 'system.resetPassword.rule.length' }),
            },
          ]}
        >
          <Input.Password
            maxLength={64}
            autoComplete="new-password"
            placeholder={intl.formatMessage({ id: 'system.resetPassword.placeholder.password' })}
          />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label={intl.formatMessage({ id: 'system.resetPassword.field.confirmPassword' })}
          dependencies={['newPassword']}
          rules={[
            {
              required: true,
              message: intl.formatMessage({ id: 'system.resetPassword.rule.confirmRequired' }),
            },
            ({ getFieldValue }) => ({
              validator(_rule, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(
                  new Error(intl.formatMessage({ id: 'system.resetPassword.rule.mismatch' })),
                );
              },
            }),
          ]}
        >
          <Input.Password maxLength={64} autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ResetPasswordModal;
