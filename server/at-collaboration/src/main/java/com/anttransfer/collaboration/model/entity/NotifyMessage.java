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
package com.anttransfer.collaboration.model.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.anttransfer.common.entity.BaseEntity;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 站内 / 离线消息实体（表 {@code sys_notify_message}）。
 *
 * <p><b>一张表承载两类语义</b>，以 {@code notifyType} 分段区分（见
 * {@code com.anttransfer.common.notify.NotifyType}）：</p>
 * <ul>
 *     <li><b>系统通知</b>（1~5、8）：审批待办 / 结果、外发链接锁定 / 到期、异常登录、传输完成。
 *         这类消息「无发送人」，只有接收人；未读数进导航栏红点。</li>
 *     <li><b>会话消息</b>（6~7）：单聊 / 群聊。这类消息<b>写扩散（fan-out on write）</b>——
 *         一条消息按参与人各落一行：单聊落 2 行（双方各一行、{@code chatTargetId} 互指为对端），
 *         群聊落 N 行（每个成员一行、{@code chatTargetId} 均为 groupId）。
 *         好处：未读 / 已读 / 会话分页全部退化为「按 {@code recipientUserId} 单表查询」，
 *         无需额外回执表；代价是群成员越多写放大越大——CE 群规模有限，属可接受权衡
 *         （EE 若引入万人群，应改为「读扩散 + 会话已读游标」，届时本表结构不变）。</li>
 * </ul>
 *
 * <p><b>落库先于推送</b>：任何消息都先 INSERT 成功再推 WebSocket，因此「推送成功但查不到」
 * 不可能发生；反之「落库成功但推送失败」只表现为「在线用户收到的是补拉而非实时帧」，
 * 不丢消息（见 {@code NotificationDispatcher}）。</p>
 *
 * <p>逻辑删除：继承 {@link BaseEntity}，查询自动追加 {@code deleted = 0}。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_notify_message")
public class NotifyMessage extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /** 阅读状态：未读 */
    public static final int READ_UNREAD = 0;

    /** 阅读状态：已读 */
    public static final int READ_READ = 1;

    /** 接收人用户 ID（逻辑关联 sys_user）——未读 / 红点 / 会话分页的<b>唯一</b>查询维度 */
    private Long recipientUserId;

    /** 发送人用户 ID：系统通知为 null；会话消息为真实发送人（用于前端区分消息方向） */
    private Long senderUserId;

    /** 通知类型：见 {@code NotifyType}（1~5 系统通知 / 6~7 会话 / 8 业务提醒） */
    private Integer notifyType;

    /** 消息体类型：见 {@code MessageType}（0-非会话 1-文本 2-文件传输 3-审批结果） */
    private Integer messageType;

    /** 会话范围：见 {@code ChatScope}（1-单聊 2-群聊）；系统通知为 null */
    private Integer chatScope;

    /** 会话目标 ID：单聊=对端用户 ID；群聊=群组 ID；系统通知为 null */
    private Long chatTargetId;

    /**
     * 客户端消息 ID：会话消息幂等去重键。
     *
     * <p>唯一索引为 {@code (sender_user_id, recipient_user_id, client_msg_id)}——
     * 必须带 {@code recipient}：群聊一条消息按成员各落一行，这些行共享同一个
     * {@code clientMsgId}，若只按 {@code (sender, clientMsgId)} 唯一，群聊第 2 个成员就写不进去。
     * 系统通知三列均为 NULL，MySQL 唯一索引对含 NULL 的行不做重复判定，故互不影响。</p>
     */
    private String clientMsgId;

    /** 通知标题（≤128 字符） */
    private String title;

    /** 通知内容（纯文本，≤1000 字符；会话消息即消息正文） */
    private String content;

    /** 关联业务类型：APPLICATION / SHARE / SECURITY / TRANSFER */
    private String bizType;

    /** 关联业务 ID（申请单 / 链接 / 传输任务等） */
    private Long bizId;

    /** 阅读状态：0-未读 1-已读 */
    private Integer readStatus;

    /** 阅读时间 */
    private LocalDateTime readTime;

    /** 是否已被读取。 */
    public boolean isRead() {
        return readStatus != null && readStatus == READ_READ;
    }

    /** 是否未读。 */
    public boolean isUnread() {
        return !isRead();
    }
}
