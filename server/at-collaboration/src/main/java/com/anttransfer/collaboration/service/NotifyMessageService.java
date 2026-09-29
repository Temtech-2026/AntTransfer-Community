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
package com.anttransfer.collaboration.service;

import com.anttransfer.collaboration.config.NotifyProperties;
import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.anttransfer.collaboration.model.vo.ChatReadReceiptVO;
import com.anttransfer.collaboration.model.vo.ChatReaderVO;
import com.anttransfer.collaboration.model.vo.NotifyMessageVO;
import com.anttransfer.collaboration.model.vo.TodoItemVO;
import com.anttransfer.collaboration.model.vo.UnreadCountVO;
import com.anttransfer.collaboration.repository.ChatReadRow;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsFrame;
import com.anttransfer.collaboration.ws.WsProtocol;
import com.anttransfer.common.notify.ChatScope;
import com.anttransfer.common.notify.NotifyType;
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.security.UserLookupPort;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 通知 / 待办查询与已读服务。
 *
 * <p><b>三口径未读（见 {@link UnreadCountVO}）</b>由 {@code NotifyMessageMapper} 的三条
 * 独立 SQL 提供；本类负责组装快照，并在<b>任何已读状态变化后</b>把最新快照推给该用户的
 * 全部在线端——这是 US-08「在任意一端处理，另一端同步标记已处理」的落点：
 * 不在服务端推送状态，多端就会各自持有不同的未读数，直到刷新页面才对齐。</p>
 *
 * <p><b>离线补拉的边界（有意为之）：</b>补拉只覆盖「纯提醒」类系统通知
 * （外发链接锁定 / 到期 / 异常登录），<b>刻意排除待办三段</b>（待我审批 / 审批结果 / 传输完成）。
 * 原因：待办的「已读」必须由<b>处置动作</b>驱动（审批完成 / 用户点击已办），
 * 若被补拉自动置读，用户会在没处理的情况下失去待办，直接违反 US-08
 * 「When 我处理，Then 标记已处理，不产生重复待办」的反向语义——
 * 「未处理就消失了」比「多一条待办」严重得多。故补拉后仍保留待办红点，
 * 直至用户在待办中心显式处置。</p>
 *
 * @author AntTransfer CE
 */
@Service
public class NotifyMessageService {

    /** 纯提醒类系统通知（非待办段）：外发链接锁定 / 到期提醒 / 取件回执 / 异常登录告警 */
    private static final List<Integer> REMINDER_TYPES =
            List.of(NotifyType.SHARE_LOCKED, NotifyType.SHARE_EXPIRE_SOON,
                    NotifyType.SHARE_ACCESSED, NotifyType.ABNORMAL_LOGIN);

    /** 待办段：待我审批 / 审批结果 / 传输完成 */
    private static final List<Integer> TODO_TYPES =
            List.of(NotifyType.APPROVAL_TODO, NotifyType.APPROVAL_RESULT, NotifyType.TRANSFER_COMPLETED);

    /** 会话段：单聊 / 群聊 */
    private static final List<Integer> CHAT_TYPES =
            List.of(NotifyType.IM_PRIVATE, NotifyType.IM_GROUP);

    private final NotifyMessageMapper notifyMessageMapper;
    private final WsBroadcaster wsBroadcaster;
    private final AfterCommitExecutor afterCommitExecutor;
    private final NotifyProperties properties;
    private final UserLookupPort userLookupPort;

    public NotifyMessageService(NotifyMessageMapper notifyMessageMapper,
                               WsBroadcaster wsBroadcaster,
                               AfterCommitExecutor afterCommitExecutor,
                               NotifyProperties properties,
                               UserLookupPort userLookupPort) {
        this.notifyMessageMapper = notifyMessageMapper;
        this.wsBroadcaster = wsBroadcaster;
        this.afterCommitExecutor = afterCommitExecutor;
        this.properties = properties;
        this.userLookupPort = userLookupPort;
    }

    /**
     * 未读三口径快照（红点 / 待办 / 会话）。
     */
    public UnreadCountVO unreadCount(Long userId) {
        return new UnreadCountVO(
                notifyMessageMapper.countUnreadInbox(userId),
                notifyMessageMapper.countUnreadTodo(userId),
                notifyMessageMapper.countUnreadChat(userId));
    }

    /**
     * 站内通知收件箱分页（系统通知，含已读与未读，按时间倒序）。
     */
    public PageResult<NotifyMessageVO> pageInbox(Long userId, long current, long pageSize) {
        LambdaQueryWrapper<NotifyMessage> wrapper = Wrappers.lambdaQuery(NotifyMessage.class)
                .eq(NotifyMessage::getRecipientUserId, userId)
                .notIn(NotifyMessage::getNotifyType, CHAT_TYPES)
                .orderByDesc(NotifyMessage::getCreateTime);
        return toVOPage(notifyMessageMapper.selectPage(new Page<>(current, pageSize), wrapper));
    }

