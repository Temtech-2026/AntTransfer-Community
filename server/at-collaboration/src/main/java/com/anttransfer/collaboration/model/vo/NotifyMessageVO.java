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

import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 站内 / 会话消息出参视图——REST 列表与 WebSocket {@code NOTIFY} / {@code CHAT} 帧共用。
 *
 * <p><b>为什么不直接序列化实体：</b>实体继承了 {@code BaseEntity}，
 * 带 {@code tenantId / createBy / updateBy / deleted} 等内部字段；直接吐出去等于把
 * 存储细节固化进对外契约，日后改表结构就会破坏接口。VO 是「契约与存储之间的防火墙」。</p>
 *
 * <p>同一份 VO 复用于 HTTP 与 WS，前端只需写一套解析逻辑（帧内 {@code data} 字段与
 * 列表元素同构），这是「上下行信封一致」之外的又一处减负。</p>
 *
 * @param id              消息 ID
 * @param recipientUserId 接收人用户 ID
 * @param senderUserId    发送人用户 ID（系统通知为 null）
 * @param senderDisplayName 发送人展示名（<b>只用于前端画首字符兜底头像</b>；发送人没设过头像、
 *                        系统通知、或本行就是发送人自己时可为 null）。本 VO 不把它当「消息署名」用：
 *                        会话气泡下不显示名字，「谁发的」由 {@code senderUserId} 与写扩散形态回答
 *                        （{@code senderUserId == recipientUserId} 即本人，前端走 mine 分支）
 * @param senderAvatarUrl 发送人头像<b>对外地址</b>（可为 null=没设过头像；含 {@code ?v=}，
 *                        消费方不得再拼接）。与 {@code senderDisplayName} 同源同命运
 * @param notifyType      通知类型（见 {@code NotifyType}）
 * @param messageType     消息体类型（见 {@code MessageType}）
 * @param chatScope       会话范围（1-单聊 2-群聊；系统通知为 null）
 * @param chatTargetId    会话目标 ID（单聊=对端用户 ID；群聊=群组 ID）
 * @param clientMsgId     客户端消息 ID（会话幂等键，系统通知为 null）
 * @param title           标题
 * @param content         正文
 * @param bizType         关联业务类型
 * @param bizId           关联业务 ID
 * @param readStatus      阅读状态：0-未读 1-已读（<b>仅指本行接收人</b>，口径见下方 {@code @implNote}）
 * @param readTime        阅读时间
 * @param mentioned       本条消息是否<b>点名了本行接收人</b>（{@code @} 提及）。行级属性，
 *                        与 {@code readStatus} 同维度：群聊里同一条消息发给 N 个人，
 *                        只有被点名者收到的那份为 {@code true}。前端据此渲染「@我」高亮，
 *                        会话列表则用它的未读计数画「有人 @ 我」角标
 *                        （{@code ConversationVO#mentionUnreadCount}）
 * @param recallStatus    撤回状态：0-正常 1-已撤回（1 时 {@code content} 已清空，
 *                        前端应渲染为「已撤回」占位而不是空气泡）
 * @param recallTime      撤回时间（未撤回为 null）
 * @param quoteClientMsgId 被引用消息的幂等键（非空即为引用回复）
 * @param quoteSenderUserId 被引用消息的发送人（引用块里「谁说的」）
 * @param quoteContent    被引用消息正文快照（已按码点截断；<b>是快照不是实时值</b>，
 *                        原消息随后被撤回也不会让它变空）
 * @param createTime      创建时间
 * @param readers         已读人（会话消息气泡下方的小头像；仅会话历史查询填充，
 *                        且只对「我发的」消息可能非空，其余场景恒为空列表）
 * @author AntTransfer CE
 * @implNote ID 字段以字符串过线，理由见 {@code UserVO}；本 VO 同时供 HTTP 与 WS 帧使用，
 * 漏标会让实时下发的 {@code chatTargetId} 被前端舍入，回传时即触发「目标用户不存在或不可用」。
 * <p><b>{@code readStatus} 不等于「对方已读」</b>：写扩散下每个参与人各有一行，
 * 本字段只描述<b>本行接收人</b>的阅读状态。发送人自己那一行落库即置读（否则自己发的消息会给自己
 * 制造未读角标），所以「我发的消息」在本字段上恒为已读——想问「对方读了没」，只能看
 * {@link #readers}（由同一消息其他人的镜像行派生）。把 {@code readStatus} 当作已读回执，
 * 是这一块最容易踩且最不易察觉的错。</p>
 */
public record NotifyMessageVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long id,
        @JsonSerialize(using = ToStringSerializer.class)
        Long recipientUserId,
        @JsonSerialize(using = ToStringSerializer.class)
        Long senderUserId,
        String senderDisplayName,
        String senderAvatarUrl,
        Integer notifyType,
        Integer messageType,
        Integer chatScope,
        @JsonSerialize(using = ToStringSerializer.class)
        Long chatTargetId,
        String clientMsgId,
        String title,
        String content,
        String bizType,
        @JsonSerialize(using = ToStringSerializer.class)
        Long bizId,
        Integer readStatus,
        LocalDateTime readTime,
        boolean mentioned,
        Integer recallStatus,
        LocalDateTime recallTime,
        String quoteClientMsgId,
        @JsonSerialize(using = ToStringSerializer.class)
        Long quoteSenderUserId,
        String quoteContent,
        LocalDateTime createTime,
        List<ChatReaderVO> readers) {

    /**
     * 由实体转换（忽略内部审计字段），已读人与发送者身份一并留空。
     *
     * <p><b>两条正当使用场景，都不要在此补发送者身份：</b></p>
     * <ol>
     *   <li>系统通知（{@code notifyType} 非会话类）——它没有「发送人」这个概念；</li>
     *   <li>发消息接口回给<b>发送人自己</b>的那一行（写扩散下
     *       {@code senderUserId == recipientUserId}）——前端按 mine 分支渲染成操作者自己的头像，
     *       服务端再查一遍发送人是谁纯属冗余。</li>
     * </ol>
     * <p>下发给<b>别人</b>的消息（历史查询 / 实时帧）必须走四参重载补齐发送者身份，
     * 否则对方看到的气泡头像会退化成兜底首字符。</p>
     */
    public static NotifyMessageVO from(NotifyMessage message) {
        return from(message, List.of(), null, null);
    }

    /**
     * 由实体转换，并带上已读人、发送人展示名与头像（会话历史查询与实时下行专用）。
     *
     * <p>{@code readers} 为 {@code null} 时归一成空列表：对外契约只区分「有已读人」与
     * 「没有已读人」，不让 {@code null} 与 {@code []} 两种「空」在前端多出一条分支。</p>
     *
     * <p><b>为什么发送者身份是入参而不是在本方法里查：</b>本类是无依赖的纯转换，而一条群消息
     * 在写扩散下会展开成 N 行——逐行查库就是 N 次查询。展示名与头像由调用方经
     * {@code UserLookupPort.findContacts} <b>一次批量</b>查好后传入。</p>
     */
    public static NotifyMessageVO from(NotifyMessage message, List<ChatReaderVO> readers,
                                       String senderDisplayName, String senderAvatarUrl) {
        if (message == null) {
            return null;
        }
        return new NotifyMessageVO(
                message.getId(),
                message.getRecipientUserId(),
                message.getSenderUserId(),
                senderDisplayName,
                senderAvatarUrl,
                message.getNotifyType(),
                message.getMessageType(),
                message.getChatScope(),
                message.getChatTargetId(),
                message.getClientMsgId(),
                message.getTitle(),
                message.getContent(),
                message.getBizType(),
                message.getBizId(),
                message.getReadStatus(),
                message.getReadTime(),
                message.isRecipientMentioned(),
                message.getRecallStatus(),
                message.getRecallTime(),
                message.getQuoteClientMsgId(),
                message.getQuoteSenderUserId(),
                message.getQuoteContent(),
                message.getCreateTime(),
                readers == null ? List.of() : readers);
    }
}
