/**
 * 组织 / 团队切换器（顶栏最左，紧贴 Logo）。
 *
 * <p><b>为什么只有一个组织：</b>本部署为单组织自托管，一次部署服务一个组织。
 * 因此这里不做假的切换动作，只如实呈现：
 * <ul>
 *   <li>当前组织 = 本次部署，默认选中且不可切换；</li>
 *   <li>「新建组织」「切换到其他组织」以禁用项呈现，避免用户点了没反应。</li>
 * </ul>
 *
 * <p>接入远端组织列表后，只需把 {@link OrgSwitcherProps.orgName} 换成远端来源。
 */

import {
  ApartmentOutlined,
  CheckOutlined,
  DownOutlined,
  PlusOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { createStyles } from 'antd-style';
import type { MenuProps } from 'antd';
import { Dropdown, Tag, Tooltip } from 'antd';
import React from 'react';

const useStyles = createStyles(({ token, css }) => ({
  trigger: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 190px;
    height: 30px;
    padding: 0 8px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
    color: ${token.colorText};
    font-size: ${token.fontSize}px;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background: ${token.colorFillTertiary};
    }
  `,
  icon: css`
    color: ${token.colorTextSecondary};
    flex: none;
  `,
  name: css`
    max-width: 120px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  `,
  arrow: css`
    flex: none;
    font-size: 10px;
    color: ${token.colorTextTertiary};
  `,
}));

export interface OrgSwitcherProps {
  /** 当前组织名；缺省取 i18n 的默认组织名 */
  orgName?: string;
}

/**
 * 顶栏组织切换器。
 *
 * @param props 见 {@link OrgSwitcherProps}
 */
const OrgSwitcher: React.FC<OrgSwitcherProps> = ({ orgName }) => {
  const intl = useIntl();
  const { styles } = useStyles();
  const current =
    orgName?.trim() || intl.formatMessage({ id: 'component.org.defaultName' });

  const items: MenuProps['items'] = [
    {
      key: 'current',
      icon: <CheckOutlined />,
      label: (
        <span>
          {current}
          <Tag
            color="green"
            style={{ marginInlineStart: 8, marginInlineEnd: 0 }}
          >
            {intl.formatMessage({ id: 'component.org.current' })}
          </Tag>
        </span>
      ),
    },
    { type: 'divider' },
    {
      key: 'create',
      icon: <PlusOutlined />,
      disabled: true,
      label: intl.formatMessage({ id: 'component.org.create' }),
    },
    {
      key: 'switch',
      icon: <SwapOutlined />,
      disabled: true,
      label: intl.formatMessage({ id: 'component.org.switch' }),
    },
  ];

  return (
    <Tooltip
      title={intl.formatMessage({ id: 'component.org.tooltip' }, { name: current })}
      placement="bottomLeft"
    >
      <Dropdown
        trigger={['click']}
        placement="bottomLeft"
        menu={{ items, selectedKeys: ['current'] }}
      >
        <span className={styles.trigger}>
          <ApartmentOutlined className={styles.icon} />
          <span className={styles.name}>{current}</span>
          <DownOutlined className={styles.arrow} />
        </span>
      </Dropdown>
    </Tooltip>
  );
};

export default OrgSwitcher;
