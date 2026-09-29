import approval from './fr-FR/approval';
import audit from './fr-FR/audit';
import auth from './fr-FR/auth';
import chat from './fr-FR/chat';
import common from './fr-FR/common';
import component from './fr-FR/component';
import exception from './fr-FR/exception';
import file from './fr-FR/file';
import globalHeader from './fr-FR/globalHeader';
import layout from './fr-FR/layout';
import menu from './fr-FR/menu';
import message from './fr-FR/message';
import network from './fr-FR/network';
import pages from './fr-FR/pages';
import permissionMap from './fr-FR/permissionMap';
import settingDrawer from './fr-FR/settingDrawer';
import settings from './fr-FR/settings';
import shares from './fr-FR/shares';
import system from './fr-FR/system';
import upload from './fr-FR/upload';
import workbench from './fr-FR/workbench';

export default {
  'navBar.lang': 'Langue',
  'layout.user.link.help': 'Aide',
  'layout.user.link.privacy': 'Confidentialité',
  'layout.user.link.terms': 'Conditions',
  'app.preview.down.block': 'Téléchargez cette page dans votre projet local',
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
