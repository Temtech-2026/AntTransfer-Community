/**
 * 文件工作台。
 *
 * <p>页面职责：目录导航（面包屑 + 子目录）+ 文件列表（类型 / 时间 / 密级筛选）
 * + 操作入口（预览 / 下载 / 分享 / 申请权限 / 删除）+ 回收站（还原 / 彻底销毁）+ 上传弹窗。</p>
 *
 * <p>三处刻意的设计：</p>
 * <ul>
 *   <li><b>上传队列由页面持有</b>：`useChunkUpload` 在页面层调用，弹窗只接收 `uploader`。
 *       这样关闭弹窗后传输继续（控制器在模块级注册表里），工具栏还能显示「上传中 N」。</li>
 *   <li><b>权限点只控「渲染」</b>：按钮用 `&lt;Access&gt;` 包裹，但真正的安全边界在后端
 *       `@RequiresPerm`。前端隐藏按钮只是体验优化，绝不能当权限校验用。</li>
 *   <li><b>删除 / 彻底销毁是两件事，不能共用一个确认框</b>：`DELETE /files/{id}` 只是
 *       「移入回收站」（可还原，`file:edit`），`DELETE /files/{id}/destroy` 才是不可撤销的
 *       物理销毁（`file:destroy`）。混在一起会让用户在「以为只是删除」的情况下真的毁掉文件，
 *       所以前者确认级别 `danger`、后者 `critical`，且只有后者显示不可撤销提示。</li>
 * </ul>
 */

import {
  AudioOutlined,
  ClearOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileTextOutlined,
  FileUnknownOutlined,
  FileWordOutlined,
  FileZipOutlined,
  FolderOutlined,
  ReloadOutlined,
  RollbackOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  Breadcrumb,
  Button,
  message,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { Dayjs } from 'dayjs';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Access } from '@/components/Access';
import { formatBytes } from '@/components/ChunkUpload';
import { useDangerConfirm } from '@/components/DangerConfirm';
import SectionCard from '@/components/SectionCard';
import { useChunkUpload } from '@/hooks/useChunkUpload';
import {
  buildFileQuery,
  destroyNode,
  downloadNode,
  EXT_SELECT_OPTIONS,
  emptyRecycle,
  type FileNode,
  type FileTableParams,
  type FolderNode,
  fetchFolderTree,
  LEVEL_OPTIONS,
  levelColor,
  levelText,
  pageFiles,
  pageRecycleFiles,
  recycleNode,
  restoreNode,
  type TableSorter,
} from '@/services/file';

import PermissionApplyModal from './components/PermissionApplyModal';
import PreviewModal from './components/PreviewModal';
import ShareModal from './components/ShareModal';
import UploadModal from './components/UploadModal';
import { folderChildren, folderPath } from './folder-tree';
import useStyles from './index.style';

const { Text } = Typography;

/** 上传队列 id：页面与弹窗共享同一控制器 */
const UPLOAD_QUEUE_ID = 'file-workbench';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'aac', 'ogg'];
const ZIP_EXTS = ['zip', 'rar', '7z', 'tar', 'gz'];
const WORD_EXTS = ['doc', 'docx'];
const EXCEL_EXTS = ['xls', 'xlsx', 'csv'];
const PPT_EXTS = ['ppt', 'pptx'];
const TEXT_EXTS = ['txt', 'md', 'log', 'json', 'xml', 'yml', 'yaml'];

/** 按扩展名给出图标（纯展示，不参与任何判定）。 */
function FileIcon({ ext }: { ext?: string | null }) {
  const { styles } = useStyles();
  const name = (ext ?? '').toLowerCase();
  if (IMAGE_EXTS.includes(name)) {
    return <FileImageOutlined className={styles.iconImage} />;
  }
  if (VIDEO_EXTS.includes(name)) {
    return <VideoCameraOutlined className={styles.iconVideo} />;
  }
  if (AUDIO_EXTS.includes(name)) {
    return <AudioOutlined className={styles.iconAudio} />;
  }
  if (ZIP_EXTS.includes(name)) {
    return <FileZipOutlined className={styles.iconZip} />;
  }
  if (name === 'pdf') {
    return <FilePdfOutlined className={styles.iconPdf} />;
  }
  if (WORD_EXTS.includes(name)) {
    return <FileWordOutlined className={styles.iconWord} />;
  }
  if (EXCEL_EXTS.includes(name)) {
    return <FileExcelOutlined className={styles.iconExcel} />;
  }
  if (PPT_EXTS.includes(name)) {
    return <FilePptOutlined className={styles.iconPpt} />;
  }
  if (TEXT_EXTS.includes(name)) {
    return <FileTextOutlined className={styles.iconText} />;
  }
  return <FileUnknownOutlined className={styles.iconUnknown} />;
}

