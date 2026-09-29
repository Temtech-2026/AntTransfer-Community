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
import esESApproval from './es-ES/approval';
import esESAudit from './es-ES/audit';
import esESAuth from './es-ES/auth';
import esESChat from './es-ES/chat';
import esESCommon from './es-ES/common';
import esESComponent from './es-ES/component';
import esESException from './es-ES/exception';
import esESFile from './es-ES/file';
import esESLayout from './es-ES/layout';
import esESNetwork from './es-ES/network';
import esESPages from './es-ES/pages';
import esESPermissionMap from './es-ES/permissionMap';
import esESShares from './es-ES/shares';
import esESSystem from './es-ES/system';
import esESUpload from './es-ES/upload';
import esESWorkbench from './es-ES/workbench';
import frFRApproval from './fr-FR/approval';
import frFRAudit from './fr-FR/audit';
import frFRAuth from './fr-FR/auth';
import frFRChat from './fr-FR/chat';
import frFRCommon from './fr-FR/common';
import frFRComponent from './fr-FR/component';
import frFRException from './fr-FR/exception';
import frFRFile from './fr-FR/file';
import frFRLayout from './fr-FR/layout';
import frFRNetwork from './fr-FR/network';
import frFRPages from './fr-FR/pages';
import frFRPermissionMap from './fr-FR/permissionMap';
import frFRShares from './fr-FR/shares';
import frFRSystem from './fr-FR/system';
import frFRUpload from './fr-FR/upload';
import frFRWorkbench from './fr-FR/workbench';
import jaJPApproval from './ja-JP/approval';
import jaJPAudit from './ja-JP/audit';
import jaJPAuth from './ja-JP/auth';
import jaJPChat from './ja-JP/chat';
import jaJPCommon from './ja-JP/common';
import jaJPComponent from './ja-JP/component';
import jaJPException from './ja-JP/exception';
import jaJPFile from './ja-JP/file';
import jaJPLayout from './ja-JP/layout';
import jaJPNetwork from './ja-JP/network';
import jaJPPages from './ja-JP/pages';
import jaJPPermissionMap from './ja-JP/permissionMap';
import jaJPShares from './ja-JP/shares';
import jaJPSystem from './ja-JP/system';
import jaJPUpload from './ja-JP/upload';
import jaJPWorkbench from './ja-JP/workbench';
import koKRApproval from './ko-KR/approval';
import koKRAudit from './ko-KR/audit';
import koKRAuth from './ko-KR/auth';
import koKRChat from './ko-KR/chat';
import koKRCommon from './ko-KR/common';
import koKRComponent from './ko-KR/component';
import koKRException from './ko-KR/exception';
import koKRFile from './ko-KR/file';
import koKRLayout from './ko-KR/layout';
import koKRNetwork from './ko-KR/network';
import koKRPages from './ko-KR/pages';
import koKRPermissionMap from './ko-KR/permissionMap';
import koKRShares from './ko-KR/shares';
import koKRSystem from './ko-KR/system';
import koKRUpload from './ko-KR/upload';
import koKRWorkbench from './ko-KR/workbench';
import ruRUApproval from './ru-RU/approval';
import ruRUAudit from './ru-RU/audit';
import ruRUAuth from './ru-RU/auth';
import ruRUChat from './ru-RU/chat';
import ruRUCommon from './ru-RU/common';
import ruRUComponent from './ru-RU/component';
import ruRUException from './ru-RU/exception';
import ruRUFile from './ru-RU/file';
import ruRULayout from './ru-RU/layout';
import ruRUNetwork from './ru-RU/network';
import ruRUPages from './ru-RU/pages';
import ruRUPermissionMap from './ru-RU/permissionMap';
import ruRUShares from './ru-RU/shares';
import ruRUSystem from './ru-RU/system';
import ruRUUpload from './ru-RU/upload';
import ruRUWorkbench from './ru-RU/workbench';
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
 * 语言包 key 一致性回归护栏（zh-CN 为基准，对齐 en-US / es-ES / fr-FR / ja-JP / ko-KR / ru-RU）。
 *
 * <p>背景：本轮 i18n 改造把散落在页面里的中文硬编码收敛成语言包 id，新增了若干命名空间
 * （auth / approval / audit / exception / system / …）。这类改造最常见的回归是
 * 「只往 zh-CN 补了键、忘了同步其它语言」——此时 `formatMessage` 在对应语言环境会静默回退成
 * id 原文或 `defaultMessage`，页面看着「没报错」，但该语言的文案是残缺的。
 *
 * <p>本用例按命名空间逐一把各语言的 key 集合对齐到 zh-CN，并额外断言合并后无跨命名空间冲突：
 * 由于各文件都是 `export default { … } as const`（运行时是普通字面量对象），对象字面量
 * 本身会静默去重重复键，因此「同文件内重复」只能靠下面这条跨命名空间检查来兜住
 * ——`zh-CN.ts` / `en-US.ts` / `es-ES.ts` / `fr-FR.ts` / `ja-JP.ts` / `ko-KR.ts` / `ru-RU.ts`
 * 用展开运算逐个覆盖命名空间，后者会静默覆盖前者的同名键。
 *
 * <p>注意：`menu` 命名空间不在此列，它由 `menu-i18n.test.ts` 按 `config/routes.ts` 派生
 * 的必需键单独护栏（含其余语言），避免重复断言。
 */

/** 每个语言包文件的形状：扁平的 `id → 文案` 映射。 */
type Messages = Record<string, string>;

