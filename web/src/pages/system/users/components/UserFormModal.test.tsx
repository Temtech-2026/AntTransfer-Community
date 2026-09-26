/**
 * 用户编辑弹窗 · 头像上传链路。
 *
 * <p>钉住三条容易在后续改动中悄悄断掉的约定：</p>
 * <ol>
 *   <li><b>上传即生效</b>：头像不走表单的「确定」，选中文件就发请求；因此它必须能用，
 *       而且不能因为表单校验没过而被顺带拦下。</li>
 *   <li><b>新地址只认服务端下发的</b>：换图后展示的必须是响应里的 {@code avatarUrl}
 *       （自带 {@code ?v=} 缓存版本号），前端不得自己拼路径。</li>
 *   <li><b>预检失败不发请求</b>：超限文件只给提示，绝不产生一次注定 400 的往返。</li>
 * </ol>
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';
import { AVATAR_MAX_BYTES, uploadUserAvatar, type UserVO } from '@/services/system';

import UserFormModal, { type UserFormModalProps } from './UserFormModal';

/** 断言用文案从 zh-CN 语言包取，键写错即失败（不在测试里另抄一份中文）。 */
const t = (id: string, values?: Record<string, unknown>) => testFormatMessage({ id, values });

const refreshCurrentUser = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useRefreshCurrentUser', () => ({
  default: () => refreshCurrentUser,
}));

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import('@/locales/testTranslate');
  return {
    // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
    useIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
    request: vi.fn(),
    history: {
      location: { pathname: '/system/users', search: '', hash: '' },
      push: vi.fn(),
      replace: vi.fn(),
    },
  };
});

vi.mock('@/services/system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/system')>();
  return { ...actual, uploadUserAvatar: vi.fn() };
});

const mockedUpload = vi.mocked(uploadUserAvatar);

const AVATAR_V1 = '/api/v1/users/101/avatar?v=v1';

const record = (overrides: Partial<UserVO> = {}): UserVO => ({
  id: '101',
  username: 'zhangsan',
  nickname: '张三',
  status: 0,
  protectedUser: false,
  avatarUrl: AVATAR_V1,
  ...overrides,
});

/** 造一个指定大小的 PNG 替身（只覆盖预检与上传用到的字段）。 */
const pngFile = (size = 1024) => {
  const file = new File(['x'], 'a.png', { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

/** antd Upload 的底层 input 是隐藏的，直接派发 change 事件。 */
const uploadFile = (file: File) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
};

const onAvatarUpdated = vi.fn();

/**
 * 上传按钮的可访问名匹配器。
 *
 * <p>不用精确字符串：按钮内的上传图标自带 {@code aria-label="upload"}，
 * 参与可访问名计算后完整名称是「upload 上传头像」，精确匹配会稳定落空。</p>
 */
const UPLOAD_BUTTON_NAME = new RegExp(t('system.user.avatar.upload'));

const renderModal = (props: Partial<UserFormModalProps> = {}) =>
  render(
    <App>
      <UserFormModal
        open
        record={record()}
        deptOptions={[]}
        roleOptions={[]}
        canAssignRole={false}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onAvatarUpdated={onAvatarUpdated}
        {...props}
      />
    </App>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedUpload.mockResolvedValue(record({ avatarUrl: '/api/v1/users/101/avatar?v=v2' }));
});

afterEach(() => {
  cleanup();
});

describe('用户编辑弹窗 · 头像', () => {
  it('编辑态展示现有头像与上传入口', async () => {
    renderModal();

    expect(await screen.findByRole('button', { name: UPLOAD_BUTTON_NAME })).toBeTruthy();
    expect(document.querySelector(`img[src="${AVATAR_V1}"]`)).toBeTruthy();
  });

  it('新建态不出现头像区（用户还没有 ID，无从上传）', async () => {
    renderModal({ record: null });

    // 标题先出来，确保弹窗已渲染，避免「查不到」只是因为还没挂载
    expect(await screen.findByText(t('system.userForm.title.create'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: UPLOAD_BUTTON_NAME })).toBeNull();
  });

  it('选中合法图片即上传：采用服务端下发的新地址，并刷新列表与登录态', async () => {
    renderModal();
    await screen.findByRole('button', { name: UPLOAD_BUTTON_NAME });

    uploadFile(pngFile());

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));
    expect(mockedUpload.mock.calls[0][0]).toBe('101');

    // 新图地址来自响应（含 ?v= 新版本号），不是前端拼接的
    await waitFor(() =>
      expect(document.querySelector('img[src="/api/v1/users/101/avatar?v=v2"]')).toBeTruthy(),
    );
    expect(onAvatarUpdated).toHaveBeenCalledTimes(1);
    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('超过上限的文件只给提示，不产生注定失败的请求', async () => {
    renderModal();
    await screen.findByRole('button', { name: UPLOAD_BUTTON_NAME });

    uploadFile(pngFile(AVATAR_MAX_BYTES + 1));

    expect(
      await screen.findByText(t('system.user.avatar.tooLarge', { max: '2 MB' })),
    ).toBeTruthy();
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(onAvatarUpdated).not.toHaveBeenCalled();
    expect(refreshCurrentUser).not.toHaveBeenCalled();
  });

  it('原无头像的用户上传后：出现新图预览并给出成功提示', async () => {
    renderModal({ record: record({ avatarUrl: undefined }) });
    await screen.findByRole('button', { name: UPLOAD_BUTTON_NAME });

    // 上传前只有 Avatar 的占位图标，没有真正的 <img>
    expect(document.querySelector('img[src^="/api/v1/users/101/avatar"]')).toBeNull();

    uploadFile(pngFile());

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(t('system.user.avatar.updated'))).toBeTruthy();
    await waitFor(() =>
      expect(document.querySelector('img[src="/api/v1/users/101/avatar?v=v2"]')).toBeTruthy(),
    );
  });

  it('连续两次选图都能上传（被拦截的文件不占 fileList 名额）', async () => {
    renderModal();
    await screen.findByRole('button', { name: UPLOAD_BUTTON_NAME });

    uploadFile(pngFile());
    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));

    // 第二次点「上传头像」选同一个文件也必须走到 beforeUpload，而不是静默无反应
    uploadFile(pngFile());
    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(2));
  });

  it('响应未带新地址时保留原预览，且不回调父级', async () => {
    // 模拟「接口成功但响应体没带 data」：此时既不能清掉预览，也不必回调父级
    mockedUpload.mockResolvedValue(undefined as never);
    renderModal();
    await screen.findByRole('button', { name: UPLOAD_BUTTON_NAME });

    uploadFile(pngFile());

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));
    expect(document.querySelector(`img[src="${AVATAR_V1}"]`)).toBeTruthy();
    expect(onAvatarUpdated).not.toHaveBeenCalled();
  });
});
