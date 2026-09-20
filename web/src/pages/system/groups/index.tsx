/**
 * 群组管理（{@code /system/groups}）—— <b>当前无可用接口，本页如实说明</b>。
 *
 * <p><b>为什么不建表格式页面</b>：库里有 {@code sys_group} / {@code sys_group_member}
 * （V1 建表、V4 补充），服务端也有 {@code GroupMember} 实体，但<b>没有任何群组管理控制器</b>
 * ——现有群组成员关系只服务于协作域的访问判定，由协作逻辑内部读写。</p>
 *
 * <p>按项目契约红线「前端不臆造 perm_code、不为未实现接口造模拟数据」，
 * 本页不渲染假列表、不放点了必然 404 的按钮，只把缺口、现状与补齐所需的接口列清楚，
 * 便于后续排期时直接对照。授权抽屉等其他能力不受影响。</p>
 */

import { PageContainer } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Alert, Descriptions, Space, Table, Tag, Typography } from 'antd';

import SectionCard from '@/components/SectionCard';

/** 补齐群组管理所需的接口（现状全部未实现，列在此处作为排期清单；purposeId 为 i18n id）。 */
const MISSING_ENDPOINTS: readonly {
  method: string;
  path: string;
  purposeId: string;
}[] = [
  {
    method: 'GET',
    path: '/api/v1/system/groups',
    purposeId: 'system.group.endpoint.groups.page',
  },
  {
    method: 'GET',
    path: '/api/v1/system/groups/{id}',
    purposeId: 'system.group.endpoint.groups.detail',
  },
  {
    method: 'POST',
    path: '/api/v1/system/groups',
    purposeId: 'system.group.endpoint.groups.create',
  },
  {
    method: 'PUT',
    path: '/api/v1/system/groups/{id}',
    purposeId: 'system.group.endpoint.groups.update',
  },
  {
    method: 'DELETE',
    path: '/api/v1/system/groups/{id}',
    purposeId: 'system.group.endpoint.groups.remove',
  },
  {
    method: 'GET',
    path: '/api/v1/system/groups/{id}/members',
    purposeId: 'system.group.endpoint.members.list',
  },
  {
    method: 'PUT',
    path: '/api/v1/system/groups/{id}/members',
    purposeId: 'system.group.endpoint.members.replace',
  },
];

const GroupPage = () => {
  const intl = useIntl();
  return (
    <PageContainer
      title={intl.formatMessage({ id: 'system.group.title' })}
      subTitle={intl.formatMessage({ id: 'system.group.subtitle' })}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        title={intl.formatMessage({ id: 'system.group.alert.title' })}
        description={intl.formatMessage({ id: 'system.group.alert.desc' })}
      />

      <SectionCard
        title={intl.formatMessage({ id: 'system.group.section.current.title' })}
        subTitle={intl.formatMessage({ id: 'system.group.section.current.subtitle' })}
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item
            label={intl.formatMessage({ id: 'system.group.desc.table' })}
          >
            <Space size={6}>
              <Typography.Text code>sys_group</Typography.Text>
              <Typography.Text code>sys_group_member</Typography.Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item
            label={intl.formatMessage({ id: 'system.group.desc.entity' })}
          >
            <Typography.Text code>GroupMember</Typography.Text>
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              {intl.formatMessage({ id: 'system.group.entity.note' })}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item
            label={intl.formatMessage({ id: 'system.group.desc.perm' })}
          >
            <Typography.Text type="secondary">
              {intl.formatMessage({ id: 'system.group.perm.none' })}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item
            label={intl.formatMessage({ id: 'system.group.desc.availability' })}
          >
            <Tag color="default">
              {intl.formatMessage({ id: 'system.group.availability.readonly' })}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </SectionCard>

      <SectionCard
        title={intl.formatMessage({ id: 'system.group.section.endpoints.title' })}
        subTitle={intl.formatMessage({ id: 'system.group.section.endpoints.subtitle' })}
      >
        <Table
          rowKey="path"
          size="small"
          pagination={false}
          dataSource={MISSING_ENDPOINTS}
          columns={[
            {
              title: intl.formatMessage({ id: 'system.group.column.method' }),
              dataIndex: 'method',
              width: 90,
              render: (method: string) => <Tag>{method}</Tag>,
            },
            {
              title: intl.formatMessage({ id: 'system.group.column.path' }),
              dataIndex: 'path',
              render: (path: string) => (
                <Typography.Text code>{path}</Typography.Text>
              ),
            },
            {
              title: intl.formatMessage({ id: 'system.group.column.purpose' }),
              dataIndex: 'purposeId',
              render: (purposeId: string) => intl.formatMessage({ id: purposeId }),
            },
          ]}
        />
      </SectionCard>
    </PageContainer>
  );
};

export default GroupPage;
