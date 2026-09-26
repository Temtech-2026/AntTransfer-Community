/**
 * 这个文件作为组件的目录
 * 目的是统一管理对外输出的组件，方便分类
 */
/**
 * 布局组件
 */
import Footer from './Footer';
import { DocLink, LangDropdown, VersionDropdown } from './RightContent';
import { AvatarDropdown } from './RightContent/AvatarDropdown';

/**
 * 业务组件
 */
export { default as ArticleListContent } from './ArticleListContent';
export { default as AvatarList } from './AvatarList';
export { default as ChatDrawer } from './ChatDrawer';
export { default as EmptyState } from './EmptyState';
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as GlobalSearch } from './GlobalSearch';
export { default as GlobalUploadProgress } from './GlobalUploadProgress';
export { default as PageSkeleton } from './PageSkeleton';
export { default as ProfileSync } from './ProfileSync';
export { default as NotificationBell } from './NotificationBell';
export { default as OfflineBanner } from './OfflineBanner';
export { default as OrgSwitcher } from './OrgSwitcher';
export { default as SiderFooter } from './SiderFooter';
export { default as StandardFormRow } from './StandardFormRow';
export { default as TagSelect } from './TagSelect';
export { default as TransferMonitor } from './TransferMonitor';

export { AvatarDropdown, DocLink, Footer, LangDropdown, VersionDropdown };
