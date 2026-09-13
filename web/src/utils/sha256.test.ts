/** 增量 SHA-256 的正确性验证：FIPS 180-4 向量 + 与 Node 原生实现交叉比对 */

import { createHash } from 'node:crypto';

import { Sha256, sha256Hex } from './sha256';

const nodeHash = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

const text = (value: string) => new TextEncoder().encode(value);

describe('Sha256', () => {
  it('符合 FIPS 180-4 标准向量', () => {
    expect(sha256Hex(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex(text('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex(text('a'.repeat(1_000_000)))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });

  it('覆盖 padding 边界长度（55/56/63/64/65/119/120 字节）', () => {
    for (const length of [55, 56, 63, 64, 65, 119, 120, 128, 129]) {
      const bytes = new Uint8Array(length).fill(length % 251);
      expect(sha256Hex(bytes)).toBe(nodeHash(bytes));
    }
  });

  it('多次 update 与一次性 update 结果一致', () => {
    const bytes = new Uint8Array(300_000).map((_, index) => index % 256);
    const oneShot = sha256Hex(bytes);

    for (const step of [1, 7, 63, 64, 65, 1024, 65_537]) {
      const hasher = new Sha256();
      for (let offset = 0; offset < bytes.length; offset += step) {
        hasher.update(
          bytes.subarray(offset, Math.min(offset + step, bytes.length)),
        );
      }
      expect(hasher.hex()).toBe(oneShot);
    }
  });

  it('大块流式输入与原生实现一致（1 MiB）', () => {
    const bytes = new Uint8Array(1024 * 1024);
    for (let index = 0; index < bytes.length; index += 997) {
      bytes[index] = index % 256;
    }
    const hasher = new Sha256();
    for (let offset = 0; offset < bytes.length; offset += 4096) {
      hasher.update(bytes.subarray(offset, offset + 4096));
    }
    expect(hasher.hex()).toBe(nodeHash(bytes));
  });

  it('digest 之后不可再 update', () => {
    const hasher = new Sha256().update(text('abc'));
    hasher.digest();
    expect(() => hasher.update(text('d'))).toThrow();
    // 重复 digest 应返回同一结果
    expect(hasher.hex()).toBe(sha256Hex(text('abc')));
  });
});
