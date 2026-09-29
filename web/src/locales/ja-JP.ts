import approval from './ja-JP/approval';
import audit from './ja-JP/audit';
import auth from './ja-JP/auth';
import chat from './ja-JP/chat';
import common from './ja-JP/common';
import component from './ja-JP/component';
import exception from './ja-JP/exception';
import file from './ja-JP/file';
import globalHeader from './ja-JP/globalHeader';
import layout from './ja-JP/layout';
import menu from './ja-JP/menu';
import message from './ja-JP/message';
import network from './ja-JP/network';
import pages from './ja-JP/pages';
import permissionMap from './ja-JP/permissionMap';
import settingDrawer from './ja-JP/settingDrawer';
import settings from './ja-JP/settings';
import shares from './ja-JP/shares';
import system from './ja-JP/system';
import upload from './ja-JP/upload';
import workbench from './ja-JP/workbench';

export default {
  'navBar.lang': '言語',
  'layout.user.link.help': 'ヘルプ',
  'layout.user.link.privacy': 'プライバシー',
  'layout.user.link.terms': '利用規約',
  'app.preview.down.block':
    'このページをローカルプロジェクトにダウンロードしてください',
  ...pages,
  ...globalHeader,
  ...menu,
  ...settingDrawer,
  ...settings,
  ...network,
  ...component,
  ...common,
  ...message,
  ...chat,
  ...file,
  ...upload,
  ...shares,
  ...system,
  ...approval,
  ...audit,
  ...permissionMap,
  ...workbench,
  ...auth,
  ...exception,
  ...layout,
};
