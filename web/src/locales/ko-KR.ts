import approval from './ko-KR/approval';
import audit from './ko-KR/audit';
import auth from './ko-KR/auth';
import chat from './ko-KR/chat';
import common from './ko-KR/common';
import component from './ko-KR/component';
import exception from './ko-KR/exception';
import file from './ko-KR/file';
import globalHeader from './ko-KR/globalHeader';
import layout from './ko-KR/layout';
import menu from './ko-KR/menu';
import message from './ko-KR/message';
import network from './ko-KR/network';
import pages from './ko-KR/pages';
import permissionMap from './ko-KR/permissionMap';
import settingDrawer from './ko-KR/settingDrawer';
import settings from './ko-KR/settings';
import shares from './ko-KR/shares';
import system from './ko-KR/system';
import upload from './ko-KR/upload';
import workbench from './ko-KR/workbench';

export default {
  'navBar.lang': '언어',
  'layout.user.link.help': '도움말',
  'layout.user.link.privacy': '개인정보',
  'layout.user.link.terms': '약관',
  'app.preview.down.block': '이 페이지를 로컬 프로젝트로 다운로드',
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
