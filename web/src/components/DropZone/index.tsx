import { InboxOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import React, { useRef, useState } from 'react';

import useStyles from './index.style';

export interface DropZoneProps {
  /** 主标题，如「拖拽文件到此处，或点击选择」。 */
  title?: React.ReactNode;
  /** 副标题，如「支持多文件同时上传」。 */
  description?: React.ReactNode;
  /** 图标，默认收件箱图标。 */
  icon?: React.ReactNode;
  /** 同原生 `<input accept>`，仅做文件选择器过滤，服务端仍需校验。 */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** 底部提示区，如「单文件不超过 2GB」。 */
  hint?: React.ReactNode;
  /** 拿到用户选择的文件。组件本身不做任何上传，交由调用方决定流程。 */
  onFiles: (files: File[]) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 拖拽 / 点选文件区。
 *
 * <p>纯展示组件：只负责「收集 File[] 并交出去」，不持有上传状态，
 * 因此接入现有上传链路时不会改变既有行为。
 *
 * <p>交互载体是原生 `<button>`（而非带 `role="button"` 的 div），
 * 这样键盘可达性、禁用语义都由浏览器保证；文件选择框作为兄弟节点放在外部，
 * 因为 `<button>` 的内容模型不允许嵌套 `<input>` 这类可交互元素。
 */
const DropZone: React.FC<DropZoneProps> = ({
  title,
  description,
  icon,
  accept,
  multiple = true,
  disabled = false,
  hint,
  onFiles,
  className,
  style,
}) => {
  const intl = useIntl();
  const { styles } = useStyles();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * 拖拽进入 / 离开会在子元素之间反复触发，直接依赖 `dragleave` 会闪动。
   * 用计数器配对 dragenter / dragleave 才能稳定判定「是否还在区域内」。
   */
  const dragDepthRef = useRef(0);

  const emit = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    onFiles(Array.from(fileList));
  };

  const resetDrag = () => {
    dragDepthRef.current = 0;
    setDragging(false);
  };

  const displayTitle = title ?? intl.formatMessage({ id: 'component.dropZone.title' });

  return (
    <>
      <button
        type="button"
        className={[styles.zone, dragging ? styles.zoneActive : '', className]
          .filter(Boolean)
          .join(' ')}
        style={style}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          if (disabled) {
            return;
          }
          dragDepthRef.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          // 不阻止默认行为的话浏览器会直接打开文件，drop 事件不会派发
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (disabled) {
            return;
          }
          dragDepthRef.current -= 1;
          if (dragDepthRef.current <= 0) {
            resetDrag();
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (disabled) {
            return;
          }
          resetDrag();
          emit(event.dataTransfer?.files ?? null);
        }}
      >
        <span className={styles.icon}>{icon ?? <InboxOutlined />}</span>
        <span className={styles.title}>{displayTitle}</span>
        {description ? (
          <span className={styles.description}>{description}</span>
        ) : null}
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </button>
      <input
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          emit(event.target.files);
          // 清空 value，否则连续选择同一个文件不会再触发 change
          event.target.value = '';
        }}
      />
    </>
  );
};

export default DropZone;
