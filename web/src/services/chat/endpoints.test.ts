/**
 * 会话域端点与权限点常量的「镜像」契约。
 *
 * <p>这些字符串是跨层契约：改错一个字符不会报错，只会表现为「请求 404」或
 * 「按钮莫名消失」。后端侧以 `sql/V14__chat_group_permission_points.sql` 与
 * `ChatController` 为唯一事实源，这里把前端镜像的那一层钉住。</p>
 */
import { describe, expect, it } from 'vitest';

import { CHAT_ENDPOINTS } from './endpoints';
import { CHAT_PERM } from './perm';

describe('CHAT_ENDPOINTS', () => {
  it('全部挂在 /api/v1/chat 之下（前缀写错就是全线 404，且不会有任何编译期提示）', () => {
    // 带群 ID 的端点只能是函数（ID 必须经字符串拼接），故此处展开成具体路径再统一校验前缀
    const paths: string[] = [];
    for (const value of Object.values(CHAT_ENDPOINTS)) {
      // 逐项收窄而不是 filter 出类型谓词：`as const` 后每项都是字面量，
      // `value is string` 过不了「谓词类型须可赋给参数类型」这条规则
      if (typeof value === 'string') {
        paths.push(value);
      }
    }
    paths.push(
      CHAT_ENDPOINTS.group('1'),
      CHAT_ENDPOINTS.groupMembers('1'),
      CHAT_ENDPOINTS.groupMember('1', '2'),
      CHAT_ENDPOINTS.groupQuit('1'),
    );
    for (const path of paths) {
      expect(path.startsWith('/api/v1/chat/')).toBe(true);
    }
  });

  it('发送与历史同路径不同方法：游标翻页与发送是同一个资源', () => {
    expect(CHAT_ENDPOINTS.send).toBe('/api/v1/chat/messages');
    expect(CHAT_ENDPOINTS.history).toBe('/api/v1/chat/messages');
  });

  it('群聊端点：GET 取「我加入的群」/ POST 建群共用同一路径', () => {
    expect(CHAT_ENDPOINTS.groups).toBe('/api/v1/chat/groups');
  });

  it('群管理端点：详情 / 改名 / 解散同路径，邀请与移除挂在 /members 之下', () => {
    expect(CHAT_ENDPOINTS.group('101')).toBe('/api/v1/chat/groups/101');
    expect(CHAT_ENDPOINTS.groupMembers('101')).toBe(
      '/api/v1/chat/groups/101/members',
    );
    expect(CHAT_ENDPOINTS.groupMember('101', '202')).toBe(
      '/api/v1/chat/groups/101/members/202',
    );
    expect(CHAT_ENDPOINTS.groupQuit('101')).toBe('/api/v1/chat/groups/101/quit');
  });

  it('群 ID 与用户 ID 原样拼接：不得出现科学计数法或精度丢失', () => {
    const snowflake = '1949000000000000001';
    expect(CHAT_ENDPOINTS.group(snowflake)).toBe(
      `/api/v1/chat/groups/${snowflake}`,
    );
    expect(CHAT_ENDPOINTS.groupMember(snowflake, snowflake)).toBe(
      `/api/v1/chat/groups/${snowflake}/members/${snowflake}`,
    );
  });

  it('单聊目标解析是独立端点（非管理员发起会话的唯一入口）', () => {
    expect(CHAT_ENDPOINTS.resolveTarget).toBe('/api/v1/chat/targets/resolve');
  });
});

describe('CHAT_PERM', () => {
  it('菜单根节点与会话域一致', () => {
    expect(CHAT_PERM.MENU_ROOT).toBe('chat');
  });

  it('建群权限点逐字符对齐 SQL 脚本', () => {
    expect(CHAT_PERM.GROUP_CREATE).toBe('chat:group:create');
  });

  it('群管理权限点逐字符对齐 V16 迁移', () => {
    // 少一个字符不会报错，只会静默判定失败：按钮莫名消失，且无处可查
    expect(CHAT_PERM.GROUP_UPDATE).toBe('chat:group:update');
    expect(CHAT_PERM.GROUP_INVITE).toBe('chat:group:invite');
    expect(CHAT_PERM.GROUP_REMOVE).toBe('chat:group:remove');
    expect(CHAT_PERM.GROUP_DISSOLVE).toBe('chat:group:dissolve');
  });

  it('操作点挂在菜单根节点之下（镜像 SQL 的 parent_id 挂载关系）', () => {
    // 与 file:download / system:user:list 同一命名规则：菜单码是操作点码的前缀
    for (const code of Object.values(CHAT_PERM)) {
      if (code === CHAT_PERM.MENU_ROOT) {
        continue;
      }
      expect(code.startsWith(`${CHAT_PERM.MENU_ROOT}:`)).toBe(true);
    }
  });

  it('只有「写」动作设点：群详情与退群恒不设（否则会做出打不开设置 / 退不出去的账号）', () => {
    expect(Object.keys(CHAT_PERM)).toEqual([
      'MENU_ROOT',
      'GROUP_CREATE',
      'GROUP_UPDATE',
      'GROUP_INVITE',
      'GROUP_REMOVE',
      'GROUP_DISSOLVE',
    ]);
  });
});
