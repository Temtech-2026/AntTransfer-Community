import enUSApproval from './en-US/approval';
import enUSAudit from './en-US/audit';
import enUSAuth from './en-US/auth';
import enUSChat from './en-US/chat';
import enUSCommon from './en-US/common';
import enUSComponent from './en-US/component';
import enUSException from './en-US/exception';
import enUSFile from './en-US/file';
import enUSLayout from './en-US/layout';
import enUSNetwork from './en-US/network';
import enUSPages from './en-US/pages';
import enUSPermissionMap from './en-US/permissionMap';
import enUSShares from './en-US/shares';
import enUSSystem from './en-US/system';
import enUSUpload from './en-US/upload';
import enUSWorkbench from './en-US/workbench';
import zhCNApproval from './zh-CN/approval';
import zhCNAudit from './zh-CN/audit';
import zhCNAuth from './zh-CN/auth';
import zhCNChat from './zh-CN/chat';
import zhCNCommon from './zh-CN/common';
import zhCNComponent from './zh-CN/component';
import zhCNException from './zh-CN/exception';
import zhCNFile from './zh-CN/file';
import zhCNLayout from './zh-CN/layout';
import zhCNNetwork from './zh-CN/network';
import zhCNPages from './zh-CN/pages';
import zhCNPermissionMap from './zh-CN/permissionMap';
import zhCNShares from './zh-CN/shares';
import zhCNSystem from './zh-CN/system';
import zhCNUpload from './zh-CN/upload';
import zhCNWorkbench from './zh-CN/workbench';

/**
 * 语言包 key 一致性回归护栏（zh-CN ↔ en-US）。
 *
 * <p>背景：本轮 i18n 改造把散落在页面里的中文硬编码收敛成语言包 id，新增了若干命名空间
 * （auth / approval / audit / exception / system / …）。这类改造最常见的回归是
 * 「只往 zh-CN 补了键、忘了同步 en-US」——此时 `formatMessage` 在英文环境会静默回退成
 * id 原文或 `defaultMessage`，页面看着「没报错」，但英文文案是残缺的。
 *
 * <p>本用例按命名空间逐一对齐两侧 key 集合，并额外断言合并后无跨命名空间冲突：
 * 由于各文件都是 `export default { … } as const`（运行时是普通字面量对象），对象字面量
 * 本身会静默去重重复键，因此「同文件内重复」只能靠下面这条跨命名空间检查来兜住
 * ——`zh-CN.ts` / `en-US.ts` 用展开运算逐个覆盖命名空间，后者会静默覆盖前者的同名键。
 *
 * <p>注意：`menu` 命名空间不在此列，它由 `menu-i18n.test.ts` 按 `config/routes.ts` 派生
 * 的必需键单独护栏（含其余 6 种语言），避免重复断言。
 */

/** 每个语言包文件的形状：扁平的 `id → 文案` 映射。 */
type Messages = Record<string, string>;

/** 本轮 i18n 改造触及的命名空间（zh-CN）。 */
const ZH_CN: Record<string, Messages> = {
  approval: zhCNApproval,
  audit: zhCNAudit,
  auth: zhCNAuth,
  chat: zhCNChat,
  common: zhCNCommon,
  component: zhCNComponent,
  exception: zhCNException,
  file: zhCNFile,
  layout: zhCNLayout,
  network: zhCNNetwork,
  pages: zhCNPages,
  permissionMap: zhCNPermissionMap,
  shares: zhCNShares,
  system: zhCNSystem,
  upload: zhCNUpload,
  workbench: zhCNWorkbench,
};

/** 本轮 i18n 改造触及的命名空间（en-US），命名空间清单必须与 {@link ZH_CN} 一一对应。 */
const EN_US: Record<string, Messages> = {
  approval: enUSApproval,
  audit: enUSAudit,
  auth: enUSAuth,
  chat: enUSChat,
  common: enUSCommon,
  component: enUSComponent,
  exception: enUSException,
  file: enUSFile,
  layout: enUSLayout,
  network: enUSNetwork,
  pages: enUSPages,
  permissionMap: enUSPermissionMap,
  shares: enUSShares,
  system: enUSSystem,
  upload: enUSUpload,
  workbench: enUSWorkbench,
};

describe('语言包 key 一致性（zh-CN ↔ en-US）', () => {
  it('两侧命名空间清单一致且非空（避免用例空转）', () => {
    const namespaces = Object.keys(ZH_CN).sort();
    expect(namespaces.length).toBeGreaterThan(0);
    expect(Object.keys(EN_US).sort()).toEqual(namespaces);
    // 必查的 8 个命名空间必须在清单内
    expect(namespaces).toEqual(
      expect.arrayContaining([
        'approval',
        'audit',
        'auth',
        'chat',
        'exception',
        'network',
        'pages',
        'system',
      ]),
    );
  });

  for (const namespace of Object.keys(ZH_CN).sort()) {
    it(`${namespace}：zh-CN 与 en-US 的 key 集合完全一致`, () => {
      const zhCNKeys = Object.keys(ZH_CN[namespace]);
      const enUSKeys = Object.keys(EN_US[namespace]);

      // 分开计算「zh-CN 有、en-US 缺」与「en-US 多出」，失败信息能直接给出待补/待删的 id
      const missingInEnUS = zhCNKeys.filter(
        (key) => !(key in EN_US[namespace]),
      );
      const extraInEnUS = enUSKeys.filter((key) => !(key in ZH_CN[namespace]));

      expect({ missingInEnUS, extraInEnUS }).toEqual({
        missingInEnUS: [],
        extraInEnUS: [],
      });
    });

    it(`${namespace}：无重复 key`, () => {
      const zhCNKeys = Object.keys(ZH_CN[namespace]);
      const enUSKeys = Object.keys(EN_US[namespace]);

      expect(zhCNKeys.length).toBe(new Set(zhCNKeys).size);
      expect(enUSKeys.length).toBe(new Set(enUSKeys).size);
    });
  }

  it('合并各命名空间后无跨命名空间 key 冲突', () => {
    // `zh-CN.ts` / `en-US.ts` 按固定顺序展开命名空间，同名键会被后者静默覆盖；
    // 单独看每个文件察觉不到，必须在合并维度上检查。
    for (const locale of [ZH_CN, EN_US]) {
      const allKeys = Object.values(locale).flatMap((messages) =>
        Object.keys(messages),
      );
      const duplicated = allKeys.filter(
        (key, index) => allKeys.indexOf(key) !== index,
      );
      expect([...new Set(duplicated)]).toEqual([]);
    }
  });
});
