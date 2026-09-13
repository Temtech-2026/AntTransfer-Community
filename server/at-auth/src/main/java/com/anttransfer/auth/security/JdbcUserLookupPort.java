/*
 * Copyright (c) 2026 AntTransfer Community Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.anttransfer.auth.security;

import com.anttransfer.auth.model.entity.SysUser;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.common.security.UserLookupPort;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * {@link UserLookupPort} 的 at-auth 实现——用户表 {@code sys_user} 的唯一对外只读出口。
 *
 * <p><b>归属说明：</b>{@code sys_user} 属 at-auth 表族（「表族只允许归属模块读写」），
 * 因此「跨模块查用户」必须落到本类，而不是让消费方（如 at-collaboration 会话域）
 * 直连用户表。</p>
 *
 * <p><b>可用性口径：</b>{@code status=0（正常）且未逻辑删除} 才算「可用」；
 * 禁用（1005）/ 锁定（1004）的账号不允许被发起新会话——否则消息会投递给一个
 * 已经登不进来的账号，永久沉淀为无人认领的未读。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class JdbcUserLookupPort implements UserLookupPort {

    private final UserMapper userMapper;

    public JdbcUserLookupPort(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Override
    public boolean existsActiveUser(Long userId) {
        if (userId == null) {
            return false;
        }
        SysUser user = userMapper.selectById(userId);
        return user != null
                && user.getStatus() != null
                && user.getStatus() == SysUser.STATUS_NORMAL;
    }

    @Override
    public Map<Long, UserContact> findContacts(Collection<Long> userIds) {
        Map<Long, UserContact> contacts = new HashMap<>();
        if (userIds == null || userIds.isEmpty()) {
            return contacts;
        }
        // 去重 + 过滤 null：调用方常直接把「会话列表里的对端 ID」丢进来，含重复与空值
        Set<Long> distinct = new LinkedHashSet<>();
        for (Long id : userIds) {
            if (id != null) {
                distinct.add(id);
            }
        }
        if (distinct.isEmpty()) {
            return contacts;
        }
        List<SysUser> users = userMapper.selectBriefByIds(distinct);
        for (SysUser user : users) {
            String display = (user.getNickname() == null || user.getNickname().isBlank())
                    ? user.getUsername()
                    : user.getNickname();
            contacts.put(user.getId(),
                    new UserContact(user.getId(), display, user.getEmail()));
        }
        return contacts;
    }
}
