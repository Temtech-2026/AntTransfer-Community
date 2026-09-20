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
package com.anttransfer.auth.service;

import com.anttransfer.auth.config.AuthProperties;
import com.anttransfer.auth.model.entity.SysUser;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.common.constant.RedisKeyConstants;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.Optional;

/**
 * 令牌会话存储（Redis 白名单 / 纪元缓存 + DB 权威吊销）。
 *
 * <p>模型（对齐 system-design §2.1~2.3、RedisKeyConstants）：</p>
 * <ul>
 *     <li>{@code at:token:refresh:{userId}} —— refresh 白名单（每用户单值，值 = 最新 refresh 指纹），
 *         原子轮换 + 复用检测；</li>
 *     <li>{@code at:token:access:{userId}} —— 会话吊销纪元缓存（= sys_user.token_epoch 镜像），
 *         access 鉴权比对 {@code ver} claim；<b>权威在 DB</b>，缓存 miss 回源自愈（P-8）；</li>
 *     <li>全端吊销两条通道：{@link #revokeAll}（{@code REQUIRES_NEW}，登出 / refresh 重放打击）与
 *         {@link #revokeAllInCurrentTransaction}（并入调用方事务，系统管理面停用 / 重置口令 / 删除账号）；
 *         两者统一为「DB {@code token_epoch + 1} 是唯一权威，<b>提交后</b>清理两个 Redis 键」。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
public class TokenSessionService {

    /**
     * refresh 原子轮换 Lua：仅当白名单旧指纹与携带值一致才 SET 新指纹。
     * 返回 0 表示旧 refresh 已失效 / 已被使用过（复用打击通道），脚本内保证原子，防并发双刷。
     */
    private static final DefaultRedisScript<Long> ROTATE_REFRESH_SCRIPT = new DefaultRedisScript<>("""
            local current = redis.call('GET', KEYS[1])
            if current == false or current ~= ARGV[1] then
                return 0
            end
            redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
            return 1
            """, Long.class);

    private final StringRedisTemplate redis;
    private final UserMapper userMapper;
    private final AuthProperties properties;

    public TokenSessionService(StringRedisTemplate redis,
                               UserMapper userMapper,
                               AuthProperties properties) {
        this.redis = redis;
        this.userMapper = userMapper;
        this.properties = properties;
    }

    /* ============================ 建会话 ============================ */

    /**
     * 登录 / 刷新成功后建立（或顶替）会话：
     * refresh 白名单写入新指纹；纪元缓存写入当前 epoch。
     */
    public void openSession(Long userId, long epoch, String refreshFingerprint) {
        redis.opsForValue().set(
                RedisKeyConstants.refreshTokenKey(userId),
                refreshFingerprint,
                properties.getRefreshTokenTtl());
        redis.opsForValue().set(
                RedisKeyConstants.accessTokenKey(userId),
                String.valueOf(epoch),
                properties.getAccessTokenTtl());
    }

    /* ============================ 纪元比对 ============================ */

    /**
     * 读取当前会话纪元：优先 Redis 缓存，miss 回源 DB 并回填（Redis 抖动 / 清空不阻断鉴权，
     * 也不绕过吊销——DB 值已 +1 时比对必失败）。
     *
     * @return 空表示用户不存在 / 已删除（按吊销处理）
     */
    public Optional<Long> currentEpoch(Long userId) {
        String cached = redis.opsForValue().get(RedisKeyConstants.accessTokenKey(userId));
        if (cached != null) {
            return Optional.of(Long.parseLong(cached));
        }
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            return Optional.empty();
        }
        long epoch = user.getTokenEpoch() == null ? 0L : user.getTokenEpoch();
        redis.opsForValue().set(
                RedisKeyConstants.accessTokenKey(userId),
                String.valueOf(epoch),
                properties.getAccessTokenTtl());
        return Optional.of(epoch);
    }

    /* ============================ refresh 轮换 ============================ */

    /**
     * 原子轮换 refresh 白名单指纹。
     *
     * @return true 轮换成功；false 表示携带的旧指纹与白名单不符（已失效或疑似复用）
     */
    public boolean rotateRefresh(Long userId, String oldFingerprint, String newFingerprint) {
        Long result = redis.execute(
                ROTATE_REFRESH_SCRIPT,
                List.of(RedisKeyConstants.refreshTokenKey(userId)),
                oldFingerprint,
                newFingerprint,
                String.valueOf(properties.getRefreshTokenTtl().toSeconds()));
        return result != null && result == 1L;
    }

    /* ============================ 全端吊销 ============================ */

    /**
     * 全端吊销（登出 / refresh 重放打击）：
     * 独立事务（REQUIRES_NEW）内 DB {@code token_epoch+1}（唯一权威，先提交），
     * 事务提交后清理 Redis 两个键——即使外层随后抛出异常也不回滚吊销。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void revokeAll(Long userId) {
        if (userId == null) {
            return;
        }
        bumpEpochAndEvictAfterCommit(userId);
    }

    /**
     * 在<b>调用方事务内</b>全端吊销（系统管理面：停用账号 / 重置口令 / 删除账号）。
     *
     * <p><b>为什么不能复用 {@link #revokeAll}：</b>这些写操作已经在 at-permission 的
     * {@code @Transactional} 里<b>持锁</b>改写了同一行 {@code sys_user}；此处若再开
     * {@code REQUIRES_NEW} 新事务去写同一行，内层会去抢外层已持有的行锁，形成<b>自我等待</b>
     * 直至锁超时。因此纪元递增必须并入调用方事务（与业务写入同生共死），只把「清 Redis」
     * 推到提交之后。</p>
     *
     * <p><b>为什么必须「提交后」清：</b>{@code at:token:access:{userId}} 是纪元镜像且 miss 会回源回填；
     * 若在提交前清掉，并发请求回源时会读到<b>尚未提交的旧纪元</b>并把它写回缓存，
     * 吊销就被这层自愈回填抹掉了——停用要等缓存自然过期（最坏 access TTL 30 min）才生效。
     * 这正是 GAP-02「停用不即时吊销」的根因。</p>
     *
     * @throws org.springframework.transaction.IllegalTransactionStateException 调用方未开启事务
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void revokeAllInCurrentTransaction(Long userId) {
        if (userId == null) {
            return;
        }
        bumpEpochAndEvictAfterCommit(userId);
    }

    /**
     * DB {@code token_epoch+1}（唯一权威）并登记「提交后清理 Redis 两键」。
     *
     * <p>私有方法不参与事务代理，随调用方事务传播；{@code REQUIRES_NEW} 与 {@code MANDATORY}
     * 两条通道共用这段写库语义，避免两处实现漂移。</p>
     */
    private void bumpEpochAndEvictAfterCommit(Long userId) {
        int updated = userMapper.bumpTokenEpoch(userId);
        // 用户不存在 / 已删除时无历史会话可吊销，但仍清理缓存态，保持幂等
        if (updated == 0) {
            deleteSessionKeys(userId);
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            deleteSessionKeys(userId);
                        }
                    });
        } else {
            deleteSessionKeys(userId);
        }
    }

    private void deleteSessionKeys(Long userId) {
        try {
            redis.delete(List.of(
                    RedisKeyConstants.refreshTokenKey(userId),
                    RedisKeyConstants.accessTokenKey(userId)));
        } catch (RuntimeException ex) {
            // 清缓存是「加速失效」而非吊销本身：DB 纪元才是唯一权威，且此处必然在事务提交之后
            // （afterCommit），此刻业务已经落定。若让异常冒出去，用户会收到 500 却明明改成功了 /
            // 登出了。故只告警：鉴权侧回源自愈，最坏退化为 access TTL 窗口。
            log.warn("全端吊销清理 Redis 会话键失败，业务已提交，依赖纪元回源自愈：userId={}", userId, ex);
        }
    }
}
