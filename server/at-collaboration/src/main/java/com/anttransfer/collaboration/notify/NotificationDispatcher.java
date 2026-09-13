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
package com.anttransfer.collaboration.notify;

import com.anttransfer.collaboration.config.NotifyProperties;
import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.anttransfer.collaboration.model.vo.NotifyMessageVO;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsFrame;
import com.anttransfer.collaboration.ws.WsProtocol;
import com.anttransfer.common.notify.MessageType;
import com.anttransfer.common.notify.NotificationCommand;
import com.anttransfer.common.notify.NotificationPort;
import com.anttransfer.common.notify.NotifyType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * {@link NotificationPort} 的唯一实现：通知域的编排中枢。
 *
 * <p><b>固定顺序（不可调换）：</b></p>
 * <ol>
 *     <li><b>落库</b>——经持久渠道（{@link InboxNotifier}）写 {@code sys_notify_message}，
 *         与调用方同事务。这一步完成前不产生任何外部可见副作用；</li>
 *     <li><b>提交后推送</b>——注册 {@code afterCommit}，事务提交才广播 WebSocket 帧；</li>
 *     <li><b>提交后旁路渠道</b>——邮件等 P1 渠道同样在提交后执行，且逐个 try/catch 隔离。</li>
 * </ol>
 *
 * <p><b>为什么推送放在提交后：</b>见 {@link AfterCommitExecutor}——事务回滚而消息已推送，
 * 就是「用户看到通知、刷新后消息消失」的幻影消息。落库先行 + 提交后推送把
 * 「可查性」与「实时性」拆开：库里有 = 一定可查，推送成功只是更快到达。</p>
 *
 * <p><b>失败语义（与 {@link NotificationPort} 契约一致）：</b>落库失败<b>向上抛</b>
 * （由调用方事务决策，不静默丢通知）；推送失败<b>吞掉并 WARN</b>（消息已在库，
 * 在线用户退化为下次连接补拉）；旁路渠道失败<b>吞掉并 WARN</b>（附加通道不该影响主流程）。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class NotificationDispatcher implements NotificationPort {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);

    /** 持久化渠道（恰一个）——消息落库的权威写入方 */
    private final Notifier persistentNotifier;

    /** 旁路渠道（邮件 / 短信…，可 0~N 个） */
    private final List<Notifier> extraNotifiers;

    private final NotifyMessageMapper notifyMessageMapper;
    private final AfterCommitExecutor afterCommitExecutor;
    private final WsBroadcaster wsBroadcaster;
    private final NotifyProperties properties;

    public NotificationDispatcher(List<Notifier> notifiers,
                                  NotifyMessageMapper notifyMessageMapper,
                                  AfterCommitExecutor afterCommitExecutor,
                                  WsBroadcaster wsBroadcaster,
                                  NotifyProperties properties) {
        List<Notifier> persistent = notifiers.stream().filter(Notifier::persistent).toList();
        // 启动即失败快照：持久渠道 0 个 = 通知永远查不到；≥2 个 = 同一消息重复落库。
        // 这是「装配期错误」，让它炸在启动而不是运行时静默出错。
        if (persistent.size() != 1) {
            throw new IllegalStateException(
                    "通知持久渠道必须恰好一个，实际 " + persistent.size() + " 个："
                            + persistent.stream().map(Notifier::channel).toList());
        }
        this.persistentNotifier = persistent.get(0);
        this.extraNotifiers = notifiers.stream().filter(n -> !n.persistent()).toList();
        this.notifyMessageMapper = notifyMessageMapper;
        this.afterCommitExecutor = afterCommitExecutor;
        this.wsBroadcaster = wsBroadcaster;
        this.properties = properties;
        log.info("通知渠道装配完成：持久={}, 旁路={}", persistentNotifier.channel(),
                extraNotifiers.stream().map(Notifier::channel).toList());
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public Long send(NotificationCommand command) {
        NotifyMessage message = persist(command);
        if (message == null) {
            return null;
        }
        scheduleAfterCommit(message);
        return message.getId();
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public List<Long> sendAll(Collection<NotificationCommand> commands) {
        if (commands == null || commands.isEmpty()) {
            return List.of();
        }
        List<Long> ids = new ArrayList<>(commands.size());
        for (NotificationCommand command : commands) {
            try {
                NotifyMessage message = persist(command);
                if (message != null) {
                    scheduleAfterCommit(message);
                    ids.add(message.getId());
                }
            } catch (Exception e) {
                // 逐条隔离：一条落库失败不应让同批其他接收人收不到通知。
                // 注意：本方法参与外层事务，DB 层失败（如约束冲突）在 MySQL 下不中止事务，
                // 因此批量语义成立；若未来迁移到「语句失败即中止事务」的数据库，需改为逐条独立事务。
                log.warn("批量通知中单条落库失败，已跳过：recipient={}, type={}, cause={}",
                        command == null ? null : command.recipientUserId(),
                        command == null ? null : command.notifyType(),
                        e.getMessage());
            }
        }
        return ids;
    }

    @Override
    public long unreadCount(long userId) {
        return notifyMessageMapper.countUnreadInbox(userId);
    }

    @Override
    public boolean existsForBiz(String bizType, Long bizId, int notifyType) {
        if (bizType == null || bizId == null || !NotifyType.isValid(notifyType)) {
            // 缺任一维度都无法构成幂等键，按「未发过」处理由调用方自行决定
            return false;
        }
        return notifyMessageMapper.countByBiz(bizType, bizId, notifyType) > 0;
    }

    /**
     * 校验并落库，返回带 ID 的实体；入参非法时按契约返回 {@code null}（跳过并告警）。
     */
    private NotifyMessage persist(NotificationCommand command) {
        if (command == null || command.recipientUserId() == null) {
            log.warn("通知接收人为空，已跳过：type={}, bizType={}, bizId={}",
                    command == null ? null : command.notifyType(),
                    command == null ? null : command.bizType(),
                    command == null ? null : command.bizId());
            return null;
        }
        int notifyType = command.notifyType();
        if (!NotifyType.isValid(notifyType) || NotifyType.isChat(notifyType)) {
            // NotificationPort 只承载「系统通知」；会话消息（6/7）必须走 ChatService，
            // 否则会绕过群成员校验与写扩散逻辑，造成收件人不一致的脏数据。
            log.warn("通知类型非法或属会话段，已跳过：recipient={}, type={}",
                    command.recipientUserId(), notifyType);
            return null;
        }
        NotifyMessage message = new NotifyMessage();
        message.setRecipientUserId(command.recipientUserId());
        message.setNotifyType(notifyType);
        message.setMessageType(MessageType.SYSTEM);
        message.setTitle(truncate(command.title(), properties.getTitleMaxLength()));
        message.setContent(truncate(command.content(), properties.getContentMaxLength()));
        message.setBizType(command.bizType());
        message.setBizId(command.bizId());
        message.setReadStatus(NotifyMessage.READ_UNREAD);
        persistentNotifier.send(message);
        return message;
    }

    /** 注册「提交后」动作：先推 WebSocket（实时），再走旁路渠道（邮件等）。 */
    private void scheduleAfterCommit(NotifyMessage message) {
        afterCommitExecutor.run(() -> {
            pushRealtime(message);
            dispatchExtraChannels(message);
        });
    }

    private void pushRealtime(NotifyMessage message) {
        wsBroadcaster.push(message.getRecipientUserId(),
                WsFrame.of(WsProtocol.TYPE_NOTIFY, NotifyMessageVO.from(message)));
    }

    private void dispatchExtraChannels(NotifyMessage message) {
        for (Notifier notifier : extraNotifiers) {
            try {
                notifier.send(message);
            } catch (Exception e) {
                // 旁路渠道是尽力而为：邮件服务器抖动绝不能让已提交的业务异常外溢
                log.warn("旁路通知渠道失败（不影响站内信）：channel={}, recipient={}, cause={}",
                        notifier.channel(), message.getRecipientUserId(), e.getMessage());
            }
        }
    }

    /** 超长截断（列有长度上限，宁可截断也不让整条通知因一个字段超长而丢）。 */
    private static String truncate(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max);
    }
}
