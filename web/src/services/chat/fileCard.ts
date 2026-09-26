/**
 * 聊天里「文件消息」的展示口径。
 *
 * <p><b>为什么是纯文本而不是附件结构：</b>后端 `ChatSendDTO.content` 是字符串，
 * 会话消息没有附件表（真正的文件实体在文件域）。所以文件消息以 `文件名（大小）`
 * 的文本形式发送，两端读到的是同一条数据，不需要为了卡片新增契约字段。
 *
 * <p><b>为什么还要在正文末尾追加条目引用：</b>只有「名字（大小）」的话，接收方
 * 看到卡片也无从知道这是文件域里的哪一个条目，「点卡片回去取件」就落不了地。
 * 于是在尺寸括号之后追加一行 `#file:{nodeId}`：
 * <ul>
 *   <li>它是<b>引用尾注</b>而不是展示内容——所有渲染入口都先经
 *       {@link parseFileCardContent} 解析再渲染，标记不会呈现给用户；</li>
 *   <li>会话消息不进消息中心与待办中心（见 `services/notify/types` 的
 *       `isChatNotify`），`content` 的展示面只有聊天页、通讯抽屉与会话摘要，
 *       三处都已走解析，因此不会污染其它界面；</li>
 *   <li><b>向后兼容</b>：没有尾注的历史消息仍解析得出「名字（大小）」，
 *       只是 `nodeId` 缺省、卡片只展示不可跳转。</li>
 * </ul>
 *
 * <p><b>`#att:` 与 `#file:` 的分工：</b>`#att:{attachmentId}` 指向一条
 * <b>会话附件授权</b>（`sys_chat_attachment`），它是「发送方已授权、接收方可免申请取件」
 * 的凭据；`#file:` 指向文件域条目本身，是「回文件域按常规权限取件」的入口。
 * 两者可同时出现，卡片据此分派：
 * <ul>
 *   <li>有 `#att:` → 走免申请取件（受用途档位 / 有效期 / 次数约束），
 *       即便源条目已被发送方移入回收站也仍然可用（授权表存了文件名与大小的快照）；</li>
 *   <li>仅有 `#file:` → 沿用旧行为，点击跳文件域（群聊与历史消息走这条）。</li>
 * </ul>
 *
 * <p>这里的函数是纯函数，便于单测覆盖「文件名自身带括号」「历史消息无尾注」这类边界。
 */

/**
 * 解析结果。
 */
export interface ChatFileCard {
  /** 文件名 */
  name: string;
  /** 尺寸展示串（如 `2.4 MB`），由发送方格式化好 */
  sizeText: string;
  /** 文件条目 ID；历史消息缺省，此时卡片只展示、不跳转 */
  nodeId?: string;
  /**
   * 会话附件授权 ID；缺省表示这条消息没有「免申请取件」凭据。
   *
   * <p>全程按字符串传递：19 位雪花 ID 一旦过一手 `Number` 就会精度丢失。
   */
  attachmentId?: string;
}

/** 条目引用尾注的前缀。 */
const NODE_MARKER = '#file:';

/** 附件授权引用尾注的前缀。 */
const ATTACHMENT_MARKER = '#att:';

/**
 * 首行形态：`名字（尺寸）`。
 *
 * <p>前半段用贪婪匹配：文件名自身含全角括号时（如 `方案（终版）.pdf（2.4 MB）`），
 * 只有最外层最后一对括号才是尺寸，否则会把文件名切坏。
 */
const HEAD_PATTERN = /^(.+)（([^（）]+)）$/;

/** 尾注里的 ID 必须是纯数字，避免把 `#file:abc` 这类半截正文当成卡片。 */
const ID_PATTERN = /^\d+$/;

/**
 * 组装文件消息正文。
 *
 * @param name         文件名
 * @param sizeText     尺寸展示串（如 `2.4 MB`）
 * @param nodeId       文件条目 ID；缺省时不追加该尾注（与旧口径逐字节一致）
 * @param attachmentId 会话附件授权 ID；缺省表示这条消息不带免申请取件凭据
 */
export function buildFileCardContent(
  name: string,
  sizeText: string,
  nodeId?: string | null,
  attachmentId?: string | null,
): string {
  const lines = [`${name}（${sizeText}）`];
  if (nodeId) {
    lines.push(`${NODE_MARKER}${nodeId}`);
  }
  if (attachmentId) {
    lines.push(`${ATTACHMENT_MARKER}${attachmentId}`);
  }
  return lines.join('\n');
}

/**
 * 解析文件消息正文。
 *
 * <p>逐行读取尾注而不是一条大正则：尾注的可选组合会随功能增加而变多，
 * 大正则一旦要支持「有 `#att:` 没 `#file:`」就要写成指数级分支，可读性也没了。
 *
 * @returns 不是本口径的文件消息（或正文被截断过）时返回 null，调用方按普通文本渲染
 */
export function parseFileCardContent(
  content: string | null | undefined,
): ChatFileCard | null {
  if (!content) {
    return null;
  }
  const lines = content.trim().split('\n');
  const head = HEAD_PATTERN.exec(lines[0].trim());
  if (!head) {
    return null;
  }
  const name = head[1].trim();
  const sizeText = head[2].trim();
  if (!name || !sizeText) {
    return null;
  }

  let nodeId: string | undefined;
  let attachmentId: string | undefined;
  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (!line) {
      // 服务端补过的空行不该把卡片打回纯文本，跳过即可
      continue;
    }
    if (line.startsWith(NODE_MARKER)) {
      const value = line.slice(NODE_MARKER.length).trim();
      if (!ID_PATTERN.test(value)) {
        return null;
      }
      nodeId = value;
      continue;
    }
    if (line.startsWith(ATTACHMENT_MARKER)) {
      const value = line.slice(ATTACHMENT_MARKER.length).trim();
      if (!ID_PATTERN.test(value)) {
        return null;
      }
      attachmentId = value;
      continue;
    }
    // 有无法识别的尾注行：宁可当普通文本渲染，也不猜
    return null;
  }

  const card: ChatFileCard = { name, sizeText };
  if (nodeId) {
    card.nodeId = nodeId;
  }
  if (attachmentId) {
    card.attachmentId = attachmentId;
  }
  return card;
}