    /**
     * 待办中心分页。
     *
     * @param pending {@code true}=仅未办（默认），{@code false}=仅已办（历史），{@code null}=全部
     */
    public PageResult<TodoItemVO> pageTodo(Long userId, Boolean pending, long current, long pageSize) {
        LambdaQueryWrapper<NotifyMessage> wrapper = Wrappers.lambdaQuery(NotifyMessage.class)
                .eq(NotifyMessage::getRecipientUserId, userId)
                .in(NotifyMessage::getNotifyType, TODO_TYPES)
                .orderByDesc(NotifyMessage::getCreateTime);
        if (pending != null) {
            wrapper.eq(NotifyMessage::getReadStatus,
                    pending ? NotifyMessage.READ_UNREAD : NotifyMessage.READ_READ);
        }
        IPage<NotifyMessage> page = notifyMessageMapper.selectPage(new Page<>(current, pageSize), wrapper);
        List<TodoItemVO> records = page.getRecords().stream().map(TodoItemVO::from).toList();
        return PageResult.of(records, page.getTotal(), page.getCurrent(), page.getSize());
    }

    /**
     * 离线补拉：返回未读的「纯提醒」通知并把它们置为已读（清零这部分红点）。
     *
     * <p>按时间<b>升序</b>返回——补拉是「补上离线期间错过的消息」，应按发生顺序呈现；
     * 与列表页的倒序（最新在前）是两种不同的阅读场景。</p>
     *
     * <p>逐条 {@code markRead} 而非「一键全读」：返回值受 {@code limit} 截断时，
     * 只应把<b>实际返回</b>的这些置读，剩余未读留给下一次补拉（否则超过上限的消息
     * 会被静默吞掉——用户永远看不到）。</p>
     *
     * @param limit 期望条数（null / 越界时收敛到 {@code [1, offlinePullLimit]}）
     * @return 已补拉并置读的消息（升序）
     */
    @Transactional
    public List<NotifyMessageVO> pullOffline(Long userId, Integer limit) {
        int effective = normalizeLimit(limit);
        LambdaQueryWrapper<NotifyMessage> wrapper = Wrappers.lambdaQuery(NotifyMessage.class)
                .eq(NotifyMessage::getRecipientUserId, userId)
                .eq(NotifyMessage::getReadStatus, NotifyMessage.READ_UNREAD)
                .in(NotifyMessage::getNotifyType, REMINDER_TYPES)
                .orderByAsc(NotifyMessage::getCreateTime)
                .last("limit " + effective);
        List<NotifyMessage> messages = notifyMessageMapper.selectList(wrapper);

        LocalDateTime now = LocalDateTime.now();
        for (NotifyMessage message : messages) {
            notifyMessageMapper.markRead(message.getId(), userId, now);
            message.setReadStatus(NotifyMessage.READ_READ);
            message.setReadTime(now);
        }
        if (!messages.isEmpty()) {
            scheduleUnreadPush(userId);
        }
        return messages.stream().map(NotifyMessageVO::from).toList();
    }

    /**
     * 单条已读（行级归属校验：非本人消息受影响 0 行 → 返回 false，由 Controller 转 4040）。
     */
    @Transactional
    public boolean markRead(Long userId, Long id) {
        int affected = notifyMessageMapper.markRead(id, userId, LocalDateTime.now());
        if (affected > 0) {
            scheduleUnreadPush(userId);
            return true;
        }
        return false;
    }

    /**
     * 一键已读（清零系统通知红点，不动会话消息）。
     *
     * @return 受影响条数
     */
    @Transactional
    public int markAllInboxRead(Long userId) {
        int affected = notifyMessageMapper.markAllInboxRead(userId, LocalDateTime.now());
        if (affected > 0) {
            scheduleUnreadPush(userId);
        }
        return affected;
    }

    /**
     * 会话已读（进入会话即清该会话角标），并把「刚被读了哪些条」回推给各发送人。
     *
     * <p><b>为何先查后改：</b>{@code UPDATE} 只回受影响行数，而回执必须给出<b>具体哪几条</b>
     * 被读了（前端要按 {@code clientMsgId} 把头像补到对应气泡下）。故先用与 UPDATE
     * <b>完全相同的谓词</b>取一次快照，再执行翻转。两步之间的并发（同一用户多端同时进入会话）
     * 不影响结论：快照里的行在本次返回时确实处于已读态。</p>
     *
     * <p><b>快照只要一页的量：</b>回执帧是加速通道（真值在会话历史里），而读者刚进会话看的就是
     * 最新一屏，故按 {@code chat-history-limit} 截断——否则上千条未读会把推送体放大到几百 KB，
     * 而多出来的部分前端当前视口根本看不见。</p>
     *
     * @return 受影响条数
     */
    @Transactional
    public int markSessionRead(Long userId, int scope, Long targetId) {
        List<ChatReadRow> unreadRows = notifyMessageMapper.selectSessionUnreadRows(
                userId, scope, targetId, properties.getChatHistoryLimit());
        int affected = notifyMessageMapper.markSessionRead(userId, scope, targetId, LocalDateTime.now());
        if (affected > 0) {
            scheduleUnreadPush(userId);
            scheduleReadReceipts(userId, scope, targetId, unreadRows);
        }
        return affected;
    }

