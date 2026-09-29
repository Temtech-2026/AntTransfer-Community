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
package com.anttransfer.collaboration.model.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 更新「我在这个群」的消息提醒偏好（整体覆盖式，三个开关一次给全）。
 *
 * <p><b>为什么用包装类型 + {@code @NotNull} 而不是 {@code boolean}：</b>三个开关共同决定
 * 一条消息是否提醒，客户端每次提交的应是「我看到并确认过的完整状态」。
 * 若用原始类型，漏传字段会被静默当成 {@code false}——用户只是开了一下免打扰，
 * 却顺带把两个提及提醒关掉了。{@code @NotNull} 让「没传」在参数校验层就失败，
 * 而不是在服务端被误解成一个有意义的取值。</p>
 *
 * <p><b>为什么是整体覆盖而不是按需增量：</b>增量更新会让两个并发请求（一个开免打扰、
 * 一个关 @ 提醒）互相覆盖对方的意图，终态取决于提交顺序；覆盖式下每次写入的都是完整状态，
 * 语义与三档开关的 UI 一一对应（存储口径见 {@code GroupMemberMapper#updateNotifyPreference}）。</p>
 *
 * <p><b>作用对象只有我自己：</b>路径里只有群 ID，成员身份由登录态决定（见
 * {@code ChatGroupService#updateNotifyPreference}），入参里没有任何指向他人的字段。</p>
 *
 * @param muteStatus         消息免打扰：0-关闭 1-开启
 * @param notifyOnMention    有人 {@code @} 我时是否提醒：0-不提醒 1-提醒
 * @param notifyOnMentionAll 群主 {@code @} 所有人时是否提醒：0-不提醒 1-提醒
 * @author AntTransfer CE
 */
public record ChatGroupNotifyPreferenceDTO(
        @NotNull(message = "免打扰开关不能为空") Boolean muteStatus,
        @NotNull(message = "提及提醒开关不能为空") Boolean notifyOnMention,
        @NotNull(message = "@所有人提醒开关不能为空") Boolean notifyOnMentionAll) {
}
