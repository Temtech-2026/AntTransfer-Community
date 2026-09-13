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

import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.service.FileNodeService;
import com.anttransfer.file.service.PackService;
import com.anttransfer.file.storage.BandwidthLimiter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * 文件域定时任务：回收站到期清理 + 限速桶空闲回收。
 *
 * <p>回收站清理分批循环而非一次性全量：每批一个独立事务（{@link FileNodeService#purgeExpiredRecycle}），
 * 避免清理大盘时出现长事务、长锁与磁盘 IO 尖峰。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FileCleanupScheduler {

    /** 单次触发的最大批次数，防止配置错误（如保留期设为 0）时无限循环 */
    private static final int MAX_ROUNDS = 100;

    /**
     * 空闲限速桶的保留时长：1 小时。
     *
     * <p>每条下载流都会以唯一 key 建桶（「任务级限速」的粒度就是一次传输），
     * 故桶数量随下载次数单调增长。不回收就是一条稳定的内存泄漏——桶本身极小，
     * 泄漏速度也慢，正因如此最容易被忽略到 OOM 才被发现。</p>
     */
    private static final long LIMITER_BUCKET_IDLE_MILLIS = TimeUnit.HOURS.toMillis(1);

    private final FileNodeService fileNodeService;
    private final PackService packService;
    private final FileProperties properties;
    private final BandwidthLimiter bandwidthLimiter;

    /**
     * 到期清理入口（默认每日 03:30，可由 {@code anttransfer.file.recycle-cleanup-cron} 覆盖）。
     */
    @Scheduled(cron = "${anttransfer.file.recycle-cleanup-cron:0 30 3 * * ?}")
    public void purgeExpiredRecycle() {
        int batchSize = Math.max(properties.getRecycleCleanupBatchSize(), 1);
        int total = 0;
        for (int round = 0; round < MAX_ROUNDS; round++) {
            int purged = fileNodeService.purgeExpiredRecycle();
            total += purged;
            if (purged < batchSize) {
                break;
            }
        }
        if (total > 0) {
            log.info("回收站到期清理完成：本轮共回收 {} 条", total);
        }
    }

    /**
     * 回收空闲限速桶（默认每小时第 40 分，可由 {@code antransfer.file.limiter-evict-cron} 覆盖）。
     *
     * <p>与回收站清理刻意错峰：两者都可能触发磁盘操作，同刻执行会让 IO 抖动叠加。</p>
     */
    @Scheduled(cron = "${anttransfer.file.limiter-evict-cron:0 40 * * * ?}")
    public void evictIdleLimiterBuckets() {
        int evicted = bandwidthLimiter.evictIdle(LIMITER_BUCKET_IDLE_MILLIS);
        if (evicted > 0) {
            log.debug("已回收空闲限速桶 {} 个", evicted);
        }
    }

    /**
     * 打包产物到期清理（默认每小时第 10 分，可由 {@code antransfer.file.pack-cleanup-cron} 覆盖）。
     *
     * <p>与回收站清理（每日 03:30）刻意分开：产物生命周期只有小时级，等不到第二天；
     * 而与限速桶回收（每小时第 40 分）错峰，避免同刻磁盘操作叠加。</p>
     */
    @Scheduled(cron = "${anttransfer.file.pack-cleanup-cron:0 10 * * * ?}")
    public void cleanupPackProducts() {
        int batchSize = Math.max(properties.getPackCleanupBatchSize(), 1);
        int total = 0;
        for (int round = 0; round < MAX_ROUNDS; round++) {
            int cleaned = packService.cleanupExpiredProducts();
            total += cleaned;
            if (cleaned < batchSize) {
                break;
            }
        }
        if (total > 0) {
            log.info("打包产物到期清理完成：本轮共清理 {} 个", total);
        }
    }

    /**
     * 僵尸打包任务收口（默认每小时第 20 分，可由 {@code antransfer.file.pack-stale-cron} 覆盖）。
     *
     * <p>线程池拒绝或进程重启会让任务永远停在「排队中」，并持续占用该用户的并发名额。
     * 这一步是名额泄漏的兜底：不指望它经常触发，一旦触发就必须把名额还回去。</p>
     */
    @Scheduled(cron = "${anttransfer.file.pack-stale-cron:0 20 * * * ?}")
    public void failStalePackTasks() {
        int failed = packService.failStaleTasks();
        if (failed > 0) {
            log.warn("打包僵尸任务收口完成：本轮判失败 {} 个", failed);
        }
    }
}