    /**
     * 保留期清理：物理删除早于 {@code cutoff} 的会话消息，单批最多 {@code batchSize} 行。
     *
     * <p><b>为什么放在 Service 而不是让调度器直接调 Mapper：</b>分层上，「清理是什么语义」
     * 属服务层（它与 {@code NotifyMessage} 的写扩散形态、逻辑删除口径强相关），
     * 而「什么时候清、循环几轮」属调度层。数据动作留在这里，调度层就只剩策略与日志，
     * 两边的改动不会互相牵连。</p>
     *
     * <p><b>刻意不加 {@code @Transactional}：</b>本方法是单条 DELETE，其自身即一个原子事务；
     * 外面再包一层只会把「每批一个短事务」变成「一个事务里连续多批」——那正是分批想要
     * 避免的长事务。故调用方（{@code ChatRetentionScheduler}）的循环外不得有事务上下文。</p>
     *
     * <p><b>不在这里钳制保留期下限：</b>下限是产品口径（{@code NotifyProperties}
     * 的 {@code MIN_MESSAGE_RETENTION_DAYS}），由调度层在算出 {@code cutoff} 之前统一应用，
     * 避免同一个 30 在两处各写一遍。</p>
     *
     * @param cutoff    保留期截止时刻（{@code create_time} 早于它的会话消息视为超期）
     * @param batchSize 单批删除行数上限（小于 1 时按 1 处理）
     * @return 实际删除行数；小于 {@code batchSize} 表示已无超期数据
     */
    public int purgeExpiredChatMessages(LocalDateTime cutoff, int batchSize) {
        return notifyMessageMapper.deleteExpiredChatMessages(cutoff, Math.max(batchSize, 1));
    }

    /**
     * 提交后推送未读快照到该用户全部在线端（跨实例）。
     */
    public void scheduleUnreadPush(Long userId) {
        afterCommitExecutor.run(() -> wsBroadcaster.push(userId,
                WsFrame.of(WsProtocol.TYPE_UNREAD, unreadCount(userId))));
    }

    /**
     * 提交后把已读回执按<b>发送人</b>归并推送。
     *
     * <p>归并维度是发送人而不是消息：一次置读通常跨多条消息，而每个发送人各有自己的会话窗口，
     * 「一位发送人一帧、帧内带他发的那几条」既省帧数，也让前端只需按 {@code clientMsgId} 就地打标。</p>
     *
     * <p><b>会话目标必须换算成发送人视角</b>：快照行的 {@code chat_target_id} 是接收人（读者）视角——单聊的
     * 镜像行 target 指向发送人自己（V5 注释 c）。单聊下发送人窗口的 target 是<b>读者本人</b>，
     * 群聊下两侧都是群 ID；照抄行里的 target 会让发送人用它对不上任何会话窗口，头像就永远不出现。</p>
     *
     * <p>读者与发送人同一个人时跳过：自己的行落库即已读，本不会进入未读快照，
     * 这里再挡一次——免得将来置读口径改动后，给自己推「你读了你自己的消息」。</p>
     */
    private void scheduleReadReceipts(Long readerId, int scope, Long targetId, List<ChatReadRow> unreadRows) {
        Map<Long, List<String>> clientMsgIdsBySender = new LinkedHashMap<>();
        for (ChatReadRow row : unreadRows) {
            Long senderId = row.getSenderUserId();
            if (senderId == null || row.getClientMsgId() == null || senderId.equals(readerId)) {
                continue;
            }
            clientMsgIdsBySender.computeIfAbsent(senderId, key -> new ArrayList<>())
                    .add(row.getClientMsgId());
        }
        if (clientMsgIdsBySender.isEmpty()) {
            return;
        }
        ChatReaderVO reader = loadReader(readerId);
        if (reader == null) {
            // 读者已不在用户目录：气泡下画不出可辨识的头像，推过去也只是个无名头像，不如不推（事实仍留在库里）
            return;
        }
        Long senderViewTargetId = ChatScope.isGroup(scope) ? targetId : readerId;
        clientMsgIdsBySender.forEach((senderId, clientMsgIds) -> afterCommitExecutor.run(
                () -> wsBroadcaster.push(senderId, WsFrame.of(WsProtocol.TYPE_CHAT_READ,
                        new ChatReadReceiptVO(scope, senderViewTargetId, reader, List.copyOf(clientMsgIds))))));
    }

    /**
     * 取读者展示名（反查不到说明账号已不在用户目录）。
     */
    private ChatReaderVO loadReader(Long userId) {
        UserLookupPort.UserContact contact = userLookupPort.findContacts(List.of(userId)).get(userId);
        return contact == null
                ? null
                : new ChatReaderVO(contact.userId(), contact.displayName(), contact.avatarUrl());
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return properties.getOfflinePullLimit();
        }
        return Math.min(limit, properties.getOfflinePullLimit());
    }

    private PageResult<NotifyMessageVO> toVOPage(IPage<NotifyMessage> page) {
        List<NotifyMessageVO> records = page.getRecords().stream().map(NotifyMessageVO::from).toList();
        return PageResult.of(records, page.getTotal(), page.getCurrent(), page.getSize());
    }
}
