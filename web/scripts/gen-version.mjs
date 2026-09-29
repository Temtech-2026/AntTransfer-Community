/**
 * 构建后置步骤：把「这一版前端究竟是哪个提交、什么时候构建的」写进 dist/version.json。
 *
 * 为什么需要：后端有 GET /api/actuator/info、镜像有 OCI 标签，前端却只是一堆静态文件——
 * 浏览器缓存、CDN、甚至手工把 dist 传上服务器，都会让「线上跑的是哪一版」退化成口头禅式猜测。
 * 有了这个文件，运维一条命令即可拿到确定答案：
 *   curl -s http://<host>/version.json
 *
 * 调用方式：由 package.json 的 build 脚本在 `max build` 之后自动执行，无需手工运行。
 * 失败策略：git 不可用（tarball 构建、CI 浅克隆、无 .git 的源码包）时回落 unknown，
 * 并且**绝不阻断构建**——版本标签是诊断信息，不该成为发布失败的成因。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 脚本自身的上级目录 = web/（本文件位于 web/scripts/） */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(webRoot, 'dist');

/** 跑一条 git 命令；任何异常都吞掉并回 undefined，交由调用处回落 unknown */
function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: webRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

const pkg = JSON.parse(readFileSync(resolve(webRoot, 'package.json'), 'utf8'));

// 提交号优先取环境变量（CI 常显式注入，且此处与 config/config.ts 的 COMMIT_HASH 同名同源），
// 其次问 git；两者都拿不到才回落 unknown——宁可显示 unknown，也不猜一个提交号。
const commit =
  process.env.GIT_COMMIT || process.env.COMMIT_HASH || git(['rev-parse', 'HEAD']) || 'unknown';
const branch =
  process.env.GIT_BRANCH || git(['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown';
// 提交自身的时间（HEAD 的 committer date，ISO 8601）——与下面的 buildTime 不是一回事
const commitTime = git(['show', '-s', '--format=%cI', 'HEAD']) || 'unknown';

const version = {
  name: pkg.name,
  version: pkg.version,
  commit,
  commitShort: commit === 'unknown' ? 'unknown' : commit.slice(0, 7),
  branch,
  // 本文件的生成时刻：后端 jar 与前端 dist 通常分别构建，两者时间戳各记各的
  buildTime: new Date().toISOString(),
  commitTime,
};

// preview / 其它仅跑 `max build` 的场景下 dist 应已存在；此处兜底以免脚本单独执行时报错
mkdirSync(distDir, { recursive: true });
const outFile = resolve(distDir, 'version.json');
writeFileSync(outFile, `${JSON.stringify(version, null, 2)}\n`, 'utf8');

console.log(`[version] ${outFile} -> commit=${version.commitShort} branch=${branch}`);
