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
import com.anttransfer.common.constant.RedisKeyConstants;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * 登录防爆破（红队 [D-03] 落地）。
 *
 * <p>Redis 计数，语义：连续失败达到阈值（默认 5 次）即临时锁定一个锁定窗口
 * （默认 15 min）。窗口从第一次失败起算，窗口内继续失败会叠加计数；计数只增不减，
 * 登录成功即清零。属「防爆破加速态」，Redis 丢失仅放宽尝试窗口，无正确性风险
 * （P-8 / RedisKeyConstants 规约）。</p>
 *
 * @author AntTransfer CE
 */
@Service
public class LoginAttemptService {

    private final StringRedisTemplate redis;
    private final AuthProperties properties;

    public LoginAttemptService(StringRedisTemplate redis, AuthProperties properties) {
        this.redis = redis;
        this.properties = properties;
    }

    /**
     * 是否处于临时锁定中（失败计数 ≥ 阈值且窗口未过）。
     */
    public boolean isLocked(String username) {
        String value = redis.opsForValue().get(RedisKeyConstants.loginFailKey(username));
        if (value == null) {
            return false;
        }
        try {
            return Long.parseLong(value) >= properties.getLoginFailThreshold();
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /**
     * 记录一次失败；首次失败时启动锁定窗口计时。
     *
     * @return true 表示本次失败已达到锁定阈值
     */
    public boolean recordFailure(String username) {
        String key = RedisKeyConstants.loginFailKey(username);
        Long count = redis.opsForValue().increment(key);
        // 首次失败（新键）时设置窗口 TTL
        if (count != null && count == 1L) {
            redis.expire(key, Duration.ofMinutes(properties.getLoginLockDuration().toMinutes()));
        }
        return count != null && count >= properties.getLoginFailThreshold();
    }

    /**
     * 登录成功清零失败计数。
     */
    public void reset(String username) {
        redis.delete(RedisKeyConstants.loginFailKey(username));
    }

    /** 锁定时长（分钟），供提示文案使用 */
    public long lockMinutes() {
        return Math.max(1, properties.getLoginLockDuration().toMinutes());
    }
}
