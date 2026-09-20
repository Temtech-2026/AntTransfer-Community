/**
 * 文件类型图标。
 *
 * <p>从页面里抽出来是因为**列表与网格两种视图都要用**：同一份文件在两处显示不同图标，
 * 用户会怀疑自己看错了行。</p>
 *
 * <p>纯展示：扩展名认不出来就落到「未知文件」图标，绝不根据扩展名推断可预览 / 可下载——
 * 那是权限与安全策略的事，由服务端下发的能力位决定。</p>
 */

import {
  AudioOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileTextOutlined,
  FileUnknownOutlined,
  FileWordOutlined,
  FileZipOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { CSSProperties } from 'react';

import useStyles from '../index.style';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'aac', 'ogg'];
const ZIP_EXTS = ['zip', 'rar', '7z', 'tar', 'gz'];
const WORD_EXTS = ['doc', 'docx'];
const EXCEL_EXTS = ['xls', 'xlsx', 'csv'];
const PPT_EXTS = ['ppt', 'pptx'];
const TEXT_EXTS = ['txt', 'md', 'log', 'json', 'xml', 'yml', 'yaml'];

export interface FileIconProps {
  ext?: string | null;
  /** 网格视图用更大的图标尺寸 */
  size?: number;
  style?: CSSProperties;
}

/** 按扩展名给出图标（纯展示，不参与任何判定）。 */
export default function FileIcon({ ext, size, style }: FileIconProps) {
  const { styles } = useStyles();
  const name = (ext ?? '').toLowerCase();
  const combined = size ? { ...style, fontSize: size } : style;

  if (IMAGE_EXTS.includes(name)) {
    return <FileImageOutlined className={styles.iconImage} style={combined} />;
  }
  if (VIDEO_EXTS.includes(name)) {
    return <VideoCameraOutlined className={styles.iconVideo} style={combined} />;
  }
  if (AUDIO_EXTS.includes(name)) {
    return <AudioOutlined className={styles.iconAudio} style={combined} />;
  }
  if (ZIP_EXTS.includes(name)) {
    return <FileZipOutlined className={styles.iconZip} style={combined} />;
  }
  if (name === 'pdf') {
    return <FilePdfOutlined className={styles.iconPdf} style={combined} />;
  }
  if (WORD_EXTS.includes(name)) {
    return <FileWordOutlined className={styles.iconWord} style={combined} />;
  }
  if (EXCEL_EXTS.includes(name)) {
    return <FileExcelOutlined className={styles.iconExcel} style={combined} />;
  }
  if (PPT_EXTS.includes(name)) {
    return <FilePptOutlined className={styles.iconPpt} style={combined} />;
  }
  if (TEXT_EXTS.includes(name)) {
    return <FileTextOutlined className={styles.iconText} style={combined} />;
  }
  return <FileUnknownOutlined className={styles.iconUnknown} style={combined} />;
}
