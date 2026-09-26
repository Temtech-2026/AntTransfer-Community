/**
 * 聊天输入框里的文件传输入口：回形针 → 「发送文件」弹窗。
 *
 * <h3>两种来源，一个决策</h3>
 * <p>「发文件」在用户心里是一件事，但文件从哪来有两种现实：</p>
 * <ul>
 *   <li><b>我的文件</b>：已经在文件工作台里传过的条目，按条目引用即可，不重复占空间；</li>
 *   <li><b>本机文件</b>：还没进过系统，必须先上传，拿到条目后才能发。</li>
 * </ul>
 * <p>把「上传本机文件」放在同一个弹窗的最上面，而不是拆成菜单里的第二项：两种来源是
 * <b>同一个决策的两个分支</b>，用户常常是打开列表之后才意识到「我要发的那个还没传」。
 * 拆成二级菜单就得退出去重进，而在 380px 宽的抽屉里，菜单项也看不出多了什么。</p>
 *
 * <h3>为什么本机文件必须走分片上传</h3>
 * <p>at-file 的小文件直传受容器 {@code spring.servlet.multipart.max-file-size}（64 MB）限制，
 * 超限会在进 Controller 之前就被裸 400 拦掉，业务侧连日志都没有。聊天里发文件没有
 * 「只能小文件」的道理，因此这里复用文件工作台同一条分片流水线（秒传预检 / 断点续传 /
 * 并发分片），而不是为聊天另开一条直传接口。</p>
 *
 * <h3>大小提示从哪来</h3>
 * <p>弹窗里写明「单个文件最大 {size}」——数字取自 {@code services/upload/constants} 的
 * {@code MAX_FILE_SIZE}（与 {@code anttransfer.file.max-file-size} 的默认值对齐）。
 * 只提示、不拦截：上限可配置，真正拒收的是服务端 4006，前端若提前改判，
 * 一旦运维调大上限就会变成「服务端让传、前端不让选」。</p>
 *
 * <h3>为什么队列 id 由调用方指定</h3>
 * <p>{@code useChunkUpload} 按 id 复用控制器（同 id 共享一份队列）。页面与抽屉<b>会同时挂载</b>
 * （抽屉挂在布局外壳上），若共用一个 id，两者拿到的是同一个控制器，而回调只认最后一批
 * 写进 options 的那一份——症状是「在抽屉里选的文件附到了页面的草稿上」。故 id 由调用方
 * 区分；它同时也是顶栏全局上传进度里的分组名。</p>
 *
 * <h3>为什么不落本地断点缓存</h3>
 * <p>这里是一次性动作：选文件 → 传完附上 / 失败重来，界面没有「续传」入口。
 * 开着断点缓存只会给 localStorage 留一份这个界面永远不会认领的记录。</p>
 */

import { PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  List,
  Modal,
  Progress,
  Tooltip,
} from 'antd';
import { createStyles } from 'antd-style';
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { formatBytes } from '@/components/ChunkUpload';
import { useChunkUpload } from '@/hooks/useChunkUpload';
import { type FileNode, pageFiles } from '@/services/file';
import { MAX_FILE_SIZE } from '@/services/upload/constants';
import type { FileDragPayload } from '@/utils/dragFile';

import { isUploadBusy, nodeToPayload, uploadedFileToPayload } from './picker';

/** 一次拉多少条候选：选文件是「翻一眼」，不是检索，够翻两页即可 */
const PICKER_PAGE_SIZE = 10;

