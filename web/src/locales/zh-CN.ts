import approval from './zh-CN/approval';
import audit from './zh-CN/audit';
import auth from './zh-CN/auth';
import chat from './zh-CN/chat';
import common from './zh-CN/common';
import component from './zh-CN/component';
import exception from './zh-CN/exception';
import file from './zh-CN/file';
import globalHeader from './zh-CN/globalHeader';
import layout from './zh-CN/layout';
import menu from './zh-CN/menu';
import message from './zh-CN/message';
import network from './zh-CN/network';
import pages from './zh-CN/pages';
import permissionMap from './zh-CN/permissionMap';
import settingDrawer from './zh-CN/settingDrawer';
import settings from './zh-CN/settings';
import shares from './zh-CN/shares';
import system from './zh-CN/system';
import upload from './zh-CN/upload';
import workbench from './zh-CN/workbench';

export default {
  'navBar.lang': '语言',
  'layout.user.link.help': '帮助',
  'layout.user.link.privacy': '隐私',
  'layout.user.link.terms': '条款',
  'app.preview.down.block': '下载此页面到本地项目',
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
