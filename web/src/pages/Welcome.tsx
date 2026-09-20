/**
 * 欢迎页（`/`）。
 *
 * <p>纯静态落地页：品牌 Hero + 能力网格 + 快速开始，不请求任何接口，
 * 因此不受后端可用性影响，作为登录后的默认落点始终可用。
 */

import {
  CloudUploadOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Tag, Typography } from 'antd';

import SectionCard from '@/components/SectionCard';
import useStyles from './Welcome.style';

const { Paragraph, Text, Title } = Typography;

/** 能力网格：三条主线，各自标注对应的后端模块（文案 id 见 `pages.welcome.feature.*`）。 */
const FEATURES = [
  {
    icon: <CloudUploadOutlined />,
    titleId: 'pages.welcome.feature.transfer.title',
    descId: 'pages.welcome.feature.transfer.desc',
  },
  {
    icon: <TeamOutlined />,
    titleId: 'pages.welcome.feature.collaboration.title',
    descId: 'pages.welcome.feature.collaboration.desc',
  },
  {
    icon: <SafetyCertificateOutlined />,
    titleId: 'pages.welcome.feature.permission.title',
    descId: 'pages.welcome.feature.permission.desc',
  },
];

/** 技术栈标签：颜色与语义对应（语言 / 框架 / 存储 / 前端 / 许可）。产品名与版本号不翻译。 */
const TECH_STACK = [
  { label: 'Java 21', color: 'blue' },
  { label: 'Spring Boot 3.5', color: 'green' },
  { label: 'MySQL 8 · Redis 7', color: 'orange' },
  { label: 'Ant Design Pro · React 19', color: 'geekblue' },
  { label: 'Apache-2.0', color: 'purple' },
];

const Welcome: React.FC = () => {
  const { styles } = useStyles();
  const intl = useIntl();

  return (
    <PageContainer
      header={{
        title: intl.formatMessage({ id: 'pages.welcome.header.title' }),
        subTitle: intl.formatMessage({ id: 'pages.welcome.header.subTitle' }),
      }}
    >
      <section className={styles.hero}>
        <Title level={2} className={styles.heroTitle}>
          {intl.formatMessage({ id: 'pages.welcome.hero.title' })}
        </Title>
        <Paragraph type="secondary" className={styles.heroDesc}>
          {intl.formatMessage({ id: 'pages.welcome.hero.desc' })}
        </Paragraph>
        <div className={styles.heroTags}>
          {TECH_STACK.map((item) => (
            <Tag key={item.label} color={item.color}>
              {item.label}
            </Tag>
          ))}
        </div>
      </section>

      <div className={styles.grid}>
        {FEATURES.map((feature) => (
          <article key={feature.titleId} className={styles.feature}>
            <span className={styles.featureIcon}>{feature.icon}</span>
            <span className={styles.featureTitle}>
              {intl.formatMessage({ id: feature.titleId })}
            </span>
            <span className={styles.featureDesc}>
              {intl.formatMessage({ id: feature.descId })}
            </span>
          </article>
        ))}
      </div>

      <SectionCard
        title={intl.formatMessage({ id: 'pages.welcome.quickStart.title' })}
        subTitle={intl.formatMessage({
          id: 'pages.welcome.quickStart.subTitle',
        })}
        icon={<RocketOutlined />}
      >
        {/* 首段内联的 `/api` 与 `http://localhost:8080` 是代码字面量，不参与翻译，
            译文按「前缀 + 代码 + 中缀 + 代码 + 后缀」拼接；排版仍由样式控制 */}
        <div className={styles.startList}>
          <Paragraph style={{ marginBottom: 0 }}>
            {intl.formatMessage({ id: 'pages.welcome.quickStart.proxyPrefix' })}{' '}
            <Text code>/api</Text>{' '}
            {intl.formatMessage({ id: 'pages.welcome.quickStart.proxyMiddle' })}{' '}
            <Text code>http://localhost:8080</Text>
            {intl.formatMessage({ id: 'pages.welcome.quickStart.proxySuffix' })}
          </Paragraph>
          <Paragraph style={{ marginBottom: 0 }}>
            {intl.formatMessage({ id: 'pages.welcome.quickStart.domainHint' })}
          </Paragraph>
        </div>
      </SectionCard>
    </PageContainer>
  );
};

export default Welcome;
