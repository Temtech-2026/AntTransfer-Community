import { CheckOutlined, GlobalOutlined } from '@ant-design/icons';
import { getAllLocales, getLocale, setLocale, useIntl } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Button } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/es';
import 'dayjs/locale/fr';
import 'dayjs/locale/ja';
import 'dayjs/locale/ko';
import 'dayjs/locale/ru';
import 'dayjs/locale/zh-cn';
import { useEffect, useMemo } from 'react';
import { resolveUiLocale, SUPPORTED_LOCALES } from '@/utils/locale';
import HeaderDropdown from '../HeaderDropdown';
import useHeaderActionStyles from './style';

/**
 * 界面语言 → dayjs 语言名。
 *
 * <p>Umi 的 `locale.antd: true` 只负责 antd 组件文案；dayjs 的全局语言要自己同步，
 * 否则相对时间（`fromNow`）会停留在上一个语种。这里**静态** import 语言包而不是
 * 动态 `import()` 拼接路径：后者会让打包器生成 context 模块，得不偿失（语言包各约 1KB）。
 */
const DAYJS_LOCALE: Record<string, string> = {
  'zh-CN': 'zh-cn',
  'ko-KR': 'ko',
  'ja-JP': 'ja',
  'fr-FR': 'fr',
  'ru-RU': 'ru',
  'es-ES': 'es',
  'en-US': 'en',
};

/** 语言自称（endonym，各语言都按自己的写法展示，不随界面语言翻译）。 */
const localeLabelMap: Record<string, { emoji: string; label: string }> = {
  'zh-CN': { emoji: '🇨🇳', label: '简体中文' },
  'ko-KR': { emoji: '🇰🇷', label: '한국어' },
  'ja-JP': { emoji: '🇯🇵', label: '日本語' },
  'fr-FR': { emoji: '🇫🇷', label: 'Français' },
  'ru-RU': { emoji: '🇷🇺', label: 'Русский' },
  'es-ES': { emoji: '🇪🇸', label: 'Español' },
  'en-US': { emoji: '🇺🇸', label: 'English' },
};

const onLangClick: MenuProps['onClick'] = ({ key }) => {
  if (key.startsWith('lang-')) {
    setLocale(resolveUiLocale(key.replace('lang-', '')), false);
  }
};

export const LangDropdown: React.FC = () => {
  const { styles } = useHeaderActionStyles();
  const intl = useIntl();
  const allLocales = useMemo(() => getAllLocales(), []);
  /**
   * 只暴露「声明受支持（`@/utils/locale` 的 SUPPORTED_LOCALES）**且**确实存在语言包」的语言。
   *
   * <p>`src/locales` 下脚手架残留的 zh-TW / pt-BR / id-ID / fa-IR / bn-BD 只有骨架文案，
   * 业务文案缺失时 `react-intl` 会回退到 `defaultMessage`（中文）甚至原始 key，
   * 用户看到的就是「切了语言但界面没变」——与其提供一个坏掉的选项，不如不提供。
   */
  const supportLocales = useMemo(
    () => SUPPORTED_LOCALES.filter((locale) => allLocales.includes(locale)),
    [allLocales],
  );
  // 归一化兜底：浏览器语言可能落在受支持集合之外（zh-TW / pt-BR / fa-IR…），
  // 归一化在 `app.tsx` 的 getInitialState 里已做一次，这里只是渲染期的最后一道保险。
  const currentLocale = resolveUiLocale(getLocale());

  // dayjs 全局语言跟随界面语言（antd 语言由 Umi 的 `locale.antd` 负责）
  useEffect(() => {
    const name = DAYJS_LOCALE[currentLocale];
    if (name) {
      dayjs.locale(name);
    }
  }, [currentLocale]);

  if (supportLocales.length <= 1) {
    return null;
  }

  const langItems: MenuProps['items'] = supportLocales.map((locale) => ({
    key: `lang-${locale}`,
    icon:
      locale === currentLocale ? (
        <CheckOutlined style={{ color: '#52c41a' }} />
      ) : (
        <span style={{ display: 'inline-block', width: 14 }} />
      ),
    label: `${localeLabelMap[locale]?.emoji ?? ''} ${localeLabelMap[locale]?.label ?? locale}`,
  }));

  return (
    <HeaderDropdown
      placement="bottomRight"
      arrow
      menu={{
        selectedKeys: [`lang-${currentLocale}`],
        onClick: onLangClick,
        items: langItems,
        style: { minWidth: 180 },
      }}
    >
      <Button
        type="text"
        className={styles.action}
        aria-label={intl.formatMessage({
          id: 'component.langSwitch',
        })}
      >
        <GlobalOutlined />
      </Button>
    </HeaderDropdown>
  );
};
