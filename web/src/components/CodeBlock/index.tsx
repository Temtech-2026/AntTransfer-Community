/**
 * CodeBlock：只读代码块，带语言标记与一键复制。
 *
 * <p>用在「接入方式」这类文档区。读者真正要做的是把示例拷到自己的页面里，
 * 所以工具条上「这是什么语言 / 这是哪个文件 / 一键拷走」比语法高亮更值钱。</p>
 *
 * <p>反馈文案由本组件自己取（`component.codeBlock.*`），调用方只需要给源码，
 * 避免每个文档区各写一遍「复制 / 复制成功」。</p>
 */

import { CheckOutlined, CopyOutlined, WarningOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Button } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import useStyles from './index.style';

export interface CodeBlockProps {
  /** 源码原文；缩进与换行原样保留，不做转义或高亮 */
  code: string;
  /** 工具条上的语言徽标（如 `tsx`） */
  language?: string;
  /** 工具条上的位置说明，通常是文件名 */
  title?: string;
  /** 是否提供复制按钮，默认提供 */
  copyable?: boolean;
}

/** 反馈停留时长：够看清结果，又不至于让人以为按钮卡住了 */
const FEEDBACK_MS = 2000;

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * 复制文本：优先 Clipboard API，失败降级 `execCommand`。
 *
 * <p>与 `ShareModal` 同策略。非安全上下文（http、局域网 IP）下
 * `navigator.clipboard` 直接不可用，没有降级路径就会静默失败——
 * 而「点了复制其实没复制」比「明确告诉你失败了」糟得多。</p>
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 权限被拒或 API 不可用：继续走降级路径
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export default function CodeBlock({
  code,
  language,
  title,
  copyable = true,
}: CodeBlockProps) {
  const { styles } = useStyles();
  const intl = useIntl();
  const [state, setState] = useState<CopyState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 卸载时清掉未到期的还原定时器，避免在已卸载组件上 setState
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = useCallback(async () => {
    const ok = await copyText(code);
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState('idle'), FEEDBACK_MS);
  }, [code]);

  // 图标是纯装饰：不带 `aria-hidden` 时它会把自己的 `aria-label`（如 "check"）
  // 拼进按钮的可访问名，屏幕阅读器会念成「check 已复制」。
  const feedback =
    state === 'copied'
      ? { icon: <CheckOutlined aria-hidden="true" />, id: 'component.codeBlock.copied' }
      : state === 'failed'
        ? {
            icon: <WarningOutlined aria-hidden="true" />,
            id: 'component.codeBlock.copyFailed',
          }
        : { icon: <CopyOutlined aria-hidden="true" />, id: 'component.codeBlock.copy' };

  return (
    <div className={styles.block}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarMain}>
          {language ? <span className={styles.language}>{language}</span> : null}
          {title ? <span className={styles.title}>{title}</span> : null}
        </div>
        {copyable ? (
          <Button size="small" icon={feedback.icon} onClick={handleCopy}>
            {intl.formatMessage({ id: feedback.id })}
          </Button>
        ) : null}
      </div>
      <pre className={styles.scroll}>
        <code className={styles.code}>{code}</code>
      </pre>
    </div>
  );
}
