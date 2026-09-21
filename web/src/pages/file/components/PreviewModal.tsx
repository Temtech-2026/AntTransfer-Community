/**
 * 预览弹窗。
 *
 * <p>渲染方式完全由服务端下发的 `strategy` 决定，前端不按扩展名猜：
 * Office 系服务端不转码，猜成 pdf 只会让用户对着空白 iframe 等。</p>
 *
 * <p>pdf / image 用的都是服务端下发的短时票据 URL（iframe、img 无法携带 Authorization 头），
 * 因此不能复用普通请求层，直接交给浏览器加载。</p>
 */

import { useIntl } from '@umijs/max';
import {
  Alert,
  Button,
  Empty,
  Modal,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type FileNode,
  fetchPreview,
  type PreviewInfo,
  resolveAssetUrl,
} from '@/services/file';

const { Text } = Typography;

export interface PreviewModalProps {
  open: boolean;
  node?: FileNode | null;
  onClose: () => void;
  /** 「改为下载」回调（下载权限校验在调用方按权限点决定是否传） */
  onDownload?: (node: FileNode) => void;
}

/** 策略标签的文案 id。 */
const STRATEGY_TEXT_ID: Record<PreviewInfo['strategy'], string> = {
  text: 'file.preview.strategy.text',
  pdf: 'file.preview.strategy.pdf',
  image: 'file.preview.strategy.image',
  'download-only': 'file.preview.strategy.downloadOnly',
  none: 'file.preview.strategy.none',
};

export default function PreviewModal({
  open,
  node,
  onClose,
  onDownload,
}: PreviewModalProps) {
  const intl = useIntl();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<PreviewInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 递增请求号：弹窗快速切换文件时丢弃过期响应，避免闪现上一个文件的预览 */
  const requestSeq = useRef(0);

  const load = useCallback(
    // nodeId 是 19 位雪花 ID，必须原样透传：转 number 会丢末位，
    // 服务端按 nodeId 取预览元信息时就查不到节点（详见 `services/file/types` 的 ID 语境说明）。
    async (nodeId: string) => {
      const seq = requestSeq.current + 1;
      requestSeq.current = seq;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPreview(nodeId);
        if (requestSeq.current === seq) {
          setInfo(result);
        }
      } catch (err) {
        if (requestSeq.current === seq) {
          setInfo(null);
          setError(
            (err as Error)?.message ||
              intl.formatMessage({ id: 'file.preview.loadFailed' }),
          );
        }
      } finally {
        if (requestSeq.current === seq) {
          setLoading(false);
        }
      }
    },
    [intl],
  );

  useEffect(() => {
    if (!open || !node) {
      return;
    }
    setInfo(null);
    void load(node.id);
  }, [open, node?.id, node, load]);

  const strategy = info?.strategy;

  const body = () => {
    if (loading) {
      return <Skeleton active paragraph={{ rows: 6 }} />;
    }
    if (error) {
      return (
        <Alert
          type="error"
          showIcon
          title={intl.formatMessage({ id: 'file.preview.failedTitle' })}
          description={error}
          action={
            node ? (
              <Button size="small" onClick={() => void load(node.id)}>
                {intl.formatMessage({ id: 'common.action.retry' })}
              </Button>
            ) : null
          }
        />
      );
    }
    if (!info) {
      return (
        <Empty description={intl.formatMessage({ id: 'file.preview.empty' })} />
      );
    }

    switch (strategy) {
      case 'text':
        return (
          <Space orientation="vertical" style={{ width: '100%' }} size={8}>
            {info.truncated ? (
              <Alert
                type="info"
                showIcon
                title={intl.formatMessage({ id: 'file.preview.truncated' })}
              />
            ) : null}
            <pre
              style={{
                maxHeight: 480,
                overflow: 'auto',
                margin: 0,
                padding: 12,
                background: token.colorFillQuaternary,
                borderRadius: token.borderRadius,
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {info.content ?? ''}
            </pre>
          </Space>
        );
      case 'pdf':
        return (
          <iframe
            title={info.name}
            src={resolveAssetUrl(info.contentUrl)}
            style={{ width: '100%', height: 520, border: 0 }}
          />
        );
      case 'image':
        return (
          <div
            style={{ textAlign: 'center', maxHeight: 520, overflow: 'auto' }}
          >
            <img
              alt={info.name}
              src={resolveAssetUrl(info.thumbnailUrl)}
              style={{ maxWidth: '100%' }}
            />
          </div>
        );
      case 'download-only':
        return (
          <Alert
            type="warning"
            showIcon
            title={intl.formatMessage({ id: 'file.preview.downloadOnlyTitle' })}
            description={intl.formatMessage({
              id: 'file.preview.downloadOnlyDescription',
            })}
            action={
              node && onDownload ? (
                <Button
                  size="small"
                  type="primary"
                  onClick={() => onDownload(node)}
                >
                  {intl.formatMessage({ id: 'file.preview.downloadFile' })}
                </Button>
              ) : null
            }
          />
        );
      default:
        return (
          <Alert
            type="info"
            showIcon
            title={intl.formatMessage({ id: 'file.preview.unavailableTitle' })}
            description={intl.formatMessage({
              id: 'file.preview.unavailableDescription',
            })}
          />
        );
    }
  };

  return (
    <Modal
      open={open}
      width={880}
      onCancel={onClose}
      footer={null}
      title={
        <Space size={8}>
          <Text ellipsis style={{ maxWidth: 520 }}>
            {node?.name ?? intl.formatMessage({ id: 'file.preview.title' })}
          </Text>
          {strategy ? (
            <Tag>{intl.formatMessage({ id: STRATEGY_TEXT_ID[strategy] })}</Tag>
          ) : null}
        </Space>
      }
    >
      {body()}
    </Modal>
  );
}
