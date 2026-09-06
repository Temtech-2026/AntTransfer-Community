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
package com.anttransfer.gateway.exception;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.Result;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * 全局异常处理器。
 *
 * <p>职责：将各模块抛出的异常统一转换为 {@link Result} 结构返回，并按
 * {@link ErrorCode#getHttpStatus()} 设置 HTTP 语义状态码，避免容器默认错误页 /
 * 堆栈信息泄露给前端，同时按类型分级记录日志：业务异常（warn）、参数校验异常（warn）、
 * 未预期异常（error + 全堆栈）。</p>
 *
 * <p>约定：无论 HTTP 状态如何，响应体恒为 {@code Result{code,message,data,traceId}}，
 * 前端以 {@code body.code} 为业务主判据，HTTP 状态用于网络层 / 拦截器决策
 * （如 401 触发重新登录、429 提示限流）。</p>
 *
 * <p>覆盖场景：</p>
 * <ul>
 *     <li>{@link BusinessException}：业务可控失败，HTTP 状态取错误码自带映射
 *         （1xxx 认证 / 2xxx 参数 / 4xxx 文件传输 / 5xxx 系统）；</li>
 *     <li>{@link MethodArgumentNotValidException}：{@code @Valid} 请求体校验失败（归入 2xxx）；</li>
 *     <li>{@link MissingServletRequestParameterException}：缺少必填 Query / Form 参数；</li>
 *     <li>{@link MethodArgumentTypeMismatchException}、{@link HttpMessageNotReadableException}：
 *         类型不匹配 / JSON 不可读（归入 2004）；</li>
 *     <li>{@link Exception}：兜底异常（归入 5001 系统异常，避免 500 页面裸奔）。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 业务异常：调用方按错误码区分处理，级别 warn。
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Result<Void>> handleBusinessException(BusinessException e) {
        ErrorCode errorCode = e.getErrorCode();
        log.warn("业务异常, code={}, httpStatus={}, message={}",
                errorCode.getCode(), errorCode.getHttpStatus(), e.getMessage());
        return build(errorCode, e.getMessage());
    }

    /**
     * 请求体参数校验异常（@Valid + @NotBlank/@NotNull 等），返回首条字段错误提示。
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<Void>> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(FieldError::getDefaultMessage)
                .orElse(ErrorCode.PARAM_ERROR.getMessage());
        log.warn("参数校验失败: {}", message);
        return build(ErrorCode.PARAM_ERROR, message);
    }

    /**
     * 缺少必填参数（Query / Form 未携带）。
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Result<Void>> handleMissingServletRequestParameterException(
            MissingServletRequestParameterException e) {
        log.warn("缺少必要参数: {}", e.getParameterName());
        return build(ErrorCode.PARAM_MISSING,
                ErrorCode.PARAM_MISSING.getMessage() + ": " + e.getParameterName());
    }

    /**
     * 路径 / 查询参数类型不匹配（如把非数字传给 Long 参数）。
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Result<Void>> handleMethodArgumentTypeMismatchException(
            MethodArgumentTypeMismatchException e) {
        log.warn("参数类型不匹配: {}", e.getName());
        return build(ErrorCode.PARAM_TYPE_ERROR,
                ErrorCode.PARAM_TYPE_ERROR.getMessage() + ": " + e.getName());
    }

    /**
     * 请求体 JSON 不可读 / 格式错误。
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Result<Void>> handleHttpMessageNotReadableException(
            HttpMessageNotReadableException e) {
        log.warn("请求体格式错误: {}", e.getMessage());
        return build(ErrorCode.PARAM_TYPE_ERROR, "请求体格式错误，请检查 JSON 与字段类型");
    }

    /**
     * 兜底异常：记录完整堆栈，对外只返回通用系统错误。
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> handleException(Exception e) {
        log.error("系统异常", e);
        return build(ErrorCode.SYSTEM_ERROR, null);
    }

    /** 按错误码的 HTTP 映射与业务提示组装响应体 */
    private ResponseEntity<Result<Void>> build(ErrorCode errorCode, String message) {
        return ResponseEntity
                .status(HttpStatusCode.valueOf(errorCode.getHttpStatus()))
                .body(Result.fail(errorCode, message == null ? errorCode.getMessage() : message));
    }
}
