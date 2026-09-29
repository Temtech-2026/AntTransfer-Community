import approval from './es-ES/approval';
import audit from './es-ES/audit';
import auth from './es-ES/auth';
import chat from './es-ES/chat';
import common from './es-ES/common';
import component from './es-ES/component';
import exception from './es-ES/exception';
import file from './es-ES/file';
import globalHeader from './es-ES/globalHeader';
import layout from './es-ES/layout';
import menu from './es-ES/menu';
import message from './es-ES/message';
import network from './es-ES/network';
import pages from './es-ES/pages';
import permissionMap from './es-ES/permissionMap';
import settingDrawer from './es-ES/settingDrawer';
import settings from './es-ES/settings';
import shares from './es-ES/shares';
import system from './es-ES/system';
import upload from './es-ES/upload';
import workbench from './es-ES/workbench';

export default {
  'navBar.lang': 'Idioma',
  'layout.user.link.help': 'Ayuda',
  'layout.user.link.privacy': 'Privacidad',
  'layout.user.link.terms': 'Términos',
  'app.preview.down.block': 'Descargue esta página en su proyecto local',
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
