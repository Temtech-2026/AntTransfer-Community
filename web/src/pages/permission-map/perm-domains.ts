/**
 * 权限点按「域」分组（纯函数，便于单测）。
 *
 * <p><b>口径说明：</b>这里的「域」只是**前端按 `:` 前缀做的字符串切分**
 * （`file:download` → `file`），后端权限点表里并没有「域」这一列，也没有下发分类。
 * 所以页面上必须写明这是前端分组口径，不能让它看起来像服务端的权威分类。</p>
 */

/** 没有 `:` 前缀（或前缀为空）的权限点归入该分组；页面上替换成本地化文案。 */
export const OTHER_DOMAIN = '';

/** 一个权限域分组。 */
export interface PermDomainGroup {
  /** 域前缀（第一个 `:` 之前的部分）；{@link OTHER_DOMAIN} 表示没有前缀 */
  domain: string;
  /** 该域下的权限点，字典序升序（保证同一份数据两次渲染顺序一致） */
  codes: string[];
}

/** 取权限点的域前缀；`file:download` → `file`，`audit` / `:x` → {@link OTHER_DOMAIN}。 */
export function domainOf(permCode: string): string {
  const index = permCode.indexOf(':');
  return index > 0 ? permCode.slice(0, index) : OTHER_DOMAIN;
}

/**
 * 按域分组：组内字典序升序，组间**按条数降序**、条数相同按域名字典序。
 *
 * <p>排序全按字符串比较，不依赖 `localeCompare`——后者的结果随运行环境语言变化，
 * 会让同一份数据在不同机器上画出不同顺序的条。</p>
 *
 * <p>不去重：后端若重复下发同一个权限点，这里如实把它算两次（重复是后端的问题，
 * 前端悄悄吞掉只会让问题更难发现）。</p>
 */
export function groupPermCodesByDomain(
  permCodes: readonly string[] | null | undefined,
): PermDomainGroup[] {
  const groups = new Map<string, string[]>();
  for (const permCode of Array.isArray(permCodes) ? permCodes : []) {
    const domain = domainOf(permCode);
    const bucket = groups.get(domain);
    if (bucket) {
      bucket.push(permCode);
    } else {
      groups.set(domain, [permCode]);
    }
  }
  return [...groups.entries()]
    .map(([domain, codes]) => ({ domain, codes: [...codes].sort() }))
    .sort((left, right) => {
      if (left.codes.length !== right.codes.length) {
        return right.codes.length - left.codes.length;
      }
      if (left.domain === right.domain) {
        return 0;
      }
      return left.domain < right.domain ? -1 : 1;
    });
}
