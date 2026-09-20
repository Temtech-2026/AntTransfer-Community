import { testFormatMessage } from '@/locales/testTranslate';

import {
  grantStateColor,
  grantStateTextId,
  remainDaysTextId,
  type GrantState,
} from './grant-timeline';

describe('grant timeline i18n', () => {
  it('四态状态文案返回 i18n id，且语言包里确有该键', () => {
    const states: GrantState[] = ['active', 'expiring', 'expired', 'permanent'];
    const expected: Record<GrantState, string> = {
      active: 'permissionMap.grantState.active',
      expiring: 'permissionMap.grantState.expiring',
      expired: 'permissionMap.grantState.expired',
      permanent: 'permissionMap.grantState.permanent',
    };
    for (const state of states) {
      const id = grantStateTextId(state);
      expect(id).toBe(expected[state]);
      expect(testFormatMessage({ id })).toBeTruthy();
    }
  });

  it('状态色标不受 i18n 影响', () => {
    expect(grantStateColor('expired')).toBe('error');
    expect(grantStateColor('expiring')).toBe('warning');
    expect(grantStateColor('permanent')).toBe('default');
    expect(grantStateColor('active')).toBe('success');
  });

  it('剩余天数描述符：长期有效 / 已过期 / 剩 N 天', () => {
    expect(remainDaysTextId(null)).toEqual({
      id: 'permissionMap.grantState.permanent',
    });
    expect(remainDaysTextId(0)).toEqual({
      id: 'permissionMap.grantState.expired',
    });
    expect(remainDaysTextId(-3)).toEqual({
      id: 'permissionMap.grantState.expired',
    });

    const days = remainDaysTextId(3);
    expect(days.id).toBe('permissionMap.remainDays');
    // 只断言插值生效，不把中文抄进测试：语言包才是唯一事实源
    expect(testFormatMessage(days)).toContain('3');
  });
});
