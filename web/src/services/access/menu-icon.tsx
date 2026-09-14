/**
 * 菜单图标注册表：把后端下发的 `icon` 字符串键映射为图标组件。
 *
 * <p>为什么不直接 `import * as Icons from '@ant-design/icons'` 动态取：全量引入会让
 * 图标包无法被 tree-shaking，首屏体积显著变大；白名单注册表是显式且可控的。
 *
 * <p>映射键同时兼容两种来源：后端下发的 `icon` 字段（如 `file`）与 perm_code 的根段（如 `file:upload` → `file`）。
 */

import {
  AppstoreOutlined,
  AuditOutlined,
  CloudUploadOutlined,
  FileOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShareAltOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

/** 图标键 → 图标节点。 */
const ICON_REGISTRY: Record<string, ReactNode> = {
  app: <AppstoreOutlined />,
  file: <FileOutlined />,
  upload: <CloudUploadOutlined />,
  share: <ShareAltOutlined />,
  audit: <AuditOutlined />,
  system: <SettingOutlined />,
  user: <UserOutlined />,
  team: <TeamOutlined />,
  role: <SafetyCertificateOutlined />,
};

/** 取图标键的根段：`system:user:list` → `system`。 */
export function iconKeyOf(permCodeOrIcon?: string | null): string {
  if (!permCodeOrIcon) {
    return '';
  }
  return permCodeOrIcon.split(':')[0] ?? '';
}

/**
 * 解析图标：优先用后端下发的 icon 键，其次回退到 perm_code 根段；都未注册时返回 undefined
 * （ProLayout 会退化为无图标，不会渲染成空白方块）。
 */
export function menuIconOf(iconKey?: string | null, permCode?: string | null): ReactNode {
  return ICON_REGISTRY[iconKeyOf(iconKey)] ?? ICON_REGISTRY[iconKeyOf(permCode)] ?? undefined;
}
