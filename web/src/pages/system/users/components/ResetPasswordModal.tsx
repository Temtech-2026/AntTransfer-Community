/**
 * 管理员重置口令弹窗（{@code POST /api/v1/system/users/{id}/reset-password}）。
 *
 * <p>后端在重置时递增 {@code token_epoch} 以<b>吊销该用户全部在途会话</b>，
 * 所以这一步是「破坏性」的：文案必须提前说清楚，不能让管理员以为只是改个密码。</p>
 */

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
      message.success('口令已重置，该用户全部在途会话已失效');
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
      title={`重置口令 · ${record?.nickname ?? record?.username ?? ''}`}
      okText="确认重置"
      okButtonProps={{ danger: true }}
      cancelText="取消"
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
        title="重置后该用户全部在途会话立即失效"
        description="用户需用新口令重新登录；管理员无法查看原口令（库中只存散列）。"
      />
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="newPassword"
          label="新口令"
          rules={[
            { required: true, message: '请输入新口令' },
            { min: 8, max: 64, message: '口令长度须为 8~64 位' },
          ]}
        >
          <Input.Password maxLength={64} autoComplete="new-password" placeholder="8~64 位" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="确认新口令"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新口令' },
            ({ getFieldValue }) => ({
              validator(_rule, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的口令不一致'));
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
