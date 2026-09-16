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
import { Tag, Typography } from 'antd';

import SectionCard from '@/components/SectionCard';
import useStyles from './Welcome.style';

const { Paragraph, Text, Title } = Typography;

/** 能力网格：三条主线，各自标注对应的后端模块。 */
const FEATURES = [
  {
    icon: <CloudUploadOutlined />,
    title: '安全文件传输',
    desc: '断点续传、进度可视、秒传校验，适配大文件传输场景（at-transfer / at-file）。',
  },
  {
    icon: <TeamOutlined />,
    title: '协作共享',
    desc: '协作空间与分享链接，多人安全访问同一批文件（at-collaboration）。',
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: '权限与审计',
    desc: 'RBAC 权限点与全链路 TraceId，可审计可追溯（at-permission / at-gateway）。',
  },
];

/** 技术栈标签：颜色与语义对应（语言 / 框架 / 存储 / 前端 / 许可）。 */
const TECH_STACK = [
  { label: 'Java 21', color: 'blue' },
  { label: 'Spring Boot 3.5', color: 'green' },
  { label: 'MySQL 8 · Redis 7', color: 'orange' },
  { label: 'Ant Design Pro · React 19', color: 'geekblue' },
  { label: 'Apache-2.0', color: 'purple' },
];

/**
 * 快速开始要点。
 *
 * <p>用结构化数组而非散落的段落：排版由样式控制，文案改动不必动 JSX 结构。
 */
const QUICK_START = [
  <>
    前后端联调：本工程已把 <Text code>/api</Text> 代理到后端{' '}
    <Text code>http://localhost:8080</Text>（见 config/proxy.ts）。
  </>,
  <>领域页面（传输 / 文件 / 协作 / 权限）将随后端接口落地逐步接入。</>,
];

const Welcome: React.FC = () => {
  const { styles } = useStyles();

  return (
    <PageContainer
      header={{
        title: 'AntTransfer CE',
        subTitle: '开源文件安全传输与协作共享',
      }}
    >
      <section className={styles.hero}>
        <Title level={2} className={styles.heroTitle}>
          AntTransfer Community Edition
        </Title>
        <Paragraph type="secondary" className={styles.heroDesc}>
          开源的内容 / 文件安全传输与协作共享解决方案：Spring Boot 3
          模块化单体后端 + Ant Design Pro 前端，开箱即用、易于二次开发。
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
          <article key={feature.title} className={styles.feature}>
            <span className={styles.featureIcon}>{feature.icon}</span>
            <span className={styles.featureTitle}>{feature.title}</span>
            <span className={styles.featureDesc}>{feature.desc}</span>
          </article>
        ))}
      </div>

      <SectionCard
        title="快速开始"
        subTitle="本地联调与后续接入"
        icon={<RocketOutlined />}
      >
        <div className={styles.startList}>
          {QUICK_START.map((line, index) => (
            // 静态文案列表：内容不会重排，用序号作 key 是安全的
            // biome-ignore lint/suspicious/noArrayIndexKey: 静态常量数组
            <Paragraph key={index} style={{ marginBottom: 0 }}>
              {line}
            </Paragraph>
          ))}
        </div>
      </SectionCard>
    </PageContainer>
  );
};

export default Welcome;
