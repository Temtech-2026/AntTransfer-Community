import { GithubOutlined, LinkOutlined } from '@ant-design/icons';
import packageJson from '@root/package.json';
import { Divider } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';

/** 兜底地址：package.json 未声明 repository 时指向模板仓库 */
const FALLBACK_REPO_URL = 'https://github.com/ant-design/ant-design-pro';

/**
 * 从 package.json 的 repository 推导仓库主页。
 *
 * 不写死托管方，只做规范化：去掉 `git+` 前缀、把 `git@host:path` 转成 https、去掉 `.git` 后缀。
 * 这样 GitHub / Gitee / GitLab 都能正确成链——否则仓库不在 github.com 时会静默退回
 * 模板仓库地址，把用户引到别人家的仓库（比不显示链接更糟）。
 */
const getRepoUrl = () => {
  const raw: unknown = packageJson.repository;
  const url =
    typeof raw === 'string'
      ? raw
      : ((raw as { url?: string } | undefined)?.url ?? '');
  const normalized = url
    .trim()
    .replace(/^git\+/, '')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
  // 只接受 https://host/owner/repo 形态，避免把畸形地址渲染成坏链接
  return /^https?:\/\/[^/]+\/[^/]+\/[^/]+$/.test(normalized)
    ? normalized
    : FALLBACK_REPO_URL;
};

const REPO_URL = getRepoUrl();
/** 仓库托管域名：用于页脚文案，避免把 Gitee 仓库标成 GitHub */
const REPO_HOST = new URL(REPO_URL).hostname;
const IS_GITHUB = REPO_HOST.endsWith('github.com');
const COMMIT_HASH = process.env.COMMIT_HASH || '';

const useStyles = createStyles(({ token, css }) => ({
  footer: css`
    padding: 16px 24px;
    text-align: center;
    color: ${token.colorTextDescription};
    font-size: ${token.fontSizeSM}px;
    line-height: ${token.lineHeight};
    background: transparent;
  `,
  copyright: css`
    margin-bottom: 6px;
  `,
  link: css`
    color: ${token.colorTextDescription};
    text-decoration: none;
    transition: color ${token.motionDurationMid};

    &:hover {
      color: ${token.colorText};
    }
  `,
  meta: css`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px 12px;
    font-family: ${token.fontFamilyCode};
    font-size: ${token.fontSizeSM - 1}px;
  `,
  group: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
  `,
  label: css`
    color: ${token.colorTextQuaternary};
  `,
  divider: css`
    display: inline-block;
    vertical-align: middle;
  `,
}));

const Footer: React.FC = () => {
  const { styles } = useStyles();
  const year = new Date().getFullYear();

  return (
    <div className={styles.footer}>
      <div className={styles.copyright}>Ant Design Pro &copy; {year}</div>
      <div className={styles.meta}>
        <span className={styles.group}>
          <span className={styles.label}>ver</span>
          <a
            className={styles.link}
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {__APP_VERSION__}
          </a>
          {COMMIT_HASH && (
            <a
              className={styles.link}
              href={`${REPO_URL}/commit/${COMMIT_HASH}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {COMMIT_HASH.slice(0, 7)}
            </a>
          )}
        </span>
        <Divider orientation="vertical" className={styles.divider} />
        <span className={styles.group}>
          <span className={styles.label}>Umi</span>
          <a
            className={styles.link}
            href="https://umijs.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {__UMI_VERSION__}
          </a>
        </span>
        <Divider orientation="vertical" className={styles.divider} />
        <span className={styles.group}>
          <span className={styles.label}>Utoo</span>
          <a
            className={styles.link}
            href="https://utoo.land"
            target="_blank"
            rel="noopener noreferrer"
          >
            {__UTOO_VERSION__}
          </a>
        </span>
        <Divider orientation="vertical" className={styles.divider} />
        <a
          className={styles.link}
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {IS_GITHUB ? (
            <GithubOutlined style={{ marginRight: 4 }} />
          ) : (
            <LinkOutlined style={{ marginRight: 4 }} />
          )}
          {REPO_HOST}
        </a>
      </div>
    </div>
  );
};

export default Footer;
