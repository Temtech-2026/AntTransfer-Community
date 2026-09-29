import { describe, expect, it } from 'vitest';

import {
  buildFileCardContent,
  fileCardDisplayText,
  parseFileCardContent,
} from './fileCard';

describe('buildFileCardContent', () => {
  it('不带条目 ID 时就是「名字（大小）」，与旧口径逐字节一致', () => {
    expect(buildFileCardContent('季度报告.pdf', '2.4 MB')).toBe(
      '季度报告.pdf（2.4 MB）',
    );
  });

  it('带条目 ID 时追加引用尾注，且用换行与尺寸括号分开', () => {
    expect(
      buildFileCardContent('季度报告.pdf', '2.4 MB', '1949000000000000001'),
    ).toBe('季度报告.pdf（2.4 MB）\n#file:1949000000000000001');
  });

  it('条目 ID 为空时不追加尾注，避免产出解析不回来的正文', () => {
    expect(buildFileCardContent('a.pdf', '1 KB', '')).toBe('a.pdf（1 KB）');
    expect(buildFileCardContent('a.pdf', '1 KB', null)).toBe('a.pdf（1 KB）');
  });

  it('带附件授权 ID 时再追加一行 #att: 尾注', () => {
    expect(buildFileCardContent('季度报告.pdf', '2.4 MB', '101', '202')).toBe(
      '季度报告.pdf（2.4 MB）\n#file:101\n#att:202',
    );
  });

  it('只有附件授权 ID（没有条目 ID）时也组装得出', () => {
    expect(buildFileCardContent('a.pdf', '1 KB', null, '202')).toBe(
      'a.pdf（1 KB）\n#att:202',
    );
  });
});

describe('parseFileCardContent', () => {
  it('解析带尾注的正文，取出条目 ID', () => {
    expect(
      parseFileCardContent('季度报告.pdf（2.4 MB）\n#file:1949000000000000001'),
    ).toEqual({
      name: '季度报告.pdf',
      sizeText: '2.4 MB',
      nodeId: '1949000000000000001',
    });
  });

  it('历史消息（正文里没有尾注）仍解析得出，只是没有条目 ID', () => {
    expect(parseFileCardContent('季度报告.pdf（2.4 MB）')).toEqual({
      name: '季度报告.pdf',
      sizeText: '2.4 MB',
    });
  });

  it('文件名自带全角括号时，只认最外层最后一对括号作尺寸', () => {
    expect(parseFileCardContent('方案（终版）.pdf（2.4 MB）')).toEqual({
      name: '方案（终版）.pdf',
      sizeText: '2.4 MB',
    });
    expect(parseFileCardContent('方案（终版）.pdf（2.4 MB）\n#file:101')).toEqual({
      name: '方案（终版）.pdf',
      sizeText: '2.4 MB',
      nodeId: '101',
    });
  });

  it('往返一致，且 19 位条目 ID 全程以字符串原样传递', () => {
    // 9007199254740993 = 2^53 + 1：一旦中途被 Number 过一手，末位就会变成 …992
    const content = buildFileCardContent(
      'a（1）.pdf',
      '12 KB',
      '9007199254740993',
    );
    expect(parseFileCardContent(content)).toEqual({
      name: 'a（1）.pdf',
      sizeText: '12 KB',
      nodeId: '9007199254740993',
    });
  });

  it('正文首尾的空白不影响解析（服务端可能补过换行）', () => {
    expect(parseFileCardContent('  a.pdf（1 KB）\n#file:7  ')).toEqual({
      name: 'a.pdf',
      sizeText: '1 KB',
      nodeId: '7',
    });
  });

  it('普通聊天内容不会被误判成文件卡片', () => {
    expect(parseFileCardContent('晚上一起过一下这个方案')).toBeNull();
    expect(parseFileCardContent('（括号开头）')).toBeNull();
    expect(parseFileCardContent('没有括号的名字')).toBeNull();
  });

  it('空值与被截断的正文返回 null，由调用方按普通文本渲染', () => {
    expect(parseFileCardContent(null)).toBeNull();
    expect(parseFileCardContent(undefined)).toBeNull();
    expect(parseFileCardContent('')).toBeNull();
    expect(parseFileCardContent('季度报告.pdf（2.4')).toBeNull();
    expect(parseFileCardContent('季度报告.pdf（）')).toBeNull();
  });

  it('解析出附件授权 ID，与条目 ID 各归各位', () => {
    expect(
      parseFileCardContent('季度报告.pdf（2.4 MB）\n#file:101\n#att:202'),
    ).toEqual({
      name: '季度报告.pdf',
      sizeText: '2.4 MB',
      nodeId: '101',
      attachmentId: '202',
    });
  });

  it('只有 #att: 尾注时也解析得出，且 19 位授权 ID 不被截断', () => {
    expect(parseFileCardContent('a.pdf（1 KB）\n#att:9007199254740993')).toEqual({
      name: 'a.pdf',
      sizeText: '1 KB',
      attachmentId: '9007199254740993',
    });
  });

  it('两条尾注顺序颠倒也解析得出（不依赖行序）', () => {
    expect(parseFileCardContent('a.pdf（1 KB）\n#att:202\n#file:101')).toEqual({
      name: 'a.pdf',
      sizeText: '1 KB',
      nodeId: '101',
      attachmentId: '202',
    });
  });

  it('无法识别的尾注行宁可当普通文本，也不猜', () => {
    expect(parseFileCardContent('a.pdf（1 KB）\n#foo:1')).toBeNull();
    expect(parseFileCardContent('a.pdf（1 KB）\n#att:abc')).toBeNull();
    expect(parseFileCardContent('a.pdf（1 KB）\n#att:')).toBeNull();
  });
});

