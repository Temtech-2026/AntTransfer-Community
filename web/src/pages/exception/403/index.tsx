import { Link } from '@umijs/max';
import { Button, Result } from 'antd';

import SectionCard from '@/components/SectionCard';

/**
 * 403：权限不足。
 *
 * <p>文案对齐后端错误码口径：权限不足 = HTTP 403 + 业务码 1003（NO_AUTH），
 * 属「策略 D」——就地提示、不引导登录（当前登录态有效，重新登录并不能提权）。
 */
export default () => (
  <SectionCard bordered={false} bodyPadding="56px 24px">
    <Result
      status="403"
      title="403"
      subTitle="抱歉，你没有访问该页面的权限。请联系管理员为当前账号开通相应权限点。"
      extra={
        <Link to="/" prefetch>
          <Button type="primary">返回首页</Button>
        </Link>
      }
    />
  </SectionCard>
);
