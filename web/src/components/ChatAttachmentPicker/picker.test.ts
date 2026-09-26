/**
 * 文件入口的纯规则：两种来源都必须产出「拖拽来源同形」的载荷。
 *
 * <p>这些分支看起来只是兜底，但每一条都对应一个会在界面上被当成正常数据用下去的脏值：
 * 空 ID 会一路走到「点发送」才失败，`NaN` 字节数会渲染成 `NaN B`，
 * 猜出来的密级会显示一个服务端从没答应过的值。</p>
 */

import { describe, expect, it } from 'vitest';

import type { UploadTaskStatus } from '@/services/upload';

import {
  isUploadBusy,
  nodeToPayload,
  normalizeSizeBytes,
  uploadedFileToPayload,
} from './picker';

const NODE_ID = '900000000000000011';

describe('normalizeSizeBytes', () => {
  it('正数原样保留', () => {
    expect(normalizeSizeBytes(2517000)).toBe(2517000);
  });

  it('可空 / 非正 / 非有限值一律归零，不把 NaN 传到展示层', () => {
    expect(normalizeSizeBytes(undefined)).toBe(0);
    expect(normalizeSizeBytes(null)).toBe(0);
    expect(normalizeSizeBytes(0)).toBe(0);
    expect(normalizeSizeBytes(-1)).toBe(0);
    expect(normalizeSizeBytes(Number.NaN)).toBe(0);
    expect(normalizeSizeBytes(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('nodeToPayload（从「我的文件」选）', () => {
  it('产出与拖拽同形的载荷', () => {
    expect(
      nodeToPayload({
        id: NODE_ID,
        name: '季度报告.pdf',
        sizeBytes: 2517000,
        level: 2,
      }),
    ).toEqual({
      nodeId: NODE_ID,
      fileName: '季度报告.pdf',
      sizeBytes: 2517000,
      level: 2,
    });
  });

  it('体积缺失按未知（0）而不是丢字段', () => {
    expect(
      nodeToPayload({
        id: NODE_ID,
        name: 'a.bin',
        sizeBytes: null,
        level: null,
      }),
    ).toEqual({
      nodeId: NODE_ID,
      fileName: 'a.bin',
      sizeBytes: 0,
      level: null,
    });
  });

  it('条目 ID 非法时返回 null：不产出一份注定发不出去的草稿', () => {
    expect(
      nodeToPayload({ id: '', name: 'a.bin', sizeBytes: 1, level: 1 }),
    ).toBeNull();
    expect(
      nodeToPayload({ id: '0', name: 'a.bin', sizeBytes: 1, level: 1 }),
    ).toBeNull();
    expect(
      nodeToPayload({ id: 'abc', name: 'a.bin', sizeBytes: 1, level: 1 }),
    ).toBeNull();
  });
});

describe('uploadedFileToPayload（上传本机文件后）', () => {
  it('用上传回传的条目 ID 组载荷，密级留空不臆造', () => {
    expect(
      uploadedFileToPayload({
        nodeId: NODE_ID,
        fileName: '年会照片.png',
        size: 2048,
      }),
    ).toEqual({
      nodeId: NODE_ID,
      fileName: '年会照片.png',
      sizeBytes: 2048,
      level: undefined,
    });
  });

  it('没回条目 ID 时返回 null：由调用方提示去文件页确认，而不是附一个空 ID', () => {
    expect(
      uploadedFileToPayload({ nodeId: undefined, fileName: 'a.png', size: 1 }),
    ).toBeNull();
    expect(
      uploadedFileToPayload({ nodeId: '0', fileName: 'a.png', size: 1 }),
    ).toBeNull();
  });
});

describe('isUploadBusy', () => {
  it('推进中的状态算忙', () => {
    const busy: UploadTaskStatus[] = [
      'pending',
      'hashing',
      'prechecking',
      'querying',
      'uploading',
      'merging',
    ];
    for (const status of busy) {
      expect(isUploadBusy({ status })).toBe(true);
    }
  });

  it('暂停与终态都不算忙：入口不能因为一条挂着/结束的任务永久卡死', () => {
    const idle: UploadTaskStatus[] = ['paused', 'success', 'error', 'canceled'];
    for (const status of idle) {
      expect(isUploadBusy({ status })).toBe(false);
    }
  });
});