describe('fileCardDisplayText', () => {
  it('剥掉 #file: 与 #att: 两条尾注，只剩展示用的「名字（尺寸）」', () => {
    expect(
      fileCardDisplayText(
        '季度报告.pdf（2.4 MB）\n#file:2102453724332388354\n#att:2104826682342342657',
      ),
    ).toBe('季度报告.pdf（2.4 MB）');
  });

  it('只有 #file: 的历史快照同样剥得掉', () => {
    expect(
      fileCardDisplayText('季度报告.pdf（2.4 MB）\n#file:1949000000000000001'),
    ).toBe('季度报告.pdf（2.4 MB）');
  });

  it('已经不含尾注的正文是幂等的（再剥一次不变）', () => {
    expect(fileCardDisplayText('季度报告.pdf（2.4 MB）')).toBe(
      '季度报告.pdf（2.4 MB）',
    );
  });

  it('不像卡片的正文原样返回，不猜着删用户写下的 #file:', () => {
    expect(fileCardDisplayText('这段正文里提到了 #file:1')).toBe(
      '这段正文里提到了 #file:1',
    );
    // 首行没有尺寸括号：整段按普通文本渲染，尾注行也不能当机器标记处理
    expect(fileCardDisplayText('讨论一下\n#file:1')).toBe('讨论一下\n#file:1');
    // 尾注 ID 不是纯数字（半截标记 / 用户写的伪标记）时同样不动
    expect(fileCardDisplayText('a.pdf（1 KB）\n#file:abc')).toBe(
      'a.pdf（1 KB）\n#file:abc',
    );
    expect(fileCardDisplayText('a.pdf（1 KB）\n#att:')).toBe(
      'a.pdf（1 KB）\n#att:',
    );
  });

  it('空值给空串，调用方可以直接画进引用块', () => {
    expect(fileCardDisplayText(null)).toBe('');
    expect(fileCardDisplayText(undefined)).toBe('');
    expect(fileCardDisplayText('')).toBe('');
  });
});
