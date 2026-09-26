import { describe, expect, it } from 'vitest';

import { formatDisplayDateTime } from './datetime';

describe('formatDisplayDateTime', () => {
  it('服务端 ISO-8601 串渲染为空格分隔的本地可读格式（去掉那个 T）', () => {
    expect(formatDisplayDateTime('2026-09-26T14:30:00')).toBe('2026-09-26 14:30:00');
  });

  it('已是空格分隔的串结果不变：两种入参形态渲染一致', () => {
    expect(formatDisplayDateTime('2026-09-26 14:30:00')).toBe('2026-09-26 14:30:00');
  });

  it('与列表列 valueType="dateTime" 的默认格式逐字符一致（切视图不得变样）', () => {
    // ProTable dateTime 的默认 dateFormatter 即 'YYYY-MM-DD HH:mm:ss'
    expect(formatDisplayDateTime('2026-01-02T03:04:05')).toBe('2026-01-02 03:04:05');
  });

  it('空值统一为占位符，而不是空字符串', () => {
    expect(formatDisplayDateTime(undefined)).toBe('-');
    expect(formatDisplayDateTime(null)).toBe('-');
    expect(formatDisplayDateTime('')).toBe('-');
    expect(formatDisplayDateTime('   ')).toBe('-');
  });

  it('解析不了的串原样回显，不静默吞成占位符', () => {
    // 显示成 `-` 会让人以为这条记录没有时间，原值至少留着排查线索
    expect(formatDisplayDateTime('刚刚')).toBe('刚刚');
  });
});