const useStyles = createStyles(({ token, css }) => ({
  /** 工具栏里的上传进度：宽度固定，不随文件名长短推挤发送按钮 */
  progress: css`
    display: inline-flex;
    align-items: center;
    width: 56px;
  `,

  /** 上传区块：入口在第一屏，不要藏在列表下面 */
  uploadBox: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
    margin-bottom: 12px;
  `,

  uploadHint: css`
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM};
    line-height: 1.5;
  `,

  /** 上传说明与其下的大小上限：两行一组，与右侧按钮顶端对齐 */
  uploadText: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,

  /** 大小上限：比说明再弱一档，是提示而不是警告（超限由服务端拒绝并回具体原因） */
  uploadLimit: css`
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM};
    line-height: 1.5;
  `,

  /** 列表高度固定：拖动滚动条时弹窗不要跟着长高 */
  list: css`
    max-height: 320px;
    overflow-y: auto;
  `,

  /** 整行就是一个按钮：键盘与读屏都能直接选中，不用额外补 tabIndex + onKeyDown */
  row: css`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: ${token.borderRadius}px;
    background: transparent;
    color: inherit;
    font-size: ${token.fontSize}px;
    text-align: left;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: ${token.colorFillQuaternary};
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorder};
      outline-offset: -2px;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `,

  rowName: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  `,

  rowSize: css`
    flex: none;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
}));

export interface ChatAttachmentPickerProps {
  /** 选中或上传完成一份文件：交给 `useChatAttachmentDraft#setAttachment` */
  onPick: (payload: FileDragPayload) => void;
  /**
   * 上传队列 id：页面与抽屉必须分开传（见文件头「为什么队列 id 由调用方指定」）。
   * 同时决定顶栏全局上传进度里的分组名（`common.upload.queue.{id}`）。
   */
  queueId: string;
  /** 发送中或已有待发附件时禁用入口 */
  disabled?: boolean;
}

