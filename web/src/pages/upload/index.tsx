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
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeploymentUnitOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  ProfileOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Select,
  Space,
  Steps,
  Table,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd';
import { useMemo, useState } from 'react';

import CodeBlock from '@/components/CodeBlock';
import { ChunkUpload, formatBytes } from '@/components/ChunkUpload';
import SectionCard from '@/components/SectionCard';
import {
  MAX_CHUNK_SIZE,
  MAX_CONCURRENCY,
} from '@/services/upload/constants';
import type { PartPayloadMode } from '@/services/upload/endpoints';
import type { UploadTaskView } from '@/services/upload/types';

import useStyles from './index.style';

const { Paragraph, Text } = Typography;

/** 演示队列 id：同一 id 的多个组件/多次挂载共享同一份上传队列 */
const DEMO_ID = 'upload-demo';

/** 某种上传方式当前生效的参数；两种方式各存一份，切方式时互不干扰 */
interface ModeConfig {
  chunkSize: number;
  concurrency: number;
}

/**
 * 两种方式的默认参数刻意不同。
 *
 * <p>表单分片每个分片都要过一遍 `FormData` 封装、服务端还要走 multipart 解析，
 * 取组件默认的 4 MiB / 3 并发更稳；裸流少一层封装与一次内存拷贝，按契约上限
 * 8 MiB / 5 并发能吃满吞吐。两者都只是**默认值**，卡片上的下拉框随时可改。</p>
 */
const MODE_CONFIG_DEFAULTS: Record<PartPayloadMode, ModeConfig> = {
  multipart: { chunkSize: 4 * 1024 * 1024, concurrency: 3 },
  'octet-stream': { chunkSize: 8 * 1024 * 1024, concurrency: 5 },
};

/** 分片大小档位（1 MiB 起步，契约上限 8 MiB） */
const CHUNK_SIZE_OPTIONS = [1, 2, 4, 8]
  .map((mb) => mb * 1024 * 1024)
  .filter((value) => value <= MAX_CHUNK_SIZE)
  .map((value) => ({ value, label: `${value / 1024 / 1024} MB` }));

/** 单文件并发分片档位（契约上限 5） */
const CONCURRENCY_OPTIONS = Array.from(
  { length: MAX_CONCURRENCY },
  (_unused, index) => index + 1,
).map((value) => ({ value, label: value }));

/** 方式卡片元数据：只存 i18n id 与展示素材，文案在渲染时解析（否则切语言不会变） */
interface ModePreset {
  key: PartPayloadMode;
  icon: React.ReactNode;
  titleId: string;
  /** `Content-Type` / 请求体形态的短标记 */
  tagId: string;
  descId: string;
  requestId: string;
  sceneId: string;
  /** 后端是否已接收该请求体形态；false 时卡片给出明确警示而非静默放着 */
  supported: boolean;
  unsupportedId?: string;
}

const MODE_PRESETS: ModePreset[] = [
  {
    key: 'multipart',
    icon: <ProfileOutlined />,
    titleId: 'upload.mode.multipart.title',
    tagId: 'upload.mode.multipart.tag',
    descId: 'upload.mode.multipart.desc',
    requestId: 'upload.mode.multipart.request',
    sceneId: 'upload.mode.multipart.scene',
    supported: true,
  },
  {
    key: 'octet-stream',
    icon: <ThunderboltOutlined />,
    titleId: 'upload.mode.octetStream.title',
    tagId: 'upload.mode.octetStream.tag',
    descId: 'upload.mode.octetStream.desc',
    requestId: 'upload.mode.octetStream.request',
    sceneId: 'upload.mode.octetStream.scene',
    // 前端这条链路已实现，但 at-transfer 的分片接口目前只声明
    // consumes = multipart/form-data（@RequestParam MultipartFile chunk），
    // 裸流会被 Spring 判为 415。后端支持裸流接收后，把这里改成 true 即可。
    supported: false,
    unsupportedId: 'upload.mode.octetStream.unsupported',
  },
];

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

/**
 * 接入示例源码。注释保留中文：这段代码是要被人原样抄进业务页的，
 * 让注释跟着代码走，比拆成两份翻译更不容易和代码本身走样。
 */
