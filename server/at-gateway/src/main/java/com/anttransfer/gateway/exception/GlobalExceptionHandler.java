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

import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.Result;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 全局异常处理器。
 *
 * <p>职责：将各模块抛出的异常统一转换为 {@link Result} 结构返回，并按
 * {@link ErrorCode#getHttpStatus()} 设置 HTTP 语义状态码，避免容器默认错误页 /
 * 堆栈信息泄露给前端，同时按类型分级记录日志：认证授权与业务异常（warn）、
 * 参数校验异常（warn）、未预期异常（error + 全堆栈）。</p>
 *
 * <p>约定：无论 HTTP 状态如何，响应体恒为 {@code Result{code,message,data,traceId}}，
 * 前端以 {@code body.code} 为业务主判据，HTTP 状态用于网络层 / 拦截器决策
 * （如 401 触发重新登录、429 提示限流）。</p>
 *
 * <p><b>安全红线</b>：对外 message 一律取自 {@link ErrorCode} 默认文案或受控的参数级提示；
 * 未预期异常只回 {@code 5001 系统繁忙，请稍后重试} + traceId，
 * 完整堆栈仅写入服务端日志，绝不出现在响应体中。</p>
 *
 * <p>覆盖场景（按类分级，Spring 自动选择最具体的处理器）：</p>
 * <ul>
 *     <li><b>认证授权</b>：{@link AuthException} —— 1xxx（1001~1006，401/403）；
 *         at-auth 接入 Spring Security 后，由其将 {@code AuthenticationException} /
 *         {@code AccessDeniedException} 转换为本异常；</li>
 *     <li><b>业务</b>：{@link BusinessException} —— HTTP 状态取错误码自带映射
 *         （2xxx 参数 / 4xxx 文件传输 / 5xxx 系统）；</li>
 *     <li><b>参数校验</b>：{@link MethodArgumentNotValidException}（{@code @RequestBody @Valid}）、
 *         {@link BindException}（表单 / 对象绑定）、{@link HandlerMethodValidationException}
 *         （方法参数约束）、{@link ConstraintViolationException}（{@code @Validated}）、
 *         {@link MissingServletRequestParameterException} 与 {@link ServletRequestBindingException}
 *         （缺参数 / 缺请求头 / 缺路径变量）、{@link MethodArgumentTypeMismatchException} 与
 *         {@link HttpMessageNotReadableException}（类型不匹配 / JSON 不可读）→ 统一 2xxx + HTTP 400；</li>
 *     <li><b>协议层</b>：{@link HttpRequestMethodNotSupportedException}（方法不支持 → 2001）、
 *         {@link HttpMediaTypeNotSupportedException}（媒体类型不支持 → 4007/415）、
 *         {@link MaxUploadSizeExceededException}（上传超限 → 4006/413）；
 *         404 由 {@link NoResourceFoundException} / {@link NoHandlerFoundException} 统一转换为
 *         {@code 4040 RESOURCE_NOT_FOUND}，杜绝 Whitelabel / 默认错误页；</li>
 *     <li><b>兜底</b>：{@link Exception} → 5001（HTTP 500）。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /* ============================ 认证授权（1xxx） ============================ */

    /**
     * 认证 / 授权失败：前端据 code 区分「静默换令牌（1002）」「跳登录（1001/1003）」
     * 「无权限提示不跳登录（1004~1006）」，级别 warn 并附带 traceId 便于审计关联。
     */
    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Result<Void>> handleAuthException(AuthException e) {
        ErrorCode errorCode = e.getErrorCode();
        log.warn("认证授权失败, code={}, httpStatus={}, message={}",
                errorCode.getCode(), errorCode.getHttpStatus(), e.getMessage());
        return build(errorCode, e.getMessage());
    }

    /* ============================ 业务异常 ============================ */

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
     * 已认证但权限不足（方法级/接口级鉴权抛出的 Spring Security AccessDeniedException）
     * → 1004 NO_AUTH（HTTP 403，前端策略 D：提示不引导登录）。
     *
     * <p>注：请求尚未进入 SecurityContext 的 401 由安全链入口点处理（at-auth）；本分支兜底
     * 控制器/切面层方法鉴权抛出的拒绝。业务错误码口径见 docs/api/error-codes.md。</p>
     *
     * <pre>{@code
     * // ===================== TODO[AT-DIFF-01] 待整体完工后裁决 =====================
     * // 外部计划书要求 AccessDeniedException → 1003/403；
     * // 本仓库已冻结契约（docs/api/error-codes.md）1003 = TOKEN_INVALID 且 HTTP 401，
     * // 若权限不足也用 1003 会导致前端按策略 C 误跳登录。
     * // 现状：拒绝类统一映射 1004 NO_AUTH/403（本类 + at-auth RestAccessDeniedHandler
     * //       + at-permission RequiresPermAspect + 前端 web/src/utils/result.ts 一致）。
     * // 解决方案（二选一，完工前裁定）：
     * //   A) 维持仓库契约（推荐）：无需改动，前端 1004 → 提示不跳登录语义正确；
     * //   B) 对齐外部计划改 1003：需同步 ErrorCode 枚举、docs/api/error-codes.md、
     * //      at-auth RestAuthenticationEntryPoint/RestAccessDeniedHandler、前端 result.ts
     * //      STRATEGY_BY_CODE（1003 将变成 D 而非 C），改动面大且易踩 401/403 语义混淆。
     * // ======================================================================
     * }</pre>
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Result<Void>> handleAccessDeniedException(AccessDeniedException e) {
        log.warn("访问被拒绝（权限不足）, message={}", e.getMessage());
        return build(ErrorCode.NO_AUTH, null);
    }

    /* ============================ 参数校验（2xxx） ============================ */

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
     * 表单 / 查询对象绑定校验失败（非 @RequestBody 场景）。
     */
    @ExceptionHandler(BindException.class)
    public ResponseEntity<Result<Void>> handleBindException(BindException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(FieldError::getDefaultMessage)
                .orElse(ErrorCode.PARAM_ERROR.getMessage());
        log.warn("参数绑定失败: {}", message);
        return build(ErrorCode.PARAM_ERROR, message);
    }

    /**
     * 方法级参数约束校验失败（Spring 6.1+，直接标注在 Controller 方法参数上的约束）。
     * 明细进日志，对外只回标准文案，避免暴露内部参数结构。
     */
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<Result<Void>> handleHandlerMethodValidationException(
            HandlerMethodValidationException e) {
        log.warn("方法参数校验失败: {}", e.getMessage());
        return build(ErrorCode.PARAM_ERROR, null);
    }

    /**
     * {@code @Validated} 触发的 Bean Validation 约束冲突（如 Service 层参数校验）。
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Result<Void>> handleConstraintViolationException(
            ConstraintViolationException e) {
        log.warn("约束校验失败: {}", e.getMessage());
        return build(ErrorCode.PARAM_ERROR, null);
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
     * 请求绑定失败兜底：缺少请求头 / Cookie / 路径变量等。
     */
    @ExceptionHandler(ServletRequestBindingException.class)
    public ResponseEntity<Result<Void>> handleServletRequestBindingException(
            ServletRequestBindingException e) {
        log.warn("请求绑定失败: {}", e.getMessage());
        return build(ErrorCode.PARAM_MISSING, null);
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

    /* ============================ 协议层 ============================ */

    /**
     * 请求方法不支持（如用 DELETE 访问只接受 POST 的端点）。
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Result<Void>> handleHttpRequestMethodNotSupportedException(
            HttpRequestMethodNotSupportedException e) {
        log.warn("请求方法不支持: {}", e.getMethod());
        return build(ErrorCode.PARAM_ERROR, "请求方法不支持，请检查接口定义");
    }

    /**
     * 媒体类型不支持（Content-Type 不被接口接受）→ 复用「文件类型不允许」语义，HTTP 415。
     */
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<Result<Void>> handleHttpMediaTypeNotSupportedException(
            HttpMediaTypeNotSupportedException e) {
        log.warn("媒体类型不支持: {}", e.getContentType());
        return build(ErrorCode.FILE_TYPE_NOT_ALLOWED, "不支持的内容类型，请检查 Content-Type");
    }

    /**
     * 上传体积超出容器 / 应用上限 → 4006（HTTP 413）。
     * 与分片上传的分片大小校验互补：整请求体超限在此拦截。
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Result<Void>> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException e) {
        log.warn("上传体积超限: {}", e.getMessage());
        return build(ErrorCode.FILE_TOO_LARGE, null);
    }

    /**
     * 404：未知路径 / 静态资源未找到 → 统一 Result，杜绝容器默认错误页。
     */
    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<Result<Void>> handleNotFoundException(Exception e) {
        log.warn("资源不存在: {}", e.getMessage());
        return build(ErrorCode.RESOURCE_NOT_FOUND, null);
    }

    /* ============================ 兜底 ============================ */

    /**
     * 兜底异常：记录完整堆栈，对外只返回通用系统错误（5001）。
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
