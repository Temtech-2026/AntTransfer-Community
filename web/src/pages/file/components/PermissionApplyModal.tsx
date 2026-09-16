/**
 * 申请权限弹窗：权限类型 / 使用目的 / 期望有效期 + 敏感等级提示。
 *
 * <p>为什么要有「敏感等级提示」：密级不仅决定审批链路长短，还决定**能批什么**。
 * 机密级文件即使审批通过也不会拿到下载与外发能力，若不提前告知，用户会按「申请下载」
 * 提交、被拒后又反复提，白跑审批。因此这里按密级给出明确预期，并把密级随申请一并提交，
 * 供审批链路直接判定层级（而不是审批人自己去查文件密级）。</p>
 */

import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  message,
  Radio,
  Result,
  Space,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';

import {
  APPLY_TYPE_OPTIONS,
  type ApplyType,
  type ApprovalRequest,
  type FileNode,
  levelApplyHint,
  levelColor,
  levelText,
  submitPermissionApplication,
} from '@/services/file';

const { Text } = Typography;

export interface PermissionApplyModalProps {
  open: boolean;
  node?: FileNode | null;
  onClose: () => void;
}

interface ApplyFormValues {
  applyType: ApplyType;
  purpose: string;
  desiredExpireAt?: Dayjs | null;
}

export default function PermissionApplyModal({
  open,
  node,
  onClose,
}: PermissionApplyModalProps) {
  const [form] = Form.useForm<ApplyFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ApprovalRequest | null>(null);

  /** 权限类型跟随表单实时变化：不同权限的风险与上限不同，提示要跟着变。 */
  const [applyType, setApplyType] = useState<ApplyType>('ACCESS');
  const activeHint = APPLY_TYPE_OPTIONS.find(
    (item) => item.value === applyType,
  )?.hint;

  const handleSubmit = async () => {
    if (!node) {
      return;
    }
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const result = await submitPermissionApplication({
        applyType: values.applyType,
        resourceType: 'FILE',
        resourceId: node.id,
        level: node.level ?? undefined,
        purpose: values.purpose.trim(),
        desiredExpireAt: values.desiredExpireAt
          ? values.desiredExpireAt.format('YYYY-MM-DD HH:mm:ss')
          : undefined,
      });
      setSubmitted(result);
    } catch (error) {
      message.error((error as Error)?.message || '提交申请失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="申请文件权限"
      width={560}
      onCancel={onClose}
      destroyOnClose
      afterOpenChange={(visible) => {
        if (visible) {
          form.resetFields();
          form.setFieldsValue({ applyType: 'ACCESS' });
          setApplyType('ACCESS');
          setSubmitted(null);
        }
      }}
      footer={
        submitted
          ? [
              <Button key="done" type="primary" onClick={onClose}>
                知道了
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onClose}>
                取消
              </Button>,
              <Button
                key="submit"
                type="primary"
                loading={submitting}
                onClick={handleSubmit}
              >
                提交申请
              </Button>,
            ]
      }
    >
      {submitted ? (
        <Result
          status="success"
          title="申请已提交"
          subTitle={`申请单号：${submitted.applicationNo ?? submitted.id}，可在「我的申请」中查看进度`}
          extra={
            <Text type="secondary">
              审批通过后权限自动生效，无需重复提交；被驳回时可查看审批意见后补充说明再提。
            </Text>
          }
        />
      ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={{ applyType: 'ACCESS' }}
        >
          <Descriptions column={1} size="small" style={{ marginBottom: 12 }}>
            <Descriptions.Item label="申请文件">
              <Text ellipsis style={{ maxWidth: 320 }}>
                {node?.name ?? '-'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="文件密级">
              <Tag color={levelColor(node?.level)}>
                {levelText(node?.level)}
              </Tag>
            </Descriptions.Item>
          </Descriptions>

          {/* 密级提示：把「这个密级能批到什么程度」提前说清楚 */}
          <Alert
            style={{ marginBottom: 12 }}
            type={
              node?.level === 3
                ? 'error'
                : node?.level === 2
                  ? 'warning'
                  : 'info'
            }
            showIcon
            title="敏感等级提示"
            description={levelApplyHint(node?.level)}
          />

          <Form.Item
            name="applyType"
            label="权限类型"
            rules={[{ required: true, message: '请选择权限类型' }]}
          >
            <Radio.Group
              onChange={(event) =>
                setApplyType(event.target.value as ApplyType)
              }
              options={APPLY_TYPE_OPTIONS.map((item) => ({
                label: item.label,
                value: item.value,
              }))}
            />
          </Form.Item>
          {activeHint ? (
            <div style={{ marginTop: -8, marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {activeHint}
              </Text>
            </div>
          ) : null}

          <Form.Item
            name="purpose"
            label="使用目的"
            rules={[
              { required: true, message: '请填写使用目的' },
              { min: 10, message: '请至少填写 10 个字，便于审批人判断' },
              { max: 500, message: '最多 500 个字' },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="例如：用于季度经营分析报告的数据核对，仅本人使用，不外发"
            />
          </Form.Item>

          <Form.Item
            name="desiredExpireAt"
            label="期望有效期"
            extra="留空表示申请长期权限（更难过审）；建议按实际需要填写，到期自动回收"
          >
            <DatePicker
              showTime
              style={{ width: 260 }}
              // 不允许选过去时间：服务端会以参数非法拒绝
              disabledDate={(current) =>
                current && current < dayjs().startOf('day')
              }
              placeholder="选择到期时间"
            />
          </Form.Item>

          <Space size={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              提交后申请人身份、申请时间由服务端记录，不可代他人申请。
            </Text>
          </Space>
        </Form>
      )}
    </Modal>
  );
}
