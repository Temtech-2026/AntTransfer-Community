/**
 * 附件用途限制选择器（发送方在发出带附件的消息前设定三轴限制）。
 *
 * <h3>为什么做成弹出层而不是发送前的必填弹窗</h3>
 * <p>绝大多数附件用默认档位即可，做成必填弹窗会打断「拖文件 → 发送」这条主路径。
 * 因此默认值直接随附件带出（可下载 / 7 天 / 不限次），想收紧的人再点开改。</p>
 *
 * <h3>为什么限制由服务端落库而不是写进消息正文</h3>
 * <p>正文尾注只带授权 ID（`#att:{id}`）。若把「仅预览」写进正文，接收方改一个字段就能绕过——
 * 限制必须存在保存方改不动的地方。这里只是把发送方的选择提交给服务端。</p>
 *
 * <h3>三轴是累进的，不是三个独立开关</h3>
 * <p>档位决定「能做什么」，有效期与次数决定「多久 / 几次」。仅预览档位下次数无意义，
 * 故该档位下次数选择被禁用并显式说明原因，而不是留一个改了也没用的控件。</p>
 */

import { SettingOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Button, Popover, Radio, Select, Space, Typography } from 'antd';
import React from 'react';

import {
  CHAT_ATTACHMENT_USAGE_MODE,
  type ChatAttachmentPolicy,
  type ChatAttachmentUsageMode,
} from '@/services/file/chatAttachment';

/** 默认限制：可下载 / 7 天 / 不限次——宽松但可撤回，符合「同事间传文件」的默认预期。 */
export const DEFAULT_CHAT_ATTACHMENT_POLICY: ChatAttachmentPolicy = {
  usageMode: CHAT_ATTACHMENT_USAGE_MODE.DOWNLOADABLE,
  expireHours: 168,
  downloadLimit: 0,
};

/** 有效期选项（小时）；`null` 表示不限期，单独用 `neverExpire` 表达。 */
const EXPIRE_HOUR_OPTIONS = [24, 168, 720] as const;

/** 下载次数上限选项（0 = 不限次）。 */
const DOWNLOAD_LIMIT_OPTIONS = [0, 1, 5, 10] as const;

const USAGE_LABEL_ID: Record<number, string> = {
  [CHAT_ATTACHMENT_USAGE_MODE.PREVIEW_ONLY]: 'chat.attach.usage.previewOnly',
  [CHAT_ATTACHMENT_USAGE_MODE.DOWNLOADABLE]: 'chat.attach.usage.downloadable',
  [CHAT_ATTACHMENT_USAGE_MODE.RESAVABLE]: 'chat.attach.usage.resavable',
};

const USAGE_DESC_ID: Record<number, string> = {
  [CHAT_ATTACHMENT_USAGE_MODE.PREVIEW_ONLY]: 'chat.attach.usage.previewOnly.desc',
  [CHAT_ATTACHMENT_USAGE_MODE.DOWNLOADABLE]: 'chat.attach.usage.downloadable.desc',
  [CHAT_ATTACHMENT_USAGE_MODE.RESAVABLE]: 'chat.attach.usage.resavable.desc',
};

export interface ChatAttachmentPolicyPickerProps {
  /** 当前限制（受控） */
  value: ChatAttachmentPolicy;
  /** 变更回调（整体替换，不做字段级合并） */
  onChange: (next: ChatAttachmentPolicy) => void;
  /** 发送中禁用，避免与正在进行的发送竞态 */
  disabled?: boolean;
}

/**
 * 把三轴渲染成一行摘要（如 `可下载 · 7 天 · 不限次`）。
 *
 * <p>摘要必须让发送方<b>在不开弹层时也能看到</b>当前限制：默认值虽然宽松，
 * 但用户可能上一次改成了「仅预览」，若不在外露位置显示，他会以为对方能下载。</p>
 */
