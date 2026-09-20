/**
 * 系统管理域「展示常量 → i18n id」的守卫。
 *
 * <p>该域的常量表不在本目录，而在 {@code @/services/system/types}（用户状态 / 数据范围 /
 * 权限点维度 / 审计结果 / 操作人兜底的映射与纯函数都在那里），本文件只做断言：
 * 每个枚举取值、每个下拉 labelId 都能在 zh-CN 语言包里取到文案。</p>
 *
 * <p><b>不抄中文文案</b>：断言用的 {@link testFormatMessage} 在语言包缺键时直接抛错，
 * 因此「键存在」这件事由它天然兜住，语言包仍是唯一事实源。</p>
 */
import { testFormatMessage } from '@/locales/testTranslate';
import { DataScope } from '@/services/access/types';
import {
  DATA_SCOPE_OPTIONS,
  PERM_TYPE_META,
  UserStatus,
  auditResultTextId,
  dataScopeTextId,
  operatorTextId,
  permTypeTextId,
  userStatusTextId,
} from '@/services/system/types';

/** 断言该 id 有文案，且取到的不是「回退成 id」本身。 */
function expectI18nMessage(id: string): void {
  const text = testFormatMessage({ id });
  expect(text).toBeTruthy();
  expect(text).not.toBe(id);
}

describe('system 域常量 i18n', () => {
  it('用户状态全枚举命中，未知取值回落 unknown', () => {
    for (const status of Object.values(UserStatus)) {
      const id = userStatusTextId(status);
      expect(id).not.toBe('system.userStatus.unknown');
      expectI18nMessage(id);
    }
    for (const unknown of [null, undefined, 99]) {
      const id = userStatusTextId(unknown);
      expect(id).toBe('system.userStatus.unknown');
      expectI18nMessage(id);
    }
  });

  it('数据范围全枚举与下拉 labelId 命中，未知取值回落 unknown', () => {
    for (const scope of Object.values(DataScope)) {
      const id = dataScopeTextId(scope);
      expect(id).not.toBe('system.dataScope.unknown');
      expectI18nMessage(id);
    }
    for (const option of DATA_SCOPE_OPTIONS) {
      expect(dataScopeTextId(option.value)).toBe(option.labelId);
      expectI18nMessage(option.labelId);
    }
    for (const unknown of [null, undefined, 99]) {
      const id = dataScopeTextId(unknown);
      expect(id).toBe('system.dataScope.unknown');
      expectI18nMessage(id);
    }
  });

  it('权限点维度全枚举命中，未知取值回落 unknown', () => {
    for (const [type, meta] of Object.entries(PERM_TYPE_META)) {
      expect(permTypeTextId(Number(type))).toBe(meta.textId);
      expectI18nMessage(meta.textId);
    }
    for (const unknown of [null, undefined, 99]) {
      const id = permTypeTextId(unknown);
      expect(id).toBe('system.permType.unknown');
      expectI18nMessage(id);
    }
  });

  it('审计结果各分支命中，未知取值回落 unknown', () => {
    expect(auditResultTextId(0)).toBe('audit.result.success');
    expectI18nMessage('audit.result.success');
    expect(auditResultTextId(1)).toBe('audit.result.failed');
    expectI18nMessage('audit.result.failed');
    for (const unknown of [null, undefined, 99]) {
      const id = auditResultTextId(unknown);
      expect(id).toBe('audit.result.unknown');
      expectI18nMessage(id);
    }
  });

  it('操作人兜底各分支：有展示名不给 id，无展示名给可取的 id', () => {
    // 展示名可用时不产生 id，渲染侧直接用展示名
    expect(operatorTextId({ userId: 7, operatorName: 'alice' })).toBeNull();

    // 已注销用户：有 userId 但反查不到展示名
    expect(operatorTextId({ userId: 7, operatorName: null })).toBe('audit.operator.deletedUser');
    expectI18nMessage('audit.operator.deletedUser');

    // 匿名 / 系统任务：userId 也为空（或 0）
    expect(operatorTextId({ userId: null, operatorName: null })).toBe('audit.operator.system');
    expectI18nMessage('audit.operator.system');
  });
});
