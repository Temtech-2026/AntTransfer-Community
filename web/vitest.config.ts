import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': join(__dirname, 'src'),
      '@root': join(__dirname),
      '@@': join(__dirname, 'src', '.umi'),
      // pro-components 的 CJS 产物 lib/provider/index.js 里写的是 require('antd/es/locale/zh_CN')：
      // 用 CJS 去加载 antd 的 ESM 文件，而该文件内部是省略扩展名的相对导入（'../calendar/locale/zh_CN'），
      // Node 原生解析不补扩展名，于是只要测试一引入 ProTable 就抛 MODULE_NOT_FOUND。
      // 它的 package.json 里 "module": "es/index.js"，webpack 构建走的正是这一份；
      // 这里只把这一个包对齐到线上口径：走 es/ 后 Vitest 会交给 Vite 处理（见 vitest 的
      // isValidNodeImport：es/ 下的 .js 不做外部化），扩展名解析与浏览器构建一致。
      '@ant-design/pro-components': join(
        __dirname,
        'node_modules/@ant-design/pro-components/es/index.js',
      ),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // 登录页测试已改写为纯 Vitest 用例（只 mock IO 层，不再依赖 Umi 的 Jest runner），
    // 因此不再排除；此前那条排除项会让改写后的用例静默不执行。
    exclude: ['node_modules', 'dist', '.umi'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/.umi/**',
        'src/services/ant-design-pro/**',
        'src/**/*.d.ts',
        'src/**/index.style.ts',
      ],
    },
    passWithNoTests: true,
    testTimeout: 15000,
  },
});
