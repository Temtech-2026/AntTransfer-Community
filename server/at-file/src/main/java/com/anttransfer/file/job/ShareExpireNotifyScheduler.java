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
package com.anttransfer.file.job;

import com.anttransfer.common.constant.RedisKeyConstants;
import com.anttransfer.common.notify.NotificationCommand;
import com.anttransfer.common.notify.NotificationPort;
import com.anttransfer.common.notify.NotifyType;
import com.anttransfer.file.config.ShareProperties;
import com.anttransfer.file.model.entity.FileObject;
import com.anttransfer.file.model.entity.ShareLink;
import com.anttransfer.file.repository.FileObjectMapper;
import com.anttransfer.file.repository.ShareLinkMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 外发链接「到期前提醒」定时任务。
 *
 * <p><b>为什么必须有它</b>：链接到期是<b>静默失效</b>——在访客撞上 4004 之前，
 * 创建者收不到任何信号。事后提醒（已过期）几乎没有可操作价值，真正有用的是到期前提醒；
 * 而到期时刻在创建时就已确定，那一刻不会有任何请求触达服务端，
 * 因此这个信号只能由扫描任务产生。</p>
 *
 * <p><b>幂等三层（宁重勿漏，但尽量避免重）</b>：
 * ① Redis 占位键 {@code at:share:expire-notify:{shareId}}（SETNX + TTL）——防并发与跨周期重复；
 * ② 发送失败<b>释放占位键</b>，让下一轮能重试（只前置占位不补偿，就会在 DB 抖动时静默漏掉提醒）；
 * ③ {@link NotificationPort#existsForBiz} 兜底——Redis 不可用（P-8 降级）时仍能靠落库事实抑制重复。</p>
 *
 * <p><b>只提醒一次，而不是每个周期提醒</b>：窗口内提醒一次已给出全部可操作信息（重新创建 / 提前取件），
 * 反复提醒同一件没有新信息的事只会训练用户忽略提醒——这与「取件回执每次必发」的口径不同，
 * 因为取件回执每次都是新事实。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ShareExpireNotifyScheduler {

    /** 提醒文案里的到期时刻格式（用户可见，与前端展示口径一致：精确到分钟） */
    private static final DateTimeFormatter EXPIRE_AT_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ShareLinkMapper shareLinkMapper;
    private final FileObjectMapper fileObjectMapper;
    private final ShareProperties shareProperties;
    private final NotificationPort notificationPort;
    private final StringRedisTemplate stringRedisTemplate;

    /**
     * 到期前提醒入口（默认每小时第 25 分，可由 {@code anttransfer.file.share.expire-notify-cron} 覆盖）。
     *
     * <p>与 at-file 其它任务刻意错峰（文件域清理在第 10 / 20 / 40 分）：本任务的成本主要在
     * 通知落库与推送，与磁盘清理同刻执行只会让抖动叠加。</p>
     */
    @Scheduled(cron = "${anttransfer.file.share.expire-notify-cron:0 25 * * * ?}")
    public void notifyExpiringSoon() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime deadline = now.plus(shareProperties.getExpireSoonWindow());
        int batch = Math.max(shareProperties.getExpireNotifyBatchSize(), 1);

        List<ShareLink> candidates;
        try {
            candidates = shareLinkMapper.selectExpiringActive(now, deadline, batch);
        } catch (Exception e) {
            // 扫描失败即本轮跳过：下个周期会重新扫到同一批（提醒尚未落库，不会漏）
            log.error("外发链接到期提醒扫描失败（本轮跳过，下轮重试）：cause={}", e.toString());
            return;
        }
        if (candidates.isEmpty()) {
            return;
        }

        int notified = 0;
        for (ShareLink link : candidates) {
            try {
                if (notifyOnce(link)) {
                    notified++;
                }
            } catch (Exception e) {
                // 单条失败不中断整批：否则一条脏数据会让后面所有链接都收不到提醒
                log.warn("外发链接到期提醒单条失败（跳过继续）：shareId={}, cause={}",
                        link.getId(), e.toString());
            }
        }
        if (notified > 0) {
            log.info("外发链接到期提醒完成：本轮命中 {} 条候选，实际提醒 {} 条（窗口 {}）",
                    candidates.size(), notified, shareProperties.getExpireSoonWindow());
        }
    }

    /** 单条链接的提醒流程：落库兜底 → 占位 → 发送 → 失败补偿。 */
    private boolean notifyOnce(ShareLink link) {
        if (link.getId() == null || link.getOwnerUserId() == null) {
            // 无归属（历史脏数据）→ 无人可提醒，占位无意义
            return false;
        }
        if (notificationPort.existsForBiz(NotificationCommand.BIZ_SHARE, link.getId(),
                NotifyType.SHARE_EXPIRE_SOON)) {
            // 落库事实已在（覆盖 Redis 键丢失 / 前一轮已发但键过期的情形）→ 不再打扰
            return false;
        }

        String key = RedisKeyConstants.SHARE_EXPIRE_NOTIFY_PREFIX + link.getId();
        if (!tryMarkNotified(key)) {
            return false;
        }
        try {
            if (sendExpireSoon(link)) {
                return true;
            }
        } catch (Exception e) {
            // send 抛异常（落库失败等）与返回 null 语义相同——本轮没发出去；必须走同一释放路径，
            // 否则「占位成功 + 抛异常」会让该链接在幂等窗口（默认 7d）内永远抢不到占位，
            // 提醒被静默漏掉——正是本类注释所承诺要避免的那种漏。
            log.warn("到期提醒发送异常（释放占位待下轮重试）：shareId={}, cause={}", link.getId(), e.toString());
        }
        releaseMark(key);
        return false;
    }

    /** 发送「即将到期」提醒；返回是否落库成功（{@code send} 返回消息 ID 即视为成功）。 */
    private boolean sendExpireSoon(ShareLink link) {
        Long messageId = notificationPort.send(NotificationCommand.shareExpireSoon(
                link.getOwnerUserId(),
                link.getId(),
                resolveFileName(link.getFileId()),
                link.getExpireAt() == null ? "未知时间" : link.getExpireAt().format(EXPIRE_AT_FORMAT)));
        return messageId != null;
    }

    /** 回源文件名（提醒里带文件名，创建者才能一眼判断是哪条分享）。 */
    private String resolveFileName(Long fileId) {
        if (fileId == null) {
            return null;
        }
        try {
            FileObject file = fileObjectMapper.selectById(fileId);
            return file == null ? null : file.getOriginalName();
        } catch (Exception e) {
            log.warn("到期提醒回源文件名失败（降级为无文件名文案）：fileId={}", fileId, e);
            return null;
        }
    }

    /**
     * 占位（SETNX + TTL）。Redis 不可用时放行——本方法的返回值只用于「是否抢到占位」，
     * 真正防重复的兜底是 {@link NotificationPort#existsForBiz}（P-8：降级只降速不失准）。
     */
    private boolean tryMarkNotified(String key) {
        try {
            Boolean marked = stringRedisTemplate.opsForValue()
                    .setIfAbsent(key, "1", shareProperties.getExpireNotifyIdempotentWindow());
            return Boolean.TRUE.equals(marked);
        } catch (Exception e) {
            log.warn("到期提醒幂等占位失败，降级为落库兜底判定：key={}", key, e);
            return true;
        }
    }

    /** 发送失败时释放占位，让下个周期能重试（避免「占位成功 + 发送失败 = 永久漏提醒」）。 */
    private void releaseMark(String key) {
        try {
            stringRedisTemplate.delete(key);
        } catch (Exception e) {
            log.warn("到期提醒幂等占位释放失败（最坏结果：本链接在幂等窗口内不再重试）：key={}", key, e);
        }
    }
}
