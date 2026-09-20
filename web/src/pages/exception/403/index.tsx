import { Link, useIntl } from '@umijs/max';
import { Button, Result } from 'antd';
import React from 'react';

import SectionCard from '@/components/SectionCard';

/**
 * 403：权限不足。
 *
 * <p>文案对齐后端错误码口径：权限不足 = HTTP 403 + 业务码 1003（NO_AUTH），
 * 属「策略 D」——就地提示、不引导登录（当前登录态有效，重新登录并不能提权）。
 */
const Exception403: React.FC = () => {
  const intl = useIntl();

  return (
    <SectionCard bordered={false} bodyPadding="56px 24px">
      <Result
        status="403"
        title="403"
        subTitle={intl.formatMessage({ id: 'exception.403.subTitle' })}
        extra={
          <Link to="/" prefetch>
            <Button type="primary">
              {intl.formatMessage({ id: 'exception.403.buttonText' })}
            </Button>
          </Link>
        }
      />
    </SectionCard>
  );
};

export default Exception403;
