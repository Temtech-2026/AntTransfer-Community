/**
 * 外发分享访客取件页（`/share/:token`，<b>免登录</b>）。
 *
 * <p>这条路径正是「复制分享链接 → 在浏览器里打开」的落点：创建者复制的
 * `{origin}/share/{token}` 必须在这里被接住。它不属于管理端任何一屏——访客没有账号、
 * 没有菜单，只有一个链接和一句提取码。因此本页：</p>
 * <ul>
 *   <li>走 `layout: false`，不渲染侧边栏 / 顶栏，也不参与权限判定
 *       （公开路径口径见 `services/access/public-paths.ts`）；</li>
 *   <li>三步式取件：`verify`（令牌 + 提取码换一次性票据）→ `redeem`（核销换元信息 + 取件票）
 *       → 浏览器原生 `<a href>` 拉 `content`（凭取件票取字节，支持断点续传）；</li>
 *   <li>只在用户点「提取文件」时提交，<b>不自动提交</b>：核销即扣减下载次数，
 *       若因自动重试而重复核销，就是白白吃掉访客的取件额度；</li>
 *   <li>创建者「复制链接和提取码」复制出的是一条带 `#code=xxx` 的单行链接，
 *       本页从 fragment 读回提取码并<b>预填</b>进输入框（见
 *       `services/file/types.ts` 的 `readShareCodeFromHash`）。预填 ≠ 代提交：
 *       访客仍要亲手点一次「提取文件」，额度只在他确认时消耗。</li>
 * </ul>
 *
 * <p><b>为什么提取成功后不自动触发下载</b>：自动下载会被部分浏览器的弹窗拦截策略吞掉，
 * 访客看到「提取成功」却没有任何文件落地，只会以为链接坏了；把下载交给一次明确的点击，
 * 成功与失败都有明确的因果。</p>
 */

import { DownloadOutlined, KeyOutlined } from '@ant-design/icons';
import { useIntl, useLocation, useParams } from '@umijs/max';
import { Alert, Button, ConfigProvider, Form, Input, Typography } from 'antd';
import React, { useMemo, useState } from 'react';

import { formatBytes } from '@/components/ChunkUpload';
import FlyingFilesBackground from '@/components/FlyingFilesBackground';
import { PUBLIC_DARK_THEME } from '@/components/PublicDarkTheme';

import {
  buildShareContentUrl,
  readShareCodeFromHash,
  redeemShareTicket,
  verifyShareTicket,
} from '@/services/file';
import type { SharePayload } from '@/services/file/types';
import { BizError } from '@/services/request';
import { DEFAULT_ERROR_MESSAGE_ID } from '@/utils/result';

import useStyles from './index.style';

/** 取件表单字段。 */
interface ExtractFormValues {
  extractCode: string;
}

