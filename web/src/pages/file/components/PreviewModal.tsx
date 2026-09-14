/**
 * 预览弹窗。
 *
 * <p>渲染方式完全由服务端下发的 `strategy` 决定，前端不按扩展名猜：
 * Office 系服务端不转码，猜成 pdf 只会让用户对着空白 iframe 等。</p>
 *
 * <p>pdf / image 用的都是服务端下发的短时票据 URL（iframe、img 无法携带 Authorization 头），
 * 因此不能复用普通请求层，直接交给浏览器加载。</p>
 */

import { Alert, Button, Empty, Modal, Skeleton, Space, Tag, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchPreview, resolveAssetUrl, type FileNode, type PreviewInfo } from '@/services/file';

const { Text } = Typography;

export interface PreviewModalProps {
  open: boolean;
  node?: FileNode | null;
  onClose: () => void;
  /** 「改为下载」回调（下载权限校验在调用方按权限点决定是否传） */
  onDownload?: (node: FileNode) => void;
}

/** 策略标签文案。 */
const STRATEGY_TEXT: Record<PreviewInfo['strategy'], string> = {
  text: '文本',
  pdf: 'PDF',
  image: '图片',
  'download-only': '仅下载',
  none: '不支持',
};

export default function PreviewModal({ open, node, onClose, onDownload }: PreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<PreviewInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 递增请求号：弹窗快速切换文件时丢弃过期响应，避免闪现上一个文件的预览 */
  const requestSeq = useRef(0);

  const load = useCallback(async (nodeId: number) => {
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
        setError((err as Error)?.message || '预览信息加载失败');
      }
    } finally {
      if (requestSeq.current === seq) {
        setLoading(false);
      }
    }
  }, []);

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
          title="预览失败"
          description={error}
          action={
            node ? (
              <Button size="small" onClick={() => void load(node.id)}>
                重试
              </Button>
            ) : null
          }
        />
      );
    }
    if (!info) {
      return <Empty description="暂无预览内容" />;
    }

    switch (strategy) {
      case 'text':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {info.truncated ? (
              <Alert
                type="info"
                showIcon
                title="内容较长，仅展示前若干字符，完整内容请下载查看"
              />
            ) : null}
            <pre
              style={{
                maxHeight: 480,
                overflow: 'auto',
                margin: 0,
                padding: 12,
                background: 'rgba(0,0,0,0.03)',
                borderRadius: 4,
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
          <div style={{ textAlign: 'center', maxHeight: 520, overflow: 'auto' }}>
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
            title="该类型不支持在线预览"
            description="为降低泄露风险，此格式不做服务端转码，请下载后在本地打开。"
            action={
              node && onDownload ? (
                <Button size="small" type="primary" onClick={() => onDownload(node)}>
                  下载文件
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
            title="无法预览"
            description="服务端未提供可用的预览方式，可能是格式不支持或预览能力未开启。"
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
            {node?.name ?? '预览'}
          </Text>
          {strategy ? <Tag>{STRATEGY_TEXT[strategy]}</Tag> : null}
        </Space>
      }
    >
      {body()}
    </Modal>
  );
}
