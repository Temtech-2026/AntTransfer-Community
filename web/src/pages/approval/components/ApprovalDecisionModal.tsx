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

import { useIntl } from '@umijs/max';
import { Alert, App, DatePicker, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import {
  OPINION_MAX_LENGTH,
  actionLabelId,
  approveApplication,
  capExpireAt,
  downscopeOptionsOf,
  isDownscope,
  rejectApplication,
} from '@/services/approval';
import type { ApprovalApplication, ApplyAction } from '@/services/approval';
import { levelColor, levelTextId } from '@/services/file';
import { isErrorHandledByRequestLayer } from '@/utils/result';

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
  const intl = useIntl();
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
        message.success(intl.formatMessage({ id: 'approval.modal.approved' }));
      } else {
        await rejectApplication(application.id, {
          opinion: (values.opinion ?? '').trim(),
        });
        message.success(intl.formatMessage({ id: 'approval.modal.rejected' }));
      }
      onSuccess();
    } catch (error) {
      // 业务错误（如 2001 参数越界、状态已变更）已由全局错误链路提示一次
      // （见 requestErrorConfig 的 errorHandler），这里只兜底不经 request 通道的同步异常——
      // 否则同一句话会弹两遍，用户会误以为决策已提交
      if (!isErrorHandledByRequestLayer(error)) {
        message.error(
          (error as Error)?.message ||
            intl.formatMessage({
              id: isApprove ? 'approval.modal.approveFailed' : 'approval.modal.rejectFailed',
            }),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const downscoped = isDownscope(applyType, grantType ?? undefined);
  const cappedExpire = expireAt ? capExpireAt(toBackendDateTime(expireAt), desiredExpireAt) : null;
  const expireCapped =
    cappedExpire !== null && cappedExpire !== toBackendDateTime(expireAt);
  const opinionMaxMessage = intl.formatMessage(
    { id: 'approval.modal.opinionMax' },
    { max: OPINION_MAX_LENGTH },
  );

  return (
    <Modal
      open={open}
      title={intl.formatMessage({
        id: isApprove ? 'approval.modal.approveTitle' : 'approval.modal.rejectTitle',
      })}
      okText={intl.formatMessage({
        id: isApprove ? 'approval.modal.approveOk' : 'approval.modal.rejectOk',
      })}
      okButtonProps={{ danger: !isApprove }}
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => void handleSubmit()}
      destroyOnHidden
      width={560}
    >
      {application ? (
        <Space orientation="vertical" size={4} style={{ marginBottom: 12 }}>
          <Text type="secondary">
            {intl.formatMessage(
              { id: 'approval.modal.applicationNo' },
              { no: application.applicationNo || `#${application.id}` },
            )}
          </Text>
          <Space size={6} wrap>
            <Tag color="blue">
              {intl.formatMessage(
                { id: 'approval.modal.applyScope' },
                { action: intl.formatMessage({ id: actionLabelId(application.applyType) }) },
              )}
            </Tag>
            <Tag color={levelColor(application.level)}>
              {intl.formatMessage({ id: levelTextId(application.level) })}
            </Tag>
            <Text type="secondary">
              {intl.formatMessage(
                { id: 'approval.modal.desiredExpireAt' },
                {
                  at:
                    application.desiredExpireAt ||
                    intl.formatMessage({ id: 'approval.longTerm' }),
                },
              )}
            </Text>
          </Space>
        </Space>
      ) : null}

      <Form form={form} layout="vertical">
        {isApprove ? (
          <>
            <Form.Item
              name="grantType"
              label={intl.formatMessage({ id: 'approval.modal.grantScope' })}
              extra={
                downscoped
                  ? intl.formatMessage(
                      { id: 'approval.modal.grantScopeDownscoped' },
                      { action: intl.formatMessage({ id: actionLabelId(applyType) }) },
                    )
                  : intl.formatMessage({ id: 'approval.modal.grantScopeSame' })
              }
            >
              <Select
                options={downscopeOptionsOf(applyType).map((action) => ({
                  value: action,
                  label: intl.formatMessage({ id: actionLabelId(action) }),
                }))}
                onChange={(value) => setGrantType(value)}
                placeholder={intl.formatMessage({ id: 'approval.modal.grantScopePlaceholder' })}
              />
            </Form.Item>

            <Form.Item
              name="expireAt"
              label={intl.formatMessage({ id: 'approval.modal.expireAt' })}
              extra={
                expireCapped
                  ? intl.formatMessage(
                      { id: 'approval.modal.expireCapped' },
                      { expireAt: cappedExpire },
                    )
                  : intl.formatMessage({ id: 'approval.modal.expireKeep' })
              }
            >
              <DatePicker
                showTime
                style={{ width: '100%' }}
                placeholder={intl.formatMessage({ id: 'approval.modal.expirePlaceholder' })}
                // 只放行不晚于「申请人期望到期」的日期；期望为空（长期）时不设上限
                disabledDate={(current) => (desired ? current.isAfter(desired, 'day') : false)}
                onChange={(value) => setExpireAt(value)}
              />
            </Form.Item>
          </>
        ) : null}

        <Form.Item
          name="opinion"
          label={intl.formatMessage({
            id: isApprove ? 'approval.modal.opinionApprove' : 'approval.modal.opinionReject',
          })}
          rules={
            isApprove
              ? [{ max: OPINION_MAX_LENGTH, message: opinionMaxMessage }]
              : [
                  {
                    required: true,
                    whitespace: true,
                    message: intl.formatMessage({ id: 'approval.modal.opinionRequired' }),
                  },
                  { max: OPINION_MAX_LENGTH, message: opinionMaxMessage },
                ]
          }
        >
          <Input.TextArea
            rows={3}
            showCount
            maxLength={OPINION_MAX_LENGTH}
            placeholder={intl.formatMessage({
              id: isApprove
                ? 'approval.modal.opinionPlaceholderApprove'
                : 'approval.modal.opinionPlaceholderReject',
            })}
          />
        </Form.Item>
      </Form>

      {isApprove ? (
        <Alert
          type="info"
          showIcon
          title={intl.formatMessage({ id: 'approval.modal.notice' })}
        />
      ) : null}
    </Modal>
  );
};

export default ApprovalDecisionModal;
