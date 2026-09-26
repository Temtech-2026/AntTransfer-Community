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
package com.anttransfer.common.security;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;

/**
 * 用户只读查询端口（SPI）——用户表（{@code sys_user}）归属 at-auth，
 * 其他模块需要「用户是否存在 / 怎么称呼 / 邮箱是什么 / 头像长什么样」时<b>不得</b>直连其表，只能经本端口反查。
 *
 * <p>这是架构铁律「表族归属」在跨模块读取上的具体落法：<b>读走 SPI、写走单事务</b>
 * （system-design §1.2 / D-1）。首个消费方是 at-collaboration 的通知与 IM 域——
 * 单聊发送前要确认对端是「存在且可用」的用户（否则 {@code 1013 CHAT_TARGET_INVALID}）；
 * 会话列表要展示对端昵称与头像；P1 邮件渠道要拿到收件地址（而 {@code sys_user.email}
 * 同样属 at-auth 表族，不能由通知域直查）。</p>
 *
 * <p><b>只读承诺：</b>本端口只暴露查询语义，实现方不得在此做写操作；调用方也不得
 * 依赖其返回值做鉴权决策（鉴权仍以 {@link AuthenticatedUser} 与权限点为准）。</p>
 *
 * @author AntTransfer CE
 */
public interface UserLookupPort {

    /**
     * 用户是否存在且可用（未删除、状态为正常）。
     *
     * <p>禁用 / 锁定用户视为「不可用」——不允许向其发起新会话或投递邮件，
     * 避免消息投递给无法登录的账号而永久沉淀为无人认领的未读。</p>
     *
     * @param userId 用户 ID
     * @return true=存在且状态正常
     */
    boolean existsActiveUser(Long userId);

    /**
     * 批量取用户联系信息（展示名 + 邮箱 + 头像地址），用于会话列表展示、消息发送者头像与 P1 邮件渠道收件。
     *
     * <p>不含账号状态判定——状态由 {@link #existsActiveUser} 单独回答，
     * 两者职责分离，避免消费方从「能查到」误推出「可用」。</p>
     *
     * @param userIds 用户 ID 集合（为空返回空 Map）
     * @return userId → 联系信息；查不到的 ID 不出现在 Map 中（调用方自行回落「未知用户」）
     */
    Map<Long, UserContact> findContacts(Collection<Long> userIds);

    /**
     * 按<b>登录账号</b>反查用户——「按账号发起会话」的解析入口。
     *
     * <p><b>为什么需要它：</b>会话目标的落库形态是 19 位雪花 ID（{@code targetId}），
     * 而人记得住、说得出的标识是登录账号。没有本方法，非管理员就只剩两条路——
     * 要么拿到别人的雪花 ID（用户目录端点挂在 {@code system:user:list} 上，只有管理员可用），
     * 要么根本发不起会话。于是「发起会话」在管理面权限之外实际不可用。</p>
     *
     * <p><b>为什么可用性判断折叠进本方法：</b>可用会话目标必须是「存在且可用」的账号
     * （口径同 {@link #existsActiveUser}）。若本方法只回答「查得到吗」，消费方必然要再调一次
     * {@code existsActiveUser} 才能用——两次反查，且两次之间账号可能被停用。
     * 方法名把口径写明（{@code findActiveBy...}），消费方就无需自行拼接两个回答，
     * 也不会从「查得到」误推出「可用」。</p>
     *
     * <p><b>精确匹配，不是模糊检索：</b>本方法不提供「按昵称找人」的能力，
     * 调用方无法用它枚举用户目录——必须先知道对方账号才能问。（检索式选人属管理面行为。）</p>
     *
     * @param username 登录账号（实现方按精确匹配处理，自行 trim）
     * @return 命中且可用的用户联系信息；账号不存在 / 已逻辑删除 / 非正常状态一律返回 {@code Optional.empty()}
     */
    Optional<UserContact> findActiveByUsername(String username);

    /**
     * 用户联系信息（最小可见字段：不含密码散列、不含账号状态）。
     *
     * @param userId      用户 ID
     * @param displayName 展示名（昵称为空时实现方回落为登录账号，保证非空）
     * @param email       邮箱（可能为空，为空表示该用户未配置邮件通知可达地址）
     * @param avatarUrl   头像<b>对外地址</b>（可能为空，为空表示该用户没设置过头像）。
     *                    <p><b>与 {@link UserAdminPort.UserRow#avatarUrl()} 的区别（同名不同义，务必看清）：</b>
     *                    那个是写侧落库用的<b>存储 key</b>（不透明文件名），这个是可以直接塞进
     *                    {@code <img src>} 的<b>地址</b>——实现方已经过
     *                    {@code com.anttransfer.common.file.AvatarStoragePort#urlOf} 拼好，
     *                    含 {@code ?v=} 缓存版本号。消费方<b>不得</b>再自行拼接前缀或版本参数。</p>
     */
    record UserContact(Long userId, String displayName, String email, String avatarUrl) {
    }
}
