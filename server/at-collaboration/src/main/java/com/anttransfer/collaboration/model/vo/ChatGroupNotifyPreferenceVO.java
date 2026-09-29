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
package com.anttransfer.collaboration.model.vo;

/**
 * 「<b>我</b>在这个群里的消息提醒偏好」（群设置面板的一组开关 + 会话列表的免打扰标记）。
 *
 * <p><b>为什么是「我」的而不是群的：</b>免打扰与提及提醒是 (我, 这个群) 这条成员关系的私有属性
 * （存储口径见 {@code V20}）。群主不能替成员关掉手机上的提示音，成员也不该被一个「群级开关」
 * 一刀切。因此本对象<b>只出现在「我自己」视角</b>的返回里：会话列表（每行是我的会话）
 * 与群详情（查看者必是该群成员）——不存在「读别人偏好」的入参面。</p>
 *
 * <p><b>三档如何共同决定「要不要出声」（前端的裁决口径，服务端只给事实）：</b></p>
 * <ol>
 *   <li>{@code muteStatus = 0}（免打扰关）→ 该群所有新消息都提醒；</li>
 *   <li>{@code muteStatus = 1}（免打扰开）→ 仅当本条消息的提及档位命中且对应开关为 1 时才提醒：
 *       {@code @我}（{@code mentionType = 1}）看 {@code notifyOnMention}；
 *       {@code @所有人}（{@code mentionType = 2}）看 {@code notifyOnMentionAll}；</li>
 *   <li>两者都不命中 → 消息照常送达，但不播放提示音、不弹提醒。</li>
 * </ol>
 * <p>这解释了「@所有人」与「有人 @ 我」为什么是两个开关：前者的打扰面是全群，
 * 后者只针对一个人，用户对它们的容忍度不同（与微信一致）。</p>
 *
 * <p><b>为什么 {@code ConversationVO} 也要带它：</b>用户可能一直停留在会话列表而不打开群设置，
 * 此时收到新消息仍要按同一份偏好决定是否出声——偏好随会话一起下发，
 * 前端无需为了「要不要响」额外发一次请求。</p>
 *
 * @param muteStatus        消息免打扰：0-关闭（默认） 1-开启（见 {@code GroupMember#MUTE_ON}）
 * @param notifyOnMention   有人 {@code @} 我时是否提醒：0-不提醒 1-提醒（默认 1）
 * @param notifyOnMentionAll 群主 {@code @} 所有人时是否提醒：0-不提醒 1-提醒（默认 1）
 * @author AntTransfer CE
 */
public record ChatGroupNotifyPreferenceVO(
        Integer muteStatus,
        Integer notifyOnMention,
        Integer notifyOnMentionAll) {
}
