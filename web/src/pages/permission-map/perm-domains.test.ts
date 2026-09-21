import { domainOf, groupPermCodesByDomain, OTHER_DOMAIN } from './perm-domains';

describe('权限域（前端按 `:` 前缀切分）', () => {
  it('取第一个 `:` 之前的段作为域', () => {
    expect(domainOf('file:download')).toBe('file');
    expect(domainOf('system:user:list')).toBe('system');
  });

  it('没有前缀或前缀为空都归入「其他」', () => {
    expect(domainOf('audit')).toBe(OTHER_DOMAIN);
    expect(domainOf(':broken')).toBe(OTHER_DOMAIN);
    expect(domainOf('')).toBe(OTHER_DOMAIN);
  });
});

describe('权限域分组', () => {
  it('组内字典序、组间按条数降序，条数相同按域名升序', () => {
    const groups = groupPermCodesByDomain([
      'file:share',
      'file:download',
      'system:user',
      'system:role',
      'audit',
      'approval:read',
    ]);

    // file / system 各 2 条并列 → 按域名升序；approval 与「其他」各 1 条 → 空串排在最前
    expect(groups.map((group) => group.domain)).toEqual([
      'file',
      'system',
      OTHER_DOMAIN,
      'approval',
    ]);
    expect(groups[0].codes).toEqual(['file:download', 'file:share']);
    expect(groups[2].codes).toEqual(['audit']);
  });

  it('空值、空数组都返回空分组（页面据此走空态）', () => {
    expect(groupPermCodesByDomain(null)).toEqual([]);
    expect(groupPermCodesByDomain(undefined)).toEqual([]);
    expect(groupPermCodesByDomain([])).toEqual([]);
  });

  it('不改动入参，也不去重（重复是后端的问题，不在前端悄悄吞掉）', () => {
    const input = ['system:user', 'system:user', 'file:download'];
    const groups = groupPermCodesByDomain(input);

    expect(input).toEqual(['system:user', 'system:user', 'file:download']);
    expect(groups.map((group) => group.domain)).toEqual(['system', 'file']);
    expect(groups[0].codes).toEqual(['system:user', 'system:user']);
  });
});
