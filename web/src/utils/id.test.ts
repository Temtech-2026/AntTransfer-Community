import { describe, expect, it } from 'vitest';

import { compareSnowflakeId, isPositiveIdString } from './id';

/** 真实形态的 19 位雪花 ID（末位非 0，便于一眼看出去精度）。 */
const SNOWFLAKE = '1943123456789012345';

describe('compareSnowflakeId', () => {
  it('按数值序而不是字典序比较', () => {
    expect(compareSnowflakeId('9', '100')).toBeLessThan(0);
    expect(compareSnowflakeId('100', '9')).toBeGreaterThan(0);
  });

  it('19 位雪花 ID 逐位精确比较，末位差异也要能区分', () => {
    expect(compareSnowflakeId(SNOWFLAKE, '1943123456789012346')).toBeLessThan(0);
    expect(compareSnowflakeId('1943123456789012346', SNOWFLAKE)).toBeGreaterThan(0);
    expect(compareSnowflakeId(SNOWFLAKE, SNOWFLAKE)).toBe(0);
  });

  it('空值（乐观行尚未拿到服务端 ID）视为最大，排在末尾', () => {
    expect(compareSnowflakeId('', '7')).toBeGreaterThan(0);
    expect(compareSnowflakeId(null, '7')).toBeGreaterThan(0);
    expect(compareSnowflakeId(undefined, '7')).toBeGreaterThan(0);
    expect(compareSnowflakeId(undefined, null)).toBe(0);
  });
});

describe('isPositiveIdString', () => {
  it('接受正整数 ID 串', () => {
    expect(isPositiveIdString(SNOWFLAKE)).toBe(true);
    expect(isPositiveIdString('7')).toBe(true);
  });

  it('拒绝 0 / 前导零 / 非数字 / 负数 / 空值', () => {
    expect(isPositiveIdString('0')).toBe(false);
    expect(isPositiveIdString('01')).toBe(false);
    expect(isPositiveIdString('1a')).toBe(false);
    expect(isPositiveIdString('')).toBe(false);
    expect(isPositiveIdString('-1')).toBe(false);
    expect(isPositiveIdString(undefined)).toBe(false);
    expect(isPositiveIdString(null)).toBe(false);
  });
});