/** 参与比对的非基准语言（基准恒为 zh-CN）。 */
const OTHER_LOCALES = [
  'en-US',
  'es-ES',
  'fr-FR',
  'ja-JP',
  'ko-KR',
  'ru-RU',
] as const;

/** 本轮 i18n 改造触及的命名空间（zh-CN，作为基准）。 */
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

/** 其余语言按同一份命名空间清单组织，缺失命名空间会在下面的清单一致性断言中失败。 */
const LOCALES: Record<
  (typeof OTHER_LOCALES)[number],
  Record<string, Messages>
> = {
  'en-US': {
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
  },
  'es-ES': {
    approval: esESApproval,
    audit: esESAudit,
    auth: esESAuth,
    chat: esESChat,
    common: esESCommon,
    component: esESComponent,
    exception: esESException,
    file: esESFile,
    layout: esESLayout,
    network: esESNetwork,
    pages: esESPages,
    permissionMap: esESPermissionMap,
    shares: esESShares,
    system: esESSystem,
    upload: esESUpload,
    workbench: esESWorkbench,
  },
  'fr-FR': {
    approval: frFRApproval,
    audit: frFRAudit,
    auth: frFRAuth,
    chat: frFRChat,
    common: frFRCommon,
    component: frFRComponent,
    exception: frFRException,
    file: frFRFile,
    layout: frFRLayout,
    network: frFRNetwork,
    pages: frFRPages,
    permissionMap: frFRPermissionMap,
    shares: frFRShares,
    system: frFRSystem,
    upload: frFRUpload,
    workbench: frFRWorkbench,
  },
  'ja-JP': {
    approval: jaJPApproval,
    audit: jaJPAudit,
    auth: jaJPAuth,
    chat: jaJPChat,
    common: jaJPCommon,
    component: jaJPComponent,
    exception: jaJPException,
    file: jaJPFile,
    layout: jaJPLayout,
    network: jaJPNetwork,
    pages: jaJPPages,
    permissionMap: jaJPPermissionMap,
    shares: jaJPShares,
    system: jaJPSystem,
    upload: jaJPUpload,
    workbench: jaJPWorkbench,
  },
  'ko-KR': {
    approval: koKRApproval,
    audit: koKRAudit,
    auth: koKRAuth,
    chat: koKRChat,
    common: koKRCommon,
    component: koKRComponent,
    exception: koKRException,
    file: koKRFile,
    layout: koKRLayout,
    network: koKRNetwork,
    pages: koKRPages,
    permissionMap: koKRPermissionMap,
    shares: koKRShares,
    system: koKRSystem,
    upload: koKRUpload,
    workbench: koKRWorkbench,
  },
  'ru-RU': {
    approval: ruRUApproval,
    audit: ruRUAudit,
    auth: ruRUAuth,
    chat: ruRUChat,
    common: ruRUCommon,
    component: ruRUComponent,
    exception: ruRUException,
    file: ruRUFile,
    layout: ruRULayout,
    network: ruRUNetwork,
    pages: ruRUPages,
    permissionMap: ruRUPermissionMap,
    shares: ruRUShares,
    system: ruRUSystem,
    upload: ruRUUpload,
    workbench: ruRUWorkbench,
  },
};

describe('语言包 key 一致性（zh-CN 为基准）', () => {
  it('各语言命名空间清单一致且非空（避免用例空转）', () => {
    const namespaces = Object.keys(ZH_CN).sort();
    expect(namespaces.length).toBeGreaterThan(0);
    for (const locale of OTHER_LOCALES) {
      expect(Object.keys(LOCALES[locale]).sort()).toEqual(namespaces);
    }
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

  for (const locale of OTHER_LOCALES) {
    for (const namespace of Object.keys(ZH_CN).sort()) {
      it(`${namespace}：zh-CN 与 ${locale} 的 key 集合完全一致`, () => {
        const baseKeys = Object.keys(ZH_CN[namespace]);
        const target = LOCALES[locale][namespace];
        const targetKeys = Object.keys(target);

        // 分开计算「zh-CN 有、目标语言缺」与「目标语言多出」，失败信息能直接给出待补/待删的 id
        const missingInTarget = baseKeys.filter((key) => !(key in target));
        const extraInTarget = targetKeys.filter(
          (key) => !(key in ZH_CN[namespace]),
        );

        expect({ missingInTarget, extraInTarget }).toEqual({
          missingInTarget: [],
          extraInTarget: [],
        });
      });

      it(`${namespace}：${locale} 无重复 key`, () => {
        const targetKeys = Object.keys(LOCALES[locale][namespace]);
        expect(targetKeys.length).toBe(new Set(targetKeys).size);
      });
    }
  }

  for (const namespace of Object.keys(ZH_CN).sort()) {
    it(`${namespace}：zh-CN 无重复 key`, () => {
      const baseKeys = Object.keys(ZH_CN[namespace]);
      expect(baseKeys.length).toBe(new Set(baseKeys).size);
    });
  }

  it('合并各命名空间后无跨命名空间 key 冲突', () => {
    // `zh-CN.ts` / `en-US.ts` / `es-ES.ts` / `fr-FR.ts` / `ja-JP.ts` / `ko-KR.ts` / `ru-RU.ts`
    // 按固定顺序展开命名空间，同名键会被后者静默覆盖；
    // 单独看每个文件察觉不到，必须在合并维度上检查。
    for (const locale of [
      ZH_CN,
      ...OTHER_LOCALES.map((name) => LOCALES[name]),
    ]) {
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
