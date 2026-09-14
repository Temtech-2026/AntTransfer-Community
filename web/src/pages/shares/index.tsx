/**
 * 分享管理页：我的外发链接（第 2 步页面 7）。
 *
 * <p>口径：
 * <ul>
 *   <li>数据源 {@code GET /api/v1/shares/mine}，<b>只接受 page/size</b>（分享域与文件域分页参数名不同），
 *       服务端没有筛选参数，因此整表 <b>关闭搜索表单</b>——摆一个点了没反应的筛选框等于假功能；</li>
 *   <li>页面与创建按钮都要求 {@code file:share}（后端 ShareController 的创建 / 撤销 / 查询统一收口在该权限点）；</li>
 *   <li>提取码不回显：列表只展示「是否开启」，明文只在创建成功的那一刻展示一次；</li>
 *   <li>取消分享二次确认，且只在「生效中」时可用。</li>
 * </ul>
 */

import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { Button, Modal, Space, Tag, Typography, message } from 'antd';
import React, { useRef, useState } from 'react';

import { useDangerConfirm } from '@/components/DangerConfirm';
import EmptyState from '@/components/EmptyState';
import {
  buildShareUrl,
  pageMyShares,
  revokeShare,
  type ShareLink,
  shareStatusText,
} from '@/services/file';

import CreateShareModal from './components/CreateShareModal';

/** 分享状态对应的标签颜色（与 shareStatusText 一一对应）。 */
function shareStatusColor(status?: number | null): string {
  switch (status) {
    case 0:
      return 'processing';
    case 2:
      return 'error';
    default:
      return 'default';
  }
}

/** 复制到剪贴板；非安全上下文（http / 旧浏览器）下 clipboard 不可用，返回 false 由调用方兜底。 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const SharesPage: React.FC = () => {
  const access = useAccess();
  const { confirm } = useDangerConfirm();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);

  const canShare = access.can('file:share');

  const handleCopy = async (record: ShareLink) => {
    const url = buildShareUrl(record.token);
    if (await copyToClipboard(url)) {
      message.success('链接已复制；提取码不会回显，请沿用创建时的提取码');
      return;
    }
    Modal.info({
      title: '请手动复制链接',
      content: <Typography.Text copyable>{url}</Typography.Text>,
    });
  };

  /**
   * 取消分享。
   *
   * <p>刻意**不 try/catch**：异常要继续抛给二次确认弹窗，弹窗才会保持打开——
   * 失败却关掉弹窗，用户会以为已经撤销成功。失败提示由全局错误链路给出。
   */
  const handleRevoke = async (record: ShareLink) => {
    await revokeShare(record.token);
    message.success('分享已取消，链接立即失效');
    actionRef.current?.reload();
  };

  /** 创建成功：立刻展示链接 + 明文提取码（唯一一次可见的窗口）。 */
  const handleCreated = (link: ShareLink, extractCode: string) => {
    setCreateOpen(false);
    actionRef.current?.reload();
    const url = buildShareUrl(link.token);
    Modal.success({
      title: '分享已创建',
      width: 560,
      okText: '我知道了',
      content: (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Typography.Text copyable={{ text: url }}>{url}</Typography.Text>
          <Typography.Text>
            提取码：
            <Typography.Text strong copyable={{ text: extractCode }}>
              {extractCode}
            </Typography.Text>
          </Typography.Text>
          <Typography.Text type="secondary">
            服务端只保存提取码散列，关闭本窗口后无法再次查看，请立即转达给对方。
          </Typography.Text>
        </Space>
      ),
    });
  };

  if (!canShare) {
    return (
      <PageContainer title="分享管理">
        <EmptyState variant="denied" description="当前账号没有外发分享权限（file:share），请联系管理员开通" />
      </PageContainer>
    );
  }

  const columns: ProColumns<ShareLink>[] = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      ellipsis: true,
      render: (_, record) => record.fileName || '（文件已删除）',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => (
        <Tag color={shareStatusColor(record.status)}>{shareStatusText(record.status)}</Tag>
      ),
    },
    {
      title: '有效期至',
      dataIndex: 'expireAt',
      width: 180,
      valueType: 'dateTime',
    },
    {
      title: '已用次数',
      dataIndex: 'downloadedCount',
      width: 140,
      render: (_, record) =>
        `${record.downloadedCount ?? 0} / ${record.downloadLimit ?? '不限'}`,
    },
    {
      title: '剩余次数',
      dataIndex: 'remainingCount',
      width: 100,
      render: (_, record) => record.remainingCount ?? '-',
    },
    {
      title: '提取码',
      dataIndex: 'extractCodeRequired',
      width: 100,
      render: (_, record) =>
        record.extractCodeRequired ? <Tag color="blue">已开启</Tag> : <Tag>未开启</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      fixed: 'right',
      render: (_, record) => {
        const active = record.status === 0;
        return [
          <Button
            key="copy"
            type="link"
            size="small"
            disabled={!active}
            title={active ? undefined : '仅生效中的分享可复制'}
            onClick={() => void handleCopy(record)}
          >
            复制链接
          </Button>,
          <Button
            key="revoke"
            type="link"
            size="small"
            danger
            disabled={!active}
            onClick={() =>
              confirm({
                title: '取消这个分享链接？',
                content:
                  '取消后链接立即失效，已发给对方的提取码一并作废。如需再次外发，只能重新创建并生成新链接。',
                level: 'critical',
                okText: '确认取消分享',
                onOk: () => handleRevoke(record),
              })
            }
          >
            取消分享
          </Button>,
        ];
      },
    },
  ];

  return (
    <PageContainer
      title="分享管理"
      subTitle="我创建的外发链接；提取码不回显，取消后不可恢复"
    >
      <ProTable<ShareLink>
        headerTitle="我的分享"
        actionRef={actionRef}
        rowKey="token"
        columns={columns}
        // 后端 mine 接口只有 page/size，没有筛选参数：整表关闭搜索表单
        search={false}
        options={false}
        scroll={{ x: 1160 }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        request={async (params) => {
          // ProTable 的 current/pageSize → 分享域的 page/size，映射收在 pageMyShares 里
          const page = await pageMyShares(params.current ?? 1, params.pageSize ?? 20);
          return { data: page.records, total: page.total, success: true };
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            创建分享
          </Button>,
        ]}
      />

      {createOpen ? (
        <CreateShareModal onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      ) : null}
    </PageContainer>
  );
};

export default SharesPage;