const ChatAttachmentPicker = ({
  onPick,
  queueId,
  disabled = false,
}: ChatAttachmentPickerProps) => {
  const intl = useIntl();
  const { message: toast } = App.useApp();
  const { styles } = useStyles();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [current, setCurrent] = useState(1);
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listFailed, setListFailed] = useState(false);
  /** 本次发起的上传任务 id：决定进度条显示哪一条 */
  const [uploadTaskId, setUploadTaskId] = useState<string | null>(null);
  /** 失败的任务名：失败提示挂在弹窗里，用户不关弹窗就能重试 */
  const [failedName, setFailedName] = useState<string | null>(null);

  const handleUploaded = useCallback(
    (task: Parameters<typeof uploadedFileToPayload>[0]) => {
      setUploadTaskId(null);
      setFailedName(null);
      const payload = uploadedFileToPayload(task);
      if (!payload) {
        // 传上去了却没拿到条目：不能让附件条去承载一个空 ID，否则会在点发送时才炸
        toast.error(intl.formatMessage({ id: 'chat.attach.uploadNoNode' }));
        return;
      }
      onPick(payload);
      setOpen(false);
    },
    [intl, onPick, toast],
  );

  const upload = useChunkUpload({
    id: queueId,
    persist: false,
    onTaskSuccess: handleUploaded,
    onTaskError: (task) => {
      setUploadTaskId(null);
      setFailedName(task.fileName);
    },
  });

  /**
   * 正在推进的上传任务。
   *
   * <p>用任务自身状态判断而不是「有没有点过开始」：用户可以在顶栏传输中心直接取消上传，
   * 那条路不会回调 {@code onTaskError}，只记住「我发起过」会让入口永久卡在禁用态。</p>
   */
  const uploadingTask = useMemo(() => {
    if (!uploadTaskId) {
      return null;
    }
    const task = upload.tasks.find((item) => item.id === uploadTaskId);
    return task && isUploadBusy(task) ? task : null;
  }, [upload.tasks, uploadTaskId]);

  const busy = uploadingTask !== null;

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let alive = true;
    setListLoading(true);
    setListFailed(false);
    pageFiles({
      current,
      pageSize: PICKER_PAGE_SIZE,
      keyword: keyword.trim() || undefined,
      sort: 'createTime,desc',
    })
      .then((result) => {
        if (!alive) {
          return;
        }
        setNodes(result.records ?? []);
        setTotal(result.total ?? 0);
      })
      .catch(() => {
        if (!alive) {
          return;
        }
        // 失败提示由请求层给过一遍；这里清空是为了不让上一页的数据冒充本次结果
        setNodes([]);
        setTotal(0);
        setListFailed(true);
      })
      .finally(() => {
        if (alive) {
          setListLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [open, current, keyword]);

  const handlePickNode = (node: FileNode) => {
    const payload = nodeToPayload(node);
    if (!payload) {
      toast.error(intl.formatMessage({ id: 'chat.attach.pickerInvalid' }));
      return;
    }
    onPick(payload);
    setOpen(false);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 先清空 value：不清的话「同一个文件失败后再选一次」不会再触发 change
    event.target.value = '';
    if (!file) {
      return;
    }
    setFailedName(null);
    const [taskId] = upload.start([file]);
    setUploadTaskId(taskId ?? null);
  };

  const openPicker = () => {
    setFailedName(null);
    setOpen(true);
  };

  return (
    <>
      {uploadingTask ? (
        <Tooltip
          title={intl.formatMessage(
            { id: 'chat.attach.uploadProgress' },
            {
              name: uploadingTask.fileName,
              percent: Math.round(uploadingTask.progress),
            },
          )}
        >
          <span className={styles.progress}>
            <Progress
              percent={Math.min(
                100,
                Math.max(0, Math.round(uploadingTask.progress)),
              )}
              size="small"
              showInfo={false}
            />
          </span>
        </Tooltip>
      ) : null}

      <Tooltip title={intl.formatMessage({ id: 'chat.attach.entry' })}>
        <Button
          type="text"
          icon={<PaperClipOutlined />}
          aria-label={intl.formatMessage({ id: 'chat.attach.entry' })}
          disabled={disabled}
          onClick={openPicker}
        />
      </Tooltip>

      {/*
        隐藏的原生文件选择框：attachment 一次只发一份，所以不加 multiple。
        不上传就点「取消」时浏览器不触发 change，这里只需处理选中。
      */}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        aria-hidden
        tabIndex={-1}
        onChange={handleFileChange}
      />

      <Modal
        open={open}
        title={intl.formatMessage({ id: 'chat.attach.modalTitle' })}
        width={560}
        footer={
          <Button onClick={() => setOpen(false)}>
            {intl.formatMessage({ id: 'chat.attach.pickerClose' })}
          </Button>
        }
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <div className={styles.uploadBox}>
          <div className={styles.uploadText}>
            <span className={styles.uploadHint}>
              {intl.formatMessage({ id: 'chat.attach.uploadHint' })}
            </span>
            <span className={styles.uploadLimit}>
              {intl.formatMessage(
                { id: 'chat.attach.sizeLimit' },
                { size: formatBytes(MAX_FILE_SIZE) },
              )}
            </span>
          </div>
          <Button
            icon={<UploadOutlined />}
            loading={busy}
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {intl.formatMessage({ id: 'chat.attach.fromDevice' })}
          </Button>
        </div>

        {uploadingTask ? (
          <Progress
            percent={Math.min(
              100,
              Math.max(0, Math.round(uploadingTask.progress)),
            )}
            status="active"
            style={{ marginBottom: 12 }}
          />
        ) : null}

        {failedName ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            title={intl.formatMessage(
              { id: 'chat.attach.uploadFailed' },
              { name: failedName },
            )}
          />
        ) : null}

        <Input.Search
          allowClear
          placeholder={intl.formatMessage({ id: 'chat.attach.pickerSearch' })}
          onSearch={(value) => {
            setKeyword(value);
            // 关键词变了必须回到第一页：留在第 3 页会得到一个空列表，看起来像「没搜到」
            setCurrent(1);
          }}
        />

        <List<FileNode>
          className={styles.list}
          loading={listLoading}
          dataSource={nodes}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  listFailed
                    ? intl.formatMessage({ id: 'chat.attach.pickerFailed' })
                    : intl.formatMessage({ id: 'chat.attach.pickerEmpty' })
                }
              />
            ),
          }}
          pagination={
            total > PICKER_PAGE_SIZE
              ? {
                  current,
                  pageSize: PICKER_PAGE_SIZE,
                  total,
                  size: 'small',
                  showSizeChanger: false,
                  onChange: setCurrent,
                }
              : false
          }
          renderItem={(node) => (
            <List.Item style={{ padding: 0, borderBlockEnd: 'none' }}>
              <button
                type="button"
                className={styles.row}
                disabled={busy}
                title={node.name}
                onClick={() => handlePickNode(node)}
              >
                <span className={styles.rowName}>{node.name}</span>
                <span className={styles.rowSize}>
                  {formatBytes(node.sizeBytes ?? 0)}
                </span>
              </button>
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
};

export default ChatAttachmentPicker;
