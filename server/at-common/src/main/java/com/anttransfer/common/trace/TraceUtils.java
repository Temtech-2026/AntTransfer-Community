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
package com.anttransfer.common.trace;

import org.slf4j.MDC;

import java.util.UUID;

/**
 * 链路追踪工具。
 *
 * <p>职责：提供基于 {@link ThreadLocal} + SLF4J MDC 的 traceId 存取能力。</p>
 * <ul>
 *     <li>at-gateway 的 {@code TraceIdFilter} 在请求入口调用 {@link #setTraceId(String)}
 *         （无则自动生成），并写入响应头 X-Trace-Id；</li>
 *     <li>{@link Result} 构造时通过 {@link #getTraceId()} 自动携带当前 traceId；</li>
 *     <li>请求结束由过滤器 finally 调用 {@link #clear()}，防止线程池复用导致串号。</li>
 * </ul>
 *
 * <p>说明：{@code ThreadLocal} 保证同线程读取一致；MDC 保证日志框架
 * （logback pattern 中配置 {@code %X{traceId}}）自动输出 traceId。</p>
 *
 * @author AntTransfer CE
 */
public final class TraceUtils {

    /** MDC / ThreadLocal 中使用的键名：traceId */
    public static final String TRACE_ID_KEY = "traceId";

    /** 当前线程的 traceId（ThreadLocal 天然线程隔离） */
    private static final ThreadLocal<String> TRACE_LOCAL = new ThreadLocal<>();

    /** 工具类禁止实例化 */
    private TraceUtils() {
    }

    /**
     * 获取当前线程 traceId；不存在时自动生成并写入（懒生成，保证任意位置可读）。
     */
    public static String getTraceId() {
        String traceId = TRACE_LOCAL.get();
        if (traceId == null || traceId.isBlank()) {
            traceId = generateTraceId();
            TRACE_LOCAL.set(traceId);
        }
        MDC.put(TRACE_ID_KEY, traceId);
        return traceId;
    }

    /**
     * 设置当前线程 traceId（优先透传网关 / 上游下发的 X-Trace-Id）。
     *
     * @param traceId 入站链路 ID，为空则自动生成
     */
    public static void setTraceId(String traceId) {
        String tid = (traceId == null || traceId.isBlank()) ? generateTraceId() : traceId;
        TRACE_LOCAL.set(tid);
        MDC.put(TRACE_ID_KEY, tid);
    }

    /**
     * 请求结束清理（必须在 finally 中调用，避免线程复用串号）。
     */
    public static void clear() {
        TRACE_LOCAL.remove();
        MDC.remove(TRACE_ID_KEY);
    }

    /** 生成 32 位十六进制 traceId（去除连字符的 UUID） */
    private static String generateTraceId() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
