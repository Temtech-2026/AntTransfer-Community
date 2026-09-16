/**
 * 审批中心（待我审批 / 我发起）。
 *
 * <p><b>权限口径：</b>两个列表端点与决策端点在后端都**没有** `@RequiresPerm`——
 * 审批资格由「是否为该单审批人 + 状态为待审」在服务层判定，不存在对应的权限点。
 * 因此本页的操作按钮不由 `<Access perm>` 控制（前端不臆造 perm_code），
 * 而是由 `canDecide(单子, 视角)` 按业务态显隐；真正的资格校验在后端。
 *
 * <p>SLA 倒计时是「提醒」而非「放行条件」：超时的单子仍要人工决策。
 */

import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Alert, App, Tabs, Tag, theme } from 'antd';
import { useMemo, useRef, useState } from 'react';
import type { ApprovalApplication, ApprovalView } from '@/services/approval';
import {
  actionLabel,
  approvalStatusColor,
  approvalStatusText,
  canDecide,
  pageMyApprovals,
  pagePendingApprovals,
} from '@/services/approval';
import { levelColor, levelText } from '@/services/file';
import type { DecisionMode } from './components/ApprovalDecisionModal';
import ApprovalDecisionModal from './components/ApprovalDecisionModal';
import ApprovalDetailDrawer from './components/ApprovalDetailDrawer';
import SlaCountdown from './components/SlaCountdown';

/** ProTable 的额外参数：`view` 参与 params 以便切换 Tab 时自动重发请求。 */
interface ApprovalTableParams {
  current?: number;
  pageSize?: number;
  view?: ApprovalView;
}

/**
 * 从 `?view=` 深链参数读取初始视角。
 *
 * <p>消息中心的「待办」会带参跳转过来（待我审批 → `?view=pending`，审批结果 → `?view=mine`），
 * 落点必须直接停在对应视角；非法 / 缺失值一律回落「待我审批」——它是本页的主视角。
 */
function readViewFromLocation(): ApprovalView {
  const raw = new URLSearchParams(history.location.search).get('view');
  return raw === 'mine' ? 'mine' : 'pending';
}

const ApprovalCenterPage = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const actionRef = useRef<ActionType | null>(null);
  const [view, setView] = useState<ApprovalView>(readViewFromLocation);
  const [decision, setDecision] = useState<{
    mode: DecisionMode;
    application: ApprovalApplication;
  } | null>(null);
  const [detail, setDetail] = useState<ApprovalApplication | null>(null);

  const columns = useMemo<ProColumns<ApprovalApplication>[]>(() => {
    const base: ProColumns<ApprovalApplication>[] = [
      {
        title: '申请单号',
        dataIndex: 'applicationNo',
        width: 180,
        ellipsis: true,
        render: (_, record) => record.applicationNo || `#${record.id}`,
      },
      {
        title: '申请动作',
        dataIndex: 'applyType',
        width: 110,
        render: (_, record) => (
          <Tag color="blue">{actionLabel(record.applyType)}</Tag>
        ),
      },
      {
        title: '敏感等级',
        dataIndex: 'level',
        width: 90,
        render: (_, record) => (
          <Tag color={levelColor(record.level)}>{levelText(record.level)}</Tag>
        ),
      },
      {
        title: '资源',
        width: 130,
        ellipsis: true,
        render: (_, record) =>
          record.resourceType
            ? `${record.resourceType} / ${record.resourceId ?? '-'}`
            : '—',
      },
      {
        title: '申请人',
        dataIndex: 'applicantId',
        width: 90,
        render: (_, record) => record.applicantId ?? '—',
      },
      {
        title: '使用用途',
        dataIndex: 'purpose',
        ellipsis: true,
        render: (_, record) => record.purpose || '—',
      },
      {
        title: '期望到期',
        dataIndex: 'desiredExpireAt',
        width: 165,
        render: (_, record) => record.desiredExpireAt || '长期有效',
      },
    ];

    if (view === 'pending') {
      base.push({
        title: 'SLA',
        width: 130,
        render: (_, record) => <SlaCountdown application={record} />,
      });
    } else {
      base.push(
        {
          title: '状态',
          dataIndex: 'status',
          width: 100,
          render: (_, record) => (
            <Tag color={approvalStatusColor(record.status)}>
              {approvalStatusText(record.status)}
            </Tag>
          ),
        },
        {
          title: '审批意见',
          dataIndex: 'opinion',
          width: 160,
          ellipsis: true,
          render: (_, record) => record.opinion || '—',
        },
      );
    }

    base.push(
      {
        title: '申请时间',
        dataIndex: 'createdAt',
        width: 165,
        render: (_, record) => record.createdAt || '—',
      },
      {
        title: '操作',
        valueType: 'option',
        width: 160,
        fixed: 'right',
        render: (_, record) => {
          const actions = [
            <a key="detail" onClick={() => setDetail(record)}>
              详情
            </a>,
          ];
          if (canDecide(record, view)) {
            actions.push(
              <a
                key="approve"
                onClick={() =>
                  setDecision({ mode: 'approve', application: record })
                }
              >
                通过
              </a>,
              <a
                key="reject"
                style={{ color: token.colorError }}
                onClick={() =>
                  setDecision({ mode: 'reject', application: record })
                }
              >
                驳回
              </a>,
            );
          }
          return actions;
        },
      },
    );

    return base;
  }, [view, token.colorError]);

  return (
    <PageContainer
      header={{ title: '审批中心', subTitle: '待我审批与我发起的权限申请' }}
    >
      <Tabs
        activeKey={view}
        onChange={(key) => {
          const next = key as ApprovalView;
          setView(next);
          // 同步到地址栏：刷新 / 复制链接后仍停在同一视角（replace 避免污染后退栈）
          history.replace(`/approval?view=${next}`);
        }}
        items={[
          { key: 'pending', label: '待我审批' },
          { key: 'mine', label: '我发起' },
        ]}
      />

      {view === 'pending' ? (
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          title="SLA 按密级推算（公开 24h / 内部 12h / 机密 4h），超时仅作提醒，不会自动通过或放行权限。"
        />
      ) : null}

      <ProTable<ApprovalApplication, ApprovalTableParams>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        cardBordered
        search={false}
        scroll={{ x: 1180 }}
        options={{ density: false, reload: true, setting: true }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        // 切换视角必须触发重新请求：ProTable 只在 params 变化时重发
        params={{ view }}
        request={async (params) => {
          const query = { current: params.current, pageSize: params.pageSize };
          const page =
            view === 'pending'
              ? await pagePendingApprovals(query)
              : await pageMyApprovals(query);
          return { data: page.records, total: page.total, success: true };
        }}
        toolBarRender={false}
        tableAlertRender={false}
      />

      <ApprovalDecisionModal
        open={decision !== null}
        mode={decision?.mode ?? 'approve'}
        application={decision?.application ?? null}
        onCancel={() => setDecision(null)}
        onSuccess={() => {
          setDecision(null);
          message.success('审批结果已提交');
          actionRef.current?.reload();
        }}
      />

      <ApprovalDetailDrawer
        open={detail !== null}
        application={detail}
        onClose={() => setDetail(null)}
      />
    </PageContainer>
  );
};

export default ApprovalCenterPage;
