import { describe, expect, it } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';

import {
  SHARE_LIMITS,
  buildFileQuery,
  buildShareLinkWithCode,
  buildShareUrl,
  isValidExtractCode,
  levelColor,
  levelTextId,
  randomExtractCode,
  readShareCodeFromHash,
  shareStatusId,
  sortExprOf,
  toOptionalNumber,
} from './types';

/** 服务层只给 id，测试用真实 zh-CN 语言包解析，保证 id 一定存在。 */
const t = (id: string, values?: Record<string, unknown>) =>
  testFormatMessage({ id, values });

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
      { folderId: '12', sorter: { updateTime: 'descend' } },
    );
    expect(query.folderId).toBe('12');
    expect(query.sort).toBe('updateTime,desc');
    expect(query.ext).toBe('pdf');
  });

  it('folderId 是雪花 ID 时原样下发，不得被 Number() 归一', () => {
    // 19 位雪花 ID 超出 JS 安全整数：一旦走 Number() 再转回字符串，末位会失真，
    // 服务端按失真的 folderId 过滤就会返回空列表（「进入目录后列表空白」）。
    const snowflake = '1943123456789012345';
    const query = buildFileQuery({}, { folderId: snowflake });
    expect(query.folderId).toBe(snowflake);
    expect(query.folderId).not.toBe(String(Number(snowflake)));
  });

  it('folderId 非纯数字（含空串）不下发', () => {
    expect(buildFileQuery({}, { folderId: 'abc' })).not.toHaveProperty('folderId');
    expect(buildFileQuery({}, { folderId: '' })).not.toHaveProperty('folderId');
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
  it('已知密级映射到语言包 id，并能解析出中文标签', () => {
    expect(levelTextId(1)).toBe('file.level.public');
    expect(levelTextId(3)).toBe('file.level.classified');
    expect(t(levelTextId(1))).toBe('公开');
    expect(t(levelTextId(3))).toBe('机密');
    expect(levelColor(1)).toBe('success');
    expect(levelColor(3)).toBe('error');
  });

  it('未知密级按未定级处理', () => {
    expect(levelTextId(undefined)).toBe('file.level.unknown');
    expect(levelTextId(9)).toBe('file.level.unknown');
    expect(t(levelTextId(9))).toBe('未定级');
    expect(levelColor(undefined)).toBe('default');
  });
});

describe('分享状态与提取码', () => {
  it('分享状态映射到语言包 id', () => {
    expect(shareStatusId(0)).toBe('file.shareStatus.active');
    expect(shareStatusId(1)).toBe('file.shareStatus.revoked');
    expect(shareStatusId(2)).toBe('file.shareStatus.expired');
    expect(shareStatusId(undefined)).toBe('file.shareStatus.unknown');
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

  it('提取码拼进 fragment，复制文案仍是单行', () => {
    const text = buildShareLinkWithCode('https://x/share/t', 'ABC123');
    expect(text).toBe('https://x/share/t#code=ABC123');
    // 回归护栏：复制内容一旦出现换行，粘进地址栏就会被当成搜索词交给搜索引擎，
    // 用户看到的是百度而不是取件页（这正是本次要修的症状）
    expect(text).not.toMatch(/[\r\n]/);
  });

  it('没带提取码（或只有空白）时不留下空 fragment', () => {
    expect(buildShareLinkWithCode('https://x/share/t')).toBe('https://x/share/t');
    expect(buildShareLinkWithCode('https://x/share/t', '   ')).toBe(
      'https://x/share/t',
    );
  });

  it('提取码做 URL 编码，不越出 fragment 的取值边界', () => {
    // 当前字符集只有字母数字，编码是为将来放宽字符集时拼接不被破坏
    expect(buildShareLinkWithCode('https://x/share/t', 'A B')).toBe(
      'https://x/share/t#code=A%20B',
    );
  });

  it('读回提取码：与写入口径对称', () => {
    const link = buildShareLinkWithCode('https://x/share/t', 'ABC123');
    expect(readShareCodeFromHash(new URL(link).hash)).toBe('ABC123');
    expect(readShareCodeFromHash('#code=ABC123')).toBe('ABC123');
    expect(readShareCodeFromHash('code=ABC123')).toBe('ABC123');
    expect(readShareCodeFromHash('#code=ABC123&from=mail')).toBe('ABC123');
  });

  it('读回提取码：形状不合法一律忽略，交给访客手输', () => {
    expect(readShareCodeFromHash('#code=ABC12')).toBeUndefined();
    expect(readShareCodeFromHash('#code=ABC-123')).toBeUndefined();
    expect(readShareCodeFromHash('#other=ABC123')).toBeUndefined();
    expect(readShareCodeFromHash('#')).toBeUndefined();
    expect(readShareCodeFromHash('')).toBeUndefined();
    expect(readShareCodeFromHash(undefined)).toBeUndefined();
    expect(readShareCodeFromHash(null)).toBeUndefined();
  });
});
