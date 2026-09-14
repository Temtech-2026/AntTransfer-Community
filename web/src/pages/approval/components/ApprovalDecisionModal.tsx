/**
 * 审批决策弹窗（通过 / 驳回）。
 *
 * <p><b>通过</b>支持两个收敛动作，且都只在**收紧方向**上可操作：
 * ① 缩范围——只能选不超过申请动作强度的授权动作（`downscopeOptionsOf`）；
 * ② 缩效期——所选到期时刻晚于申请人期望时，提交前用 `capExpireAt` 收敛回期望值。
 * 两者都是「前端把非法输入挡在门外」的体验优化：后端对放大行为会返回参数越界（2001），
 * 这里提前收敛只是为了不让用户白填一遍。
 *
 * <p><b>驳回</b>理由必填（后端 `ApplicationRejectDTO.opinion` 为 `@NotBlank`）。
 */

import { Alert, App, DatePicker, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import {
  OPINION_MAX_LENGTH,
  actionLabel,
  approveApplication,
  capExpireAt,
  downscopeOptionsOf,
  isDownscope,
  rejectApplication,
} from '@/services/approval';
import type { ApprovalApplication, ApplyAction } from '@/services/approval';
import { levelColor, levelText } from '@/services/file';

const { Text } = Typography;

/** 决策弹窗形态。 */
export type DecisionMode = 'approve' | 'reject';

export interface ApprovalDecisionModalProps {
  open: boolean;
  mode: DecisionMode;
  application: ApprovalApplication | null;
  onCancel: () => void;
  /** 决策成功（用于刷新列表） */
  onSuccess: () => void;
}

interface DecisionFormValues {
  grantType?: ApplyAction;
  expireAt?: Dayjs | null;
  opinion?: string;
}

/** 后端 `LocalDateTime` 的入参格式（不带时区，与列表回显格式一致）。 */
function toBackendDateTime(value?: Dayjs | null): string | null {
  return value ? value.format('YYYY-MM-DDTHH:mm:ss') : null;
}

export const ApprovalDecisionModal = ({
  open,
  mode,
  application,
  onCancel,
  onSuccess,
}: ApprovalDecisionModalProps) => {
  const [form] = Form.useForm<DecisionFormValues>();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  // 供「缩范围 / 缩效期」提示实时回显
  const [grantType, setGrantType] = useState<ApplyAction | undefined>();
  const [expireAt, setExpireAt] = useState<Dayjs | null>(null);

  const isApprove = mode === 'approve';
  const applyType = application?.applyType ?? null;
  const desiredExpireAt = application?.desiredExpireAt ?? null;
  const desired = desiredExpireAt ? dayjs(desiredExpireAt) : null;

  useEffect(() => {
    if (!open || !application) {
      return;
    }
    // 默认值 = 申请原值：不调整就是「原样通过」，减少一次必填交互
    const initialGrant = (application.applyType as ApplyAction | undefined) ?? undefined;
    const initialExpire = desiredExpireAt ? dayjs(desiredExpireAt) : null;
    form.setFieldsValue({
      grantType: initialGrant,
      expireAt: initialExpire,
      opinion: undefined,
    });
    setGrantType(initialGrant);
    setExpireAt(initialExpire);
  }, [open, application, desiredExpireAt, form]);

  const handleSubmit = async () => {
    if (!application) {
      return;
    }
    let values: DecisionFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验失败：antd 已在字段下方提示
    }
    setSubmitting(true);
    try {
      if (isApprove) {
        // 提交前再收敛一次：disabledDate 只能挡到「日」，挡不住「同日晚于期望时刻」
        const chosen = toBackendDateTime(values.expireAt);
        const finalExpire = capExpireAt(chosen, desiredExpireAt);
        await approveApplication(application.id, {
          grantType: values.grantType,
          expireAt: finalExpire,
          opinion: values.opinion?.trim() || undefined,
        });
        message.success('已通过该申请');
      } else {
        await rejectApplication(application.id, {
          opinion: (values.opinion ?? '').trim(),
        });
        message.success('已驳回该申请');
      }
      onSuccess();
    } catch (error) {
      // 业务错误（如 2001 参数越界、状态已变更）由全局拦截器提示，这里兜底非 Result 形态异常
      message.error((error as Error)?.message || (isApprove ? '审批通过失败' : '驳回失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const downscoped = isDownscope(applyType, grantType ?? undefined);
  const cappedExpire = expireAt ? capExpireAt(toBackendDateTime(expireAt), desiredExpireAt) : null;
  const expireCapped =
    cappedExpire !== null && cappedExpire !== toBackendDateTime(expireAt);

  return (
    <Modal
      open={open}
      title={isApprove ? '审批通过' : '驳回申请'}
      okText={isApprove ? '确认通过' : '确认驳回'}
      okButtonProps={{ danger: !isApprove }}
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => void handleSubmit()}
      destroyOnClose
      width={560}
    >
      {application ? (
        <Space direction="vertical" size={4} style={{ marginBottom: 12 }}>
          <Text type="secondary">申请单号：{application.applicationNo || `#${application.id}`}</Text>
          <Space size={6} wrap>
            <Tag color="blue">申请：{actionLabel(application.applyType)}</Tag>
            <Tag color={levelColor(application.level)}>{levelText(application.level)}</Tag>
            <Text type="secondary">
              期望到期：{application.desiredExpireAt || '长期有效'}
            </Text>
          </Space>
        </Space>
      ) : null}

      <Form form={form} layout="vertical">
        {isApprove ? (
          <>
            <Form.Item
              name="grantType"
              label="授权范围（只能收紧，不能超过申请范围）"
              extra={
                downscoped
                  ? `低于申请动作「${actionLabel(applyType)}」——将按更小范围授权`
                  : '与申请范围一致'
              }
            >
              <Select
                options={downscopeOptionsOf(applyType).map((action) => ({
                  value: action,
                  label: actionLabel(action),
                }))}
                onChange={(value) => setGrantType(value)}
                placeholder="选择授权动作"
              />
            </Form.Item>

            <Form.Item
              name="expireAt"
              label="授权有效期（只能缩短，不能超过申请值）"
              extra={
                expireCapped
                  ? `所选时间晚于申请人期望，将收敛为 ${cappedExpire}`
                  : '留空表示长期有效'
              }
            >
              <DatePicker
                showTime
                style={{ width: '100%' }}
                placeholder="留空 = 长期有效"
                // 只放行不晚于「申请人期望到期」的日期；期望为空（长期）时不设上限
                disabledDate={(current) => (desired ? current.isAfter(desired, 'day') : false)}
                onChange={(value) => setExpireAt(value)}
              />
            </Form.Item>
          </>
        ) : null}

        <Form.Item
          name="opinion"
          label={isApprove ? '审批意见（可选）' : '驳回原因（必填）'}
          rules={
            isApprove
              ? [{ max: OPINION_MAX_LENGTH, message: `不超过 ${OPINION_MAX_LENGTH} 字` }]
              : [
                  { required: true, whitespace: true, message: '请填写驳回原因' },
                  { max: OPINION_MAX_LENGTH, message: `不超过 ${OPINION_MAX_LENGTH} 字` },
                ]
          }
        >
          <Input.TextArea
            rows={3}
            showCount
            maxLength={OPINION_MAX_LENGTH}
            placeholder={isApprove ? '可补充说明授权条件' : '说明驳回理由，将同步给申请人'}
          />
        </Form.Item>
      </Form>

      {isApprove ? (
        <Alert
          type="info"
          showIcon
          title="通过后立即生效：授权范围与有效期均不可放宽，如需放宽须由申请人重新提交。"
        />
      ) : null}
    </Modal>
  );
};

export default ApprovalDecisionModal;
