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
 * 注意后端<b>只支持按用户 ID 精确过滤</b>，没有「按展示名模糊」的入参；输入框用文本而非数字
 * （19 位雪花 ID 超出 JS 安全整数范围，数字控件会悄悄吃掉末位）。</p>
 *
 * <p><b>时间入参</b>：后端 {@code AuditLogQueryDTO} 用 {@code LocalDateTime} + ISO，
 * 必须发 {@code yyyy-MM-ddTHH:mm:ss}（不带时区），由 {@link toBackendDateTime} 统一收敛。</p>
 */

import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { Alert, App, Button, Result, Space, Tag, Typography } from 'antd';
import { useRef, useState } from 'react';

import {
  SYSTEM_PERM,
  exportAuditLogs,
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
  actionTextId,
} from './constants';

const AuditPage = () => {
  const access = useAccess();
  const intl = useIntl();
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
        message.success(intl.formatMessage({ id: 'audit.export.success' }));
      }
    } catch {
      // 全局错误提示已给出
    } finally {
      setExporting(false);
    }
  };

  if (!canRead) {
    return (
      <PageContainer title={intl.formatMessage({ id: 'audit.page.title' })}>
        <Result
          status="403"
          title={intl.formatMessage({ id: 'audit.denied.title' })}
          subTitle={intl.formatMessage({ id: 'audit.denied.subTitle' })}
        />
      </PageContainer>
    );
  }

  /** 操作人展示：有展示名用展示名，否则按已注销用户 / 系统兜底。 */
  const operatorTextOf = (row: AuditLogVO): string =>
    row.operatorName
      ? row.operatorName
      : row.userId
        ? intl.formatMessage({ id: 'audit.operator.deletedUser' }, { userId: row.userId })
        : intl.formatMessage({ id: 'audit.operator.system' });

  const columns: ProColumns<AuditLogVO>[] = [
    {
      title: intl.formatMessage({ id: 'audit.column.logTime' }),
      dataIndex: 'logTime',
      search: false,
      valueType: 'dateTime',
      width: 180,
      fixed: 'left',
    },
    {
      title: intl.formatMessage({ id: 'audit.column.timeRange' }),
      dataIndex: 'startTime',
      hideInTable: true,
      valueType: 'dateTime',
      fieldProps: { placeholder: intl.formatMessage({ id: 'audit.column.timeRangeStart' }) },
      // 列级 search.transform：日期组件交出 Date / 'yyyy-MM-dd HH:mm:ss'，后端要 ISO 本地时间
      search: { transform: (value: unknown) => toBackendDateTime(value) },
    },
    {
      title: intl.formatMessage({ id: 'audit.column.endTime' }),
      dataIndex: 'endTime',
      hideInTable: true,
      valueType: 'dateTime',
      fieldProps: { placeholder: intl.formatMessage({ id: 'audit.column.timeRangeEnd' }) },
      search: { transform: (value: unknown) => toBackendDateTime(value) },
    },
    {
      title: intl.formatMessage({ id: 'audit.column.operator' }),
      dataIndex: 'userId',
      hideInTable: true,
      valueType: 'text',
      fieldProps: {
        placeholder: intl.formatMessage({ id: 'audit.column.operatorIdPlaceholder' }),
      },
    },
    {
      title: intl.formatMessage({ id: 'audit.column.operator' }),
      dataIndex: 'operatorName',
      search: false,
      width: 140,
      render: (_, row) => operatorTextOf(row),
    },
    {
      title: intl.formatMessage({ id: 'audit.column.action' }),
      dataIndex: 'action',
      valueType: 'select',
      width: 150,
      fieldProps: {
        options: AUDIT_ACTION_GROUPS.map((group) => ({
          label: intl.formatMessage({ id: group.labelId }),
          options: group.options.map((option) => ({
            label: intl.formatMessage({ id: option.labelId }),
            value: option.value,
          })),
        })),
        showSearch: true,
        optionFilterProp: 'label',
        placeholder: intl.formatMessage({ id: 'audit.filter.allActions' }),
      },
      render: (_, row) => {
        if (!row.action) {
          return '--';
        }
        const labelId = actionTextId(row.action);
        return labelId ? intl.formatMessage({ id: labelId }) : row.action;
      },
    },
    {
      title: intl.formatMessage({ id: 'audit.column.module' }),
      dataIndex: 'module',
      valueType: 'select',
      width: 120,
      fieldProps: {
        options: Object.entries(AUDIT_MODULE_ENUM).map(([value, meta]) => ({
          label: intl.formatMessage({ id: meta.labelId }),
          value,
        })),
        allowClear: true,
        placeholder: intl.formatMessage({ id: 'audit.filter.all' }),
      },
      render: (_, row) => {
        const meta = AUDIT_MODULE_ENUM[row.module];
        return meta ? (
          <Tag>{intl.formatMessage({ id: meta.labelId })}</Tag>
        ) : (
          <Tag>{row.module || '--'}</Tag>
        );
      },
    },
    {
      title: intl.formatMessage({ id: 'audit.column.targetType' }),
      dataIndex: 'targetType',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        options: AUDIT_TARGET_TYPE_OPTIONS.map((option) => ({
          label: intl.formatMessage({ id: option.labelId }),
          value: option.value,
        })),
        showSearch: true,
        optionFilterProp: 'label',
        allowClear: true,
        placeholder: intl.formatMessage({ id: 'audit.filter.all' }),
      },
    },
    {
      title: intl.formatMessage({ id: 'audit.column.target' }),
      dataIndex: 'targetType',
      search: false,
      width: 170,
      render: (_, row) =>
        row.targetType ? `${row.targetType}${row.targetId ? ` #${row.targetId}` : ''}` : '--',
    },
    {
      title: intl.formatMessage({ id: 'audit.column.result' }),
      dataIndex: 'result',
      valueType: 'select',
      width: 90,
      fieldProps: {
        options: [
          { label: intl.formatMessage({ id: 'audit.result.success' }), value: 0 },
          { label: intl.formatMessage({ id: 'audit.result.failed' }), value: 1 },
        ],
        allowClear: true,
        placeholder: intl.formatMessage({ id: 'audit.filter.all' }),
      },
      render: (_, row) =>
        row.result === 0 ? (
          <Tag color="success">{intl.formatMessage({ id: 'audit.result.success' })}</Tag>
        ) : row.result === 1 ? (
          <Tag color="error">{intl.formatMessage({ id: 'audit.result.failed' })}</Tag>
        ) : (
          <Tag>{intl.formatMessage({ id: 'audit.result.unknown' })}</Tag>
        ),
    },
    {
      title: intl.formatMessage({ id: 'audit.column.ip' }),
      dataIndex: 'ip',
      search: false,
      width: 140,
      render: (_, row) => row.ip || '--',
    },
    {
      title: intl.formatMessage({ id: 'audit.column.traceId' }),
      dataIndex: 'traceId',
      search: false,
      copyable: true,
      width: 160,
      ellipsis: true,
      render: (_, row) => row.traceId || '--',
    },
    {
      title: intl.formatMessage({ id: 'audit.column.detail' }),
      dataIndex: 'detail',
      search: false,
      ellipsis: true,
      render: (_, row) =>
        row.detail ? <Typography.Text title={row.detail}>{row.detail}</Typography.Text> : '--',
    },
  ];

  return (
    <PageContainer
      title={intl.formatMessage({ id: 'audit.page.title' })}
      subTitle={intl.formatMessage({ id: 'audit.page.subTitle' })}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={intl.formatMessage({ id: 'audit.criteria.title' })}
        description={
          <span>
            {intl.formatMessage({ id: 'audit.criteria.operatorPrefix' })}
            <b>{intl.formatMessage({ id: 'audit.criteria.operatorStrong' })}</b>
            {intl.formatMessage({ id: 'audit.criteria.operatorSuffix' })}
            {intl.formatMessage({ id: 'audit.criteria.timePrefix' })}
            <code>logTime</code>
            {intl.formatMessage({ id: 'audit.criteria.timeSuffix' })}
            {intl.formatMessage({ id: 'audit.criteria.export' })}
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
            userId: asStringParam(params.userId),
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
              {intl.formatMessage({ id: 'common.action.refresh' })}
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={handleExport}
            >
              {intl.formatMessage({ id: 'audit.toolbar.export' })}
            </Button>
          </Space>,
        ]}
      />
    </PageContainer>
  );
};

export default AuditPage;