const COMPONENT_USAGE_SNIPPET = `import { ChunkUpload } from '@/components/ChunkUpload';

<ChunkUpload
  id="upload-demo"            // 同 id 共享同一上传队列，切页不中断
  chunkSize={4 * 1024 * 1024} // 4 MiB，契约上限 8 MiB
  concurrency={3}             // 单文件并发分片数，上限 5
  partPayloadMode="multipart" // 'multipart' | 'octet-stream'，按任务生效
  extra={{ spaceId: 'demo' }} // 透传给预检的业务字段
  onTaskSuccess={(task) => console.log(task.fileId)}
/>`;

const HOOK_USAGE_SNIPPET = `import { useChunkUpload } from '@/hooks/useChunkUpload';

function MyUploader() {
  // 与 <ChunkUpload id="upload-demo" /> 用同一个 id，即共用同一条队列
  const { tasks, resumable, start, pauseAll, clearFinished } = useChunkUpload({
    id: 'upload-demo',
    chunkSize: 4 * 1024 * 1024, // 契约上限 8 MiB
    concurrency: 3,             // 上限 5
  });

  return (
    <>
      <input type="file" multiple onChange={(e) => start(e.target.files ?? [])} />
      <button onClick={pauseAll}>全部暂停</button>
      <button onClick={clearFinished}>清除已结束</button>
      <span>{tasks.length} 个任务（{resumable.length} 条待续传）</span>
    </>
  );
}`;

/**
 * 接入方式页签。代码与其要点绑成一个整体一起切换——
 * 分成两个独立区域会让「看到的是 Hook 代码、读到的是组件要点」这种错位成为可能。
 */
