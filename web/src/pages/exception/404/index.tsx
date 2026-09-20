import { Link, useIntl } from '@umijs/max';
import { Button, Result } from 'antd';
import React from 'react';

import SectionCard from '@/components/SectionCard';

/** 404：路由未命中（含 `/user/*` 兜底与顶层 `/*` 兜底）。 */
const Exception404: React.FC = () => {
  const intl = useIntl();

  return (
    <SectionCard bordered={false} bodyPadding="56px 24px">
      <Result
        status="404"
        title="404"
        subTitle={intl.formatMessage({ id: 'exception.404.subTitle' })}
        extra={
          <Link to="/" prefetch>
            <Button type="primary">
              {intl.formatMessage({ id: 'exception.404.buttonText' })}
            </Button>
          </Link>
        }
      />
    </SectionCard>
  );
};

export default Exception404;
