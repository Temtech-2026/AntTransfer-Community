/**
 * 文件域深链契约。
 *
 * <p>聊天里的文件卡片要能「点回文件域取件」，就得有人把条目 ID 写进地址、有人把它读出来。
 * 这一对读写必须用同一个参数名——写错一个字，表现是「点了没反应」而不是报错，
 * 所以把它放在这个无依赖的叶子模块里，供写入方（文件卡片）与读取方（文件工作台）共用。</p>
 */

/** 回到文件域时携带条目 ID 的查询参数名。 */
export const FILE_DEEPLINK_PARAM = 'nodeId';

/**
 * 拼出「打开某个文件条目」的地址。
 *
 * @param nodeId 文件条目 ID（19 位雪花 ID，字符串，见 `services/file/types` 的 ID 语境说明）
 */
export function buildFileDeepLink(nodeId: string): string {
  return `/file?${FILE_DEEPLINK_PARAM}=${encodeURIComponent(nodeId)}`;
}
