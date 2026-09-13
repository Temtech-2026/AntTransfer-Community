/**
 * 增量 SHA-256（纯 TypeScript，无依赖）。
 *
 * `crypto.subtle.digest` 是一次性接口，必须整份数据进内存；本项目单文件上限 10 GiB，
 * 整件读入必然 OOM，因此需要可 `update(chunk)` 流式喂入的实现——内存占用恒为
 * 「一个分片 + 64 字节块缓冲」。分片哈希仍走原生 `crypto.subtle`（更快），
 * 本实现只服务全文件流式摘要（秒传键，PRD US-02）。
 *
 * 必须同时能在 Worker 与主线程运行，故不得引用 DOM / React / Umi。
 */

/** SHA-256 轮常量（FIPS 180-4 §4.2.2） */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** 初始散列值（FIPS 180-4 §5.3.3） */
const H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
]);

const BLOCK_BYTES = 64;

/** 字节数组 → 小写十六进制 */
export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/** 增量 SHA-256：`update()` 可多次调用，`digest()` 收尾后不可再用 */
export class Sha256 {
  private h = Uint32Array.from(H0);
  private readonly block = new Uint8Array(BLOCK_BYTES);
  private readonly w = new Uint32Array(64);
  private blockLength = 0;
  /** 已喂入字节数（10 GiB 远未触及 number 精度上限） */
  private bytesHashed = 0;
  private finished = false;

  /** 喂入一段数据，按 64 字节块增量处理 */
  update(data: Uint8Array): this {
    if (this.finished) {
      throw new Error('Sha256 已收尾（digest 后不可再 update）');
    }
    this.bytesHashed += data.length;
    let offset = 0;

    // ① 补齐上次残留的不足一块
    if (this.blockLength > 0) {
      const take = Math.min(BLOCK_BYTES - this.blockLength, data.length);
      this.block.set(data.subarray(0, take), this.blockLength);
      this.blockLength += take;
      offset = take;
      if (this.blockLength === BLOCK_BYTES) {
        this.processBlock(this.block, 0);
        this.blockLength = 0;
      }
    }

    // ② 整块直通，避免逐块拷贝
    while (offset + BLOCK_BYTES <= data.length) {
      this.processBlock(data, offset);
      offset += BLOCK_BYTES;
    }

    // ③ 尾部不足一块留待下次
    if (offset < data.length) {
      this.block.set(data.subarray(offset), 0);
      this.blockLength = data.length - offset;
    }
    return this;
  }

  /** 收尾并返回 32 字节摘要 */
  digest(): Uint8Array {
    if (!this.finished) {
      this.finalize();
      this.finished = true;
    }
    const out = new Uint8Array(32);
    const view = new DataView(out.buffer);
    for (let i = 0; i < 8; i += 1) {
      view.setUint32(i * 4, this.h[i], false);
    }
    return out;
  }

  /** 收尾并返回小写十六进制摘要 */
  hex(): string {
    return toHex(this.digest());
  }

  /** padding：0x80 + 若干 0x00 + 64bit 大端比特长度（FIPS 180-4 §5.1） */
  private finalize(): void {
    const totalBits = this.bytesHashed * 8;
    const high = Math.floor(totalBits / 0x100000000);
    const low = totalBits >>> 0;
    // 使 (blockLength + pad + 8) 恰为 64 的整数倍
    const padLength =
      this.blockLength < 56 ? 56 - this.blockLength : 120 - this.blockLength;
    const tail = new Uint8Array(padLength + 8);
    tail[0] = 0x80;
    const view = new DataView(tail.buffer);
    view.setUint32(padLength, high, false);
    view.setUint32(padLength + 4, low, false);
    this.update(tail);
  }

  private processBlock(input: Uint8Array, offset: number): void {
    const w = this.w;
    for (let i = 0; i < 16; i += 1) {
      const p = offset + i * 4;
      w[i] =
        (input[p] << 24) |
        (input[p + 1] << 16) |
        (input[p + 2] << 8) |
        input[p + 3];
    }
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 =
        ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, hh] = this.h;
    for (let i = 0; i < 64; i += 1) {
      const s1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + K[i] + w[i]) | 0;
      const s0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }

    this.h[0] = (this.h[0] + a) | 0;
    this.h[1] = (this.h[1] + b) | 0;
    this.h[2] = (this.h[2] + c) | 0;
    this.h[3] = (this.h[3] + d) | 0;
    this.h[4] = (this.h[4] + e) | 0;
    this.h[5] = (this.h[5] + f) | 0;
    this.h[6] = (this.h[6] + g) | 0;
    this.h[7] = (this.h[7] + hh) | 0;
  }
}

/** 一次性便捷函数：对单段字节求 SHA-256 十六进制摘要 */
export function sha256Hex(data: Uint8Array): string {
  return new Sha256().update(data).hex();
}
