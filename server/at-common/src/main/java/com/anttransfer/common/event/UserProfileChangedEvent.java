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
package com.anttransfer.common.event;

/**
 * 用户资料变更事件（头像更换成功后，<b>事务提交后</b>发布）。
 *
 * <p><b>事件不承载资料本身，只承载「谁变了」与已经算好的新值：</b>头像的存储 key 已在
 * 同一事务里落库（{@code sys_user.avatar_url}），事件只是让别的模块知道「该刷新这个人的画像了」。
 * 发布点必须置于 {@code afterCommit}——提交前发，事务一旦回滚，各端就会去拉一个并不存在的
 * {@code ?v=}，表现必然是碎图，而且是「只有回滚时才会出现」的那种。</p>
 *
 * <p><b>为什么必须走事件，而不是让写侧直接推 WS 帧：</b>头像的写侧在 at-permission，
 * 而 WS 推送通道属 at-collaboration。按模块依赖铁律，两者不得互相编译期依赖，
 * 跨模块的「发生了一件事」只能经共享内核（at-common）的事件契约传递——
 * 与 {@link PermissionGrantEvent} 同一处置（见其类注的 AT-DIFF-10）。</p>
 *
 * <p><b>消费方（当前唯一）的行为：</b>at-collaboration 把它转成 {@code PROFILE} 帧，
 * 推给<b>变更者本人的所有在线端</b>——在 A 端换了头像，B 端（另一个标签页 / 另一台设备）的
 * 顶栏与聊天头像要立刻跟上。<b>会话对端刻意不推：</b>他们的头像来自会话列表与消息载荷，
 * 下次拉取自然就是新值；为此维护一张「谁在关注谁」的订阅表，收益远小于它与
 * 群成员关系变更之间的同步成本。</p>
 *
 * @param userId    资料变更的用户 ID
 * @param avatarUrl 变更后的头像<b>对外地址</b>（经
 *                  {@code com.anttransfer.common.file.AvatarStoragePort#urlOf} 拼好、
 *                  已含 {@code ?v=} 缓存版本号；为 {@code null} 表示该用户当前没有头像）
 * @author AntTransfer CE
 */
public record UserProfileChangedEvent(Long userId, String avatarUrl) {
}
