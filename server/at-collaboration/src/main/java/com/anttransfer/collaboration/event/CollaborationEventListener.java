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
package com.anttransfer.collaboration.event;

import com.anttransfer.collaboration.model.vo.ChatProfileVO;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsFrame;
import com.anttransfer.collaboration.ws.WsProtocol;
import com.anttransfer.common.event.PermissionExpiredEvent;
import com.anttransfer.common.event.PermissionGrantEvent;
import com.anttransfer.common.event.TransferCompletedEvent;
import com.anttransfer.common.event.UserProfileChangedEvent;
import com.anttransfer.common.notify.NotificationCommand;
import com.anttransfer.common.notify.NotificationPort;
import com.anttransfer.common.notify.NotifyType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 跨模块事件 → 站内通知的转换器（事件侧消费入口）。
 *
 * <p><b>为什么用 {@link EventListener} 而不是 {@code @TransactionalEventListener}：</b>
 * 本模块消费的三个事件（{@link PermissionGrantEvent} / {@link PermissionExpiredEvent} /
 * {@link TransferCompletedEvent}）的发布点<b>都已经在 {@code afterCommit} 回调里</b>
 * （见各自 event 类注与 {@code PermissionGrantExpireScheduler}）。事件到达时事务已结束，
 * 若用 {@code @TransactionalEventListener(AFTER_COMMIT)} 且未设 {@code fallbackExecution=true}，
 * Spring 会发现「当前无事务」而<b>静默丢弃</b>该事件——通知永远不会发出，且不报任何错。
 * 用 {@code @EventListener} 语义直白：来了就处理，无事务时立即执行、有事务时随事务（更严格）。
 * 各 event 类 javadoc 中的 {@code @TransactionalEventListener} 示例在此修正为此用法。</p>
 *
 * <p><b>异常必须自吞：</b>监听器在业务线程（发布方的 afterCommit 阶段）同步执行，
 * 一旦抛出会污染发布方的事务完成流程（甚至让「已提交的业务」在调用方看来失败）。
 * 通知是派生副作用，失败只记 ERROR——权威幂等源在发布方，重新触发事件即可补发。</p>
 *
 * <p><b>幂等：</b>每条都先用 {@link NotificationPort#existsForBiz} 按
 * {@code bizType + bizId + notifyType} 判重。这既防「重复发布事件导致重复通知」，
 * 也让本监听器可与业务模块的<b>内联通知路径并存</b>：谁先发谁生效，另一条自动跳过。</p>
 *
 * <p><b>为什么必须用 {@code REQUIRES_NEW} 包一层：</b>事件是在发布方的 {@code afterCommit}
 * 里到达的，此时<b>外层事务已提交但连接仍绑定在线程上、事务同步仍然 active</b>。
 * 若直接调用 {@code @Transactional(REQUIRED)} 的通知分发器，Spring 会把它当作「加入既有事务」
 * ——而那个事务已经提交完了，通知的 INSERT 既不会被再次提交，也不会被回滚，
 * 表现为「接口正常返回、库里查不到通知」的静默丢数据。
 * {@code REQUIRES_NEW} 会先 suspend 掉这个已完成的事务（同时清理事务同步），
 * 再开一个全新事务，通知的落库与「提交后推送」才都能正常发生。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class CollaborationEventListener {

    private static final Logger log = LoggerFactory.getLogger(CollaborationEventListener.class);

    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final NotificationPort notificationPort;

    /**
     * 独立事务模板：提交后回调里唯一能安全开启新事务的方式（见类注）。
     * 不直接用 {@code @Transactional} 注解是因为它无法作用在「已提交事务的 afterCommit」这一时机上。
     */
    private final TransactionTemplate requiresNewTx;

    /**
     * WS 推送通道。用于把「用户资料变更」这类<b>不产生站内通知</b>的事件转成实时帧：
     * 换个头像不该在待办中心留下任何记录，但本人的其他在线端要立刻换图。
     */
    private final WsBroadcaster wsBroadcaster;

    public CollaborationEventListener(NotificationPort notificationPort,
                                      PlatformTransactionManager transactionManager,
                                      WsBroadcaster wsBroadcaster) {
        this.notificationPort = notificationPort;
        this.requiresNewTx = new TransactionTemplate(transactionManager);
        this.requiresNewTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.wsBroadcaster = wsBroadcaster;
    }

    /**
     * 授权下发（审批通过）→ 申请人「审批结果」通知。
     *
     * <p><b>定位为幂等兜底而非主路径：</b>审批通过的通知目前由 at-permission 在
     * 审批事务内内联发出（同事务，能带上申请单号，文案更完整）。本监听器只在其<b>缺席</b>时补发，
     * 覆盖两类场景：① 未来若按 architecture §4「D-1 纯事件总线」改造、业务模块不再内联发通知；
     * ② 内联通知因故未落库（如已发布事件但通知未提交）。正常路径下
     * {@code existsForBiz} 命中后直接返回，不产生重复待办。</p>
     *
     * <p>注意：本方法只处理<b>通过</b>；驳回不发布事件（无对应事件契约），
     * 其通知仍由 at-permission 内联发送。</p>
     */
    @EventListener
    public void onPermissionGranted(PermissionGrantEvent event) {
        if (event == null || event.userId() == null || event.applicationId() == null) {
            return;
        }
        try {
            requiresNewTx.executeWithoutResult(status -> {
                if (notificationPort.existsForBiz(NotificationCommand.BIZ_APPLICATION,
                        event.applicationId(), NotifyType.APPROVAL_RESULT)) {
                    log.debug("审批结果通知已存在，跳过兜底补发：applicationId={}", event.applicationId());
                    return;
                }
                notificationPort.send(new NotificationCommand(
                        event.userId(),
                        NotifyType.APPROVAL_RESULT,
                        "您的权限申请已通过",
                        "已通过（授权动作 " + event.grantType() + "，" + expireText(event.expireAt()) + "）",
                        NotificationCommand.BIZ_APPLICATION,
                        event.applicationId()));
            });
        } catch (Exception e) {
            log.error("授权下发事件转通知失败（不影响已提交的授权）：applicationId={}, userId={}, cause={}",
                    event.applicationId(), event.userId(), e.toString());
        }
    }

    /**
     * 传输完成 → 发起人「传输已完成」提醒（{@code notify_type=8}，纳入待办中心）。
     *
     * <p><b>本事件在 CE 的主路径已于 2026-09-29 打通</b>：at-transfer 在分片合并成功后
     * 经 {@code TransferEventPublisher} 发布（发布发生在 {@code transition} 事务提交之后，
     * 事件失败不回滚已落库的内容），本监听器随即补上通知与待办。此前的「契约与监听器先行就绪、
     * 发布方待补」悬空状态结束。</p>
     */
    @EventListener
    public void onTransferCompleted(TransferCompletedEvent event) {
        if (event == null || event.userId() == null || event.transferId() == null) {
            return;
        }
        try {
            requiresNewTx.executeWithoutResult(status -> {
                if (notificationPort.existsForBiz(NotificationCommand.BIZ_TRANSFER,
                        event.transferId(), NotifyType.TRANSFER_COMPLETED)) {
                    log.debug("传输完成提醒已存在，跳过重复发布：transferId={}", event.transferId());
                    return;
                }
                String summary = "文件「" + safe(event.fileName()) + "」（" + humanSize(event.fileSize())
                        + "）已完成传输";
                notificationPort.send(NotificationCommand.transferCompleted(
                        event.userId(), event.transferId(), summary));
            });
        } catch (Exception e) {
            log.error("传输完成事件转通知失败（不影响已提交的传输记录）：transferId={}, userId={}, cause={}",
                    event.transferId(), event.userId(), e.toString());
        }
    }

    /**
     * 授权到期回收 —— <b>CE 有意不转站内通知</b>（显式决策，非遗漏）。
     *
     * <p>原因：{@link NotifyType} 的编码分段是 US-08 的产品白名单
     * （1~5 系统通知、6~7 会话、8~9 业务提醒：8 传输完成、9 取件回执），
     * 其中<b>没有</b>「授权到期回收」的位置。
     * 若强行映射到 {@code APPROVAL_RESULT}(2)，会在待办中心出现一条语义错误的
     * 「审批结果」，比不发更糟（用户会以为审批状态变了）。</p>
     *
     * <p>该事件仍被发布且语义完整（载荷含资源 / 动作 / 回收时刻），回收动作本身已由
     * 定时任务落库并留审计；use-case-flows §2.1/§2.4 亦标注该通知为「可选」。
     * 若产品后续确认要通知，应<b>先扩 {@code notify_type} 编码表并同步 PRD §8 与
     * {@code docs/api} 文档</b>，再在此处补一行——属待登记的口径缺口，
     * 不应以「就近复用某个类型」的方式绕过。</p>
     *
     * <p>保留本监听器（而非不声明）是为了让代码里能看到这个决策，避免后来者以为是漏了。</p>
     */
    @EventListener
    public void onPermissionExpired(PermissionExpiredEvent event) {
        log.debug("授权到期回收事件不产生站内通知（notify_type 无对应段，属已登记的待定口径）：grantId={}, userId={}",
                event == null ? null : event.grantId(), event == null ? null : event.userId());
    }

    /**
     * 用户资料变更（换头像）→ {@code PROFILE} 实时帧。
     *
     * <p><b>为什么是「事件转帧」而不是写侧直接推：</b>见 {@link UserProfileChangedEvent}
     * 类注——头像写侧在 at-permission，WS 通道在 at-collaboration，两者不得互相编译期依赖。</p>
     *
     * <p><b>为什么这一条不走 {@link #requiresNewTx}：</b>本监听器<b>不写任何表</b>。头像
     * 已经在发布方的事务里落了库，这里只是把既成事实播出去；开新事务只会白占一个连接，
     * 还把一件已经提交的事重新塞进一个可以失败的事务边界里。需要独立事务的是
     * {@code notificationPort.send}（要写通知表）那几条路径，不是本条。</p>
     *
     * <p><b>推给谁：全员广播</b>（{@code broadcast}，投给所有在线连接）。
     * 理由是产品口径「头像一变，所有能看到它的地方立刻换图」：除了本人自己的多端，
     * 会话对端、群成员列表、用户管理列表也都在展示这个头像。收件人集合无法廉价算出——
     * 要精确匹配就得维护一张「谁在关注谁」的订阅表并让它与群成员关系变更保持同步；
     * 而本帧载荷只有 {@code userId + 头像直出地址}（后者本就是免登录可读的公开路径），
     * 全员广播的暴露面与「让对方直接访问这个 URL」完全相同。频率上换头像是低频人工动作，
     * 不构成放大。理由详见 {@link WsBroadcaster#broadcast} 与 {@link WsProtocol#TYPE_PROFILE}。</p>
     *
     * <p>异常必须自吞（与类注同因）：本方法在发布方的 {@code afterCommit} 阶段同步执行，
     * 抛出会把「已经提交成功的换头像」在调用方看来变成失败。</p>
     */
    @EventListener
    public void onUserProfileChanged(UserProfileChangedEvent event) {
        if (event == null || event.userId() == null) {
            return;
        }
        try {
            wsBroadcaster.broadcast(WsFrame.of(WsProtocol.TYPE_PROFILE,
                    new ChatProfileVO(event.userId(), event.avatarUrl())));
        } catch (Exception e) {
            log.error("资料变更帧广播失败（头像已落库，各端将退化为下次拉取时才刷新）：userId={}, cause={}",
                    event.userId(), e.toString());
        }
    }

    private static String expireText(LocalDateTime expireAt) {
        return expireAt == null ? "长期有效" : "有效期至 " + DATE_TIME.format(expireAt);
    }

    private static String safe(String text) {
        return text == null ? "未命名文件" : text;
    }

    /** 人类可读文件大小（仅用于文案展示）。 */
    private static String humanSize(Long bytes) {
        if (bytes == null || bytes < 0) {
            return "大小未知";
        }
        if (bytes < 1024) {
            return bytes + " B";
        }
        String[] units = {"KB", "MB", "GB", "TB"};
        double value = bytes;
        int unit = -1;
        do {
            value /= 1024;
            unit++;
        } while (value >= 1024 && unit < units.length - 1);
        return String.format("%.1f %s", value, units[unit]);
    }
}
