/**
 * 聊天里「文件消息」的展示口径。
 *
 * <p><b>为什么是纯文本而不是附件结构：</b>后端 `ChatSendDTO.content` 是字符串，
 * 会话消息没有附件表（真正的文件实体在文件域）。所以从文件区拖进来的文件以
 * `文件名（大小）` 的文本形式发送：
 * <ul>
 *   <li>聊天页（不做解析的一方）看到的是 `[文件] 合同.pdf（2.4 MB）`，语义完整；</li>
 *   <li>抽屉（发送方）把它解析回卡片渲染，得到「文件迷你卡片」的观感。</li>
 * </ul>
 * 两端读的是同一条消息、同一份数据，不需要为了卡片新增契约字段。
 *
 * <p>这里的函数是纯函数，便于单测覆盖「文件名自身带括号」这类边界。
 */

/**
 * 解析结果。
 */
export interface ChatFileCard {
  /** 文件名 */
  name: string;
  /** 尺寸展示串（如 `2.4 MB`），由发送方格式化好 */
  sizeText: string;
}

/**
 * 组装文件消息正文。
 *
 * @param name     文件名
 * @param sizeText 尺寸展示串（如 `2.4 MB`）
 */
export function buildFileCardContent(name: string, sizeText: string): string {
  return `${name}（${sizeText}）`;
}

/**
 * 解析文件消息正文。
 *
 * <p>用贪婪匹配前半段：文件名自身含全角括号时（如 `方案（终版）.pdf（2.4 MB）`），
 * 只有最外层最后一对括号才是尺寸，否则会把文件名切坏。
 *
 * @returns 不是本口径的文件消息（或正文被截断过）时返回 null，调用方按普通文本渲染
 */
export function parseFileCardContent(
  content: string | null | undefined,
): ChatFileCard | null {
  if (!content) {
    return null;
  }
  const matched = /^(.+)（([^（）]+)）$/.exec(content.trim());
  if (!matched) {
    return null;
  }
  const name = matched[1].trim();
  const sizeText = matched[2].trim();
  if (!name || !sizeText) {
    return null;
  }
  return { name, sizeText };
}
