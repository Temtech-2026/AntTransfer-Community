/**
 * 申请权限弹窗：权限类型 / 使用目的 / 期望有效期 + 敏感等级提示。
 *
 * <p>为什么要有「敏感等级提示」：密级不仅决定审批链路长短，还决定**能批什么**。
 * 机密级文件即使审批通过也不会拿到下载与外发能力，若不提前告知，用户会按「申请下载」
 * 提交、被拒后又反复提，白跑审批。因此这里按密级给出明确预期，并把密级随申请一并提交，
 * 供审批链路直接判定层级（而不是审批人自己去查文件密级）。</p>
 */

import { useIntl } from '@umijs/max';
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
  levelApplyHintId,
  levelColor,
  levelTextId,
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
  const intl = useIntl();
  const [form] = Form.useForm<ApplyFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ApprovalRequest | null>(null);

  /** 权限类型跟随表单实时变化：不同权限的风险与上限不同，提示要跟着变。 */
  const [applyType, setApplyType] = useState<ApplyType>('ACCESS');
  const activeHintId = APPLY_TYPE_OPTIONS.find(
    (item) => item.value === applyType,
  )?.hintId;

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
      message.error(
        (error as Error)?.message ||
          intl.formatMessage({ id: 'file.apply.submitFailed' }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={intl.formatMessage({ id: 'file.apply.title' })}
      width={560}
      onCancel={onClose}
      destroyOnHidden
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
                {intl.formatMessage({ id: 'common.action.gotIt' })}
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onClose}>
                {intl.formatMessage({ id: 'common.action.cancel' })}
              </Button>,
              <Button
                key="submit"
                type="primary"
                loading={submitting}
                onClick={handleSubmit}
              >
                {intl.formatMessage({ id: 'file.apply.submit' })}
              </Button>,
            ]
      }
    >
      {submitted ? (
        <Result
          status="success"
          title={intl.formatMessage({ id: 'file.apply.submittedTitle' })}
          subTitle={intl.formatMessage(
            { id: 'file.apply.submittedSubTitle' },
            { no: submitted.applicationNo ?? submitted.id },
          )}
          extra={
            <Text type="secondary">
              {intl.formatMessage({ id: 'file.apply.submittedExtra' })}
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
            <Descriptions.Item
              label={intl.formatMessage({ id: 'file.apply.field.file' })}
            >
              <Text ellipsis style={{ maxWidth: 320 }}>
                {node?.name ?? '-'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item
              label={intl.formatMessage({ id: 'file.apply.field.level' })}
            >
              <Tag color={levelColor(node?.level)}>
                {intl.formatMessage({ id: levelTextId(node?.level) })}
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
            title={intl.formatMessage({ id: 'file.apply.levelAlertTitle' })}
            description={intl.formatMessage({
              id: levelApplyHintId(node?.level),
            })}
          />

          <Form.Item
            name="applyType"
            label={intl.formatMessage({ id: 'file.apply.field.applyType' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({
                  id: 'file.apply.field.applyTypeRequired',
                }),
              },
            ]}
          >
            <Radio.Group
              onChange={(event) =>
                setApplyType(event.target.value as ApplyType)
              }
              options={APPLY_TYPE_OPTIONS.map((item) => ({
                label: intl.formatMessage({ id: item.labelId }),
                value: item.value,
              }))}
            />
          </Form.Item>
          {activeHintId ? (
            <div style={{ marginTop: -8, marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {intl.formatMessage({ id: activeHintId })}
              </Text>
            </div>
          ) : null}

          <Form.Item
            name="purpose"
            label={intl.formatMessage({ id: 'file.apply.field.purpose' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({
                  id: 'file.apply.field.purposeRequired',
                }),
              },
              {
                min: 10,
                message: intl.formatMessage({
                  id: 'file.apply.field.purposeMin',
                }),
              },
              {
                max: 500,
                message: intl.formatMessage({
                  id: 'file.apply.field.purposeMax',
                }),
              },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder={intl.formatMessage({
                id: 'file.apply.field.purposePlaceholder',
              })}
            />
          </Form.Item>

          <Form.Item
            name="desiredExpireAt"
            label={intl.formatMessage({ id: 'file.apply.field.expireAt' })}
            extra={intl.formatMessage({ id: 'file.apply.field.expireAtExtra' })}
          >
            <DatePicker
              showTime
              style={{ width: 260 }}
              // 不允许选过去时间：服务端会以参数非法拒绝
              disabledDate={(current) =>
                current && current < dayjs().startOf('day')
              }
              placeholder={intl.formatMessage({
                id: 'file.apply.field.expireAtPlaceholder',
              })}
            />
          </Form.Item>

          <Space size={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {intl.formatMessage({ id: 'file.apply.footnote' })}
            </Text>
          </Space>
        </Form>
      )}
    </Modal>
  );
}
