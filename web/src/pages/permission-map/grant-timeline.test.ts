import { testFormatMessage } from '@/locales/testTranslate';

import {
  GRANT_STATE_ORDER,
  type GrantState,
  type GrantTimelineEntry,
  grantStateColor,
  grantStateTextId,
  remainDaysTextId,
  summarizeGrantStates,
  VALIDITY_BAR_HORIZON_DAYS,
  validityBarPercent,
} from './grant-timeline';

/** 造一条时间轴条目：分布口径只关心 state，其余字段不是断言对象。 */
function entry(
  state: GrantState,
  remainDays: number | null,
): GrantTimelineEntry {
  return { grant: { grantId: state }, state, remainDays };
}

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

describe('授权状态分布口径', () => {
  it('四态齐全、顺序固定，条数为 0 的状态也保留（图例位置不抖动）', () => {
    const slices = summarizeGrantStates([
      entry('active', 40),
      entry('active', 60),
      entry('expiring', 3),
    ]);

    expect(slices.map((slice) => slice.state)).toEqual([...GRANT_STATE_ORDER]);
    expect(slices.map((slice) => slice.count)).toEqual([2, 1, 0, 0]);
    expect(slices.map((slice) => slice.percent)).toEqual([66.7, 33.3, 0, 0]);
  });

  it('空数据不产生 NaN（总数为 0 时占比记 0）', () => {
    const slices = summarizeGrantStates([]);

    expect(slices.every((slice) => slice.count === 0)).toBe(true);
    expect(slices.every((slice) => slice.percent === 0)).toBe(true);
  });

  it('占比保留 1 位小数，不为了凑满 100 去调整某一段', () => {
    const slices = summarizeGrantStates([
      entry('active', 1),
      entry('expiring', 1),
      entry('expired', -2),
    ]);

    expect(slices.map((slice) => slice.percent)).toEqual([33.3, 33.3, 33.3, 0]);
  });
});

describe('剩余天数条刻度', () => {
  it('长期有效与已过期都不画条', () => {
    expect(validityBarPercent(null)).toBeNull();
    expect(validityBarPercent(0)).toBeNull();
    expect(validityBarPercent(-5)).toBeNull();
  });

  it('按 30 天封顶映射，超过上限一律满格', () => {
    expect(VALIDITY_BAR_HORIZON_DAYS).toBe(30);
    expect(validityBarPercent(15)).toBe(50);
    expect(validityBarPercent(30)).toBe(100);
    expect(validityBarPercent(31)).toBe(100);
    expect(validityBarPercent(365)).toBe(100);
  });

  it('剩 1 天也画得出来（不能舍成 0 宽的隐形条）', () => {
    expect(validityBarPercent(1)).toBe(3);
  });
});
