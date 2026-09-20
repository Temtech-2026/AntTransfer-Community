/**
 * 危险操作二次确认。
 *
 * <p>收口三件事，避免每个页面各写一套：
 * <ol>
 *   <li><b>必须是弹窗而不是行内 Popconfirm</b>：删除 / 取消分享 / 彻底销毁这类操作
 *       在列表里只需要一次点击就能触发，行内气泡容易被误触后顺手确认；弹窗的
 *       焦点转移能形成一次「停下来确认」的停顿。</li>
 *   <li><b>确认键必须是红色（danger）</b>：与「保存」「提交」区分开，颜色本身就是危险信号。</li>
 *   <li><b>失败时弹窗不关闭</b>：接口失败却关掉弹窗，用户会以为操作成功；
 *       这里靠「onOk 返回 rejected Promise」保留弹窗（antd 的既定行为）。</li>
 * </ol>
 *
 * <p>调用约定：{@link DangerConfirmOptions.onOk} <b>不要把异常吞掉</b>——抛出即视为失败，
 * 错误提示由请求层（`requestErrorConfig`）统一弹出，这里不重复弹 toast。
 */

import { ExclamationCircleFilled } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { App, theme } from 'antd';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

/** 危险级别。 */
export type DangerLevel =
  /** 可恢复 / 影响面小：只做红色确认键区分。 */
  | 'danger'
  /** 不可撤销：额外显示一句风险提示。 */
  | 'critical';

/** 二次确认入参。 */
export interface DangerConfirmOptions {
  /** 弹窗标题，建议用动词短语，如「取消分享」。 */
  title: ReactNode;
  /** 后果说明：说清「会发生什么」，而不是重复标题。 */
  content: ReactNode;
  /** 危险级别，缺省 `danger`。 */
  level?: DangerLevel;
  /** 确认键文案，缺省「确认执行」。 */
  okText?: string;
  /** 取消键文案，缺省「取消」。 */
  cancelText?: string;
  /** 确认后的动作；抛异常即视为失败（弹窗保持打开）。 */
  onOk: () => void | Promise<void>;
  /** 成功后要提示的文案；不传则不提示（适合页面已有刷新反馈的场景）。 */
  successMessage?: string;
}

/** Hook 返回值。 */
export interface DangerConfirmResult {
  confirm: (options: DangerConfirmOptions) => void;
}

/**
 * 取得二次确认能力（必须在 antd `<App>` 上下文内使用，@umijs/max 的 antd 插件已全局包裹）。
 */
export function useDangerConfirm(): DangerConfirmResult {
  const { modal, message } = App.useApp();
  const { token } = theme.useToken();
  const intl = useIntl();

  return useMemo<DangerConfirmResult>(
    () => ({
      confirm: (options) => {
        const {
          title,
          content,
          level = 'danger',
          onOk,
          successMessage,
          okText,
          cancelText,
        } = options;

        const instance = modal.confirm({
          title,
          icon: <ExclamationCircleFilled style={{ color: token.colorError }} />,
          okButtonProps: { danger: true },
          okText: okText ?? intl.formatMessage({ id: 'common.danger.ok' }),
          cancelText: cancelText ?? intl.formatMessage({ id: 'common.danger.cancel' }),
          content: (
            <div>
              <div style={{ color: token.colorTextSecondary }}>{content}</div>
              {level === 'critical' ? (
                <div style={{ marginTop: 8, color: token.colorError, fontSize: 12 }}>
                  {intl.formatMessage({
                    id: 'common.danger.irreversible',
                  })}
                </div>
              ) : null}
            </div>
          ),
          onOk: async () => {
            // 这里不 try/catch：让 rejection 冒泡，antd 会保留弹窗（见文件头第 3 点）
            await onOk();
            if (successMessage) {
              message.success(successMessage);
            }
          },
        });

        // 读一次 then 会把该弹窗标记为 silent（antd useModal 实现）：
        // onOk 失败时既不关闭弹窗，也不抛出无人处理的 Promise rejection。
        // 注意 antd 6 的 then 要求同时给出 resolve/reject 两个回调，故显式补一个空 reject。
        instance.then(
          () => undefined,
          () => undefined,
        );
      },
    }),
    [modal, message, token.colorError, token.colorTextSecondary, intl],
  );
}

export default useDangerConfirm;
