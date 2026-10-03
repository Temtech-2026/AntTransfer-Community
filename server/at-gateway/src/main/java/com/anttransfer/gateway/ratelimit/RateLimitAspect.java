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
package com.anttransfer.gateway.ratelimit;

import com.anttransfer.common.constant.RedisKeyConstants;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.ratelimit.RateLimit;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;

/**
 * {@link RateLimit} 切面（骨架）：固定窗口 Redis 计数限流。
 *
 * <p>实现：Lua（INCR + 首增时 EXPIRE）保证计数与窗口计时原子；窗口内计数超过
 * {@code max} 抛 {@code BusinessException(RATE_LIMITED, 4290)} → 全局异常 → HTTP 429。
 * Redis 不可用 / 脚本异常时按「放行 + 告警」处理（限流属防御态，不允许拖垮业务，P-8 语义）。</p>
 *
 * <p>Key：{@code at:rl:{类}#{方法}[:业务key][:{维度}]}，维度默认客户端 IP；
 * 同一注解可在登录 / 验证码 / 分享等端点按业务 key 隔离窗口。</p>
 *
 * @author AntTransfer CE
 */
@Aspect
@Component
public class RateLimitAspect {

    private static final Logger log = LoggerFactory.getLogger(RateLimitAspect.class);

    private static final DefaultRedisScript<Long> INCR_WITH_EXPIRE = new DefaultRedisScript<>("""
            local current = redis.call('INCR', KEYS[1])
            if current == 1 then
                redis.call('EXPIRE', KEYS[1], ARGV[1])
            end
            return current
            """, Long.class);

    private final StringRedisTemplate redis;

    public RateLimitAspect(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /** 方法级声明 */
    @Around("@annotation(rateLimit)")
    public Object aroundMethod(ProceedingJoinPoint joinPoint, RateLimit rateLimit) throws Throwable {
        checkAndProceed(joinPoint, rateLimit);
        return joinPoint.proceed();
    }

    /** 类级声明（方法级声明存在时让位于方法级） */
    @Around("@within(rateLimit)")
    public Object aroundType(ProceedingJoinPoint joinPoint, RateLimit rateLimit) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        if (signature.getMethod().isAnnotationPresent(RateLimit.class)) {
            return joinPoint.proceed();
        }
        checkAndProceed(joinPoint, rateLimit);
        return joinPoint.proceed();
    }

    private void checkAndProceed(ProceedingJoinPoint joinPoint, RateLimit rateLimit) {
        if (rateLimit.max() <= 0) {
            return; // max<=0 视为不限制
        }
        String key = buildKey(joinPoint, rateLimit);
        try {
            Long count = redis.execute(
                    INCR_WITH_EXPIRE, List.of(key), String.valueOf(rateLimit.windowSeconds()));
            if (count != null && count > rateLimit.max()) {
                String message = rateLimit.message();
                throw new BusinessException(ErrorCode.RATE_LIMITED,
                        message == null || message.isBlank() ? ErrorCode.RATE_LIMITED.getMessage() : message);
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            // Redis 异常不阻断业务（防御态降级为放行），仅记录告警便于观测
            log.warn("限流执行异常（本次放行）: key={}", key, e);
        }
    }

    private String buildKey(ProceedingJoinPoint joinPoint, RateLimit rateLimit) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String target = signature.getDeclaringType().getSimpleName() + "#" + signature.getName();
        // Key 统一经 at-common 常量类生成，模块内禁止手拼（system-design §7.1）
        return RedisKeyConstants.rateLimitKey(target, rateLimit.key(), currentDimension());
    }

    /**
     * 限流维度：客户端 IP。
     *
     * <p><b>必须经 {@link ClientIpResolver}，不能直接取 {@code getRemoteAddr()}。</b>
     * 直接取会同时踩两个坑，且都很致命：</p>
     * <ul>
     *   <li><b>生产在 nginx 之后</b>（见 {@code deploy/nginx}），{@code remoteAddr} 是代理 IP，
     *       于是全站共用一个计数桶——正常用户互相挤爆，限流变成自我 DoS；</li>
     *   <li>改用 {@code X-Forwarded-For} 又走向另一极端：该头客户端完全可控，
     *       攻击者每次伪造一个新 IP 即可让 per-IP 限流形同虚设，还能把任意字符串
     *       注入 Redis 键空间。{@code ClientIpResolver} 同时解决两点——取反代链首跳，
     *       且只放行合法 IP 字面量，否则降级回 {@code remoteAddr}。</li>
     * </ul>
     *
     * <p>该解析口径与各域审计（{@code FileAuditLogger} 等）一致；三处若各记一个 IP，
     * 「限流把谁拦了」和「审计记的是谁」就对不上，事后无法复盘。</p>
     */
    private String currentDimension() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            HttpServletRequest request = attrs.getRequest();
            return ClientIpResolver.resolve(
                    request.getHeader(ClientIpResolver.HEADER_X_FORWARDED_FOR),
                    request.getHeader(ClientIpResolver.HEADER_X_REAL_IP),
                    request.getRemoteAddr());
        }
        return ClientIpResolver.UNKNOWN;
    }
}
