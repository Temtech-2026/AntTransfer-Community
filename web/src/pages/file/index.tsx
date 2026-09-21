/**
 * 文件工作台。
 *
 * <p>页面职责：目录导航（面包屑 + 子目录）+ 文件浏览（列表 / 网格两种视图）+ 查询
 * （关键字 / 类型 / 密级 / 创建时间）+ 单条与批量操作 + 回收站（还原 / 彻底销毁）
 * + 上传弹窗 + 移动弹窗。</p>
 *
 * <p>几处刻意的设计：</p>
 * <ul>
 *   <li><b>数据只有一份，视图只是渲染器</b>：列表与网格共用同一份 `rows` / 分页 / 排序状态。
 *       若两个视图各自取数，切一次视图就可能看到两套结果（甚至两次请求落到不同分页），
 *       「视图切换」会变成「数据穿越」。</li>
 *   <li><b>上传队列由页面持有</b>：关闭弹窗后传输继续（控制器在模块级注册表里），
 *       工具栏还能显示「上传中 N」。</li>
 *   <li><b>权限点只控「渲染」</b>：真正的安全边界永远在后端 `@RequiresPerm`。
 *       行内动作清单统一由 {@link buildNodeActions} 产出，避免「列表藏了、网格没藏」。</li>
 *   <li><b>删除 ≠ 彻底销毁</b>：`DELETE /files/{id}` 只是移入回收站（可还原，`file:edit`），
 *       `DELETE /files/{id}/destroy` 才是不可撤销的物理销毁（`file:destroy`）。
 *       前者确认级别 `danger`、后者 `critical`，且只有后者写明「无法撤销」。</li>
 *   <li><b>批量动作只在「我的文件」出现</b>：服务端只有批量移入回收站，没有批量还原 /
 *       批量销毁，因此回收站不给勾选框——勾完没有动作可用比没有勾选框更让人困惑。</li>
 * </ul>
 */

import {
  AppstoreOutlined,
  BarsOutlined,
  ClearOutlined,
  DeleteOutlined,
  FolderOutlined,
  ReloadOutlined,
  RollbackOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { type ProColumns, PageContainer, ProTable } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import {
  Alert,
  Breadcrumb,
  Button,
  DatePicker,
  Divider,
  Dropdown,
  Form,
  Input,
  type MenuProps,
  Pagination,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Access, usePerm } from '@/components/Access';
import { formatBytes } from '@/components/ChunkUpload';
import { useDangerConfirm } from '@/components/DangerConfirm';
import SectionCard from '@/components/SectionCard';
import { useChunkUpload } from '@/hooks/useChunkUpload';
import {
  EXT_SELECT_OPTIONS,
  type FileNode,
  type FileTableParams,
  type FolderNode,
  LEVEL_OPTIONS,
  type TableSorter,
  batchRecycleNodes,
  buildFileQuery,
  destroyNode,
  downloadNode,
  emptyRecycle,
  fetchFolderTree,
  levelColor,
  levelTextId,
  pageFiles,
  pageRecycleFiles,
  recycleElapsedDays,
  recycleNode,
  restoreNode,
} from '@/services/file';

import FileGrid from './components/FileGrid';
import FileIcon from './components/FileIcon';
import MoveModal from './components/MoveModal';
import PermissionApplyModal from './components/PermissionApplyModal';
import PreviewModal from './components/PreviewModal';
import SecurityBadges from './components/SecurityBadges';
import ShareModal from './components/ShareModal';
import UploadModal from './components/UploadModal';
import { folderChildren, folderPath } from './folder-tree';
import useStyles from './index.style';
import { type NodeActionHandlers, NodeActionLinks } from './node-actions';

const { Text } = Typography;

/** 上传队列 id：页面与弹窗共享同一控制器 */
const UPLOAD_QUEUE_ID = 'file-workbench';

/** 视图偏好落 localStorage：用户选过网格，下次进页面不该被改回列表 */
const VIEW_MODE_KEY = 'ant-transfer:file-view-mode';

/** 每页条数可选值：与服务端分页上界一致，不给一个点了必然被拒的选项 */
const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

const DEFAULT_PAGE_SIZE = 20;

type ViewMode = 'list' | 'grid';

function readViewMode(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_MODE_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    // 隐私模式 / 存储被禁用：降级为列表，不因为一个偏好读不到就白屏
    return 'list';
  }
}

