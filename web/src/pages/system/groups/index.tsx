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
import { Alert, Descriptions, Space, Table, Tag, Typography } from 'antd';

import SectionCard from '@/components/SectionCard';

/** 补齐群组管理所需的接口（现状全部未实现，列在此处作为排期清单）。 */
const MISSING_ENDPOINTS: readonly {
  method: string;
  path: string;
  purpose: string;
}[] = [
  {
    method: 'GET',
    path: '/api/v1/system/groups',
    purpose: '群组分页 / 关键字检索',
  },
  { method: 'GET', path: '/api/v1/system/groups/{id}', purpose: '群组详情' },
  { method: 'POST', path: '/api/v1/system/groups', purpose: '创建群组' },
  {
    method: 'PUT',
    path: '/api/v1/system/groups/{id}',
    purpose: '编辑群组（名称 / 备注 / 负责人）',
  },
  { method: 'DELETE', path: '/api/v1/system/groups/{id}', purpose: '删除群组' },
  {
    method: 'GET',
    path: '/api/v1/system/groups/{id}/members',
    purpose: '成员列表',
  },
  {
    method: 'PUT',
    path: '/api/v1/system/groups/{id}/members',
    purpose: '整集替换成员',
  },
];

const GroupPage = () => {
  return (
    <PageContainer title="群组管理" subTitle="暂未开放">
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        title="CE 版未提供群组管理接口，本页暂为占位说明"
        description={
          <span>
            数据表 <code>sys_group</code> / <code>sys_group_member</code>{' '}
            已存在，
            但服务端没有对应的管理控制器与权限点。为避免给出「点了必然失败」的入口，
            这里不提供增删改操作，也不渲染模拟数据。
          </span>
        }
      />

      <SectionCard
        title="现状"
        subTitle="数据表、服务端实体与权限点"
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="数据表">
            <Space size={6}>
              <Typography.Text code>sys_group</Typography.Text>
              <Typography.Text code>sys_group_member</Typography.Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="服务端实体">
            <Typography.Text code>GroupMember</Typography.Text>
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              仅协作域内部使用（访问判定），无对外 CRUD
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="权限点">
            <Typography.Text type="secondary">
              无 <code>system:group:*</code> 权限点（V9 只定义了 system:user:*
              与 system:role:*）
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="当前可用性">
            <Tag color="default">只读不可用（无接口）</Tag>
          </Descriptions.Item>
        </Descriptions>
      </SectionCard>

      <SectionCard title="补齐所需接口" subTitle="排期清单">
        <Table
          rowKey="path"
          size="small"
          pagination={false}
          dataSource={MISSING_ENDPOINTS}
          columns={[
            {
              title: '方法',
              dataIndex: 'method',
              width: 90,
              render: (method: string) => <Tag>{method}</Tag>,
            },
            {
              title: '路径',
              dataIndex: 'path',
              render: (path: string) => (
                <Typography.Text code>{path}</Typography.Text>
              ),
            },
            { title: '用途', dataIndex: 'purpose' },
          ]}
        />
      </SectionCard>
    </PageContainer>
  );
};

export default GroupPage;
