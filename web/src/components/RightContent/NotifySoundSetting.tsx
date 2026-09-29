/**
 * 「新消息提示音」的本人设置块（嵌在个人信息弹窗里）。
 *
 * <p>四件事：整体开关、内置音色三选一 / 自定义音色、上传 / 更换 / 删除自定义音频、试听。</p>
 *
 * <p><b>为什么"自定义"是独立一行而不是第四个单选项：</b>它不是和「铃声 / 气泡」并列的一种音色，
 * 而是「确实有一段自己上传的音频」这个事实的结果——没有音频时它根本不该可点。
 * 做成普通单选项就会出现「选中了自定义，却什么都没响」这种用户无法解释的状态。
 * 真正的音色切换仍由单选项表达，只是第一项受「有没有音频」约束。</p>
 *
 * <p><b>为什么开关与音色分开提交、但都走整体覆盖：</b>它们各自是一次独立的用户动作，
 * 一次拨动提交一次；但接口口径是整体覆盖（见 `UpdateNotifySettingPayload`），
 * 所以每次提交都带上另一项的当前值。这样「并发拨两个开关」最坏结果是后一次覆盖前一次，
 * 而不是拼出一个谁都没选过的组合。</p>
 *
 * <p><b>乐观更新 + 失败回读</b>：拨开关立刻改本地状态（不然开关要等一个 RTT 才动，手感很差），
 * 失败则重新拉一次服务端值把它纠正回来——不做「自己推算回滚」，
 * 因为失败时服务端可能已经落了一半，推算只会让界面离事实更远。</p>
 */

import { UploadOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { App, Button, Divider, Radio, Space, Switch, Typography, Upload } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';

import {
  clearMyNotifySound,
  fetchMyNotifySetting,
  updateMyNotifySetting,
  uploadMyNotifySound,
} from '@/services/auth';
import type { NotifySetting, NotifySoundPreset } from '@/services/auth';
import {
  checkNotifySoundFile,
  formatSoundDuration,
  formatSoundFileSize,
  NOTIFY_SOUND_ACCEPT_ATTR,
  NOTIFY_SOUND_PRESETS,
  notifySoundPresetMessageId,
} from '@/services/notify/soundPlan';
import {
  previewNotifySound,
  setNotifySoundSetting,
} from '@/services/notify/soundPlayer';

/** 提示音相关文案统一前缀，避免四处散落的字符串前缀各错一个字。 */
const I18N_PREFIX = 'component.avatar.notifySound';

const NotifySoundSetting: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();

  const [setting, setSetting] = useState<NotifySetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const t = useCallback(
    (id: string, values?: Record<string, string | number>) =>
      intl.formatMessage({ id }, values),
    [intl],
  );

  const applySetting = useCallback((next: NotifySetting) => {
    setSetting(next);
    setLoadFailed(false);
    // 同步给播放器：面板里刚改完就生效，不必等下一次拉取
    setNotifySoundSetting(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await fetchMyNotifySetting();
      applySetting(loaded);
    } catch {
      // 错误提示由请求层负责；这里只需给出「这块没加载出来 + 可重试」的形态，
      // 而不是把整个个人信息弹窗一起变成空态
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [applySetting]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * 提交一次整体覆盖；成功后用服务端返回值回填（而不是用提交值），
   * 因为「音色传 custom 但本地其实没音频」这类情况服务端会回落，回填才能看到真实结果。
   */
  const commit = useCallback(
    async (next: Pick<NotifySetting, 'soundEnabled' | 'soundPreset'>) => {
      if (!setting) {
        return;
      }
      const previous = setting;
      // 乐观更新：开关 / 单选属于高频轻量操作，等 RTT 才动会明显「粘手」
      applySetting({ ...setting, ...next });
      setSaving(true);
      try {
        const saved = await updateMyNotifySetting(next);
        applySetting(saved);
      } catch {
        // 失败不乱猜：回读服务端值把界面拉回事实（错误提示已由请求层弹过）
        setSetting(previous);
        void load();
      } finally {
        setSaving(false);
      }
    },
    [applySetting, load, setting],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!setting) {
        return;
      }
      // 预检只为省一次必然失败的往返：真假仍由服务端按文件头裁决（4029~4031）
      const rejection = checkNotifySoundFile(file, setting);
      if (rejection === 'type') {
        message.error(t(`${I18N_PREFIX}.typeInvalid`));
        return;
      }
      if (rejection === 'too-large') {
        message.error(
          t(`${I18N_PREFIX}.tooLarge`, {
            max: formatSoundFileSize(setting.maxSoundBytes),
          }),
        );
        return;
      }

      setUploading(true);
      try {
        // 上传即生效（服务端会把音色切到 custom 并清掉旧文件），
        // 所以这里不需要再补一次「保存」——返回的就是变更后的完整设置
        const saved = await uploadMyNotifySound(file);
        applySetting(saved);
        message.success(t(`${I18N_PREFIX}.uploaded`));
      } catch {
        // 上传通道已负责提示（4029~4032 会带着服务端文案弹出来）
      } finally {
        setUploading(false);
      }
    },
    [applySetting, message, setting, t],
  );

  const handleClear = useCallback(async () => {
    setUploading(true);
    try {
      const saved = await clearMyNotifySound();
      applySetting(saved);
      message.success(t(`${I18N_PREFIX}.cleared`));
    } catch {
      // 同上：提示交给请求层
    } finally {
      setUploading(false);
    }
  }, [applySetting, message, t]);

  /**
   * 试听。
   *
   * <p><b>刻意无视「提示音开关」</b>：开关关着时，用户恰恰更需要先听到这段音才能决定要不要开；
   * 若严格按开关静音，试听会永远没反应，看起来像功能坏了。</p>
   */
  const handlePreview = useCallback(async () => {
    if (!setting) {
      return;
    }
    setPreviewing(true);
    try {
      const played = await previewNotifySound({ ...setting, soundEnabled: true });
      if (!played) {
        // 唯一会导致「点了没声」且用户需要知道的原因是浏览器拦截了自动播放
        message.warning(t(`${I18N_PREFIX}.previewBlocked`));
      }
    } finally {
      setPreviewing(false);
    }
  }, [message, setting, t]);

  const preset = setting?.soundPreset ?? 'default';
  const hasCustomSound = Boolean(setting?.customSoundUrl);

  const uploadButton = (
    <Upload
      accept={NOTIFY_SOUND_ACCEPT_ATTR}
      showUploadList={false}
      // 受控空列表：beforeUpload 返回 false 只是「不自动上传」，文件仍会留在 antd 内部列表里，
      // 之后再选同一个文件就不会再触发 beforeUpload（表现为「第二次点了没反应」）
      fileList={[]}
      beforeUpload={(file) => {
        void handleFile(file);
        // 拦截 antd 默认上传：改由 uploadMyNotifySound 走 XHR 直发 FormData
        return false;
      }}
    >
      <Button loading={uploading} icon={<UploadOutlined />} disabled={loading || !setting}>
        {t(hasCustomSound ? `${I18N_PREFIX}.replace` : `${I18N_PREFIX}.upload`)}
      </Button>
    </Upload>
  );

  return (
    <div>
      <Divider style={{ margin: '16px 0 12px' }} />
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {t(`${I18N_PREFIX}.title`)}
      </Typography.Title>

      {loadFailed && !setting ? (
        <Space direction="vertical" size={8}>
          <Typography.Text type="secondary">
            {t(`${I18N_PREFIX}.loadFailed`)}
          </Typography.Text>
          <Button size="small" loading={loading} onClick={() => void load()}>
            {t('common.action.retry')}
          </Button>
        </Space>
      ) : (
        <Space direction="vertical" size={10} style={{ display: 'flex' }}>
          <Space size={8}>
            <Switch
              size="small"
              checked={Boolean(setting?.soundEnabled)}
              loading={loading}
              disabled={loading || saving || !setting}
              onChange={(checked) =>
                void commit({ soundEnabled: checked, soundPreset: preset })
              }
            />
            <Typography.Text>{t(`${I18N_PREFIX}.enabled`)}</Typography.Text>
          </Space>

          <Space size={8} wrap>
            <Typography.Text type="secondary">
              {t(`${I18N_PREFIX}.presetLabel`)}
            </Typography.Text>
            <Radio.Group
              value={preset}
              disabled={loading || saving || !setting}
              onChange={(event) =>
                void commit({
                  soundEnabled: Boolean(setting?.soundEnabled),
                  soundPreset: event.target.value as NotifySoundPreset,
                })
              }
            >
              {NOTIFY_SOUND_PRESETS.map((item) => (
                <Radio key={item} value={item}>
                  {t(notifySoundPresetMessageId(item))}
                </Radio>
              ))}
              {/*
                自定义项只在确实有音频时可点，且不属于上述单选项组：
                它是「有这段音频」的结果，缺音频时勾选它只会制造一个响不了的音色
              */}
              <Radio
                value="custom"
                disabled={!hasCustomSound}
                title={hasCustomSound ? undefined : t(`${I18N_PREFIX}.customEmpty`)}
              >
                {t(notifySoundPresetMessageId('custom'))}
              </Radio>
            </Radio.Group>
          </Space>

          <Space size={8} wrap>
            {uploadButton}
            {hasCustomSound && (
              <Button danger size="middle" loading={uploading} onClick={() => void handleClear()}>
                {t(`${I18N_PREFIX}.clear`)}
              </Button>
            )}
            <Button
              size="middle"
              loading={previewing}
              disabled={loading || !setting}
              onClick={() => void handlePreview()}
            >
              {t(`${I18N_PREFIX}.preview`)}
            </Button>
          </Space>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {hasCustomSound
              ? t(`${I18N_PREFIX}.customMeta`, {
                  name: setting?.customSoundName ?? '',
                  size: formatSoundFileSize(setting?.customSoundSize),
                  duration: formatSoundDuration(setting?.customSoundDurationMs),
                })
              : t(`${I18N_PREFIX}.hint`, {
                  maxSize: formatSoundFileSize(setting?.maxSoundBytes),
                  maxDuration: formatSoundDuration(setting?.maxSoundDurationMillis),
                })}
          </Typography.Text>
        </Space>
      )}
    </div>
  );
};

export default NotifySoundSetting;
