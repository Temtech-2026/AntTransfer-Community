/**
 * 顶栏全局搜索。
 *
 * <p><b>落到哪个能力上：</b>CE 的文件接口支持按关键字（文件名）与密级 / 类型过滤，
 * 因此这里把搜索词交给文件工作台（`/file?keyword=…`），由它去调真实接口，
 * 本组件不自己发请求——避免出现「顶栏搜到的东西」和「文件页列表」两套口径。
 *
 * <p><b>说明文字只讲能搜什么：</b>只写当前可检索的范围（文件名、标签），
 * 不做点了没反馈的假入口。
 */

import { InfoCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { history, useIntl } from '@umijs/max';
import { createStyles } from 'antd-style';
import { Input, Tooltip } from 'antd';
import React, { useState } from 'react';

const useStyles = createStyles(({ token, css }) => ({
  wrap: css`
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 16px;
  `,
  search: css`
    width: 100%;
    max-width: 480px;
  `,
  hint: css`
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    cursor: help;
  `,
  hintText: css`
    max-width: 240px;
    line-height: 1.5;
    white-space: normal;
  `,
}));

/**
 * 顶栏搜索框：回车 / 点击搜索图标即跳转文件工作台。
 */
const GlobalSearch: React.FC = () => {
  const intl = useIntl();
  const { styles } = useStyles();
  const [keyword, setKeyword] = useState('');

  const submit = (value: string) => {
    const next = value.trim();
    if (!next) {
      return;
    }
    history.push(`/file?keyword=${encodeURIComponent(next)}`);
  };

  return (
    <div className={styles.wrap}>
      <Input.Search
        className={styles.search}
        allowClear
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        onSearch={submit}
        enterButton={<SearchOutlined />}
        placeholder={intl.formatMessage({ id: 'component.globalSearch.placeholder' })}
        aria-label={intl.formatMessage({ id: 'component.globalSearch.ariaLabel' })}
      />
      <Tooltip
        title={
          <span className={styles.hintText}>
            {intl.formatMessage({ id: 'component.globalSearch.scopeTitle' })}
          </span>
        }
      >
        <InfoCircleOutlined
          className={styles.hint}
          aria-label={intl.formatMessage({ id: 'component.globalSearch.scopeAria' })}
        />
      </Tooltip>
    </div>
  );
};

export default GlobalSearch;