/** 查询表单字段（与 `FileTableParams` 对齐，只多出 RangePicker 的 Dayjs 形态） */
interface QueryFormValues {
  name?: string;
  ext?: string;
  level?: number | string;
  createTimeRange?: [Dayjs | null, Dayjs | null] | null;
}

export default function FileWorkbenchPage() {
  const { token } = theme.useToken();
  const { styles } = useStyles();
  const intl = useIntl();
  const [queryForm] = Form.useForm<QueryFormValues>();
  const canEdit = usePerm('file:edit');

  /** 当前目录；undefined = 根目录。雪花 ID 用字符串承接（见 `services/file/types` 的 ID 语境说明） */
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewNode, setPreviewNode] = useState<FileNode | null>(null);
  const [shareNode, setShareNode] = useState<FileNode | null>(null);
  const [applyNode, setApplyNode] = useState<FileNode | null>(null);
  const [moveNodes, setMoveNodes] = useState<FileNode[] | null>(null);

  /** 当前视图：只影响渲染，不影响数据 */
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);

  /** 查询条件（表单归一后的形态，不含分页 / 排序） */
  const [query, setQuery] = useState<FileTableParams>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortState, setSortState] = useState<TableSorter>({});
  const [rows, setRows] = useState<FileNode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  /** 自增即重取：代替 ProTable 的 actionRef.reload（数据已由页面持有） */
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /**
   * 回收站视角开关。
   *
   * <p>回收站是**另一个数据源**（`GET /files/recycle`）而不是本地过滤，因此这里只存一个布尔量，
   * 由它同时决定「请求打到哪个端点」「操作列给哪些动作」「工具栏长什么样」。</p>
   */
  const [recycleMode, setRecycleMode] = useState(false);
  const { confirm } = useDangerConfirm();

  /** 上传队列：关闭弹窗不中断传输，工具栏据此显示进行中数量 */
  const uploader = useChunkUpload({
    id: UPLOAD_QUEUE_ID,
    // 目标目录透传给预检：秒传命中的文件也要记录在正确目录下
    precheckExtra: folderId ? { parentId: folderId } : undefined,
    onTaskSuccess: () => setReloadKey((key) => key + 1),
  });

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

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

  /**
   * 取数：列表与网格唯一的入口。
   *
   * <p>`alive` 不只是防重复渲染——用户快速连点翻页时会有多个请求在飞，
   * 先回来的旧结果若被写进 state，就会出现「翻到第 3 页显示第 2 页内容」。</p>
   */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const load = async () => {
      try {
        if (recycleMode) {
          const result = await pageRecycleFiles({ current: page, pageSize });
          if (alive) {
            setRows(result.records);
            setTotal(result.total);
          }
          return;
        }
        const result = await pageFiles(
          buildFileQuery(
            { ...query, current: page, pageSize },
            { folderId, sorter: sortState },
          ),
        );
        if (alive) {
          setRows(result.records);
          setTotal(result.total);
        }
      } catch {
        // 失败提示由请求层给出；这里只负责不让上一页的数据留在屏幕上冒充本次结果
        if (alive) {
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [recycleMode, page, pageSize, query, folderId, sortState, reloadKey]);

  /** 视角 / 目录 / 查询条件一变，之前勾选的条目已不在屏幕上，必须清空选择 */
  useEffect(() => {
    setSelectedIds([]);
  }, [recycleMode, page, pageSize, folderId, query, sortState]);

  const folders = useMemo(
    () => folderChildren(folderTree, folderId),
    [folderTree, folderId],
  );
  const path = useMemo(() => folderPath(folderTree, folderId), [folderTree, folderId]);
  const uploading = uploader.tasks.filter(
    (task) => !['success', 'error', 'canceled'].includes(task.status),
  ).length;

  const selectedNodes = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds],
  );

  /**
   * 下载：换票（XHR，失败按 code 提示）→ 取件交给浏览器原生下载。
   *
   * <p>不再有百分比进度：接管的浏览器不会把进度回传给页面，进度改由浏览器的下载面板呈现。
   * 页面只能标注「准备中」与「已交给浏览器」两个节点，所以成功文案是「已开始下载」而不是
   * 「下载完成」——前端并没有能力知道它何时真的落盘。</p>
   */
  const handleDownload = useCallback(async (target: FileNode) => {
    const key = `download-${target.id}`;
    message.open({
      key,
      type: 'loading',
      content: intl.formatMessage(
        { id: 'file.download.preparing' },
        { name: target.name },
      ),
      duration: 0,
    });
    try {
      // silent：换票失败走下面的 catch 统一提示，避免全局提示与页面提示重复弹两次
      await downloadNode(target, { silent: true });
      message.open({
        key,
        type: 'success',
        content: intl.formatMessage(
          { id: 'file.download.done' },
          { name: target.name },
        ),
      });
    } catch (error) {
      message.open({
        key,
        type: 'error',
        content:
          (error as Error)?.message ||
          intl.formatMessage({ id: 'file.download.failed' }),
      });
    }
  }, [intl]);

  /** 删除 = 移入回收站：可还原，所以确认级别只到 `danger`，措辞也避免过度恐吓。 */
  const handleRecycle = useCallback(
    (target: FileNode) => {
      confirm({
        title: intl.formatMessage(
          { id: 'file.recycle.confirmTitle' },
          { name: target.name },
        ),
        content: intl.formatMessage({ id: 'file.recycle.confirmContent' }),
        level: 'danger',
        okText: intl.formatMessage({ id: 'file.action.recycle' }),
        onOk: async () => {
          await recycleNode(target.id);
          refresh();
        },
      });
    },
    [confirm, intl, refresh],
  );

  /** 彻底销毁：不可撤销，必须 `critical`，并把「无法恢复」写进正文而不是只靠红色按钮暗示。 */
  const handleDestroy = useCallback(
    (target: FileNode) => {
      confirm({
        title: intl.formatMessage(
          { id: 'file.destroy.confirmTitle' },
          { name: target.name },
        ),
        content: intl.formatMessage({ id: 'file.destroy.confirmContent' }),
        level: 'critical',
        okText: intl.formatMessage({ id: 'file.action.destroy' }),
        onOk: async () => {
          await destroyNode(target.id);
          refresh();
        },
      });
    },
    [confirm, intl, refresh],
  );

  const handleRestore = useCallback(
    async (target: FileNode) => {
      try {
        await restoreNode(target.id);
        message.success(
          intl.formatMessage({ id: 'file.restore.done' }, { name: target.name }),
        );
        refresh();
      } catch {
        // 失败提示由请求层给出，列表保持原样
      }
    },
    [intl, refresh],
  );

  const handleEmptyRecycle = useCallback(() => {
    confirm({
      title: intl.formatMessage({ id: 'file.empty.confirmTitle' }),
      content: intl.formatMessage({ id: 'file.empty.confirmContent' }),
      level: 'critical',
      okText: intl.formatMessage({ id: 'file.action.emptyRecycle' }),
      onOk: async () => {
        const count = await emptyRecycle();
        message.success(
          count > 0
            ? intl.formatMessage({ id: 'file.empty.done' }, { count })
            : intl.formatMessage({ id: 'file.empty.noop' }),
        );
        refresh();
      },
    });
  }, [confirm, intl, refresh]);

  /* ============================ 批量动作 ============================ */

  /**
   * 批量下载：串行。
   *
   * <p>并发下载会把浏览器的连接池占满，反而让每一个都变慢；串行还能让进度提示保持可读。</p>
   */
  const handleBatchDownload = useCallback(async () => {
    for (const target of selectedNodes) {
      await handleDownload(target);
    }
    setSelectedIds([]);
  }, [handleDownload, selectedNodes]);

  /** 批量移入回收站：走服务端的批量端点，避免 N 次单条请求各自半成功 */
  const handleBatchRecycle = useCallback(() => {
    const ids = selectedNodes.map((node) => node.id);
    if (ids.length === 0) {
      return;
    }
    confirm({
      title: intl.formatMessage(
        { id: 'file.batchRecycle.confirmTitle' },
        { count: ids.length },
      ),
      content: intl.formatMessage({ id: 'file.batchRecycle.confirmContent' }),
      level: 'danger',
      okText: intl.formatMessage({ id: 'file.action.recycle' }),
      onOk: async () => {
        const count = await batchRecycleNodes(ids);
        message.success(
          count > 0
            ? intl.formatMessage({ id: 'file.batchRecycle.done' }, { count })
            : intl.formatMessage({ id: 'file.batchRecycle.noop' }),
        );
        setSelectedIds([]);
        refresh();
      },
    });
  }, [confirm, intl, refresh, selectedNodes]);

  /** 行内动作回调集合：列表与网格共用，确保两个视图看到的是同一批动作 */
  const nodeActionHandlers = useMemo<NodeActionHandlers>(
    () => ({
      onPreview: (node) => setPreviewNode(node),
      onDownload: (node) => void handleDownload(node),
      onShare: (node) => setShareNode(node),
      onApply: (node) => setApplyNode(node),
      onRecycle: (node) => handleRecycle(node),
      onRestore: (node) => void handleRestore(node),
      onDestroy: (node) => handleDestroy(node),
    }),
    [handleDestroy, handleDownload, handleRecycle, handleRestore],
  );

  /* ============================ 查询 ============================ */

  const handleQueryFinish = (values: QueryFormValues) => {
    const range = values.createTimeRange;
    setQuery({
      name: values.name,
      ext: values.ext,
      level: values.level,
      // 查询层不该依赖 UI 组件库的值类型，这里就把 dayjs 归一成 `YYYY-MM-DD`
      createTimeRange: range
        ? [range[0]?.format('YYYY-MM-DD'), range[1]?.format('YYYY-MM-DD')]
        : undefined,
    });
    setPage(1);
  };

  const handleQueryReset = () => {
    queryForm.resetFields();
    setQuery({});
    setPage(1);
  };

  const handleViewModeChange = (value: string | number) => {
    const next: ViewMode = value === 'grid' ? 'grid' : 'list';
    setViewMode(next);
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, next);
    } catch {
      // 存不下只是丢偏好，不影响功能
    }
  };

  const columns = useMemo<ProColumns<FileNode>[]>(
    () => [
      {
        title: intl.formatMessage({ id: 'file.column.name' }),
        dataIndex: 'name',
        ellipsis: true,
        render: (_, node) => (
          <div className={styles.nameCell}>
            <FileIcon ext={node.ext} />
            <span className={styles.fileName}>{node.name}</span>
            {node.tags?.map((tag) => (
              <Tag key={tag.id} color={tag.color ?? undefined} style={{ marginInlineEnd: 0 }}>
                {tag.name}
              </Tag>
            ))}
            {/*
              安全徽标紧跟文件名，而不是单开一列：服务端目前不保证下发水印 / 失效时间，
              单开一列在多数行会是空白，反而稀释了「这列在提示风险」的信号。
            */}
            <span className={styles.nameBadges}>
              <SecurityBadges node={node} />
            </span>
          </div>
        ),
      },
      {
        title: intl.formatMessage({ id: 'file.column.ext' }),
        dataIndex: 'ext',
        width: 110,
        render: (_, node) => (node.ext ? <Tag>{`.${node.ext}`}</Tag> : '-'),
      },
      {
        title: intl.formatMessage({ id: 'file.column.level' }),
        dataIndex: 'level',
        width: 100,
        render: (_, node) => (
          <Tag color={levelColor(node.level)}>
            {intl.formatMessage({ id: levelTextId(node.level) })}
          </Tag>
        ),
      },
      {
        title: intl.formatMessage({ id: 'file.column.size' }),
        dataIndex: 'sizeBytes',
        width: 110,
        sorter: true,
        render: (_, node) => formatBytes(node.sizeBytes ?? 0),
      },
      {
        title: intl.formatMessage({ id: 'file.column.updateTime' }),
        dataIndex: 'updateTime',
        width: 170,
        sorter: true,
        render: (_, node) => node.updateTime ?? '-',
      },
      // 回收站专属列：正常态没有 recycleTime，这一列只在回收站视角出现
      ...(recycleMode
        ? [
            {
              title: intl.formatMessage({ id: 'file.column.recycleTime' }),
              dataIndex: 'recycleTime',
              width: 140,
              render: (_: unknown, node: FileNode) => {
                const days = recycleElapsedDays(node.recycleTime);
                if (days === undefined) {
                  return '-';
                }
                return days === 0
                  ? intl.formatMessage({ id: 'file.recycle.today' })
                  : intl.formatMessage(
                      { id: 'file.recycle.daysAgo' },
                      { days },
                    );
              },
            } satisfies ProColumns<FileNode>,
          ]
        : []),
      {
        title: intl.formatMessage({ id: 'file.column.action' }),
        valueType: 'option',
        width: recycleMode ? 160 : 240,
        fixed: 'right',
        render: (_, node) => (
          <NodeActionLinks
            node={node}
            handlers={nodeActionHandlers}
            recycleMode={recycleMode}
            dangerColor={token.colorError}
          />
        ),
      },
    ],
    [intl, nodeActionHandlers, recycleMode, styles, token.colorError],
  );

  /**
   * 共享的查询表单。
   *
   * <p>刻意不用 ProTable 内建搜索：列表与网格两种视图必须看到**同一套查询条件**，
   * 内建搜索跟着 ProTable 走，一切到网格视图筛选条件就消失了。</p>
   */
  const queryBar = (
    <Form
      form={queryForm}
      layout="inline"
      className={styles.queryForm}
      onFinish={handleQueryFinish}
    >
      <Form.Item
        name="name"
        label={intl.formatMessage({ id: 'file.query.name' })}
      >
        <Input
          allowClear
          placeholder={intl.formatMessage({ id: 'file.query.namePlaceholder' })}
          style={{ width: 180 }}
        />
      </Form.Item>
      <Form.Item name="ext" label={intl.formatMessage({ id: 'file.query.ext' })}>
        {/* 分组下拉里每一项都是具体扩展名：服务端 ext 只支持单值，聚合过滤会变成假筛选 */}
        <Select
          allowClear
          options={EXT_SELECT_OPTIONS.map((group) => ({
            label: intl.formatMessage({ id: group.labelId }),
            options: group.options,
          }))}
          placeholder={intl.formatMessage({ id: 'file.query.extAll' })}
          style={{ width: 160 }}
        />
      </Form.Item>
      <Form.Item
        name="level"
        label={intl.formatMessage({ id: 'file.query.level' })}
      >
        <Select
          allowClear
          options={LEVEL_OPTIONS.map((item) => ({
            label: intl.formatMessage({ id: item.labelId }),
            value: item.value,
          }))}
          placeholder={intl.formatMessage({ id: 'file.query.levelAll' })}
          style={{ width: 130 }}
        />
      </Form.Item>
      <Form.Item
        name="createTimeRange"
        label={intl.formatMessage({ id: 'file.query.createTime' })}
      >
        <DatePicker.RangePicker />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">
            {intl.formatMessage({ id: 'file.query.submit' })}
          </Button>
          <Button onClick={handleQueryReset}>
            {intl.formatMessage({ id: 'file.query.reset' })}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );

  /** 工具栏：回收站与「我的文件」互斥，不共用同一批按钮 */
  const toolbarActions = recycleMode ? (
    <>
      <Button icon={<RollbackOutlined />} onClick={() => setRecycleMode(false)}>
        {intl.formatMessage({ id: 'file.action.backToFiles' })}
      </Button>
      <Access perm="file:destroy">
        <Button danger icon={<ClearOutlined />} onClick={handleEmptyRecycle}>
          {intl.formatMessage({ id: 'file.action.emptyRecycle' })}
        </Button>
      </Access>
    </>
  ) : (
    <>
      {/*
        权限点取自 docs/development/frontend-permission-map.md（单一事实源）：
        「上传 / 秒传 → file:upload」。缺这道门禁时无上传权的用户仍会看到入口，
        点进去到预检才吃 403 —— 属于「按钮可见但必然失败」，必须在渲染层就藏掉。
      */}
      <Access perm="file:upload">
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => setUploadOpen(true)}
        >
          {intl.formatMessage({ id: 'file.action.upload' })}
        </Button>
      </Access>
      <Access perm="file:preview">
        <Button icon={<DeleteOutlined />} onClick={() => setRecycleMode(true)}>
          {intl.formatMessage({ id: 'file.action.enterRecycle' })}
        </Button>
      </Access>
    </>
  );

  /** 「更多」里的批量动作：没有 file:edit 就不给「移入回收站」这一项，而不是给一个点了报错的项 */
  const moreItems: MenuProps['items'] = [];
  if (canEdit) {
    moreItems.push({
      key: 'batch-recycle',
      label: intl.formatMessage({ id: 'file.action.recycle' }),
      danger: true,
    });
    moreItems.push({ type: 'divider' });
  }
  moreItems.push({
    key: 'clear-selection',
    label: intl.formatMessage({ id: 'file.action.clearSelection' }),
  });

  const handleMoreClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'batch-recycle') {
      handleBatchRecycle();
      return;
    }
    if (key === 'clear-selection') {
      setSelectedIds([]);
    }
  };

  return (
    <PageContainer
      header={{
        title: intl.formatMessage({ id: 'file.title' }),
        subTitle: intl.formatMessage({ id: 'file.subtitle' }),
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
            title={intl.formatMessage({ id: 'file.recycle.alertTitle' })}
            description={intl.formatMessage({
              id: 'file.recycle.alertDescription',
            })}
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
                        <FolderOutlined />{' '}
                        {intl.formatMessage({ id: 'file.breadcrumb.all' })}
                      </a>
                    ),
                  },
                  ...path.map((folder) => ({
                    title: (
                      <a onClick={() => setFolderId(folder.id)}>{folder.name}</a>
                    ),
                  })),
                ]}
              />
            }
          >
            {folders.length > 0 ? (
              <div className={styles.folderBar}>
                <Text type="secondary">
                  {intl.formatMessage({ id: 'file.folder.children' })}
                </Text>
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
              <Text type="secondary">
                {intl.formatMessage({ id: 'file.folder.empty' })}
              </Text>
            )}
          </SectionCard>
        )}

        <SectionCard
          bodyPadding="16px 24px"
          title={
            recycleMode
              ? intl.formatMessage({ id: 'file.section.recycle' })
              : intl.formatMessage({ id: 'file.section.myFiles' })
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
                  {intl.formatMessage(
                    { id: 'file.uploadingCount' },
                    { count: uploading },
                  )}
                </Tag>
              ) : null}
              <Button icon={<ReloadOutlined />} onClick={refresh}>
                {intl.formatMessage({ id: 'common.action.refresh' })}
              </Button>
            </Space>
          }
        >
          <div className={styles.queryBar}>
            {/*
              回收站的筛选语义与我的文件不同（无目录、无密级过滤），
              宁可不给搜索框，也不给一个看似能筛、实际不生效的假筛选。
            */}
            {recycleMode ? (
              <Text type="secondary">
                {intl.formatMessage({ id: 'file.recycle.noFilterHint' })}
              </Text>
            ) : (
              queryBar
            )}
            <Segmented
              value={viewMode}
              onChange={handleViewModeChange}
              options={[
                {
                  value: 'list',
                  label: intl.formatMessage({ id: 'file.view.list' }),
                  icon: <BarsOutlined />,
                },
                {
                  value: 'grid',
                  label: intl.formatMessage({ id: 'file.view.grid' }),
                  icon: <AppstoreOutlined />,
                },
              ]}
            />
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div className={styles.toolbar}>{toolbarActions}</div>

          {selectedIds.length > 0 ? (
            <div className={styles.actionBar} style={{ marginTop: 12 }}>
              <span className={styles.actionBarCount}>
                {intl.formatMessage(
                  { id: 'file.selectedCount' },
                  { count: selectedIds.length },
                )}
              </span>
              <Access perm="file:share">
                <Tooltip
                  title={
                    selectedIds.length > 1
                      ? intl.formatMessage({ id: 'file.batch.shareMultiHint' })
                      : undefined
                  }
                >
                  <Button
                    size="small"
                    disabled={selectedIds.length !== 1}
                    onClick={() =>
                      selectedNodes[0] ? setShareNode(selectedNodes[0]) : undefined
                    }
                  >
                    {intl.formatMessage({ id: 'file.action.share' })}
                  </Button>
                </Tooltip>
              </Access>
              <Access perm="file:download">
                <Button size="small" onClick={() => void handleBatchDownload()}>
                  {intl.formatMessage({ id: 'file.action.download' })}
                </Button>
              </Access>
              <Access perm="file:edit">
                <Button
                  size="small"
                  disabled={selectedNodes.length === 0}
                  onClick={() => setMoveNodes(selectedNodes)}
                >
                  {intl.formatMessage({ id: 'file.action.move' })}
                </Button>
              </Access>
              <Tooltip
                title={
                  selectedIds.length > 1
                    ? intl.formatMessage({ id: 'file.batch.applyMultiHint' })
                    : undefined
                }
              >
                <Button
                  size="small"
                  disabled={selectedIds.length !== 1}
                  onClick={() =>
                    selectedNodes[0] ? setApplyNode(selectedNodes[0]) : undefined
                  }
                >
                  {intl.formatMessage({ id: 'file.action.permission' })}
                </Button>
              </Tooltip>
              <Dropdown
                menu={{ items: moreItems, onClick: handleMoreClick }}
                trigger={['click']}
              >
                <Button size="small">
                  {intl.formatMessage({ id: 'file.action.more' })}
                </Button>
              </Dropdown>
              <span className={styles.actionBarTail}>
                <Button type="text" size="small" onClick={() => setSelectedIds([])}>
                  {intl.formatMessage({ id: 'file.action.clearSelection' })}
                </Button>
              </span>
            </div>
          ) : null}

          {viewMode === 'grid' ? (
            <>
              <div style={{ marginTop: 12 }}>
                <FileGrid
                  nodes={rows}
                  loading={loading}
                  recycleMode={recycleMode}
                  // 批量还原 / 批量销毁服务端没有对应端点，回收站就不给勾选框
                  selectable={!recycleMode}
                  selectedIds={selectedIds}
                  onToggleSelect={(id) =>
                    setSelectedIds((ids) =>
                      ids.includes(id)
                        ? ids.filter((item) => item !== id)
                        : [...ids, id],
                    )
                  }
                  handlers={nodeActionHandlers}
                  dangerColor={token.colorError}
                />
              </div>
              <div className={styles.gridFoot}>
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={total}
                  showSizeChanger
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  showTotal={(sum) =>
                    intl.formatMessage({ id: 'file.total' }, { total: sum })
                  }
                  onChange={(nextPage, nextPageSize) => {
                    // 换每页条数后回到第 1 页：否则可能停在一个已不存在的页码上
                    setPage(nextPageSize !== pageSize ? 1 : nextPage);
                    setPageSize(nextPageSize);
                  }}
                />
              </div>
            </>
          ) : (
            <ProTable<FileNode, FileTableParams>
              rowKey="id"
              columns={columns}
              dataSource={rows}
              loading={loading}
              // 数据已由页面持有：ProTable 退化为受控表格，避免「两个取数入口」
              headerTitle={false}
              search={false}
              options={false}
              toolBarRender={false}
              scroll={{ x: 960 }}
              rowSelection={
                recycleMode
                  ? undefined
                  : {
                      selectedRowKeys: selectedIds,
                      // rowKey 取的是条目 ID（19 位雪花 ID），keys 已是字符串：
                      // 这里**不能再 map(Number)**，转 number 会丢末位，之后
                      // selectedIds.includes(row.id) 永远不匹配，勾选后批量动作静默失效。
                      onChange: (keys) => setSelectedIds(keys as string[]),
                    }
              }
              pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: true,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                showTotal: (sum) =>
                  intl.formatMessage({ id: 'file.total' }, { total: sum }),
              }}
              onChange={(pagination, _filters, tableSorter) => {
                const single = Array.isArray(tableSorter)
                  ? tableSorter[0]
                  : tableSorter;
                // columnKey 缺省时回落到 field（即 dataIndex），否则排序参数会静默丢失
                const field = (single?.columnKey ?? single?.field) as
                  | string
                  | undefined;
                setSortState(
                  field && single?.order ? { [field]: single.order } : {},
                );
                const nextSize = pagination.pageSize ?? pageSize;
                setPage(nextSize !== pageSize ? 1 : (pagination.current ?? 1));
                setPageSize(nextSize);
              }}
            />
          )}
        </SectionCard>

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

        <MoveModal
          open={Boolean(moveNodes)}
          nodes={moveNodes ?? []}
          tree={folderTree}
          onClose={() => setMoveNodes(null)}
          onMoved={refresh}
        />
      </Space>
    </PageContainer>
  );
}