export function formatChatAttachmentPolicy(
  intl: ReturnType<typeof useIntl>,
  policy: ChatAttachmentPolicy,
): string {
  const parts: string[] = [
    intl.formatMessage({ id: USAGE_LABEL_ID[policy.usageMode] }),
  ];

  if (policy.neverExpire) {
    parts.push(intl.formatMessage({ id: 'chat.attach.expire.never' }));
  } else {
    parts.push(
      intl.formatMessage(
        { id: 'chat.attach.expire.days' },
        { days: Math.max(1, Math.round((policy.expireHours ?? 168) / 24)) },
      ),
    );
  }

  // 仅预览档位下次数不参与判定，摘要里也不提，避免给出「限 5 次」这种无效承诺
  if (policy.usageMode !== CHAT_ATTACHMENT_USAGE_MODE.PREVIEW_ONLY) {
    parts.push(
      policy.downloadLimit
        ? intl.formatMessage(
            { id: 'chat.attach.limit.times' },
            { count: policy.downloadLimit },
          )
        : intl.formatMessage({ id: 'chat.attach.limit.unlimited' }),
    );
  }

  return parts.join(' · ');
}

const ChatAttachmentPolicyPicker: React.FC<
  ChatAttachmentPolicyPickerProps
> = ({ value, onChange, disabled }) => {
  const intl = useIntl();
  const limitDisabled =
    value.usageMode === CHAT_ATTACHMENT_USAGE_MODE.PREVIEW_ONLY;

  const content = (
    <Space direction="vertical" size={12} style={{ width: 320 }}>
      <div>
        <Typography.Text strong>
          {intl.formatMessage({ id: 'chat.attach.policy.usage.label' })}
        </Typography.Text>
        <Radio.Group
          style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}
          value={value.usageMode}
          onChange={(event) =>
            onChange({ ...value, usageMode: event.target.value as ChatAttachmentUsageMode })
          }
        >
          {(
            [
              CHAT_ATTACHMENT_USAGE_MODE.PREVIEW_ONLY,
              CHAT_ATTACHMENT_USAGE_MODE.DOWNLOADABLE,
              CHAT_ATTACHMENT_USAGE_MODE.RESAVABLE,
            ] as const
          ).map((mode) => (
            <Radio key={mode} value={mode}>
              <span>{intl.formatMessage({ id: USAGE_LABEL_ID[mode] })}</span>
              <Typography.Text
                type="secondary"
                style={{ display: 'block', fontSize: 12 }}
              >
                {intl.formatMessage({ id: USAGE_DESC_ID[mode] })}
              </Typography.Text>
            </Radio>
          ))}
        </Radio.Group>
      </div>

      <div>
        <Typography.Text strong>
          {intl.formatMessage({ id: 'chat.attach.policy.expire.label' })}
        </Typography.Text>
        <Select
          style={{ width: '100%', marginTop: 6 }}
          value={value.neverExpire ? 'never' : String(value.expireHours ?? 168)}
          onChange={(next) =>
            onChange(
              next === 'never'
                ? { ...value, neverExpire: true }
                : {
                    ...value,
                    neverExpire: false,
                    expireHours: Number(next),
                  },
            )
          }
          options={[
            ...EXPIRE_HOUR_OPTIONS.map((hours) => ({
              value: String(hours),
              label: intl.formatMessage(
                { id: 'chat.attach.expire.days' },
                { days: hours / 24 },
              ),
            })),
            {
              value: 'never',
              label: intl.formatMessage({ id: 'chat.attach.expire.never' }),
            },
          ]}
        />
      </div>

      <div>
        <Typography.Text strong>
          {intl.formatMessage({ id: 'chat.attach.policy.limit.label' })}
        </Typography.Text>
        <Select
          style={{ width: '100%', marginTop: 6 }}
          disabled={limitDisabled}
          value={value.downloadLimit ?? 0}
          onChange={(next) => onChange({ ...value, downloadLimit: next })}
          options={DOWNLOAD_LIMIT_OPTIONS.map((limit) => ({
            value: limit,
            label: limit
              ? intl.formatMessage({ id: 'chat.attach.limit.times' }, { count: limit })
              : intl.formatMessage({ id: 'chat.attach.limit.unlimited' }),
          }))}
        />
        {limitDisabled && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {intl.formatMessage({ id: 'chat.attach.policy.limit.disabledHint' })}
          </Typography.Text>
        )}
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {intl.formatMessage({ id: 'chat.attach.policy.footnote' })}
      </Typography.Text>
    </Space>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="topLeft"
      title={intl.formatMessage({ id: 'chat.attach.policy.title' })}
    >
      <Button
        type="text"
        size="small"
        icon={<SettingOutlined />}
        disabled={disabled}
        aria-label={intl.formatMessage({ id: 'chat.attach.policy.trigger' })}
      >
        {formatChatAttachmentPolicy(intl, value)}
      </Button>
    </Popover>
  );
};

export default ChatAttachmentPolicyPicker;
