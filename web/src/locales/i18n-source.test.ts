import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 语言包**源码级**护栏：同一个文件里不许出现重复的顶层 key。
 *
 * <p>为什么必须读源码：`export default { a: 1, a: 2 }` 在运行时只会留下一个键，
 * 于是任何基于 `Object.keys()` 的检查（包括 `i18n-parity.test.ts` 里的「无重复 key」）
 * 都**恒为真**——重复键属于「写坏了却测不出来」的那一类。而它的真实代价并不小：
 * `tsc` 报 TS1117、构建失败，但 `vitest` 与 `biome` 都会放行，
 * 等暴露时通常已经在提交之后（2026-09-30 就发生过一次：7 个语言包被整块贴了两遍，
 * 80 个 TS1117 一路躲过了全部 1077 个用例）。</p>
 *
 * <p>只比「顶层 key」，按文件内的最小缩进判定；嵌套结构不参与——语言包目前全是扁平表，
 * 将来即便出现嵌套，本规则也只约束顶层。若某文件一个 key 都没扫到，
 * 用例会明确失败（而不是「没有重复」式假阳性）。</p>
 */

const localesDir = dirname(fileURLToPath(import.meta.url));

/** 语言目录形如 `zh-CN`；用它把 `*.test.ts`、聚合文件之类排除在外。 */
const LANGUAGE_DIR = /^[a-z]{2}-[A-Z]{2}$/;

/** parity 测试钉住的 7 个产品语言：它们必须在本次扫描范围内（防目录改名后护栏静默失效）。 */
const PRODUCT_LANGUAGES = [
  'en-US',
  'es-ES',
  'fr-FR',
  'ja-JP',
  'ko-KR',
  'ru-RU',
  'zh-CN',
];

const languages = readdirSync(localesDir)
  .filter(
    (entry) =>
      LANGUAGE_DIR.test(entry) &&
      statSync(join(localesDir, entry)).isDirectory(),
  )
  .sort();

type KeyEntry = { key: string; line: number };

/** 取一个语言包文件的顶层 key；顶层缩进 = 文件内出现的最小缩进。 */
function topLevelKeys(file: string): KeyEntry[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const entries: (KeyEntry & { indent: number })[] = [];
  lines.forEach((line, index) => {
    const matched = /^(\s*)'([^']+)':/.exec(line);
    if (!matched) return;
    entries.push({ key: matched[2], line: index + 1, indent: matched[1].length });
  });
  if (entries.length === 0) return [];
  const topIndent = Math.min(...entries.map((entry) => entry.indent));
  return entries
    .filter((entry) => entry.indent === topIndent)
    .map(({ key, line }) => ({ key, line }));
}

describe('语言包源码：顶层 key 不得重复', () => {
  it('7 个产品语言都在扫描范围内', () => {
    expect(languages).toEqual(expect.arrayContaining(PRODUCT_LANGUAGES));
  });

  it.each(languages)('%s：各命名空间文件里的顶层 key 互不重复', (language) => {
    const dir = join(localesDir, language);
    const files = readdirSync(dir)
      .filter((file) => file.endsWith('.ts'))
      .sort();
    expect(files.length).toBeGreaterThan(0);

    let scanned = 0;
    const duplicated: string[] = [];
    for (const file of files) {
      const seen = new Set<string>();
      for (const entry of topLevelKeys(join(dir, file))) {
        scanned += 1;
        if (seen.has(entry.key)) {
          duplicated.push(`${file}:${entry.line} 重复定义 ${entry.key}`);
        }
        seen.add(entry.key);
      }
    }

    // 兜底：一个 key 都没扫到，说明「缩进 = 顶层」这条假设已经失效，
    // 此时「没有重复」是假阳性，必须让用例红掉而不是静静通过
    expect(scanned).toBeGreaterThan(0);
    expect(duplicated).toEqual([]);
  });
});
