/**
 * 外发分享弹窗：有效期 / 提取码 / 下载次数 + 链接复制。
 *
 * <p>关键口径：**提取码只进不出**。服务端收到明文后立即 BCrypt 散列入库，
 * 任何接口都不会回显，因此「复制链接和提取码」只能由前端用表单里的明文拼装，
 * 一旦弹窗关闭就无法再取回——所以成功态必须把提取码留在页面上（而不是提示后清空）。</p>
 */

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
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';

import {
  buildShareCopyText,
  buildShareUrl,
  createShare,
  type FileNode,
  isValidExtractCode,
  randomExtractCode,
  SHARE_EXPIRE_PRESETS,
  SHARE_LIMITS,
  type ShareLink,
} from '@/services/file';

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

export default function ShareModal({ open, node, onClose }: ShareModalProps) {
  const [form] = Form.useForm<ShareFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);

  const reset = () => {
    form.resetFields();
    form.setFieldsValue({
      expireDays: SHARE_LIMITS.defaultExpireDays,
      downloadLimit: SHARE_LIMITS.defaultDownloadLimit,
      extractCode: randomExtractCode(),
    });
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!node) {
      return;
    }
    const values = await form.validateFields();
    // 到期时间用「当前时刻 + N 天」而非当天 23:59:59：避免用户 23:58 选 1 天却只剩 1 分钟
    const expireAt = dayjs()
      .add(values.expireDays, 'day')
      .format('YYYY-MM-DD HH:mm:ss');
    setSubmitting(true);
    try {
      const link = await createShare({
        fileId: node.id,
        extractCode: values.extractCode,
        downloadLimit: values.downloadLimit,
        expireAt,
      });
      setResult({
        link,
        url: buildShareUrl(link.token),
        extractCode: values.extractCode,
        expireAt: link.expireAt ?? expireAt,
      });
    } catch (error) {
      // 超限（2005）等业务错误由全局拦截器提示；这里兜底非 Result 形态的异常
      message.error((error as Error)?.message || '创建外发分享失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result) {
      return;
    }
    const text = buildShareCopyText(
      result.url,
      result.extractCode,
      result.expireAt,
    );
    const ok = await copyText(text);
    if (ok) {
      message.success('链接与提取码已复制');
    } else {
      message.warning('浏览器拒绝访问剪贴板，请手动选中复制');
    }
  };

  return (
    <Modal
      open={open}
      title={`外发分享${node ? `：${node.name}` : ''}`}
      width={560}
      onCancel={onClose}
      destroyOnClose
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
                再创建一个
              </Button>,
              <Button key="done" type="primary" onClick={onClose}>
                完成
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
                生成链接
              </Button>,
            ]
      }
    >
      {result ? (
        <Result
          status="success"
          title="外发链接已生成"
          subTitle="提取码不会再次显示，请立即复制并转达给对方"
          extra={
            <Space
              orientation="vertical"
              size={8}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="分享链接">
                  <Paragraph copyable={false} style={{ marginBottom: 0 }}>
                    {result.url}
                  </Paragraph>
                </Descriptions.Item>
                <Descriptions.Item label="提取码">
                  <Text strong code>
                    {result.extractCode}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="有效期至">
                  {result.expireAt}
                </Descriptions.Item>
                <Descriptions.Item label="可下载次数">
                  {result.link.remainingCount ??
                    result.link.downloadLimit ??
                    '-'}{' '}
                  次
                </Descriptions.Item>
              </Descriptions>
              <Button type="primary" block onClick={handleCopy}>
                复制链接和提取码
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
          <Alert
            style={{ marginBottom: 12 }}
            type="warning"
            showIcon
            title="外发链接等价于把文件送出内网"
            description="链接凭提取码即可免登录访问，所有下载都会留痕；密级为机密的文件需先通过外发审批，否则会被服务端拒绝（403 / 1003）。"
          />

          <Form.Item
            name="expireDays"
            label="有效期"
            rules={[{ required: true, message: '请选择有效期' }]}
            extra={`上限 ${SHARE_LIMITS.maxExpireDays} 天，超出会被服务端拒绝`}
          >
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={SHARE_EXPIRE_PRESETS.map((preset) => ({
                label: preset.label,
                value: preset.value,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="extractCode"
            label="提取码"
            rules={[
              { required: true, message: '请输入提取码' },
              {
                validator: (_, value: string) =>
                  isValidExtractCode(value)
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(
                          `提取码需 ${SHARE_LIMITS.extractCodeMin}~${SHARE_LIMITS.extractCodeMax} 位字母或数字`,
                        ),
                      ),
              },
            ]}
          >
            <Input
              maxLength={SHARE_LIMITS.extractCodeMax}
              placeholder="6~32 位字母数字"
              addonAfter={
                <Space size={4}>
                  <Button
                    type="link"
                    size="small"
                    onClick={() =>
                      form.setFieldValue('extractCode', randomExtractCode())
                    }
                  >
                    随机
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    onClick={async () => {
                      const code = form.getFieldValue('extractCode') as string;
                      if (!code) {
                        message.warning('请先生成或填写提取码');
                        return;
                      }
                      const ok = await copyText(code);
                      if (ok) {
                        message.success('提取码已复制');
                      }
                    }}
                  >
                    复制
                  </Button>
                </Space>
              }
            />
          </Form.Item>

          <Form.Item
            name="downloadLimit"
            label="下载次数上限"
            rules={[{ required: true, message: '请输入下载次数上限' }]}
            extra="达到上限后链接自动失效；撤销链接可立即作废已签发的下载票据"
          >
            <InputNumber
              min={1}
              max={SHARE_LIMITS.maxDownloadLimit}
              precision={0}
              style={{ width: 200 }}
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
