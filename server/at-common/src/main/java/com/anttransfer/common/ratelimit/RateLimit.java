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
package com.anttransfer.common.ratelimit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 接口级限流注解（骨架）：固定窗口 + Redis 原子计数（INCR + EXPIRE）。
 *
 * <p>标注在 Controller 方法或类上，由 at-gateway 的 {@code RateLimitAspect} 执行：
 * 同一窗口内计数超过 {@link #max()} 即抛 {@code BusinessException(RATE_LIMITED, 4290)}，
 * 经全局异常处理统一返回 HTTP 429（前端策略 G：退避重试）。</p>
 *
 * <p>用法：</p>
 * <pre>{@code
 *   @RateLimit(windowSeconds = 60, max = 5, message = "获取验证码过于频繁")
 *   @PostMapping("/captcha") ...
 * }</pre>
 *
 * @author AntTransfer CE
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RateLimit {

    /**
     * 限流窗口长度（秒）。
     */
    long windowSeconds() default 60;

    /**
     * 窗口内允许的最大请求次数。
     */
    long max() default 60;

    /**
     * 可选：业务维度（如 login、captcha），拼入 Redis key，用于区分不同限流维度。
     */
    String key() default "";

    /**
     * 超限提示文案；为空使用错误码默认文案。
     */
    String message() default "";
}
