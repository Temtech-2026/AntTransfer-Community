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
package com.anttransfer.collaboration.job;

import com.anttransfer.collaboration.config.NotifyProperties;
import com.anttransfer.collaboration.service.NotifyMessageService;
import com.anttransfer.common.constant.RedisKeyConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * 会话消息保留期清理：把超过保留期的会话消息物理删除。
 *
 * <p><b>为什么必须有它：</b>PRD §4 P1「站内轻 IM」对用户承诺的是「消息持久化
 * <b>≥ 30 天</b>」——这个「≥」是<b>下限</b>，不是「永久保留」。写扩散下每条群消息落 N 行，
 * 一个几百人的群日常对话就足以让 {@code sys_notify_message} 以每天数万行的速度增长，
 * 而此前没有任何机制回收：查询随表体积变慢、备份随表体积变大，最后在某个没人记得的凌晨
 * 把磁盘写满。也就是说，「保留期」不落地，等于把产品承诺里的「≥30 天」悄悄变成了「永久」——
 * 而永久是运维成本，不是产品功能。</p>
 *
 * <p><b>保留期下限保护：</b>配置低于 {@link NotifyProperties#MIN_MESSAGE_RETENTION_DAYS} 时
 * 按 30 天执行——「≥ 30 天」是对用户的产品承诺，不能让一次配置失误把它变成 1 天。
 * 钳制<b>刻意放在这里而不是配置类的 setter 里</b>，理由见
 * {@link NotifyProperties#messageRetentionDays}（让运维在配置文件里看到的数字与实际行为对得上）。</p>
 *
 * <p><b>只清会话消息：</b>收件箱通知的保留期涉及待办中心与审批留痕，属独立命题
 * （口径见 {@code V18} ③ 与 {@code NotifyMessageService} 类注），本任务不触碰。</p>
 *
 * <p><b>分批循环而非一次删完：</b>每批一个独立短事务（
 * {@link NotifyMessageService#purgeExpiredChatMessages}），避免清理大盘时出现长事务、
 * 长时间行锁与 binlog 尖峰。形态与 {@code FileCleanupScheduler} 同构。</p>
 *
 * <p><b>跨实例互斥：</b>{@code @Scheduled} 在各实例<b>各自</b>触发——定时注解本身不理解
 * 「这是集群任务」。多实例同刻进入时，删除虽然幂等（都只删超期行），但会造成 N 倍的
 * 行锁竞争与 binlog 写入，把一次后台清理放大成一次写抖动。故以 Redis 占位键
 * {@code at:chat:retention-lock} 做互斥，<b>抢不到即整轮跳过</b>——
 * 下一次触发在 24h 后，而清理本就是「追上增量」的兜底动作，跳过一轮没有代价。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChatRetentionScheduler {

    /**
     * 单次触发的最大批次数。
     *
     * <p>它防的是「配置写错导致无限循环」——例如保留期被设成 0（截止时刻 = 现在），
     * 此时几乎每一行都满足删除条件，若没有轮数上限，任务会一直删到表空。
     * 上限与批大小共同给出单次触发的删除上界：
     * {@code MAX_ROUNDS × message-cleanup-batch-size}（默认 100 × 1000 = 10 万行）。
     * 超出部分留给下一次触发（24h 后），因为积压到十万行的量级已经意味着
     * 「保留期刚被调小」这类一次性事件，分几天追平完全可接受。</p>
     */
    private static final int MAX_ROUNDS = 100;

    /**
     * 本实例标识，写入互斥键的值。
     *
     * <p>本任务<b>不释放锁</b>（理由见 {@link #acquireLock()}），故该值不参与
     * 「锁是否还属于我」的判定，只用于排查时回答「这轮是谁在跑」。</p>
     */
    private static final String OWNER = UUID.randomUUID().toString();

    private final NotifyMessageService notifyMessageService;
    private final NotifyProperties properties;
    private final StringRedisTemplate stringRedisTemplate;

    /**
     * 保留期清理入口（默认每日 04:20，可由
     * {@code anttransfer.collaboration.notify.message-cleanup-cron} 覆盖）。
     *
     * <p>与文件域清理（每日 03:30）刻意错开：两者都要写库 / 写盘，同刻执行只会让抖动叠加。
     * 选择凌晨而非整点，是为了避开「NTP 校时导致的整点任务聚集」。</p>
     */
    @Scheduled(cron = "${anttransfer.collaboration.notify.message-cleanup-cron:0 20 4 * * ?}")
    public void purgeExpiredChatMessages() {
        if (!acquireLock()) {
            log.debug("会话消息保留期清理已被其他实例接管（本轮跳过）");
            return;
        }
        int retentionDays = Math.max(properties.getMessageRetentionDays(),
                NotifyProperties.MIN_MESSAGE_RETENTION_DAYS);
        int batchSize = Math.max(properties.getMessageCleanupBatchSize(), 1);
        // 截止时刻只取一次：若在循环内逐批重算，「每批几百毫秒」的耗时会让后批的边界慢慢前移，
        // 同一轮清理删掉的时间范围就不可复现了（排查时无法回答「这轮到底清了哪一段」）
        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);

        int total = 0;
        for (int round = 0; round < MAX_ROUNDS; round++) {
            int purged = notifyMessageService.purgeExpiredChatMessages(cutoff, batchSize);
            total += purged;
            if (purged < batchSize) {
                // 本批没删满 = 超期数据已清空，无需再进下一轮
                break;
            }
        }
        if (total > 0) {
            log.info("会话消息保留期清理完成：保留 {} 天（截止 {}），本轮共删除 {} 行",
                    retentionDays, cutoff, total);
        }
    }

    /**
     * 抢本轮清理的执行权（SETNX + TTL）。
     *
     * <p><b>刻意不释放锁：</b>本任务每天只触发一次，而锁 TTL 只有 15 分钟——
     * 「抢到 → 执行完 → 释放」与「抢到 → 执行完 → 让它在 15 分钟后自然过期」
     * 对下一次触发（24h 后）完全没有区别，但后者避开了释放锁的固有难题：
     * 释放前必须先确认「锁还是我的」，而「读-比对-删」是非原子的读-改-写
     * （违反 P-6 规约），原子释放又要为这一处引入 Lua CAS——
     * 为一次每日兜底任务付这个复杂度并不划算。运维若需立刻重跑，
     * 删掉 {@code at:chat:retention-lock} 即可（这也是一个明确、可审计的手动动作）。</p>
     *
     * <p><b>Redis 不可用时放行</b>（与 {@code ShareExpireNotifyScheduler} 同一降级口径，P-8）：
     * 本锁只用来「避免重复劳动」，不是正确性闸门——删除按超期条件执行，天然幂等，
     * 多实例同时跑最坏是做了两遍同样的事；反过来，「因为拿不到锁就不清理」
     * 会让积压无上限增长，那才是真正不可接受的一侧。</p>
     *
     * @return 是否取得本轮执行权
     */
    private boolean acquireLock() {
        try {
            Boolean acquired = stringRedisTemplate.opsForValue().setIfAbsent(
                    RedisKeyConstants.CHAT_RETENTION_LOCK_KEY,
                    OWNER,
                    RedisKeyConstants.CHAT_RETENTION_LOCK_TTL_SECONDS,
                    TimeUnit.SECONDS);
            return Boolean.TRUE.equals(acquired);
        } catch (Exception e) {
            log.warn("会话消息保留期清理互斥占位失败（降级为放行执行）：cause={}", e.toString());
            return true;
        }
    }
}
