import { CheckOutlined, GlobalOutlined } from '@ant-design/icons';
import { getAllLocales, getLocale, setLocale } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Button } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn';
import { useEffect, useMemo } from 'react';
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
  'en-US': 'en',
};

const localeLabelMap: Record<string, { emoji: string; label: string }> = {
  'zh-CN': { emoji: '🇨🇳', label: '简体中文' },
  'zh-TW': { emoji: '🇭🇰', label: '繁體中文' },
  'en-US': { emoji: '🇺🇸', label: 'English' },
  'ja-JP': { emoji: '🇯🇵', label: '日本語' },
  'pt-BR': { emoji: '🇧🇷', label: 'Português' },
  'id-ID': { emoji: '🇮🇩', label: 'Bahasa Indonesia' },
  'fa-IR': { emoji: '🇮🇷', label: 'فارسی' },
  'bn-BD': { emoji: '🇧🇩', label: 'বাংলা' },
};

const onLangClick: MenuProps['onClick'] = ({ key }) => {
  if (key.startsWith('lang-')) {
    setLocale(key.replace('lang-', ''), false);
  }
};

export const LangDropdown: React.FC = () => {
  const { styles } = useHeaderActionStyles();
  const allLocales = useMemo(() => getAllLocales(), []);
  const currentLocale = getLocale();
  const supportLocales = allLocales.filter((l) => l in localeLabelMap);

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
      <Button type="text" className={styles.action} aria-label="语言切换">
        <GlobalOutlined />
      </Button>
    </HeaderDropdown>
  );
};