const ShareVisitPage: React.FC = () => {
  const { styles } = useStyles();
  const intl = useIntl();
  const { token } = useParams<{ token?: string }>();
  // 创建者的「复制链接和提取码」把提取码拼在 fragment 上（`#code=xxx`），这里读回来预填。
  // 只预填、不代提交：核销即扣减取件次数，额度必须等访客亲手点一次「提取文件」再消耗。
  const { hash } = useLocation();
  const presetCode = useMemo(() => readShareCodeFromHash(hash), [hash]);

  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  /** 核销结果；非空即进入「可下载」态 */
  const [payload, setPayload] = useState<SharePayload | null>(null);

  const handleFinish = async (values: ExtractFormValues) => {
    if (!token) {
      return;
    }
    setSubmitting(true);
    setErrorText(null);
    try {
      // 先换一次性票据，再用它核销：两步都成功才算取件成立
      const ticket = await verifyShareTicket(token, {
        extractCode: values.extractCode.trim(),
        accessType: 'download',
      });
      setPayload(await redeemShareTicket(ticket.ticket));
    } catch (error) {
      const biz = error instanceof BizError ? error : undefined;
      // 4004 / 4010 / 4011 / 4040 都是业务语义明确的失败，直接把后端原文案给访客看
      // （改写成前端自造文案反而会丢掉「还差几次」「锁定到几点」这类关键信息）
      setErrorText(
        biz?.message ||
          (error as Error)?.message ||
          intl.formatMessage({ id: DEFAULT_ERROR_MESSAGE_ID }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className={styles.container}>
        <FlyingFilesBackground />
        <div className={styles.contentWrapper}>
          <ConfigProvider theme={PUBLIC_DARK_THEME}>
            <div className={styles.card}>
              <Alert
                type="error"
                showIcon
                title={intl.formatMessage({ id: 'shares.visit.invalidLink' })}
              />
            </div>
          </ConfigProvider>
        </div>
      </div>
    );
  }

  // 取件票有 TTL：过期后同一个下载地址会 4004，必须让访客提前知道要重新提取
  const contentUrl =
    payload?.contentTicket && payload.contentTicket.length > 0
      ? buildShareContentUrl(token, payload.contentTicket)
      : null;
  const ttlMinutes = payload?.expiresInSeconds
    ? Math.max(1, Math.floor(payload.expiresInSeconds / 60))
    : 5;

  return (
    <div className={styles.container}>
      <FlyingFilesBackground />

      <div className={styles.contentWrapper}>
        {/* 与登录页共用同一份暗色 token：访客见到的两屏应当是同一套视觉 */}
        <ConfigProvider theme={PUBLIC_DARK_THEME}>
          <div className={styles.card}>
            <div className={styles.brand}>
              {/* 装饰性图片：品牌名由下方标题承担，alt 留空避免读屏重复播报 */}
              <img className={styles.logo} src="/logo.svg" alt="" />
              <Typography.Title level={3} style={{ marginBottom: 8 }}>
                AntTransfer
              </Typography.Title>
              <Typography.Text type="secondary">
                {intl.formatMessage({ id: 'shares.visit.subtitle' })}
              </Typography.Text>
            </div>

            {errorText ? (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                title={errorText}
              />
            ) : null}

            {payload && contentUrl ? (
              <>
                <Alert
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                  title={intl.formatMessage({ id: 'shares.visit.redeemed' })}
                  description={intl.formatMessage(
                    { id: 'shares.visit.ticketTtl' },
                    { minutes: ttlMinutes },
                  )}
                />

                <div className={styles.fileMeta}>
                  <Typography.Text
                    className={styles.fileName}
                    strong
                    // 文件名来自服务端，可能很长（含路径分隔符也不该被当作分段点）
                  >
                    {payload.fileName ??
                      intl.formatMessage({ id: 'shares.visit.unknownFile' })}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {formatBytes(payload.sizeBytes ?? 0)}
                  </Typography.Text>
                </div>

                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<DownloadOutlined />}
                  href={contentUrl}
                  // 显式 download：只靠服务端 Content-Disposition 的话，浏览器会先把取件当
                  // 顶层导航，当前文档随之卸载；开发服务器的 HMR 客户端会因此触发整页 reload
                  // 并取消这次取件（火狐必现）。理由与 services/request 的 startNativeDownload 一致
                  download={payload.fileName ?? ''}
                >
                  {intl.formatMessage({ id: 'shares.visit.download' })}
                </Button>
              </>
            ) : (
              <>
                <Form
                  layout="vertical"
                  size="large"
                  requiredMark={false}
                  initialValues={{ extractCode: presetCode ?? '' }}
                  onFinish={handleFinish}
                >
                  <Form.Item
                    name="extractCode"
                    label={intl.formatMessage({ id: 'shares.visit.code.label' })}
                    extra={
                      presetCode
                        ? intl.formatMessage({ id: 'shares.visit.code.prefilled' })
                        : undefined
                    }
                    rules={[
                      {
                        required: true,
                        message: intl.formatMessage({
                          id: 'shares.visit.code.required',
                        }),
                      },
                    ]}
                  >
                    <Input
                      prefix={<KeyOutlined />}
                      placeholder={intl.formatMessage({
                        id: 'shares.visit.code.placeholder',
                      })}
                      autoComplete="off"
                      disabled={submitting}
                    />
                  </Form.Item>

                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={submitting}
                  >
                    {intl.formatMessage({ id: 'shares.visit.submit' })}
                  </Button>
                </Form>

                <Typography.Paragraph
                  type="secondary"
                  style={{
                    marginTop: 16,
                    marginBottom: 0,
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                >
                  {intl.formatMessage({ id: 'shares.visit.footer' })}
                </Typography.Paragraph>
              </>
            )}
          </div>
        </ConfigProvider>
      </div>
    </div>
  );
};

export default ShareVisitPage;
