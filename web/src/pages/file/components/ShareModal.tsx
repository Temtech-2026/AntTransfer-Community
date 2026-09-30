/**
 * 外发分享弹窗：积木式配置（谁可以访问 / 安全策略 / 有效期）+ 链接复制。
 *
 * <p>**关键口径：提取码只进不出。** 服务端收到明文后立即 BCrypt 散列入库，
 * 任何接口都不会回显，因此「复制链接和提取码」只能由前端用表单里的明文拼装，
 * 一旦弹窗关闭就无法再取回——所以成功态必须把提取码留在页面上（而不是提示后清空）。</p>
 *
 * <p>**复制出去的必须是一条单行链接。** 「复制链接和提取码」把提取码拼进链接的 fragment
 * （`#code=xxx`），而不是另起一行写「提取码：xxx」：多行文本粘进浏览器地址栏会被当成
 * 搜索词送去默认搜索引擎（跳到百度，而不是取件页）。提取码放 fragment 而非 query，
 * 又规避了「提取码随请求行进服务端访问日志」的问题。
 * 拼装规则见 `services/file/types.ts` 的 `buildShareLinkWithCode`。</p>
 *
 * <p>**为什么是「积木」而不是一条长表单：** 外发分享的风险来自三个正交维度
 * （对谁开放 / 拿到之后能做什么 / 开放多久），每个维度的失效后果不同，
 * 混在一列控件里用户会只盯着「有效期」而忽略「对谁开放」。分块后每块自带一句
 * 后果说明，缺哪块是一眼可见的。</p>
 *
 * <p>**CE 能力边界如实呈现：** 指定接收人（邮箱 / 手机号 / 组织架构）与动态水印
 * 都需要服务端能力（内部授权接口、水印开关下发），CE 当前没有。
 * 这里**照实标成不可用**并写明原因，而不是画一个点了没反应的假控件——
 * 前端更不能假装「已开启水印」，那会给用户一个「文件受保护」的假安全感。</p>
 */

