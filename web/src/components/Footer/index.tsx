import { GithubOutlined, LinkOutlined } from '@ant-design/icons';
import packageJson from '@root/package.json';
import { Divider } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';

/** 兜底地址：package.json 未声明 repository 时指向本项目仓库（不再是 Ant Design Pro 模板仓库） */
const FALLBACK_REPO_URL = 'https://gitee.com/temtech/AntTransfer-Community';

/**
 * 镜像仓库：与主仓库同一份提交历史（commit hash 一一对应），公开可读。
 *
 * <p>主仓库地址的唯一权威源仍是 `package.json.repository`——它只能承载一个地址，
 * 因此镜像在此显式声明，并在页脚**并列展示**：两家托管方的可达性在不同网络环境下并不相同，
 * 让访问者自己挑一个能打开的，比替他们决定更可靠。</p>
 */
const MIRROR_REPO_URL = 'https://github.com/Temtech-2026/AntTransfer-Community';

/**
 * 规范化仓库主页地址：去掉 `git+` 前缀、把 `git@host:path` 转成 https、去掉 `.git` 后缀。
 */
const normalizeRepoUrl = (raw: unknown) => {
  const url =
    typeof raw === 'string'
      ? raw
      : ((raw as { url?: string } | undefined)?.url ?? '');
  return url
    .trim()
    .replace(/^git\+/, '')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
};

/** 只接受 https://host/owner/repo 形态，避免把畸形地址渲染成坏链接 */
const isRepoHomepage = (url: string) =>
  /^https?:\/\/[^/]+\/[^/]+\/[^/]+$/.test(url);

/**
 * 从 package.json 的 repository 推导**主**仓库主页。
 *
 * 不写死托管方，只做归一：GitHub / Gitee / GitLab 都能正确成链——若按
 * 某一家的域名硬判，另一家的地址会静默退回兜底地址，把用户引到别人家的仓库
 * （比不显示链接更糟）。
 */
const getRepoUrl = () => {
  const normalized = normalizeRepoUrl(packageJson.repository);
  return isRepoHomepage(normalized) ? normalized : FALLBACK_REPO_URL;
};

type RepoLink = { url: string; host: string; isGithub: boolean };

const toRepoLink = (url: string): RepoLink => {
  const host = new URL(url).hostname;
  return { url, host, isGithub: host.endsWith('github.com') };
};

const REPO_URL = getRepoUrl();

/**
 * 页脚展示的仓库链接：主仓库 + 镜像，按地址去重
 * （package.json 哪天改指 GitHub 时，不至于出现两条一模一样的链接）。
 */
const REPO_LINKS: RepoLink[] = [REPO_URL, MIRROR_REPO_URL]
  .filter((url, index, all) => all.indexOf(url) === index)
  .map(toRepoLink);

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
      {/* 版权主体必须是本项目：沿用脚手架的 `Ant Design Pro ©` 会让访问者以为本站由模板出品 */}
      <div className={styles.copyright}>AntTransfer Community Edition &copy; {year}</div>
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
        {/* 主仓库与镜像并列：两家可达性因网络环境而异，给访问者自己挑 */}
        {REPO_LINKS.map((repo) => (
          <a
            key={repo.url}
            className={styles.link}
            href={repo.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {repo.isGithub ? (
              <GithubOutlined style={{ marginRight: 4 }} />
            ) : (
              <LinkOutlined style={{ marginRight: 4 }} />
            )}
            {repo.host}
          </a>
        ))}
      </div>
    </div>
  );
};

export default Footer;
