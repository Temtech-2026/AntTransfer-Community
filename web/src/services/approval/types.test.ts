import { testFormatMessage } from '@/locales/testTranslate';

import { actionLabelId } from './types';

describe('approval actionLabelId i18n', () => {
  it('四个已登记动作返回对应 i18n id，且语言包可解析', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['ACCESS', 'approval.grantAction.access'],
      ['DOWNLOAD', 'approval.grantAction.download'],
      ['EDIT', 'approval.grantAction.edit'],
      ['SHARE', 'approval.grantAction.share'],
    ];
    for (const [action, expectedId] of cases) {
      const id = actionLabelId(action);
      expect(id).toBe(expectedId);
      expect(testFormatMessage({ id })).toBeTruthy();
    }
  });

  it('空值兜底为 unknown，且语言包可解析', () => {
    for (const empty of [undefined, null, '']) {
      const id = actionLabelId(empty);
      expect(id).toBe('approval.grantAction.unknown');
      expect(testFormatMessage({ id })).toBeTruthy();
    }
  });

  it('未登记动作码统一兜底为 unknown，不把裸编码当 id 透传', () => {
    for (const unknown of ['DOWNLOAD_V2', 'MOVE', 'access']) {
      expect(actionLabelId(unknown)).toBe('approval.grantAction.unknown');
    }
  });
});
