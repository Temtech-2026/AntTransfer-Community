/**
 * 审计日志（{@code /audit}）—— 只读检索。
 *
 * <p><b>可见性</b>：后端对该端点要求 {@code audit:log:read}，而该权限点<b>只授予 AUDITOR</b>
 * （V9 的授权红线②：其余角色一个 {@code system:*} 都不给，AUDITOR 不授任何 {@code system:*}）。
 * 因此路由权限点登记为 {@code audit:log:read}，非审计员在菜单与路由两层都进不来；
 * 本页再自查一次，属于纵深防御而非唯一防线。</p>
 *
 * <p><b>检索维度</b>：操作类型（{@code action}）/ 操作人（{@code userId}）/ 时间区间
 * （{@code startTime}~{@code endTime}），另附带域 / 对象类型 / 结果。
 * 注意后端<b>只支持按用户 ID 精确过滤</b>，没有「按展示名模糊」的入参，故检索列用数字输入。</p>
 *
 * <p><b>时间入参</b>：后端 {@code AuditLogQueryDTO} 用 {@code LocalDateTime} + ISO，
 * 必须发 {@code yyyy-MM-ddTHH:mm:ss}（不带时区），由 {@link toBackendDateTime} 统一收敛。</p>
 */

import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import { Alert, App, Button, Result, Space, Tag, Typography } from 'antd';
import { useRef, useState } from 'react';

import {
  SYSTEM_PERM,
  auditResultText,
  exportAuditLogs,
  operatorText,
  pageAuditLogs,
  type AuditLogQuery,
  type AuditLogVO,
} from '@/services/system';
import { toBackendDateTime } from '@/utils/datetime';
import { asNumberParam, asStringParam } from '@/utils/query';

import {
  AUDIT_ACTION_GROUPS,
  AUDIT_MODULE_ENUM,
  AUDIT_TARGET_TYPE_OPTIONS,
  actionText,
} from './constants';

