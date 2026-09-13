#!/usr/bin/env node
/**
 * Vitest 启动器：在 spawn Vitest 之前，把 CWD 规范化为操作系统返回的标准路径。
 *
 * 背景（Windows 特有）：
 *   当项目通过小写盘符打开时（例如 `e:\...`），`process.cwd()` 会保持小写，
 *   而 `fs.realpathSync*` 会把同一路径规范化成大写盘符（`E:\...`）。Vitest 内部
 *   的模块解析器会对模块路径无条件执行 realpath（见 vitest-dev/vitest#5251），
 *   于是「Vitest 主进程」与「测试文件模块」会用两个不同的 URL 字符串指向同一个
 *   物理文件。Node 的 ESM 缓存以 URL 字符串为键，这会导致同一模块被实例化两次：
 *   `@vitest/runner` 的模块级变量 `runner` 在测试文件所使用的那份实例中是
 *   `undefined`，测试收集阶段即报错：
 *     TypeError: Cannot read properties of undefined (reading 'config')
 *
 *   解决办法：把「工作目录」与「Vitest 入口脚本」都规范化后再启动，让主进程与测试模块
 *   使用同一套路径大小写，从而消除重复实例。该规范化在 Linux/macOS 上是恒等变换，
 *   不影响其他平台，也不改变任何测试行为。
 */
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pkgPath = require.resolve('vitest/package.json');
const pkg = require(pkgPath);
const binRelative = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.vitest;
const vitestBin = path.join(path.dirname(pkgPath), binRelative);

/** 把路径规范化为操作系统返回的标准形式，失败时退回原值。 */
function canonical(p) {
  try {
    return realpathSync.native(p);
  } catch {
    return p;
  }
}

// CWD 与入口脚本都必须使用同一套「规范化后」的路径大小写，否则 Node 的 ESM 缓存
// 会把同一个模块按两个 URL 字符串分别实例化。
const cwd = canonical(process.cwd());
const entry = canonical(vitestBin);

const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
