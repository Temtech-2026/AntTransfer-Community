import { BookOutlined } from '@ant-design/icons';
import { history, useIntl } from '@umijs/max';
import { Button, Tooltip } from 'antd';
import React from 'react';
import { LangDropdown } from './LangDropdown';
import useHeaderActionStyles from './style';

export const DocLink: React.FC = () => {
  const intl = useIntl();
  const { styles } = useHeaderActionStyles();
  const title = intl.formatMessage({ id: 'component.docLink.title' });
  return (
    <Tooltip title={title}>
      <Button
        type="text"
        className={styles.action}
        icon={<BookOutlined />}
        aria-label={title}
        onClick={() => {
          history.push('/welcome');
        }}
      />
    </Tooltip>
  );
};

export { LangDropdown };
