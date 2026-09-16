/**
 * 分片上传示例页（/upload）。
 *
 * 两个用途：
 * 1. 演示 {@link ChunkUpload} 的完整交互：秒传、断点续传、并发分片、失败重试、暂停/取消；
 * 2. 作为「组件怎么接」的可运行样例——「接入方式」卡片里的代码就是本页用法。
 *
 * 页面本身不承载业务：真正的文件列表/空间归属随后端 at-transfer 接口落地再接。
 */

import {
  CloudUploadOutlined,
  LinkOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Alert, Space, Steps, Table, Tag, Typography, theme } from 'antd';
import { useMemo, useState } from 'react';

import { ChunkUpload, formatBytes } from '@/components/ChunkUpload';
import SectionCard from '@/components/SectionCard';
import type { UploadTaskView } from '@/services/upload/types';

const { Paragraph, Text } = Typography;

/** 与组件默认值保持一致：4 MiB / 3 并发 */
const CHUNK_SIZE = 4 * 1024 * 1024;
const CONCURRENCY = 3;
/** 演示队列 id：同一 id 的多个组件/多次挂载共享同一份上传队列 */
const DEMO_ID = 'upload-demo';

const PIPELINE = [
  { title: '计算校验值', description: 'Worker 内增量 SHA-256，主线程不卡' },
  { title: '秒传预检', description: '摘要命中即完成，0 字节传输' },
  { title: '查询已收分片', description: '以服务端清单为准' },
  { title: '并发补传分片', description: '默认 3 并发，失败退避重试' },
  { title: '合并校验', description: '服务端整件重算摘要后合并' },
];

const USAGE_SNIPPET = `import { ChunkUpload } from '@/components/ChunkUpload';

<ChunkUpload
  id="upload-demo"            // 同 id 共享同一上传队列，切页不中断
  chunkSize={4 * 1024 * 1024} // 4 MiB，契约上限 8 MiB
  concurrency={3}             // 单文件并发分片数，上限 5
  extra={{ spaceId: 'demo' }} // 透传给预检的业务字段
  onTaskSuccess={(task) => console.log(task.fileId)}
/>`;

interface FinishedItem {
  key: string;
  fileName: string;
  size: number;
  instant: boolean;
  fileId?: string;
}

/** 已完成列表最多保留的条数，避免演示页无限增长 */
const MAX_FINISHED = 8;

export default function UploadDemoPage() {
  const { token } = theme.useToken();
  const [finished, setFinished] = useState<FinishedItem[]>([]);

  const handleSuccess = (task: UploadTaskView) => {
    setFinished((prev) =>
      [
        {
          key: `${task.id}-${task.fileId ?? ''}`,
          fileName: task.fileName,
          size: task.size,
          instant: task.instant,
          fileId: task.fileId,
        },
        ...prev,
      ].slice(0, MAX_FINISHED),
    );
  };

  const columns = useMemo(
    () => [
      {
        title: '文件名',
        dataIndex: 'fileName',
        ellipsis: true,
      },
      {
        title: '大小',
        dataIndex: 'size',
        width: 110,
        render: (size: number) => formatBytes(size),
      },
      {
        title: '方式',
        dataIndex: 'instant',
        width: 110,
        render: (instant: boolean) =>
          instant ? (
            <Tag color="purple">秒传</Tag>
          ) : (
            <Tag color="blue">分片上传</Tag>
          ),
      },
      {
        title: 'fileId',
        dataIndex: 'fileId',
        width: 220,
        render: (fileId?: string) => <Text code>{fileId ?? '-'}</Text>,
      },
    ],
    [],
  );

  return (
    <PageContainer
      header={{
        title: '分片上传',
        subTitle: '秒传 · 断点续传 · 并发分片',
      }}
    >
      <Space
        orientation="vertical"
        size={token.marginMD}
        style={{ width: '100%' }}
      >
        <SectionCard
          title="上传链路"
          subTitle="摘要 → 秒传 → 补传 → 合并"
          icon={<CloudUploadOutlined />}
        >
          <Steps
            size="small"
            responsive
            labelPlacement="vertical"
            items={PIPELINE}
          />
          <Paragraph type="secondary" style={{ margin: '16px 0 0' }}>
            大文件先在本机算出摘要，服务端据此判定能否秒传；未命中则只补传缺失分片，
            任意时刻刷新页面，重新选择同一文件即可从服务端已收位置继续。
          </Paragraph>
        </SectionCard>

        <ChunkUpload
          id={DEMO_ID}
          title="分片上传演示"
          chunkSize={CHUNK_SIZE}
          concurrency={CONCURRENCY}
          extra={{ spaceId: 'demo-space' }}
          onTaskSuccess={handleSuccess}
        />

        {finished.length > 0 ? (
          <SectionCard
            title="已完成文件"
            subTitle={`最多保留最近 ${MAX_FINISHED} 条`}
            icon={<UnorderedListOutlined />}
          >
            <Table<FinishedItem>
              size="small"
              rowKey="key"
              columns={columns}
              dataSource={finished}
              pagination={false}
            />
          </SectionCard>
        ) : null}

        <SectionCard title="接入方式" subTitle="组件与 Hook 两种用法">
          <Paragraph type="secondary">
            组件已内置队列与进度展示；若要在业务页自己控制布局，可直接用 Hook
            <Text code>useChunkUpload()</Text>，它返回
            <Text code>tasks</Text> / <Text code>resumable</Text> 快照与
            <Text code>start</Text> / <Text code>pause</Text> /
            <Text code>resume</Text> / <Text code>retry</Text> /
            <Text code>cancel</Text> 等动作。
          </Paragraph>
          <pre
            style={{
              margin: '0 0 16px',
              padding: token.paddingSM,
              background: token.colorFillQuaternary,
              borderRadius: token.borderRadiusLG,
              fontSize: token.fontSizeSM,
              overflowX: 'auto',
            }}
          >
            <code>{USAGE_SNIPPET}</code>
          </pre>
          <Alert
            type="info"
            showIcon
            title="如何试跑"
            description={
              <Space orientation="vertical" size={2}>
                <Text>
                  本页自带本地 mock（
                  <Text code>src/pages/upload/_mock.ts</Text>，umi
                  只加载页面目录下的
                  <Text code>_mock.ts</Text>）：用{' '}
                  <Text code>npm run start</Text>
                  启动（自动开启
                  mock）时，上传链路可离线走通，同一文件再传一次即命中秒传。
                </Text>
                <Text type="secondary">
                  <LinkOutlined /> 用 <Text code>npm run dev</Text> 启动会关闭
                  mock，并把
                  <Text code>/api</Text> 代理到 <Text code>localhost:8080</Text>
                  ，此时需要后端 at-transfer 的接口已就绪。
                </Text>
                <Text type="secondary">
                  注意：与其它业务页一样，本页受登录守卫保护（未登录会跳到
                  <Text code>/user/login</Text>）；登录接口目前没有 mock，需后端
                  at-auth 就绪，因此 mock 只覆盖「上传链路」这一段。
                </Text>
              </Space>
            }
          />
        </SectionCard>
      </Space>
    </PageContainer>
  );
}