export default function FileWorkbenchPage() {
  const { token } = theme.useToken();
  const { styles } = useStyles();
  const actionRef = useRef<ActionType>(null);

  /** 当前目录；undefined = 根目录 */
  const [folderId, setFolderId] = useState<number | undefined>(undefined);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewNode, setPreviewNode] = useState<FileNode | null>(null);
  const [shareNode, setShareNode] = useState<FileNode | null>(null);
  const [applyNode, setApplyNode] = useState<FileNode | null>(null);
  /**
   * 回收站视角开关。
   *
   * <p>回收站是**另一个数据源**（`GET /files/recycle`）而不是本地过滤，因此这里只存一个布尔量，
   * 由它同时决定「请求打到哪个端点」「操作列给哪些动作」「工具栏长什么样」。
   */
  const [recycleMode, setRecycleMode] = useState(false);
  const { confirm } = useDangerConfirm();

  /** 上传队列：关闭弹窗不中断传输，工具栏据此显示进行中数量 */
  const uploader = useChunkUpload({
    id: UPLOAD_QUEUE_ID,
    // 目标目录透传给预检：秒传命中的文件也要记录在正确目录下
    precheckExtra: folderId ? { parentId: folderId } : undefined,
    onTaskSuccess: () => {
      actionRef.current?.reload();
    },
  });

  useEffect(() => {
    let alive = true;
    fetchFolderTree()
      .then((tree) => {
        if (alive) {
          setFolderTree(tree);
        }
      })
      .catch(() => {
        // 目录树拉不到不该阻塞文件列表：降级成「只有面包屑根节点」
        if (alive) {
          setFolderTree([]);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const folders = useMemo(
    () => folderChildren(folderTree, folderId),
    [folderTree, folderId],
  );
  const path = useMemo(
    () => folderPath(folderTree, folderId),
    [folderTree, folderId],
  );
  const uploading = uploader.tasks.filter(
    (task) => !['success', 'error', 'canceled'].includes(task.status),
  ).length;

  /** 下载：换票 → 取件 → 落盘，全程用一条可更新的 toast 反馈进度 */
  const handleDownload = useCallback(async (node: FileNode) => {
    const key = `download-${node.id}`;
    message.open({
      key,
      type: 'loading',
      content: `正在准备下载 ${node.name}`,
      duration: 0,
    });
    try {
      await downloadNode(node, {
        onProgress: (progress) => {
          if (progress.percent > 0) {
            message.open({
              key,
              type: 'loading',
              content: `下载中 ${progress.percent}%`,
              duration: 0,
            });
          }
        },
      });
      message.open({ key, type: 'success', content: `${node.name} 下载完成` });
    } catch (error) {
      message.open({
        key,
        type: 'error',
        content: (error as Error)?.message || '下载失败',
      });
    }
  }, []);

  /** 删除 = 移入回收站：可还原，所以确认级别只到 `danger`，措辞也避免过度恐吓。 */
  const handleRecycle = useCallback(
    (node: FileNode) => {
      confirm({
        title: `把「${node.name}」移入回收站？`,
        content:
          '移入回收站后它不再出现在「我的文件」中，但可以随时还原，不会丢失数据。',
        level: 'danger',
        okText: '移入回收站',
        onOk: async () => {
          await recycleNode(node.id);
          actionRef.current?.reload();
        },
      });
    },
    [confirm],
  );

  /** 彻底销毁：不可撤销，必须 `critical`，并把「无法恢复」写进正文而不是只靠红色按钮暗示。 */
  const handleDestroy = useCallback(
    (node: FileNode) => {
      confirm({
        title: `彻底销毁「${node.name}」？`,
        content:
          '文件实体与其所有分片会被永久删除，回收站不再保留，此操作无法撤销。',
        level: 'critical',
        okText: '彻底销毁',
        onOk: async () => {
          await destroyNode(node.id);
          actionRef.current?.reload();
        },
      });
    },
    [confirm],
  );

  const handleRestore = useCallback(async (node: FileNode) => {
    try {
      await restoreNode(node.id);
      message.success(`「${node.name}」已还原`);
      actionRef.current?.reload();
    } catch {
      // 失败提示由请求层给出，列表保持原样
    }
  }, []);

  const handleEmptyRecycle = useCallback(() => {
    confirm({
      title: '清空回收站？',
      content:
        '回收站里的全部文件将被彻底销毁，无法恢复。若只是暂时不用，建议先留在回收站。',
      level: 'critical',
      okText: '清空回收站',
      onOk: async () => {
        const count = await emptyRecycle();
        message.success(
          count > 0 ? `已销毁 ${count} 个条目` : '回收站本来就是空的',
        );
        actionRef.current?.reload();
      },
    });
  }, [confirm]);

  const columns = useMemo<ProColumns<FileNode>[]>(
    () => [
      {
        title: '文件名',
        dataIndex: 'name',
        ellipsis: true,
        fieldProps: { placeholder: '文件名关键字' },
        render: (_, node) => (
          <Space size={6} wrap={false}>
            <FileIcon ext={node.ext} />
            <Text ellipsis style={{ maxWidth: 320 }}>
              {node.name}
            </Text>
            {node.tags?.map((tag) => (
              <Tag key={tag.id} color={tag.color ?? undefined}>
                {tag.name}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: '类型',
        dataIndex: 'ext',
        width: 110,
        // 分组下拉里每一项都是具体扩展名：服务端 ext 只支持单值，聚合过滤会变成假筛选
        valueType: 'select',
        fieldProps: {
          options: EXT_SELECT_OPTIONS,
          allowClear: true,
          placeholder: '全部类型',
        },
        render: (_, node) => (node.ext ? <Tag>{`.${node.ext}`}</Tag> : '-'),
      },
      {
        title: '密级',
        dataIndex: 'level',
        width: 100,
        valueType: 'select',
        fieldProps: {
          options: LEVEL_OPTIONS.map((item) => ({
            label: item.label,
            value: item.value,
          })),
          allowClear: true,
          placeholder: '全部密级',
        },
        render: (_, node) => (
          <Tag color={levelColor(node.level)}>{levelText(node.level)}</Tag>
        ),
      },
      {
        title: '大小',
        dataIndex: 'sizeBytes',
        width: 110,
        hideInSearch: true,
        sorter: true,
        render: (_, node) => formatBytes(node.sizeBytes ?? 0),
      },
      {
        title: '更新时间',
        dataIndex: 'updateTime',
        width: 170,
        hideInSearch: true,
        sorter: true,
        render: (_, node) => node.updateTime ?? '-',
      },
      {
        title: '创建时间',
        dataIndex: 'createTimeRange',
        valueType: 'dateRange',
        hideInTable: true,
        // 这里把 dayjs 归一成 `YYYY-MM-DD`：查询层不该依赖 UI 组件库的值类型
        search: {
          transform: (value: [Dayjs, Dayjs] | undefined) => ({
            createTimeRange: [
              value?.[0]?.format('YYYY-MM-DD'),
              value?.[1]?.format('YYYY-MM-DD'),
            ],
          }),
        },
      },
      {
        title: '操作',
        valueType: 'option',
        width: recycleMode ? 160 : 240,
        fixed: 'right',
        // 回收站里只保留「还原 / 彻底销毁」：预览、下载、分享对已移入回收站的文件没有意义
        render: (_, node) =>
          recycleMode
            ? [
                <Access key="restore" perm="file:edit">
                  <a onClick={() => void handleRestore(node)}>还原</a>
                </Access>,
                <Access key="destroy" perm="file:destroy">
                  <a
                    onClick={() => handleDestroy(node)}
                    style={{ color: token.colorError }}
                  >
                    彻底销毁
                  </a>
                </Access>,
              ]
            : [
                <Access key="preview" perm="file:preview">
                  <a onClick={() => setPreviewNode(node)}>预览</a>
                </Access>,
                <Access key="download" perm="file:download">
                  <a onClick={() => void handleDownload(node)}>下载</a>
                </Access>,
                <Access key="share" perm="file:share">
                  <a onClick={() => setShareNode(node)}>分享</a>
                </Access>,
                // 申请权限对所有人开放：没有权限的人正是要申请的人
                <a key="apply" onClick={() => setApplyNode(node)}>
                  申请权限
                </a>,
                <Access key="recycle" perm="file:edit">
                  <a
                    onClick={() => handleRecycle(node)}
                    style={{ color: token.colorError }}
                  >
                    删除
                  </a>
                </Access>,
              ],
      },
    ],
    [
      handleDownload,
      handleRestore,
      handleRecycle,
      handleDestroy,
      recycleMode,
      token.colorError,
    ],
  );

  return (
    <PageContainer
      header={{
        title: '文件',
        subTitle: '目录、密级与类型筛选',
      }}
    >
      <Space
        orientation="vertical"
        size={token.marginSM}
        style={{ width: '100%' }}
      >
        {recycleMode ? (
          <Alert
            type="warning"
            showIcon
            title="回收站"
            description="回收站里的文件不再出现在「我的文件」中。可在此还原，或彻底销毁（不可恢复）；销毁需 file:destroy 权限。"
          />
        ) : (
          <SectionCard
            bodyPadding="12px 24px"
            title={
              <Breadcrumb
                items={[
                  {
                    title: (
                      <a onClick={() => setFolderId(undefined)}>
                        <FolderOutlined /> 全部文件
                      </a>
                    ),
                  },
                  ...path.map((folder) => ({
                    title: (
                      <a onClick={() => setFolderId(folder.id)}>
                        {folder.name}
                      </a>
                    ),
                  })),
                ]}
              />
            }
            extra={
              <Space>
                {uploading > 0 ? (
                  <Tag
                    onClick={() => setUploadOpen(true)}
                    style={{
                      cursor: 'pointer',
                      marginInlineEnd: 0,
                      color: token.colorPrimary,
                      background: token.colorPrimaryBg,
                      borderColor: token.colorPrimaryBorder,
                    }}
                  >
                    上传中 {uploading}
                  </Tag>
                ) : null}
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => actionRef.current?.reload()}
                >
                  刷新
                </Button>
              </Space>
            }
          >
            {folders.length > 0 ? (
              <div className={styles.folderBar}>
                <Text type="secondary">子目录：</Text>
                {folders.map((folder) => (
                  <Button
                    key={folder.id}
                    size="small"
                    icon={<FolderOutlined />}
                    onClick={() => setFolderId(folder.id)}
                  >
                    {folder.name}
                  </Button>
                ))}
              </div>
            ) : (
              <Text type="secondary">当前目录下没有子目录</Text>
            )}
          </SectionCard>
        )}

        <ProTable<FileNode, FileTableParams>
          rowKey="id"
          actionRef={actionRef}
          columns={columns}
          cardBordered
          headerTitle={recycleMode ? '回收站' : '我的文件'}
          scroll={{ x: 960 }}
          // 回收站的筛选语义与我的文件不同（无目录、无密级过滤），宁可不给搜索框也不给假筛选
          search={
            recycleMode
              ? false
              : { labelWidth: 'auto', defaultCollapsed: false }
          }
          options={{ density: false, reload: true, setting: true }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          // 目录 / 回收站视角变化都必须触发重新请求：ProTable 只在 params 变化时重新发起
          params={{ folderId, recycle: recycleMode }}
          request={async (params, sorter) => {
            if (recycleMode) {
              const page = await pageRecycleFiles({
                current: params.current,
                pageSize: params.pageSize,
              });
              return { data: page.records, total: page.total, success: true };
            }
            const query = buildFileQuery(params, {
              folderId,
              sorter: sorter as TableSorter,
            });
            const page = await pageFiles(query);
            return { data: page.records, total: page.total, success: true };
          }}
          toolBarRender={() => {
            const actions: ReactNode[] = [];
            if (recycleMode) {
              actions.push(
                <Button
                  key="back"
                  icon={<RollbackOutlined />}
                  onClick={() => setRecycleMode(false)}
                >
                  返回我的文件
                </Button>,
              );
              actions.push(
                <Access key="empty" perm="file:destroy">
                  <Button
                    danger
                    icon={<ClearOutlined />}
                    onClick={handleEmptyRecycle}
                  >
                    清空回收站
                  </Button>
                </Access>,
              );
              return actions;
            }
            actions.push(
              // 权限点取自 docs/development/frontend-permission-map.md（单一事实源）：
              // 「上传 / 秒传 → file:upload」。缺这道门禁时无上传权的用户仍会看到入口，
              // 点进去到预检才吃 403 —— 属于「按钮可见但必然失败」，必须在渲染层就藏掉。
              <Access key="upload" perm="file:upload">
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => setUploadOpen(true)}
                >
                  上传文件
                </Button>
              </Access>,
            );
            actions.push(
              <Access key="recycle" perm="file:preview">
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => setRecycleMode(true)}
                >
                  回收站
                </Button>
              </Access>,
            );
            return actions;
          }}
        />

        <UploadModal
          open={uploadOpen}
          folderId={folderId}
          uploader={uploader}
          onClose={() => setUploadOpen(false)}
        />

        <PreviewModal
          open={Boolean(previewNode)}
          node={previewNode}
          onClose={() => setPreviewNode(null)}
          onDownload={(node) => {
            setPreviewNode(null);
            void handleDownload(node);
          }}
        />

        <ShareModal
          open={Boolean(shareNode)}
          node={shareNode}
          onClose={() => setShareNode(null)}
        />

        <PermissionApplyModal
          open={Boolean(applyNode)}
          node={applyNode}
          onClose={() => setApplyNode(null)}
        />
      </Space>
    </PageContainer>
  );
}
