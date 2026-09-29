import approval from './ru-RU/approval';
import audit from './ru-RU/audit';
import auth from './ru-RU/auth';
import chat from './ru-RU/chat';
import common from './ru-RU/common';
import component from './ru-RU/component';
import exception from './ru-RU/exception';
import file from './ru-RU/file';
import globalHeader from './ru-RU/globalHeader';
import layout from './ru-RU/layout';
import menu from './ru-RU/menu';
import message from './ru-RU/message';
import network from './ru-RU/network';
import pages from './ru-RU/pages';
import permissionMap from './ru-RU/permissionMap';
import settingDrawer from './ru-RU/settingDrawer';
import settings from './ru-RU/settings';
import shares from './ru-RU/shares';
import system from './ru-RU/system';
import upload from './ru-RU/upload';
import workbench from './ru-RU/workbench';

export default {
  'navBar.lang': 'Язык',
  'layout.user.link.help': 'Справка',
  'layout.user.link.privacy': 'Конфиденциальность',
  'layout.user.link.terms': 'Условия',
  'app.preview.down.block': 'Скачайте эту страницу в локальный проект',
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
