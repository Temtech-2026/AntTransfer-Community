import { describe, expect, it } from 'vitest';

import {
  SHARE_LIMITS,
  buildFileQuery,
  buildShareCopyText,
  buildShareUrl,
  isValidExtractCode,
  levelColor,
  levelText,
  randomExtractCode,
  shareStatusText,
  sortExprOf,
  toOptionalNumber,
} from './types';

describe('toOptionalNumber（宽松归一）', () => {
  it('数字与数字字符串归一为数值', () => {
    expect(toOptionalNumber(3)).toBe(3);
    expect(toOptionalNumber('3')).toBe(3);
    expect(toOptionalNumber(' 42 ')).toBe(42);
  });

  it('空值 / 非法值一律视为未传', () => {
    expect(toOptionalNumber(undefined)).toBeUndefined();
    expect(toOptionalNumber(null)).toBeUndefined();
    expect(toOptionalNumber('')).toBeUndefined();
    expect(toOptionalNumber('   ')).toBeUndefined();
    expect(toOptionalNumber('abc')).toBeUndefined();
    expect(toOptionalNumber(Number.NaN)).toBeUndefined();
    expect(toOptionalNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe('sortExprOf（ProTable 排序 → 服务端表达式）', () => {
  it('ascend / descend 映射为 asc / desc', () => {
    expect(sortExprOf({ updateTime: 'ascend' })).toBe('updateTime,asc');
    expect(sortExprOf({ sizeBytes: 'descend' })).toBe('sizeBytes,desc');
  });

  it('无有效排序时返回 undefined', () => {
    expect(sortExprOf()).toBeUndefined();
    expect(sortExprOf({})).toBeUndefined();
    expect(sortExprOf({ updateTime: null })).toBeUndefined();
  });

  it('多列排序取第一个有效项', () => {
    expect(sortExprOf({ name: null, sizeBytes: 'descend', updateTime: 'ascend' })).toBe(
      'sizeBytes,desc',
    );
  });
});

describe('buildFileQuery（查询体组装）', () => {
  it('空参只下发分页默认值，其余空参不下发', () => {
    const query = buildFileQuery();
    expect(query).toEqual({ current: 1, pageSize: 20 });
  });

  it('关键字去空白，纯空白不下发', () => {
    expect(buildFileQuery({ name: '  报表  ' }).keyword).toBe('报表');
    expect(buildFileQuery({ name: '   ' })).not.toHaveProperty('keyword');
  });

  it('密级字符串归一为数字，非法值不下发', () => {
    expect(buildFileQuery({ level: '3' }).level).toBe(3);
    expect(buildFileQuery({ level: '' })).not.toHaveProperty('level');
    expect(buildFileQuery({ level: 'abc' })).not.toHaveProperty('level');
  });

  it('创建时间区间补齐起止时刻（避免时区漂移只用日期字符串）', () => {
    expect(buildFileQuery({ createTimeRange: ['2026-09-01', '2026-09-14'] })).toMatchObject({
      startTime: '2026-09-01 00:00:00',
      endTime: '2026-09-14 23:59:59',
    });
  });

  it('时间区间只给一端时另一端不下发', () => {
    const startOnly = buildFileQuery({ createTimeRange: ['2026-09-01', undefined] });
    expect(startOnly.startTime).toBe('2026-09-01 00:00:00');
    expect(startOnly).not.toHaveProperty('endTime');

    const empty = buildFileQuery({ createTimeRange: [undefined, undefined] });
    expect(empty).not.toHaveProperty('startTime');
    expect(empty).not.toHaveProperty('endTime');
  });

  it('folderId 与 sort 来自上下文而非表单字段', () => {
    const query = buildFileQuery(
      { ext: 'pdf' },
      { folderId: 12, sorter: { updateTime: 'descend' } },
    );
    expect(query.folderId).toBe(12);
    expect(query.sort).toBe('updateTime,desc');
    expect(query.ext).toBe('pdf');
  });

  it('folderId 非数字（含 0 之外的非法值）不下发', () => {
    expect(buildFileQuery({}, { folderId: Number.NaN })).not.toHaveProperty('folderId');
    expect(buildFileQuery({}, {})).not.toHaveProperty('folderId');
  });

  it('分页参数可覆盖默认值', () => {
    expect(buildFileQuery({ current: 3, pageSize: 50 })).toMatchObject({
      current: 3,
      pageSize: 50,
    });
  });
});

describe('密级展示口径', () => {
  it('已知密级给中文标签与语义色', () => {
    expect(levelText(1)).toBe('公开');
    expect(levelText(3)).toBe('机密');
    expect(levelColor(1)).toBe('success');
    expect(levelColor(3)).toBe('error');
  });

  it('未知密级按未定级处理', () => {
    expect(levelText(undefined)).toBe('未定级');
    expect(levelText(9)).toBe('未定级');
    expect(levelColor(undefined)).toBe('default');
  });
});

describe('分享状态与提取码', () => {
  it('分享状态文案', () => {
    expect(shareStatusText(0)).toBe('生效中');
    expect(shareStatusText(1)).toBe('已撤销');
    expect(shareStatusText(2)).toBe('已失效');
    expect(shareStatusText(undefined)).toBe('未知');
  });

  it('随机提取码长度被夹到合法区间', () => {
    expect(randomExtractCode(1, () => 0)).toHaveLength(SHARE_LIMITS.extractCodeMin);
    expect(randomExtractCode(999, () => 0)).toHaveLength(SHARE_LIMITS.extractCodeMax);
    expect(randomExtractCode(SHARE_LIMITS.extractCodeDefault, () => 0.999)).toHaveLength(
      SHARE_LIMITS.extractCodeDefault,
    );
  });

  it('提取码字符集剔除了易混字符', () => {
    // random 恒为 0 时取字符集首位，且不应出现 0/O/1/l/I
    expect(randomExtractCode(8, () => 0)).toBe('AAAAAAAA');
  });

  it('提取码校验：长度与字符集', () => {
    expect(isValidExtractCode('ABC123')).toBe(true);
    expect(isValidExtractCode('ABC12')).toBe(false);
    expect(isValidExtractCode('A'.repeat(SHARE_LIMITS.extractCodeMax))).toBe(true);
    expect(isValidExtractCode('A'.repeat(SHARE_LIMITS.extractCodeMax + 1))).toBe(false);
    expect(isValidExtractCode('ABC-123')).toBe(false);
    expect(isValidExtractCode('')).toBe(false);
    expect(isValidExtractCode(null)).toBe(false);
  });
});

describe('分享链接与复制文案', () => {
  it('URL 基于注入的 origin 并对 token 编码', () => {
    expect(buildShareUrl('abc', 'https://file.example.com')).toBe(
      'https://file.example.com/share/abc',
    );
    expect(buildShareUrl('a/b', 'https://file.example.com')).toBe(
      'https://file.example.com/share/a%2Fb',
    );
  });

  it('复制文案必须同时给出链接与提取码', () => {
    const text = buildShareCopyText('https://x/share/t', 'ABC123', '2026-09-21 00:00:00');
    expect(text).toContain('链接：https://x/share/t');
    expect(text).toContain('提取码：ABC123');
    expect(text).toContain('有效期至：2026-09-21 00:00:00');
  });

  it('未传提取码 / 有效期时不产生空行', () => {
    expect(buildShareCopyText('https://x/share/t')).toBe('链接：https://x/share/t');
  });
});
