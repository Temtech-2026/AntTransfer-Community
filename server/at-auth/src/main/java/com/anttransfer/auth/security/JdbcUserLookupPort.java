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
import com.anttransfer.common.file.AvatarStoragePort;
import com.anttransfer.common.security.UserLookupPort;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
 * <p><b>头像地址的拼装落在这里，而不是留给消费方：</b>库里 {@code sys_user.avatar_url}
 * 存的是不透明存储 key，对外地址必须经 {@link AvatarStoragePort#urlOf} 拼。若让每个消费方
 * 自己拼，路径或版本参数一变就会出现「有的地方能显示、有的地方是碎图」。本类是
 * {@code sys_user} 的唯一对外只读出口，因此这里也是「用户 → 对外头像地址」这一映射的收口点
 * （与 at-auth 的 {@code AuthService#profile} / at-permission 的用户列表同一真相源）。</p>
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
            contacts.put(user.getId(),
                    new UserContact(user.getId(), displayName(user), user.getEmail(),
                            AvatarStoragePort.urlOf(user.getId(), user.getAvatarUrl())));
        }
        return contacts;
    }

    @Override
    public Optional<UserContact> findActiveByUsername(String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        // selectByUsername 自带 deleted = 0 过滤；状态判定与 existsActiveUser 同一处口径，
        // 避免「查得到但不可用」的账号被当成会话目标（禁用账号只会沉淀成无人认领的未读）
        SysUser user = userMapper.selectByUsername(username.trim());
        if (user == null || user.getStatus() == null || user.getStatus() != SysUser.STATUS_NORMAL) {
            return Optional.empty();
        }
        return Optional.of(new UserContact(user.getId(), displayName(user), user.getEmail(),
                AvatarStoragePort.urlOf(user.getId(), user.getAvatarUrl())));
    }

    /** 展示名回落：昵称为空时用登录账号，保证非空（口径与 {@link #findContacts} 一致）。 */
    private static String displayName(SysUser user) {
        return (user.getNickname() == null || user.getNickname().isBlank())
                ? user.getUsername()
                : user.getNickname();
    }
}
