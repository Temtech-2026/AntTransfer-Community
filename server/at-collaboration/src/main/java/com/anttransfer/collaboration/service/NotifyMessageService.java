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
import com.anttransfer.collaboration.model.vo.NotifyMessageVO;
import com.anttransfer.collaboration.model.vo.TodoItemVO;
import com.anttransfer.collaboration.model.vo.UnreadCountVO;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsFrame;
import com.anttransfer.collaboration.ws.WsProtocol;
import com.anttransfer.common.notify.NotifyType;
import com.anttransfer.common.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

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

    /** 纯提醒类系统通知（非待办段）：外发链接锁定 / 到期提醒 / 异常登录告警 */
    private static final List<Integer> REMINDER_TYPES =
            List.of(NotifyType.SHARE_LOCKED, NotifyType.SHARE_EXPIRE_SOON, NotifyType.ABNORMAL_LOGIN);

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

    public NotifyMessageService(NotifyMessageMapper notifyMessageMapper,
                                WsBroadcaster wsBroadcaster,
                                AfterCommitExecutor afterCommitExecutor,
                                NotifyProperties properties) {
        this.notifyMessageMapper = notifyMessageMapper;
        this.wsBroadcaster = wsBroadcaster;
        this.afterCommitExecutor = afterCommitExecutor;
        this.properties = properties;
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
     * 会话已读（进入会话即清该会话角标）。
     *
     * @return 受影响条数
     */
    @Transactional
    public int markSessionRead(Long userId, int scope, Long targetId) {
        int affected = notifyMessageMapper.markSessionRead(userId, scope, targetId, LocalDateTime.now());
        if (affected > 0) {
            scheduleUnreadPush(userId);
        }
        return affected;
    }

    /**
     * 提交后推送未读快照到该用户全部在线端（跨实例）。
     */
    public void scheduleUnreadPush(Long userId) {
        afterCommitExecutor.run(() -> wsBroadcaster.push(userId,
                WsFrame.of(WsProtocol.TYPE_UNREAD, unreadCount(userId))));
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
