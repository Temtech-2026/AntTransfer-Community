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
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 自定义容器错误控制器（接管 Spring Boot 默认的 {@code BasicErrorController}）。
 *
 * <p><b>背景</b>：Spring Boot 默认的 {@code BasicErrorController} 会返回
 * {@code {"timestamp":...,"status":...,"error":...,"path":...}} 形态的错误体，
 * 与项目统一契约 {@link Result} 不一致；当客户端带 {@code Accept: text/html} 时
 * 还会渲染 Whitelabel HTML 错误页。本类声明为 {@code ErrorController} 后，
 * Spring Boot 的 {@code ErrorMvcAutoConfiguration} 会因
 * {@code @ConditionalOnMissingBean(ErrorController.class)} 自动退让。</p>
 *
 * <p><b>接管范围</b>（{@code GlobalExceptionHandler} 覆盖不到的部分）：</p>
 * <ul>
 *     <li>Servlet Filter 中抛出的未捕获异常（异常发生在 DispatcherServlet 之前）；</li>
 *     <li>容器内部 {@code sendError(...)} 触发的错误页派发；</li>
 *     <li>异步请求超时等由容器转发的失败。</li>
 * </ul>
 *
 * <p><b>不覆盖</b>：连接器级拒绝（非法 URI、超限请求头/请求行）由 Tomcat 在
 * 进入 Servlet 容器<b>之前</b>直接终止，连 {@code /error} 派发都会被绕过，
 * 需由 {@link JsonErrorReportValve} 兜底。</p>
 *
 * <p><b>安全约定</b>：响应体只含错误码默认文案 + traceId，
 * <b>不回显</b> {@code jakarta.servlet.error.message}（可能含内部类名、路径等实现细节），
 * 真实异常堆栈仅落服务端日志。</p>
 *
 * @author AntTransfer CE
 */
@RestController
public class ApiErrorController implements ErrorController {

    private static final Logger log = LoggerFactory.getLogger(ApiErrorController.class);

    /** HTTP 状态码合法下界 */
    private static final int MIN_HTTP_STATUS = 100;

    /** HTTP 状态码合法上界 */
    private static final int MAX_HTTP_STATUS = 599;

    /**
     * 容器错误统一出口。
     *
     * <p>路径与 {@code server.error.path} 对齐（默认 {@code /error}），
     * 该方法在 {@code SecurityConfig} 中已列为免登录放行，否则错误响应本身会再触发 401。</p>
     *
     * @param request 当前请求（携带容器写入的 {@code jakarta.servlet.error.*} 属性）
     * @return 统一 {@link Result} 结构，HTTP 状态沿用容器原值
     */
    @RequestMapping("${server.error.path:${error.path:/error}}")
    public ResponseEntity<Result<Void>> handleContainerError(HttpServletRequest request) {
        int httpStatus = resolveHttpStatus(request);
        ErrorCode errorCode = HttpStatusErrorMapper.resolve(httpStatus);
        String uri = attributeAsString(request, RequestDispatcher.ERROR_REQUEST_URI);

        Throwable exception = attributeAsThrowable(request.getAttribute(RequestDispatcher.ERROR_EXCEPTION));
        if (exception != null) {
            // 堆栈只进日志，不出响应体
            log.error("容器派发错误已兜底为统一 Result：status={}, uri={}", httpStatus, uri, exception);
        } else {
            log.warn("容器派发错误已兜底为统一 Result：status={}, uri={}, containerMessage={}",
                    httpStatus, uri, attributeAsString(request, RequestDispatcher.ERROR_MESSAGE));
        }

        return ResponseEntity.status(httpStatus).body(Result.fail(errorCode));
    }

    /**
     * 解析容器写入的 HTTP 状态码。
     *
     * <p>直接访问 {@code /error}（无错误属性）时容器会给出 999 等非法值，
     * 此处收敛到 500，避免 {@code ResponseEntity.status(int)} 抛 {@code IllegalArgumentException}。</p>
     */
    private static int resolveHttpStatus(HttpServletRequest request) {
        Object statusCode = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        if (statusCode instanceof Integer code && code >= MIN_HTTP_STATUS && code <= MAX_HTTP_STATUS) {
            return code;
        }
        return HttpStatus.INTERNAL_SERVER_ERROR.value();
    }

    private static String attributeAsString(HttpServletRequest request, String name) {
        Object value = request.getAttribute(name);
        return value == null ? null : value.toString();
    }

    private static Throwable attributeAsThrowable(Object value) {
        return value instanceof Throwable throwable ? throwable : null;
    }
}
