import {
  CloudUploadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Col, Row, Space, Tag, Typography } from 'antd';
import React from 'react';

const { Paragraph, Text, Title } = Typography;

const featureList = [
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

const Welcome: React.FC = () => {
  return (
    <PageContainer
      header={{
        title: 'AntTransfer CE',
      }}
    >
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={3} style={{ marginBottom: 0 }}>
            AntTransfer Community Edition
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 8 }}>
            开源的内容 / 文件安全传输与协作共享解决方案：Spring Boot 3
            模块化单体后端 + Ant Design Pro 前端，开箱即用、易于二次开发。
          </Paragraph>
          <Space wrap>
            <Tag color="blue">Java 21</Tag>
            <Tag color="green">Spring Boot 3.5</Tag>
            <Tag color="orange">MySQL 8 · Redis 7</Tag>
            <Tag color="geekblue">Ant Design Pro · React 19</Tag>
            <Tag color="purple">Apache-2.0</Tag>
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {featureList.map((feature) => (
          <Col xs={24} md={12} xl={8} key={feature.title}>
            <Card>
              <Space direction="vertical" size="small">
                <Space>
                  {feature.icon}
                  <Text strong>{feature.title}</Text>
                </Space>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {feature.desc}
                </Paragraph>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ marginTop: 16 }}>
        <Title level={5}>快速开始</Title>
        <Paragraph>
          前后端联调：本工程已把 <Text code>/api</Text> 代理到后端{' '}
          <Text code>http://localhost:8080</Text>（见 config/proxy.ts）。
        </Paragraph>
        <Paragraph style={{ marginBottom: 0 }}>
          领域页面（传输 / 文件 / 协作 / 权限）将随后端接口落地逐步接入。
        </Paragraph>
      </Card>
    </PageContainer>
  );
};

export default Welcome;