const USAGE_TABS = [
  {
    key: 'component',
    labelId: 'upload.demo.usage.tab.component',
    snippet: COMPONENT_USAGE_SNIPPET,
    title: 'ChunkUpload',
    pointIds: [
      'upload.demo.usage.component.point1',
      'upload.demo.usage.component.point2',
      'upload.demo.usage.component.point3',
    ],
  },
  {
    key: 'hook',
    labelId: 'upload.demo.usage.tab.hook',
    snippet: HOOK_USAGE_SNIPPET,
    title: 'useChunkUpload',
    pointIds: [
      'upload.demo.usage.hook.point1',
      'upload.demo.usage.hook.point2',
      'upload.demo.usage.hook.point3',
    ],
  },
];

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
  const { styles } = useStyles();
  const intl = useIntl();
  const [finished, setFinished] = useState<FinishedItem[]>([]);
  const [activeMode, setActiveMode] = useState<PartPayloadMode>('multipart');
  const [modeConfig, setModeConfig] = useState<
    Record<PartPayloadMode, ModeConfig>
  >(() => ({
    multipart: { ...MODE_CONFIG_DEFAULTS.multipart },
    'octet-stream': { ...MODE_CONFIG_DEFAULTS['octet-stream'] },
  }));

  const activeConfig = modeConfig[activeMode];

  /**
   * 改的是「某种方式自己的」参数：在非当前方式上也能先调好再切过去，
   * 而不是切过去再改——后者会把另一种方式的配置一起带走。
   */
  const updateModeConfig = (mode: PartPayloadMode, patch: Partial<ModeConfig>) => {
    setModeConfig((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], ...patch },
    }));
  };

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

        <SectionCard
          title={intl.formatMessage({ id: 'upload.mode.title' })}
          subTitle={intl.formatMessage({ id: 'upload.mode.subtitle' })}
          icon={<DeploymentUnitOutlined />}
        >
          <div className={styles.modeGrid}>
            {MODE_PRESETS.map((preset) => {
              const active = preset.key === activeMode;
              const config = modeConfig[preset.key];
              return (
                <Card
                  key={preset.key}
                  variant="outlined"
                  className={active ? styles.modeCardActive : styles.modeCard}
                  styles={{ body: { height: '100%', boxSizing: 'border-box' } }}
                >
                  <div className={styles.modeBody}>
                    <div className={styles.modeHead}>
                      <span className={styles.modeIcon}>{preset.icon}</span>
                      <div className={styles.modeTitleWrap}>
                        <span className={styles.modeTitle}>
                          {intl.formatMessage({ id: preset.titleId })}
                        </span>
                        <span className={styles.modeTag}>
                          {intl.formatMessage({ id: preset.tagId })}
                        </span>
                      </div>
                      {preset.supported ? null : (
                        <Tag color="warning">
                          {intl.formatMessage({
                            id: 'upload.mode.unsupportedTag',
                          })}
                        </Tag>
                      )}
                      {active ? (
                        <Tag color="processing">
                          {intl.formatMessage({ id: 'upload.mode.active' })}
                        </Tag>
                      ) : null}
                    </div>

                    <Paragraph type="secondary" style={{ margin: 0 }}>
                      <CodeText
                        text={intl.formatMessage({ id: preset.descId })}
                      />
                    </Paragraph>

                    <ul className={styles.modeFacts}>
                      <li className={styles.modeFact}>
                        <span className={styles.modeFactLabel}>
                          {intl.formatMessage({
                            id: 'upload.mode.fact.request',
                          })}
                        </span>
                        <span className={styles.modeFactValue}>
                          <CodeText
                            text={intl.formatMessage({ id: preset.requestId })}
                          />
                        </span>
                      </li>
                      <li className={styles.modeFact}>
                        <span className={styles.modeFactLabel}>
                          {intl.formatMessage({ id: 'upload.mode.fact.scene' })}
                        </span>
                        <span className={styles.modeFactValue}>
                          {intl.formatMessage({ id: preset.sceneId })}
                        </span>
                      </li>
                    </ul>

                    {preset.unsupportedId ? (
                      <Alert
                        type="warning"
                        showIcon
                        title={
                          <CodeText
                            text={intl.formatMessage({
                              id: preset.unsupportedId,
                            })}
                          />
                        }
                      />
                    ) : null}

                    {/* 参数属于「方式」而不是「页面」：可以先在非当前方式上调好再切过去 */}
                    <div className={styles.modeConfig}>
                      <Space size={12} wrap>
                        <Space size={6}>
                          <Text type="secondary">
                            {intl.formatMessage({
                              id: 'component.chunkUpload.chunkSize',
                            })}
                          </Text>
                          <Select
                            size="small"
                            value={config.chunkSize}
                            style={{ width: 96 }}
                            options={CHUNK_SIZE_OPTIONS}
                            onChange={(value) =>
                              updateModeConfig(preset.key, {
                                chunkSize: value,
                              })
                            }
                          />
                        </Space>
                        <Space size={6}>
                          <Text type="secondary">
                            {intl.formatMessage({
                              id: 'component.chunkUpload.concurrency',
                            })}
                          </Text>
                          <Select
                            size="small"
                            value={config.concurrency}
                            style={{ width: 72 }}
                            options={CONCURRENCY_OPTIONS}
                            onChange={(value) =>
                              updateModeConfig(preset.key, {
                                concurrency: value,
                              })
                            }
                          />
                        </Space>
                      </Space>
                    </div>

                    <div className={styles.modeFoot}>
                      {active ? null : (
                        <Button
                          type="primary"
                          onClick={() => setActiveMode(preset.key)}
                        >
                          {intl.formatMessage({ id: 'upload.mode.use' })}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <Paragraph type="secondary" style={{ margin: '16px 0 0' }}>
            <InfoCircleOutlined />{' '}
            {intl.formatMessage({ id: 'upload.mode.switchHint' })}
          </Paragraph>
        </SectionCard>

        <ChunkUpload
          id={DEMO_ID}
          title={intl.formatMessage({ id: 'upload.demo.chunkTitle' })}
          partPayloadMode={activeMode}
          chunkSize={activeConfig.chunkSize}
          concurrency={activeConfig.concurrency}
          // 分片大小/并发已经由上面的方式卡片统一配置，组件内部那行调节项不再重复出现
          showTuning={false}
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
          <Tabs
            items={USAGE_TABS.map((tab) => ({
              key: tab.key,
              label: intl.formatMessage({ id: tab.labelId }),
              children: (
                <div className={styles.usagePanel}>
                  <CodeBlock
                    code={tab.snippet}
                    language="tsx"
                    title={tab.title}
                  />
                  <ul className={styles.usagePoints}>
                    {tab.pointIds.map((pointId) => (
                      <li key={pointId} className={styles.usagePoint}>
                        <CheckCircleOutlined
                          className={styles.usagePointIcon}
                        />
                        <span>
                          <CodeText
                            text={intl.formatMessage({ id: pointId })}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            }))}
          />
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
