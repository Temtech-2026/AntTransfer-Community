import { Link } from '@umijs/max';
import { Button, Result } from 'antd';

import SectionCard from '@/components/SectionCard';

/**
 * 500：服务端异常。
 *
 * <p>不可恢复的兜底页：只给出「返回首页」这一条安全出路，
 * 不提供重试按钮（重试可能再次触发同一异常，且错误上下文已丢失）。
 */
export default () => (
  <SectionCard bordered={false} bodyPadding="56px 24px">
    <Result
      status="500"
      title="500"
      subTitle="抱歉，服务出现异常。请稍后重试，若持续出现请联系管理员排查。"
      extra={
        <Link to="/" prefetch>
          <Button type="primary">返回首页</Button>
        </Link>
      }
    />
  </SectionCard>
);