const AuditPage = () => {
  const access = useAccess();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType | null>(null);
  /** 最近一次实际生效的检索条件（导出与列表必须同源，否则「列表能筛、导出筛不了」）。 */
  const lastQueryRef = useRef<AuditLogQuery>({});
  const [exporting, setExporting] = useState(false);

  const canRead = access.can(SYSTEM_PERM.AUDIT_LOG_READ);

  const handleExport = async () => {
    setExporting(true);
    try {
      const saved = await exportAuditLogs(lastQueryRef.current);
      if (saved) {
        message.success('导出已开始下载');
      }
    } catch {
      // 全局错误提示已给出
    } finally {
      setExporting(false);
    }
  };

  if (!canRead) {
    return (
      <PageContainer title="审计日志">
        <Result
          status="403"
          title="仅审计员可访问"
          subTitle="本页需要 audit:log:read 权限点，该权限点只授予审计员角色。"
        />
      </PageContainer>
    );
  }

  const columns: ProColumns<AuditLogVO>[] = [
    {
      title: '时间',
      dataIndex: 'logTime',
      search: false,
      valueType: 'dateTime',
      width: 180,
      fixed: 'left',
    },
    {
      title: '时间区间',
      dataIndex: 'startTime',
      hideInTable: true,
      valueType: 'dateTime',
      fieldProps: { placeholder: '起（含）' },
      // 列级 search.transform：日期组件交出 Date / 'yyyy-MM-dd HH:mm:ss'，后端要 ISO 本地时间
      search: { transform: (value: unknown) => toBackendDateTime(value) },
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      hideInTable: true,
      valueType: 'dateTime',
      fieldProps: { placeholder: '止（含）' },
      search: { transform: (value: unknown) => toBackendDateTime(value) },
    },
    {
      title: '操作人',
      dataIndex: 'userId',
      hideInTable: true,
      valueType: 'digit',
      fieldProps: { placeholder: '用户 ID（精确匹配）', precision: 0 },
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      search: false,
      width: 140,
      render: (_, row) => operatorText(row),
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      valueType: 'select',
      width: 150,
      fieldProps: {
        options: AUDIT_ACTION_GROUPS,
        showSearch: true,
        optionFilterProp: 'label',
        placeholder: '全部动作',
      },
      render: (_, row) => actionText(row.action),
    },
    {
      title: '所属域',
      dataIndex: 'module',
      valueType: 'select',
      width: 120,
      fieldProps: {
        options: Object.entries(AUDIT_MODULE_ENUM).map(([value, meta]) => ({
          label: meta.text,
          value,
        })),
        allowClear: true,
        placeholder: '全部',
      },
      render: (_, row) => {
        const meta = AUDIT_MODULE_ENUM[row.module];
        return meta ? <Tag>{meta.text}</Tag> : <Tag>{row.module || '--'}</Tag>;
      },
    },
    {
      title: '对象类型',
      dataIndex: 'targetType',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        options: AUDIT_TARGET_TYPE_OPTIONS,
        showSearch: true,
        optionFilterProp: 'label',
        allowClear: true,
        placeholder: '全部',
      },
    },
    {
      title: '操作对象',
      dataIndex: 'targetType',
      search: false,
      width: 170,
      render: (_, row) =>
        row.targetType ? `${row.targetType}${row.targetId ? ` #${row.targetId}` : ''}` : '--',
    },
    {
      title: '结果',
      dataIndex: 'result',
      valueType: 'select',
      width: 90,
      fieldProps: {
        options: [
          { label: '成功', value: 0 },
          { label: '失败', value: 1 },
        ],
        allowClear: true,
        placeholder: '全部',
      },
      render: (_, row) =>
        row.result === 0 ? (
          <Tag color="success">成功</Tag>
        ) : row.result === 1 ? (
          <Tag color="error">失败</Tag>
        ) : (
          <Tag>{auditResultText(row.result)}</Tag>
        ),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      search: false,
      width: 140,
      render: (_, row) => row.ip || '--',
    },
    {
      title: '链路 ID',
      dataIndex: 'traceId',
      search: false,
      copyable: true,
      width: 160,
      ellipsis: true,
      render: (_, row) => row.traceId || '--',
    },
    {
      title: '详情',
      dataIndex: 'detail',
      search: false,
      ellipsis: true,
      render: (_, row) =>
        row.detail ? <Typography.Text title={row.detail}>{row.detail}</Typography.Text> : '--',
    },
  ];

  return (
    <PageContainer title="审计日志" subTitle="只读检索（写入侧已脱敏）">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="检索口径"
        description={
          <span>
            操作人只支持按<b>用户 ID 精确匹配</b>（后端不提供按展示名模糊）；
            时间区间为闭区间，按事件时间（<code>logTime</code>）过滤；
            导出沿用当前检索条件，上限由服务端控制。
          </span>
        }
      />
      <ProTable<AuditLogVO>
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        scroll={{ x: 1600 }}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        options={{ density: false, setting: true, reload: true }}
        dateFormatter="string"
        request={async (params) => {
          const query: AuditLogQuery = {
            userId: asNumberParam(params.userId),
            action: asStringParam(params.action),
            module: asStringParam(params.module),
            targetType: asStringParam(params.targetType),
            result: asNumberParam(params.result),
            startTime: asStringParam(params.startTime),
            endTime: asStringParam(params.endTime),
          };
          lastQueryRef.current = query;
          try {
            const page = await pageAuditLogs({
              ...query,
              current: params.current,
              pageSize: params.pageSize,
            });
            return { data: page.records ?? [], total: page.total ?? 0, success: true };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        toolBarRender={() => [
          <Space key="tools" size={8}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                actionRef.current?.reload();
              }}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={handleExport}
            >
              导出 CSV
            </Button>
          </Space>,
        ]}
      />
    </PageContainer>
  );
};

export default AuditPage;
