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
package com.anttransfer.gateway.error;

import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.Result;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.catalina.connector.Request;
import org.apache.catalina.connector.Response;
import org.apache.catalina.valves.ErrorReportValve;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

/**
 * Tomcat 统一错误页阀门：把容器级错误的 <b>HTML 错误页</b>替换为统一 {@link Result} JSON。
 *
 * <p><b>为什么需要它</b>：{@link ApiErrorController} 只能接管「被容器派发到 {@code /error}」
 * 的错误。但连接器级拒绝（非法 URI 编码、超限请求行、超限请求头）由 Tomcat 在
 * <b>进入 Servlet 容器前</b>直接终止，既不会经过 DispatcherServlet，也不会派发到 {@code /error}，
 * 最终由 Tomcat 内置的 {@code ErrorReportValve} 渲染成 {@code HTTP Status 400 – Bad Request}
 * 这类 HTML 页面 —— 前端按 JSON 解析会直接失败。</p>
 *
 * <p>本类继承 {@link ErrorReportValve} 并重写 {@link #report(Request, Response, Throwable)}，
 * 在容器准备渲染错误页时改写为 JSON。装配见 {@link TomcatJsonErrorReportConfig}。</p>
 *
 * <p><b>安全约定</b>：与 {@code GlobalExceptionHandler} 一致，
 * 响应体只含错误码默认文案 + traceId；真实异常堆栈与容器原始报文仅落服务端日志。</p>
 *
 * @author AntTransfer CE
 */
public class JsonErrorReportValve extends ErrorReportValve {

    private static final Logger log = LoggerFactory.getLogger(JsonErrorReportValve.class);

    /** 链路追踪响应头：与 TraceIdFilter 保持一致，便于调用方带回问题 */
    private static final String TRACE_ID_HEADER = "X-Trace-Id";

    /** 容器错误页渲染为 JSON 时使用应用统一的 Jackson 配置 */
    private final ObjectMapper objectMapper;

    /**
     * @param objectMapper 应用级 ObjectMapper（由 Spring 容器注入，保证序列化口径一致）
     */
    public JsonErrorReportValve(ObjectMapper objectMapper) {
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    }

    @Override
    protected void report(Request request, Response response, Throwable throwable) {
        int statusCode = response.getStatus();
        // 与 Tomcat 原生判定保持一致：非错误状态 / 已有响应体 / 已被其他阀门上报过，则不改写
        if (statusCode < 400 || response.getContentWritten() > 0 || !response.setErrorReported()) {
            return;
        }

        ErrorCode errorCode = HttpStatusErrorMapper.resolve(statusCode);
        // Result 构造时自动携带当前线程 traceId（连接器级错误下 TraceIdFilter 未执行，此处懒生成）
        Result<Void> body = Result.fail(errorCode);

        logServerSide(request, throwable, statusCode, body.getTraceId());

        try {
            response.setHeader(TRACE_ID_HEADER, body.getTraceId());
            response.setContentType("application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            byte[] payload = objectMapper.writeValueAsBytes(body);
            response.setContentLength(payload.length);
            response.getOutputStream().write(payload);
        } catch (IOException | IllegalStateException ex) {
            // 写响应失败时不抛异常（否则会干扰容器结束流程），降级为容器默认行为
            log.warn("JsonErrorReportValve 写出统一错误响应失败，降级为容器默认错误页", ex);
        }
    }

    /**
     * 服务端留痕。堆栈与容器原始报文只进日志，不出响应体。
     */
    private static void logServerSide(Request request, Throwable throwable, int statusCode, String traceId) {
        String uri = safeRequestUri(request);
        if (throwable != null) {
            log.error("容器级错误已统一为 Result：status={}, uri={}, traceId={}", statusCode, uri, traceId, throwable);
        } else if (statusCode >= 500) {
            log.error("容器级错误已统一为 Result：status={}, uri={}, traceId={}", statusCode, uri, traceId);
        } else {
            log.warn("容器级错误已统一为 Result：status={}, uri={}, traceId={}", statusCode, uri, traceId);
        }
    }

    /**
     * 安全读取原始 URI。
     *
     * <p>非法 URI 场景下 {@code MessageBytes} 可能无法按默认字符集还原，此处兜底为空串，
     * 绝不允许「日志失败」反过来影响错误响应写出。</p>
     */
    private static String safeRequestUri(Request request) {
        try {
            String uri = request.getRequestURI();
            return uri == null ? "" : uri;
        } catch (Exception ex) {
            return "";
        }
    }
}
