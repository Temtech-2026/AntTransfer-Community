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
import { useIntl } from '@umijs/max';
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

/** 上传链路步骤：只存 i18n id，文案在渲染时解析（否则切语言不会变） */
const PIPELINE_STEPS = [
  { titleId: 'upload.demo.step.hash.title', descId: 'upload.demo.step.hash.desc' },
  {
    titleId: 'upload.demo.step.precheck.title',
    descId: 'upload.demo.step.precheck.desc',
  },
  {
    titleId: 'upload.demo.step.query.title',
    descId: 'upload.demo.step.query.desc',
  },
  {
    titleId: 'upload.demo.step.upload.title',
    descId: 'upload.demo.step.upload.desc',
  },
  {
    titleId: 'upload.demo.step.merge.title',
    descId: 'upload.demo.step.merge.desc',
  },
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

/**
 * 把文案里的反引号片段渲染成行内代码。
 *
 * <p>用「一条完整文案 + 反引号标记」而不是把句子拆成多个 JSX 片段，
 * 是因为中英文的语序不同：拆开写会把语序固化在 JSX 里，英文只能凑合。</p>
 */
function CodeText({ text }: { text: string }) {
  const parts = text.split('`');
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: 片段由同一条文案切分而来，序号即稳定身份
          <Text code key={`code-${index}`}>
            {part}
          </Text>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: 片段由同一条文案切分而来，序号即稳定身份
          <span key={`text-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

export default function UploadDemoPage() {
  const { token } = theme.useToken();
  const intl = useIntl();
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
        title: intl.formatMessage({ id: 'file.column.name' }),
        dataIndex: 'fileName',
        ellipsis: true,
      },
      {
        title: intl.formatMessage({ id: 'file.column.size' }),
        dataIndex: 'size',
        width: 110,
        render: (size: number) => formatBytes(size),
      },
      {
        title: intl.formatMessage({ id: 'upload.column.method' }),
        dataIndex: 'instant',
        width: 110,
        render: (instant: boolean) =>
          instant ? (
            <Tag color="purple">
              {intl.formatMessage({ id: 'upload.instant' })}
            </Tag>
          ) : (
            <Tag color="blue">
              {intl.formatMessage({ id: 'upload.column.chunked' })}
            </Tag>
          ),
      },
      {
        title: 'fileId',
        dataIndex: 'fileId',
        width: 220,
        render: (fileId?: string) => <Text code>{fileId ?? '-'}</Text>,
      },
    ],
    [intl],
  );

  const pipelineItems = useMemo(
    () =>
      PIPELINE_STEPS.map((step) => ({
        title: intl.formatMessage({ id: step.titleId }),
        description: intl.formatMessage({ id: step.descId }),
      })),
    [intl],
  );

  return (
    <PageContainer
      header={{
        title: intl.formatMessage({ id: 'upload.demo.pageTitle' }),
        subTitle: intl.formatMessage({ id: 'upload.demo.pageSubtitle' }),
      }}
    >
      <Space
        orientation="vertical"
        size={token.marginMD}
        style={{ width: '100%' }}
      >
        <SectionCard
          title={intl.formatMessage({ id: 'upload.demo.pipeline.title' })}
          subTitle={intl.formatMessage({
            id: 'upload.demo.pipeline.subtitle',
          })}
          icon={<CloudUploadOutlined />}
        >
          <Steps
            size="small"
            responsive
            labelPlacement="vertical"
            items={pipelineItems}
          />
          <Paragraph type="secondary" style={{ margin: '16px 0 0' }}>
            {intl.formatMessage({ id: 'upload.demo.pipeline.desc' })}
          </Paragraph>
        </SectionCard>

        <ChunkUpload
          id={DEMO_ID}
          title={intl.formatMessage({ id: 'upload.demo.chunkTitle' })}
          chunkSize={CHUNK_SIZE}
          concurrency={CONCURRENCY}
          extra={{ spaceId: 'demo-space' }}
          onTaskSuccess={handleSuccess}
        />

        {finished.length > 0 ? (
          <SectionCard
            title={intl.formatMessage({ id: 'upload.demo.finished.title' })}
            subTitle={intl.formatMessage(
              { id: 'upload.demo.finished.subtitle' },
              { count: MAX_FINISHED },
            )}
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

        <SectionCard
          title={intl.formatMessage({ id: 'upload.demo.usage.title' })}
          subTitle={intl.formatMessage({ id: 'upload.demo.usage.subtitle' })}
        >
          <Paragraph type="secondary">
            <CodeText
              text={intl.formatMessage({ id: 'upload.demo.usage.desc' })}
            />
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
            title={intl.formatMessage({ id: 'upload.demo.tryRun.title' })}
            description={
              <Space orientation="vertical" size={2}>
                <Text>
                  <CodeText
                    text={intl.formatMessage({
                      id: 'upload.demo.tryRun.localMock',
                    })}
                  />
                </Text>
                <Text type="secondary">
                  <LinkOutlined />{' '}
                  <CodeText
                    text={intl.formatMessage({
                      id: 'upload.demo.tryRun.dev',
                    })}
                  />
                </Text>
                <Text type="secondary">
                  <CodeText
                    text={intl.formatMessage({
                      id: 'upload.demo.tryRun.auth',
                    })}
                  />
                </Text>
              </Space>
            }
          />
        </SectionCard>
      </Space>
    </PageContainer>
  );
}
