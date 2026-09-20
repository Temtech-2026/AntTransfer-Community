import { testFormatMessage } from '@/locales/testTranslate';

import {
  AUDIT_ACTION_GROUPS,
  AUDIT_ACTION_LABEL_IDS,
  AUDIT_MODULE_ENUM,
  AUDIT_RESULT_ENUM,
  AUDIT_TARGET_TYPE_OPTIONS,
  actionTextId,
} from './constants';

describe('audit constants i18n', () => {
  it('命中字典时返回 i18n id，且语言包里确有该键', () => {
    const id = actionTextId('FILE_UPLOAD');
    expect(id).toBe('audit.action.FILE_UPLOAD');
    const text = testFormatMessage({ id: id as string });
    // 断言「能取到文案」而不是把中文抄进测试：语言包才是唯一事实源
    expect(text).toBeTruthy();
    expect(text).not.toBe(id);
  });

  it('未命中 / 空值返回 null，交给调用方原样展示编码', () => {
    expect(actionTextId('NOT_A_REAL_ACTION')).toBeNull();
    expect(actionTextId(null)).toBeNull();
    expect(actionTextId(undefined)).toBeNull();
    expect(actionTextId('')).toBeNull();
  });

  it('分组 / 域 / 结果 / 对象类型的所有 id 都能在 zh-CN 语言包里取到文案', () => {
    for (const group of AUDIT_ACTION_GROUPS) {
      expect(testFormatMessage({ id: group.labelId })).toBeTruthy();
      for (const option of group.options) {
        expect(testFormatMessage({ id: option.labelId })).toBeTruthy();
      }
    }
    for (const meta of Object.values(AUDIT_MODULE_ENUM)) {
      expect(testFormatMessage({ id: meta.labelId })).toBeTruthy();
    }
    for (const meta of Object.values(AUDIT_RESULT_ENUM)) {
      expect(testFormatMessage({ id: meta.labelId })).toBeTruthy();
    }
    for (const option of AUDIT_TARGET_TYPE_OPTIONS) {
      expect(testFormatMessage({ id: option.labelId })).toBeTruthy();
    }
  });

  it('动作字典由分组展开且无重复 value', () => {
    const values = AUDIT_ACTION_GROUPS.flatMap((group) =>
      group.options.map((option) => option.value),
    );
    expect(values).toHaveLength(new Set(values).size);
    expect(Object.keys(AUDIT_ACTION_LABEL_IDS)).toHaveLength(values.length);
  });
});