import {
  ClockCircleOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Radio,
  Result,
  Space,
  Switch,
  theme,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { type ReactNode, useState } from 'react';

import {
  buildShareLinkWithCode,
  buildShareUrl,
  createShare,
  type FileNode,
  isValidExtractCode,
  randomExtractCode,
  SHARE_EXPIRE_PRESETS,
  SHARE_LIMITS,
  type ShareLink,
} from '@/services/file';
import { formatLocalDateTime } from '@/utils/datetime';
import { isErrorHandledByRequestLayer } from '@/utils/result';

const { Text, Paragraph } = Typography;

export interface ShareModalProps {
  open: boolean;
  /** 目标文件；为空时不渲染表单内容 */
  node?: FileNode | null;
  onClose: () => void;
}

interface ShareFormValues {
  expireDays: number;
  extractCode: string;
  downloadLimit: number;
}

/** 访问方式。当前只有「凭链接」一种，另一种保留枚举以便将来直接接上接口。 */
type Audience = 'link' | 'member';

/** 成功态快照：链接 + 本次使用的明文提取码（服务端不再回显）。 */
interface ShareResult {
  link: ShareLink;
  url: string;
  extractCode: string;
  expireAt: string;
}

/** 复制文本：优先 Clipboard API，失败降级到 execCommand（http / 旧内核场景）。 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 继续走降级路径
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** 配置积木：一块 = 一个正交的风险维度 */
function Block({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        // 底部只留 4px：Form.Item 自带下边距，给多了会与块间距混淆
        padding: '12px 14px 4px',
        marginBottom: token.marginSM,
        background: token.colorFillQuaternary,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span style={{ color: token.colorPrimary }}>{icon}</span>
        <Text strong>{title}</Text>
        {hint ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {hint}
          </Text>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** 只读的开关行：用于「强制开启」与「CE 未提供」两类不可交互的状态 */
function LockedSwitch({
  checked,
  label,
  description,
  tag,
}: {
  checked: boolean;
  label: string;
  description: string;
  tag?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 12,
      }}
    >
      <Switch size="small" checked={checked} disabled />
      <div style={{ lineHeight: 1.5 }}>
        <Space size={6}>
          <Text>{label}</Text>
          {tag}
        </Space>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {description}
          </Text>
        </div>
      </div>
    </div>
  );
}

export default function ShareModal({ open, node, onClose }: ShareModalProps) {
  const intl = useIntl();
  const [form] = Form.useForm<ShareFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [audience, setAudience] = useState<Audience>('link');

  const reset = () => {
    form.resetFields();
    form.setFieldsValue({
      expireDays: SHARE_LIMITS.defaultExpireDays,
      downloadLimit: SHARE_LIMITS.defaultDownloadLimit,
      extractCode: randomExtractCode(),
    });
    setAudience('link');
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!node) {
      return;
    }
    // 外发分享是**物理文件**维度：后端 `ShareLinkService#requireOwnedFile` 拿 `fileId` 查
    // `sys_file`（物理层），`sys_share_link.file_id` 关联的也是 `sys_file.id`。
    // 所以这里必须是 `node.fileId`，**不是** `node.id`——后者是 `sys_file_node` 的条目 ID，
    // 两张表的 ID 都由雪花生成、分属不同值空间；拿条目 ID 去查物理表必然落空，
    // 服务端只会回 4005「文件不存在或已被删除」（与「无权」刻意不可区分）。
    const fileId = node.fileId;
    if (!fileId) {
      // `sys_file_node.file_id` 是 NOT NULL：走到这里说明拿到的是残缺 / 过期的行数据。
      // 与其发一个注定失败的请求，不如就地止损。
      message.error(intl.formatMessage({ id: 'file.share.missingFileId' }));
      return;
    }
    const values = await form.validateFields();
    // 到期时间用「当前时刻 + N 天」而非当天 23:59:59：避免用户 23:58 选 1 天却只剩 1 分钟
    const expireMoment = dayjs().add(values.expireDays, 'day');
    // 后端 `CreateShareRequest.expireAt` 是 `LocalDateTime` 且未配 `@JsonFormat`，只认 ISO-8601
    // （`T` 分隔）。原先直接 `format('YYYY-MM-DD HH:mm:ss')` 交出的是空格分隔，会被
    // GlobalExceptionHandler 判成 2004「请求体格式错误，请检查 JSON 与字段类型」。
    const expireAt = formatLocalDateTime(expireMoment.toDate());
    setSubmitting(true);
    try {
      const link = await createShare({
        fileId,
        extractCode: values.extractCode,
        downloadLimit: values.downloadLimit,
        expireAt,
      });
      setResult({
        link,
        url: buildShareUrl(link.token),
        extractCode: values.extractCode,
        // 服务端回显优先（有效期可能被服务端按配置夹紧）；展示统一用本地可读格式，
        // 免得把 ISO 的 `T` 直接摆到用户面前
        expireAt: (link.expireAt ? dayjs(link.expireAt) : expireMoment).format(
          'YYYY-MM-DD HH:mm:ss',
        ),
      });
    } catch (error) {
      // 超限（2005）等业务错误已由全局错误链路提示一次（见 requestErrorConfig 的 errorHandler），
      // 这里只兜底不经 request 通道的同步异常——否则同一句话会弹两遍，用户会误以为提交了两次
      if (!isErrorHandledByRequestLayer(error)) {
        message.error(
          (error as Error)?.message ||
            intl.formatMessage({ id: 'file.share.createFailed' }),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result) {
      return;
    }
    // 复制出去的是一条单行链接（提取码在 fragment 上）：多行文本粘进地址栏会被当成搜索词
    const text = buildShareLinkWithCode(result.url, result.extractCode);
    const ok = await copyText(text);
    if (ok) {
      message.success(intl.formatMessage({ id: 'file.share.copied' }));
    } else {
      message.warning(intl.formatMessage({ id: 'file.share.copyDenied' }));
    }
  };

  /** 机密级：外发前必须已有通过的审批单，否则服务端必拒（403 / 1003） */
  const needApproval = Number(node?.level) >= 3;

  return (
    <Modal
      open={open}
      title={
        node
          ? intl.formatMessage({ id: 'file.share.titleWithName' }, { name: node.name })
          : intl.formatMessage({ id: 'file.share.title' })
      }
      width={620}
      centered
      onCancel={onClose}
      destroyOnHidden
      afterOpenChange={(visible) => {
        // 每次打开都重置：上一次的提取码已无法回显，残留表单会让用户误以为复用旧码
        if (visible) {
          reset();
        }
      }}
      footer={
        result
          ? [
              <Button key="again" onClick={reset}>
                {intl.formatMessage({ id: 'file.share.again' })}
              </Button>,
              <Button key="done" type="primary" onClick={onClose}>
                {intl.formatMessage({ id: 'file.share.done' })}
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
                {intl.formatMessage({ id: 'file.share.generate' })}
              </Button>,
            ]
      }
    >
      {result ? (
        <Result
          status="success"
          title={intl.formatMessage({ id: 'file.share.resultTitle' })}
          subTitle={intl.formatMessage({ id: 'file.share.resultSubTitle' })}
          extra={
            <Space
              orientation="vertical"
              size={8}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item
                  label={intl.formatMessage({ id: 'file.share.field.url' })}
                >
                  <Paragraph copyable={false} style={{ marginBottom: 0 }}>
                    {result.url}
                  </Paragraph>
                </Descriptions.Item>
                <Descriptions.Item
                  label={intl.formatMessage({ id: 'file.share.field.code' })}
                >
                  <Text strong code>
                    {result.extractCode}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item
                  label={intl.formatMessage({
                    id: 'file.share.field.expireAt',
                  })}
                >
                  {result.expireAt}
                </Descriptions.Item>
                <Descriptions.Item
                  label={intl.formatMessage({
                    id: 'file.share.field.downloadLimit',
                  })}
                >
                  {intl.formatMessage(
                    { id: 'file.share.times' },
                    {
                      count:
                        result.link.remainingCount ??
                        result.link.downloadLimit ??
                        '-',
                    },
                  )}
                </Descriptions.Item>
              </Descriptions>
              <Button type="primary" block onClick={handleCopy}>
                {intl.formatMessage({ id: 'file.share.copyBoth' })}
              </Button>
            </Space>
          }
        />
      ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            expireDays: SHARE_LIMITS.defaultExpireDays,
            downloadLimit: SHARE_LIMITS.defaultDownloadLimit,
            extractCode: randomExtractCode(),
          }}
        >
          {needApproval ? (
            <Alert
              style={{ marginBottom: 12 }}
              type="error"
              showIcon
              title={intl.formatMessage({
                id: 'file.share.approvalRequiredTitle',
              })}
              description={intl.formatMessage({
                id: 'file.share.approvalRequiredDescription',
              })}
            />
          ) : (
            <Alert
              style={{ marginBottom: 12 }}
              type="warning"
              showIcon
              title={intl.formatMessage({ id: 'file.share.warningTitle' })}
              description={intl.formatMessage({
                id: 'file.share.warningDescription',
              })}
            />
          )}

          {/* 积木 ①：对谁开放 */}
          <Block
            icon={<TeamOutlined />}
            title={intl.formatMessage({ id: 'file.share.block.audience' })}
          >
            <Radio.Group
              value={audience}
              onChange={(event) => setAudience(event.target.value as Audience)}
              style={{ width: '100%' }}
            >
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Radio value="link">
                  <Space size={6}>
                    <LinkOutlined />
                    <Text>
                      {intl.formatMessage({ id: 'file.share.audience.link' })}
                    </Text>
                  </Space>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {intl.formatMessage({
                        id: 'file.share.audience.linkHint',
                      })}
                    </Text>
                  </div>
                </Radio>
                <Radio value="member" disabled>
                  <Space size={6}>
                    <TeamOutlined />
                    <Text>
                      {intl.formatMessage({ id: 'file.share.audience.member' })}
                    </Text>
                  </Space>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {intl.formatMessage({
                        id: 'file.share.audience.memberHint',
                      })}
                    </Text>
                  </div>
                </Radio>
              </Space>
            </Radio.Group>
          </Block>

          {/* 积木 ②：拿到之后能做什么 + 访问凭证 */}
          <Block
            icon={<SafetyCertificateOutlined />}
            title={intl.formatMessage({ id: 'file.share.block.policy' })}
          >
            <Form.Item
              name="extractCode"
              label={intl.formatMessage({ id: 'file.share.field.codeLabel' })}
              rules={[
                {
                  required: true,
                  message: intl.formatMessage({
                    id: 'file.share.field.codeRequired',
                  }),
                },
                {
                  validator: (_, value: string) =>
                    isValidExtractCode(value)
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error(
                            intl.formatMessage(
                              { id: 'file.share.field.codeRule' },
                              {
                                min: SHARE_LIMITS.extractCodeMin,
                                max: SHARE_LIMITS.extractCodeMax,
                              },
                            ),
                          ),
                        ),
                },
              ]}
              extra={intl.formatMessage({ id: 'file.share.field.codeExtra' })}
            >
              <Input
                maxLength={SHARE_LIMITS.extractCodeMax}
                placeholder={intl.formatMessage({
                  id: 'file.share.field.codePlaceholder',
                })}
                addonAfter={
                  <Space size={4}>
                    <Button
                      type="link"
                      size="small"
                      onClick={() =>
                        form.setFieldValue('extractCode', randomExtractCode())
                      }
                    >
                      {intl.formatMessage({ id: 'file.share.random' })}
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      onClick={async () => {
                        const code = form.getFieldValue('extractCode') as string;
                        if (!code) {
                          message.warning(
                            intl.formatMessage({ id: 'file.share.codeMissing' }),
                          );
                          return;
                        }
                        const ok = await copyText(code);
                        if (ok) {
                          message.success(
                            intl.formatMessage({ id: 'file.share.codeCopied' }),
                          );
                        }
                      }}
                    >
                      {intl.formatMessage({ id: 'file.share.copy' })}
                    </Button>
                  </Space>
                }
              />
            </Form.Item>

            <Form.Item
              name="downloadLimit"
              label={intl.formatMessage({ id: 'file.share.field.limitLabel' })}
              rules={[
                {
                  required: true,
                  message: intl.formatMessage({
                    id: 'file.share.field.limitRequired',
                  }),
                },
              ]}
              extra={intl.formatMessage({ id: 'file.share.field.limitExtra' })}
            >
              <InputNumber
                min={1}
                max={SHARE_LIMITS.maxDownloadLimit}
                precision={0}
                style={{ width: 200 }}
              />
            </Form.Item>

            <LockedSwitch
              checked
              label={intl.formatMessage({ id: 'file.share.trace.label' })}
              description={intl.formatMessage({
                id: 'file.share.trace.description',
              })}
            />
            <LockedSwitch
              checked={false}
              label={intl.formatMessage({ id: 'file.share.watermark.label' })}
              description={intl.formatMessage({
                id: 'file.share.watermark.description',
              })}
            />
          </Block>

          {/* 积木 ③：开放多久 */}
          <Block
            icon={<ClockCircleOutlined />}
            title={intl.formatMessage({ id: 'file.share.block.expire' })}
          >
            <Form.Item
              name="expireDays"
              label={intl.formatMessage({ id: 'file.share.field.expireLabel' })}
              rules={[
                {
                  required: true,
                  message: intl.formatMessage({
                    id: 'file.share.field.expireRequired',
                  }),
                },
              ]}
              extra={intl.formatMessage(
                { id: 'file.share.field.expireExtra' },
                { max: SHARE_LIMITS.maxExpireDays },
              )}
              style={{ marginBottom: 8 }}
            >
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                options={SHARE_EXPIRE_PRESETS.map((days) => ({
                  label: intl.formatMessage(
                    { id: 'file.share.presetDays' },
                    { days },
                  ),
                  value: days,
                }))}
              />
            </Form.Item>
          </Block>
        </Form>
      )}
    </Modal>
  );
}
