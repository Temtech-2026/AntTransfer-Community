import approval from './en-US/approval';
import audit from './en-US/audit';
import auth from './en-US/auth';
import chat from './en-US/chat';
import common from './en-US/common';
import component from './en-US/component';
import exception from './en-US/exception';
import file from './en-US/file';
import globalHeader from './en-US/globalHeader';
import layout from './en-US/layout';
import menu from './en-US/menu';
import message from './en-US/message';
import network from './en-US/network';
import pages from './en-US/pages';
import permissionMap from './en-US/permissionMap';
import settingDrawer from './en-US/settingDrawer';
import settings from './en-US/settings';
import shares from './en-US/shares';
import system from './en-US/system';
import upload from './en-US/upload';
import workbench from './en-US/workbench';

export default {
  'navBar.lang': 'Languages',
  'layout.user.link.help': 'Help',
  'layout.user.link.privacy': 'Privacy',
  'layout.user.link.terms': 'Terms',
  'app.preview.down.block': 'Download this page to your local project',
  ...globalHeader,
  ...menu,
  ...settingDrawer,
  ...settings,
  ...network,
  ...component,
  ...pages,
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
