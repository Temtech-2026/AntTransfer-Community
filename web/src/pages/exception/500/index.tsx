import { Link, useIntl } from '@umijs/max';
import { Button, Result } from 'antd';
import React from 'react';

import SectionCard from '@/components/SectionCard';

/**
 * 500：服务端异常。
 *
 * <p>不可恢复的兜底页：只给出「返回首页」这一条安全出路，
 * 不提供重试按钮（重试可能再次触发同一异常，且错误上下文已丢失）。
 */
const Exception500: React.FC = () => {
  const intl = useIntl();

  return (
    <SectionCard bordered={false} bodyPadding="56px 24px">
      <Result
        status="500"
        title="500"
        subTitle={intl.formatMessage({ id: 'exception.500.subTitle' })}
        extra={
          <Link to="/" prefetch>
            <Button type="primary">
              {intl.formatMessage({ id: 'exception.500.buttonText' })}
            </Button>
          </Link>
        }
      />
    </SectionCard>
  );
};

export default Exception500;
