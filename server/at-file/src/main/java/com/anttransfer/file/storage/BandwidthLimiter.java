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
package com.anttransfer.file.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * 速率限制器：按维度对「传输节奏」做匀速放行（漏桶）。
 *
 * <p><b>为什么是阻塞放行而不是拒绝：</b>限速作用在已经开始传输的流上。此时响应头早已发出，
 * 没有任何办法再回头告诉客户端「你超限了」——只能选择「慢一点发」或「掐断连接」。
 * 掐断会让用户拿到半截文件且无法续传，体验远差于慢速下完。真正该拒绝的场景是<b>还没开始</b>
 * 传输的准入判定（如打包任务创建），那一层交给 4103/4019。</p>
 *
 * <p><b>两个维度同时生效：</b>任务级（{@code pack:{taskId}}）决定「这一条流多快」，
 * 全局（{@code global}）决定「所有流加起来多快」。调用方对两者各调一次，
 * 顺序上先任务后全局——这样全局桶的等待时间不会被单任务的长等待挤占。</p>
 *
 * <p><b>多实例局限：</b>桶在进程内存中，故集群下「全局限速」实为「每实例各自限速」。
 * CE 是单实例部署，此处不引入 Redis 协调（会带来每块一次网络往返，得不偿失）；
 * 若未来横向扩展，需把全局桶换成 Redis 令牌桶，届时本类的 {@code acquire} 签名不变。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
public class BandwidthLimiter {

    /** 单次睡眠上限：把长等待切成小步，保证线程中断能及时响应，也避免 sleep 精度漂移累积 */
    private static final long MAX_SLEEP_NANOS = TimeUnit.MILLISECONDS.toNanos(200);

    /** 各维度的漏桶 */
    private final Map<String, LeakyBucket> buckets = new ConcurrentHashMap<>();

    /**
     * 按速率放行指定字节数；本方法会阻塞到「按该速率发完这些字节」的时刻。
     *
     * @param key           限速维度（如 {@code pack:123} / {@code global}）
     * @param bytesPerSecond 速率上限（字节/秒）；{@code <= 0} 表示不限速，立即返回
     * @param bytes         本次待发送字节数
     * @throws InterruptedException 线程在等待中被中断（调用方应中止传输并让出连接）
     */
    public void acquire(String key, long bytesPerSecond, long bytes) throws InterruptedException {
        if (bytesPerSecond <= 0L || bytes <= 0L) {
            return;
        }
        LeakyBucket bucket = buckets.computeIfAbsent(key, k -> new LeakyBucket());
        long waitNanos = bucket.reserve(bytesPerSecond, bytes);
        while (waitNanos > 0) {
            long step = Math.min(waitNanos, MAX_SLEEP_NANOS);
            TimeUnit.NANOSECONDS.sleep(step);
            waitNanos -= step;
        }
    }

    /**
     * 清理空闲桶，防止 key 无限增长（每个上传 / 下载任务都会产生一个 key）。
     *
     * <p>由定时任务调用；被清掉的桶只影响「匀速基线」，下一块会以当前时刻为新起点，
     * 短暂允许一点突发，不会造成数据问题。</p>
     *
     * @param idleMillis 超过该空闲时长的桶将被移除
     * @return 清理数量
     */
    public int evictIdle(long idleMillis) {
        long deadline = System.currentTimeMillis() - idleMillis;
        int before = buckets.size();
        buckets.entrySet().removeIf(e -> e.getValue().lastTouchedMillis() < deadline);
        return before - buckets.size();
    }

    /**
     * 漏桶：维护「下一次可发送时刻」，请求进来时按速率把该时刻往后推，并返回需要等待的时长。
     *
     * <p>实现成「预约式」而非「令牌式」，是因为传输侧天然是「按块发送」的循环：
     * 预约式只需一次加减法和一次 sleep，没有后台补充线程，也不会因为长时间无流量而空转。</p>
     */
    private static final class LeakyBucket {

        /** 下一次可发送时刻（纳秒，相对 {@link System#nanoTime()}） */
        private long nextFreeNanos;

        /** 最近一次被触碰的墙钟时间（毫秒），仅供空闲清理判断 */
        private long lastTouched = System.currentTimeMillis();

        /**
         * 预约发送 {@code bytes} 字节所需的等待时长。
         *
         * @return 需要等待的纳秒数（0 表示可立即发送）
         */
        synchronized long reserve(long bytesPerSecond, long bytes) {
            long now = System.nanoTime();
            lastTouched = System.currentTimeMillis();
            // 长时间空闲后不应「攒下」额度：基线过期即重置为当下，否则空闲越久突发越大
            if (nextFreeNanos < now) {
                nextFreeNanos = now;
            }
            // 用 double 累加避免整数除法把不足 1 纳秒的额度抹成 0（低速限速下会直接失效）
            long costNanos = (long) (bytes * 1_000_000_000.0d / bytesPerSecond);
            nextFreeNanos += Math.max(costNanos, 1L);
            return nextFreeNanos - now;
        }

        synchronized long lastTouchedMillis() {
            return lastTouched;
        }
    }
}
