/**
 * 创建外发分享弹窗（第 2 步页面 7）。
 *
 * <p>三个业务字段：有效期 / 提取码 / 下载次数上限；文件通过搜索选择（只列文件域分页里的文件）。</p>
 *
 * <p><b>提取码只进不出</b>：服务端立即 BCrypt 散列入库，任何查询接口都不回显。因此这里的默认值
 * 在打开时随机生成，且创建成功后由父页面立刻展示一次——错过这个窗口就再也拿不回来，
 * 只能撤销后重建。</p>
 *
 * <p>生命周期由父组件用「条件挂载」控制（关闭即卸载），这样每次打开都是全新表单，
 * 不需要依赖 Modal 的 destroyOnClose（该属性在 antd 5.25 起已更名）。</p>
 */

import { ModalForm, ProFormDigit, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import React, { useMemo } from 'react';

import {
  createShare,
  pageFiles,
  SHARE_EXPIRE_PRESETS,
  SHARE_LIMITS,
  type ShareLink,
  isValidExtractCode,
  randomExtractCode,
} from '@/services/file';
import { toBackendDateTime } from '@/utils/datetime';

interface CreateShareModalProps {
  /** 关闭弹窗（父组件据此卸载本组件） */
  onClose: () => void;
  /** 创建成功：链接元信息 + 本次明文提取码（只此一次可见） */
  onCreated: (link: ShareLink, extractCode: string) => void;
}

/** 表单字段（与 ProForm 的 name 对齐）。 */
interface CreateShareFormValues {
  fileId: number;
  expireDays: number;
  downloadLimit: number;
  extractCode: string;
}

const CreateShareModal: React.FC<CreateShareModalProps> = ({ onClose, onCreated }) => {
  const intl = useIntl();
  // 打开即随机一个提取码：可直接使用，也可改成便于口头转达的自定义码
  const defaultExtractCode = useMemo(() => randomExtractCode(), []);

  return (
    <ModalForm<CreateShareFormValues>
      title={intl.formatMessage({ id: 'shares.create.title' })}
      open
      width={520}
      modalProps={{ onCancel: onClose, maskClosable: false }}
      initialValues={{
        expireDays: SHARE_LIMITS.defaultExpireDays,
        downloadLimit: SHARE_LIMITS.defaultDownloadLimit,
        extractCode: defaultExtractCode,
      }}
      onFinish={async (values) => {
        const extractCode = values.extractCode.trim();
        const link = await createShare({
          fileId: values.fileId,
          extractCode,
          downloadLimit: values.downloadLimit,
          // 后端要 LocalDateTime（不带时区）：天数 → 绝对到期时刻由前端算好再交给 toBackendDateTime
          expireAt: toBackendDateTime(new Date(Date.now() + values.expireDays * 86_400_000)),
        });
        onCreated(link, extractCode);
        return true;
      }}
    >
      <ProFormSelect
        name="fileId"
        label={intl.formatMessage({ id: 'shares.create.file' })}
        placeholder={intl.formatMessage({
          id: 'shares.create.filePlaceholder',
        })}
        showSearch
        rules={[
          {
            required: true,
            message: intl.formatMessage({ id: 'shares.create.fileRequired' }),
          },
        ]}
        // 文件域分页参数是 current/pageSize（NodeQuery），与分享域的 page/size 不同口径
        params={{ current: 1, pageSize: 20 }}
        request={async (params) => {
          const keyword = (params as { keyword?: string } | undefined)?.keyword?.trim();
          const page = await pageFiles({ current: 1, pageSize: 20, keyword });
          return page.records.map((node) => ({ label: node.name, value: node.id }));
        }}
        fieldProps={{
          filterOption: false,
          notFoundContent: intl.formatMessage({
            id: 'shares.create.fileNotFound',
          }),
        }}
      />

      <ProFormSelect
        name="expireDays"
        label={intl.formatMessage({ id: 'shares.create.expire' })}
        options={SHARE_EXPIRE_PRESETS.map((days) => ({
          value: days,
          label: intl.formatMessage({ id: 'file.share.presetDays' }, { days }),
        }))}
        rules={[
          {
            required: true,
            message: intl.formatMessage({ id: 'shares.create.expireRequired' }),
          },
        ]}
        extra={intl.formatMessage(
          { id: 'shares.create.expireExtra' },
          { days: SHARE_LIMITS.maxExpireDays },
        )}
      />

      <ProFormDigit
        name="downloadLimit"
        label={intl.formatMessage({ id: 'shares.create.downloadLimit' })}
        min={1}
        max={SHARE_LIMITS.maxDownloadLimit}
        rules={[
          {
            required: true,
            message: intl.formatMessage({
              id: 'shares.create.downloadLimitRequired',
            }),
          },
        ]}
        fieldProps={{ precision: 0 }}
        extra={intl.formatMessage(
          { id: 'shares.create.downloadLimitExtra' },
          { max: SHARE_LIMITS.maxDownloadLimit },
        )}
      />

      <ProFormText
        name="extractCode"
        label={intl.formatMessage({ id: 'shares.create.extractCode' })}
        rules={[
          {
            required: true,
            message: intl.formatMessage({
              id: 'shares.create.extractCodeRequired',
            }),
          },
          {
            validator: async (_rule, value?: string) => {
              if (isValidExtractCode(value)) {
                return;
              }
              throw new Error(
                intl.formatMessage(
                  { id: 'shares.create.extractCodeRule' },
                  {
                    min: SHARE_LIMITS.extractCodeMin,
                    max: SHARE_LIMITS.extractCodeMax,
                  },
                ),
              );
            },
          },
        ]}
        extra={intl.formatMessage({ id: 'shares.create.extractCodeExtra' })}
        fieldProps={{ maxLength: SHARE_LIMITS.extractCodeMax, autoComplete: 'off' }}
      />
    </ModalForm>
  );
};

export default CreateShareModal;
