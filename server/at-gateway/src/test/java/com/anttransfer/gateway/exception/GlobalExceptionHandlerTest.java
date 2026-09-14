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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/**
 * 全局异常处理器单测：<b>异常 → 业务错误码 → HTTP 状态 → 响应体文案</b> 的映射契约。
 *
 * <p>该测试锁住三条红线：</p>
 * <ol>
 *     <li><b>参数校验一律 2xxx</b>：{@code @Valid} / 绑定 / 类型 / 缺参 / JSON 不可读全部落 2xxx + HTTP 400，
 *         不得因处理器缺分支而漏到兜底 5001；</li>
 *     <li><b>越权一律 1003 + 403（策略 D）</b>：{@code AccessDeniedException} 归一到 {@code NO_AUTH}，
 *         且不回显原始拒绝原因（避免靠错误文案探测资源归属）；</li>
 *     <li><b>未预期异常一律 5001 且零泄漏</b>：响应体只含固定文案，异常自带 message
 *         （可能含连接串 / SQL / 类名）绝不外泄，完整堆栈只进服务端日志。</li>
 * </ol>
 *
 * <p>本测试为纯单元测试：直接调用处理器方法并按 {@code @ExceptionHandler} 的静态类型分派，
 * 与 Spring 运行期「选最具体类型处理器」的规则一致，不启动 Spring 上下文。</p>
 */
@DisplayName("GlobalExceptionHandler：全局异常与错误码映射")
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    /** 模拟异常内部携带的敏感细节：一旦出现在响应体中即视为泄漏 */
    private static final String SECRET = "jdbc:mysql://10.0.0.1:3306/at_secret?user=root&password=p@ss";

    /* ==================================================================== */
    /* 1. 映射矩阵：异常 → 错误码 / HTTP 状态                                  */
    /* ==================================================================== */

    @Nested
    @DisplayName("1. 异常 → 错误码 / HTTP 状态映射矩阵")
    class MappingMatrix {

        @ParameterizedTest(name = "[{index}] {0} → {2}")
        @MethodSource("com.anttransfer.gateway.exception.GlobalExceptionHandlerTest#mappingCases")
        @DisplayName("按异常类型映射到预期错误码与 HTTP 语义状态，且响应体无堆栈泄漏")
        void mapsToExpectedErrorCodeAndHttpStatus(
                String scenario,
                Exception thrown,
                ErrorCode expected,
                BiFunction<GlobalExceptionHandler, Exception, ResponseEntity<Result<Void>>> invoke) {

            ResponseEntity<Result<Void>> response = invoke.apply(handler, thrown);

            assertThat(response.getStatusCode().value())
                    .as("%s 的 HTTP 状态应由错误码映射决定", scenario)
                    .isEqualTo(expected.getHttpStatus());

            Result<Void> body = response.getBody();
            assertThat(body).as("%s 必须返回统一响应体", scenario).isNotNull();
            assertThat(body.getCode()).as("%s 的业务码", scenario).isEqualTo(expected.getCode());
            assertThat(body.getMessage()).as("%s 的提示文案", scenario).isNotBlank();
            assertThat(body.getData()).as("%s 失败响应不应携带业务数据", scenario).isNull();

            assertNoLeak(body.getMessage(), scenario);
        }

        @Test
        @DisplayName("越权：AccessDeniedException 归一为 1003/403，且不回显原始拒绝原因")
        void accessDeniedMappedToNoAuthWithoutEchoingReason() {
            AccessDeniedException denied = new AccessDeniedException("用户 id=42 无权访问 fileId=8888");

            ResponseEntity<Result<Void>> response = handler.handleAccessDeniedException(denied);

            assertThat(response.getStatusCode().value()).isEqualTo(403);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.NO_AUTH.getCode());
            assertThat(response.getBody().getMessage())
                    .as("策略 D：就地提示，且不得回显资源 ID / 用户 ID")
                    .isEqualTo(ErrorCode.NO_AUTH.getMessage())
                    .doesNotContain("42")
                    .doesNotContain("8888");
        }

        @Test
        @DisplayName("认证异常保留抛出处补充的定位文案（受控文案，非异常堆栈）")
        void authExceptionKeepsProvidedMessage() {
            AuthException e = new AuthException(ErrorCode.NO_AUTH, "无操作权限：file:destroy");

            ResponseEntity<Result<Void>> response = handler.handleAuthException(e);

            assertThat(response.getStatusCode().value()).isEqualTo(403);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getCode()).isEqualTo(1003);
            assertThat(response.getBody().getMessage()).isEqualTo("无操作权限：file:destroy");
            assertNoLeak(response.getBody().getMessage(), "AuthException 自定义文案");
        }
    }

    /* ==================================================================== */
    /* 映射矩阵的用例来源（异常实例 + 期望错误码 + 应调用的处理器方法）           */
    /* ==================================================================== */

    static Stream<Arguments> mappingCases() {
        /* ---------- 认证授权 1xxx ---------- */
        AuthException notLogin = new AuthException(ErrorCode.NOT_LOGIN);
        AuthException tokenExpired = new AuthException(ErrorCode.TOKEN_EXPIRED);
        AuthException noAuth = new AuthException(ErrorCode.NO_AUTH);
        AuthException locked = new AuthException(ErrorCode.ACCOUNT_LOCKED);
        AuthException tokenInvalid = new AuthException(ErrorCode.TOKEN_INVALID);
        AuthException badCredentials = new AuthException(ErrorCode.BAD_CREDENTIALS);

        /* ---------- 业务异常：HTTP 状态完全由错误码分段决定 ---------- */
        BusinessException paramError = new BusinessException(ErrorCode.PARAM_ERROR);
        BusinessException outOfRange = new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE);
        BusinessException integrity = new BusinessException(ErrorCode.FILE_INTEGRITY_ERROR);
        BusinessException shareExpired = new BusinessException(ErrorCode.SHARE_EXPIRED_OR_LIMIT);
        BusinessException taskNotFound = new BusinessException(ErrorCode.TRANSFER_TASK_NOT_FOUND);
        BusinessException stateError = new BusinessException(ErrorCode.TRANSFER_STATE_ERROR);
        BusinessException rateLimited = new BusinessException(ErrorCode.RATE_LIMITED);

        /* ---------- 流程分支码（策略 B：code≠0 但 HTTP 仍为 200） ---------- */
        BusinessException instantMiss = new BusinessException(ErrorCode.INSTANT_UPLOAD_MISS);
        BusinessException chunkMissing = new BusinessException(ErrorCode.CHUNK_MISSING);

        return Stream.of(
                caseOf("AuthException(1001 未登录)", notLogin, ErrorCode.NOT_LOGIN,
                        (h, e) -> h.handleAuthException((AuthException) e)),
                caseOf("AuthException(1002 Token 过期)", tokenExpired, ErrorCode.TOKEN_EXPIRED,
                        (h, e) -> h.handleAuthException((AuthException) e)),
                caseOf("AuthException(1003 无权限)", noAuth, ErrorCode.NO_AUTH,
                        (h, e) -> h.handleAuthException((AuthException) e)),
                caseOf("AuthException(1004 账号锁定)", locked, ErrorCode.ACCOUNT_LOCKED,
                        (h, e) -> h.handleAuthException((AuthException) e)),
                caseOf("AuthException(1006 Token 无效)", tokenInvalid, ErrorCode.TOKEN_INVALID,
                        (h, e) -> h.handleAuthException((AuthException) e)),
                caseOf("AuthException(1007 账号或密码错误)", badCredentials, ErrorCode.BAD_CREDENTIALS,
                        (h, e) -> h.handleAuthException((AuthException) e)),

                caseOf("BusinessException(2001 参数错误)", paramError, ErrorCode.PARAM_ERROR,
                        (h, e) -> h.handleBusinessException((BusinessException) e)),
                caseOf("BusinessException(2005 参数超范围)", outOfRange, ErrorCode.PARAM_OUT_OF_RANGE,
                        (h, e) -> h.handleBusinessException((BusinessException) e)),
                caseOf("BusinessException(4003 完整性校验失败)", integrity, ErrorCode.FILE_INTEGRITY_ERROR,
                        (h, e) -> h.handleBusinessException((BusinessException) e)),
                caseOf("BusinessException(4004 分享过期/次数用尽)", shareExpired,
                        ErrorCode.SHARE_EXPIRED_OR_LIMIT,
                        (h, e) -> h.handleBusinessException((BusinessException) e)),
                caseOf("BusinessException(4101 传输任务不存在)", taskNotFound,
                        ErrorCode.TRANSFER_TASK_NOT_FOUND,
                        (h, e) -> h.handleBusinessException((BusinessException) e)),
                caseOf("BusinessException(4102 传输状态不允许)", stateError, ErrorCode.TRANSFER_STATE_ERROR,
                        (h, e) -> h.handleBusinessException((BusinessException) e)),
                caseOf("BusinessException(4103 传输限流)", rateLimited, ErrorCode.RATE_LIMITED,
                        (h, e) -> h.handleBusinessException((BusinessException) e)),
                caseOf("BusinessException(4001 秒传未命中：策略 B 仍 200)", instantMiss,
                        ErrorCode.INSTANT_UPLOAD_MISS,
                        (h, e) -> h.handleBusinessException((BusinessException) e)),
                caseOf("BusinessException(4002 分片缺失：策略 B 仍 200)", chunkMissing,
                        ErrorCode.CHUNK_MISSING,
                        (h, e) -> h.handleBusinessException((BusinessException) e)),

                caseOf("AccessDeniedException（方法级鉴权拒绝）", new AccessDeniedException("拒绝"),
                        ErrorCode.NO_AUTH,
                        (h, e) -> h.handleAccessDeniedException((AccessDeniedException) e)),

                /* ---------- 参数校验：必须全部落 2xxx / 400 ---------- */
                caseOf("MethodArgumentNotValidException(@RequestBody @Valid)", methodArgumentNotValid(),
                        ErrorCode.PARAM_ERROR,
                        (h, e) -> h.handleMethodArgumentNotValidException((MethodArgumentNotValidException) e)),
                caseOf("BindException(表单/查询对象绑定)", bindException(), ErrorCode.PARAM_ERROR,
                        (h, e) -> h.handleBindException((BindException) e)),
                caseOf("HandlerMethodValidationException(方法参数约束)", handlerMethodValidation(),
                        ErrorCode.PARAM_ERROR,
                        (h, e) -> h.handleHandlerMethodValidationException((HandlerMethodValidationException) e)),
                caseOf("ConstraintViolationException(@Validated)",
                        constraintViolation(), ErrorCode.PARAM_ERROR,
                        (h, e) -> h.handleConstraintViolationException((ConstraintViolationException) e)),
                caseOf("MissingServletRequestParameterException(缺查询参数)",
                        new MissingServletRequestParameterException("name", "String"), ErrorCode.PARAM_MISSING,
                        (h, e) -> h.handleMissingServletRequestParameterException(
                                (MissingServletRequestParameterException) e)),
                caseOf("ServletRequestBindingException(缺请求头/路径变量)", servletRequestBinding(),
                        ErrorCode.PARAM_MISSING,
                        (h, e) -> h.handleServletRequestBindingException((ServletRequestBindingException) e)),
                caseOf("MethodArgumentTypeMismatchException(类型不匹配)", typeMismatch(),
                        ErrorCode.PARAM_TYPE_ERROR,
                        (h, e) -> h.handleMethodArgumentTypeMismatchException(
                                (MethodArgumentTypeMismatchException) e)),
                caseOf("HttpMessageNotReadableException(JSON 不可读)", notReadable(),
                        ErrorCode.PARAM_TYPE_ERROR,
                        (h, e) -> h.handleHttpMessageNotReadableException((HttpMessageNotReadableException) e)),

                /* ---------- 协议层 ---------- */
                caseOf("HttpRequestMethodNotSupportedException(方法不支持)",
                        new HttpRequestMethodNotSupportedException("DELETE"), ErrorCode.PARAM_ERROR,
                        (h, e) -> h.handleHttpRequestMethodNotSupportedException(
                                (HttpRequestMethodNotSupportedException) e)),
                caseOf("HttpMediaTypeNotSupportedException(Content-Type 不支持)",
                        mediaTypeNotSupported(), ErrorCode.FILE_TYPE_NOT_ALLOWED,
                        (h, e) -> h.handleHttpMediaTypeNotSupportedException(
                                (HttpMediaTypeNotSupportedException) e)),
                caseOf("MaxUploadSizeExceededException(上传超限)",
                        new MaxUploadSizeExceededException(1024L), ErrorCode.FILE_TOO_LARGE,
                        (h, e) -> h.handleMaxUploadSizeExceededException((MaxUploadSizeExceededException) e)),
                caseOf("NoResourceFoundException(未知路径)", noResourceFound(), ErrorCode.RESOURCE_NOT_FOUND,
                        (h, e) -> h.handleNotFoundException(e)),
                caseOf("NoHandlerFoundException(无处理器)", noHandlerFound(), ErrorCode.RESOURCE_NOT_FOUND,
                        (h, e) -> h.handleNotFoundException(e)),

                /* ---------- 兜底 ---------- */
                caseOf("未预期 IllegalStateException（兜底 5001）",
                        new IllegalStateException("内部错误：" + SECRET), ErrorCode.SYSTEM_ERROR,
                        (h, e) -> h.handleException(e))
        );
    }

    private static Arguments caseOf(String scenario, Exception thrown, ErrorCode expected,
                                    BiFunction<GlobalExceptionHandler, Exception,
                                            ResponseEntity<Result<Void>>> invoke) {
        return Arguments.of(scenario, thrown, expected, invoke);
    }

    /* ==================================================================== */
    /* 异常实例工厂（这些 Spring 异常无便捷公开构造，需借助容器类型构造）        */
    /* ==================================================================== */

    /** 仅供 MethodParameter 定位的哑方法 */
    @SuppressWarnings("unused")
    private static void dummyHandler(String username) {
        // 测试专用，无实现
    }

    private static MethodParameter dummyMethodParameter() {
        try {
            return new MethodParameter(
                    GlobalExceptionHandlerTest.class.getDeclaredMethod("dummyHandler", String.class), 0);
        } catch (NoSuchMethodException e) {
            throw new IllegalStateException("测试自身缺陷：哑方法签名不匹配", e);
        }
    }

    private static BeanPropertyBindingResult bindingResultWithFieldError(String field, String message) {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "req");
        bindingResult.addError(new FieldError("req", field, message));
        return bindingResult;
    }

    static MethodArgumentNotValidException methodArgumentNotValid() {
        return new MethodArgumentNotValidException(dummyMethodParameter(),
                bindingResultWithFieldError("username", "登录账号不能为空"));
    }

    static BindException bindException() {
        return new BindException(bindingResultWithFieldError("pageSize", "每页条数必须在 1~100 之间"));
    }

    /** 该异常需 MethodValidationResult 构造，此处以 mock 提供最小可用实例（只取 message 记日志） */
    static HandlerMethodValidationException handlerMethodValidation() {
        return mock(HandlerMethodValidationException.class);
    }

    static ServletRequestBindingException servletRequestBinding() {
        return new ServletRequestBindingException("缺少请求头 X-Trace-Id");
    }

    static MethodArgumentTypeMismatchException typeMismatch() {
        return new MethodArgumentTypeMismatchException("abc", Integer.class, "size",
                dummyMethodParameter(), new IllegalArgumentException("abc 不能转换为 Integer"));
    }

    static HttpMessageNotReadableException notReadable() {
        // 显式转型消除 (String, Throwable) / (String, HttpInputMessage) 的重载歧义
        return new HttpMessageNotReadableException("JSON parse error: 敏感内部细节", (Throwable) null);
    }

    /** ConstraintViolationException 无单参构造，违规集合留空（处理器只取 message 记日志）。 */
    static ConstraintViolationException constraintViolation() {
        return new ConstraintViolationException("size 必须为正数", Set.of());
    }

    static HttpMediaTypeNotSupportedException mediaTypeNotSupported() {
        return new HttpMediaTypeNotSupportedException(MediaType.APPLICATION_XML,
                List.of(MediaType.APPLICATION_JSON));
    }

    static NoResourceFoundException noResourceFound() {
        return new NoResourceFoundException(HttpMethod.GET, "/api/v1/unknown");
    }

    static NoHandlerFoundException noHandlerFound() {
        return new NoHandlerFoundException("GET", "/api/v1/unknown", new HttpHeaders());
    }

    /* ==================================================================== */
    /* 2. 参数校验：字段级提示可定位，且不外泄内部结构                          */
    /* ==================================================================== */

    @Nested
    @DisplayName("2. 参数校验：字段级提示与内部细节隔离")
    class ParamValidationDetail {

        @Test
        @DisplayName("@Valid 失败返回首条字段错误文案，可直接定位到字段")
        void methodArgumentNotValidReturnsFirstFieldMessage() {
            ResponseEntity<Result<Void>> response =
                    handler.handleMethodArgumentNotValidException(methodArgumentNotValid());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getCode()).isEqualTo(2001);
            assertThat(response.getBody().getMessage()).isEqualTo("登录账号不能为空");
        }

        @Test
        @DisplayName("绑定失败但无字段错误时，降级为错误码默认文案而非 null")
        void bindExceptionWithoutFieldErrorFallsBackToDefaultMessage() {
            BindException empty = new BindException(new BeanPropertyBindingResult(new Object(), "query"));

            ResponseEntity<Result<Void>> response = handler.handleBindException(empty);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getCode()).isEqualTo(2001);
            assertThat(response.getBody().getMessage()).isEqualTo(ErrorCode.PARAM_ERROR.getMessage());
        }

        @Test
        @DisplayName("缺参：提示带缺失参数名，便于前端定位")
        void missingParameterMessageContainsParameterName() {
            ResponseEntity<Result<Void>> response = handler.handleMissingServletRequestParameterException(
                    new MissingServletRequestParameterException("fileId", "Long"));

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getCode()).isEqualTo(2002);
            assertThat(response.getBody().getMessage()).isEqualTo("缺少必要参数: fileId");
        }

        @Test
        @DisplayName("类型不匹配：提示带参数名，但不回显原始入参值")
        void typeMismatchMessageContainsNameButNotRawValue() {
            ResponseEntity<Result<Void>> response =
                    handler.handleMethodArgumentTypeMismatchException(typeMismatch());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getCode()).isEqualTo(2004);
            assertThat(response.getBody().getMessage())
                    .isEqualTo("参数类型不匹配: size")
                    .doesNotContain("abc");
        }

        @Test
        @DisplayName("约束校验 / 方法参数校验：对外只回默认文案，明细仅进日志")
        void constraintViolationsDoNotExposeInternalDetail() {
            ResponseEntity<Result<Void>> constraint = handler.handleConstraintViolationException(
                    constraintViolation());
            ResponseEntity<Result<Void>> methodParam =
                    handler.handleHandlerMethodValidationException(handlerMethodValidation());

            assertThat(constraint.getStatusCode().value()).isEqualTo(400);
            assertThat(methodParam.getStatusCode().value()).isEqualTo(400);
            assertThat(constraint.getBody()).isNotNull();
            assertThat(methodParam.getBody()).isNotNull();
            assertThat(constraint.getBody().getCode()).isEqualTo(2001);
            assertThat(methodParam.getBody().getCode()).isEqualTo(2001);
            assertThat(constraint.getBody().getMessage()).isEqualTo(ErrorCode.PARAM_ERROR.getMessage());
            assertThat(methodParam.getBody().getMessage()).isEqualTo(ErrorCode.PARAM_ERROR.getMessage());
        }

        @Test
        @DisplayName("JSON 不可读：不回显解析器原始文案")
        void notReadableDoesNotEchoParserDetail() {
            ResponseEntity<Result<Void>> response =
                    handler.handleHttpMessageNotReadableException(notReadable());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getCode()).isEqualTo(2004);
            assertThat(response.getBody().getMessage())
                    .isEqualTo("请求体格式错误，请检查 JSON 与字段类型")
                    .doesNotContain("JSON parse error");
        }
    }

    /* ==================================================================== */
    /* 3. 兜底：5001 且零堆栈泄漏                                              */
    /* ==================================================================== */

    @Nested
    @DisplayName("3. 未预期异常兜底：5001 + 零泄漏")
    class FallbackNoLeak {

        @Test
        @DisplayName("异常 message 含连接串 / SQL / 内部类名时，响应体只回固定文案")
        void unexpectedExceptionNeverLeaksInternalDetail() {
            String[] internalDetails = {
                    "Access denied for user 'root'@'10.0.0.1' (using password: YES)",
                    SECRET,
                    "java.sql.SQLSyntaxErrorException: Table 'at_secret.sys_user' doesn't exist",
                    "com.anttransfer.permission.service.UserService.create(UserService.java:88)"
            };

            for (String detail : internalDetails) {
                ResponseEntity<Result<Void>> response = handler.handleException(new RuntimeException(detail));

                assertThat(response.getStatusCode().value()).as("兜底必须为 HTTP 500").isEqualTo(500);
                assertThat(response.getBody()).isNotNull();
                assertThat(response.getBody().getCode()).isEqualTo(5001);
                assertThat(response.getBody().getMessage())
                        .isEqualTo(ErrorCode.SYSTEM_ERROR.getMessage())
                        .doesNotContain("root")
                        .doesNotContain("password")
                        .doesNotContain("sys_user")
                        .doesNotContain("UserService")
                        .doesNotContain("SQLSyntaxErrorException");
                assertNoLeak(response.getBody().getMessage(), detail);
            }
        }

        @Test
        @DisplayName("原因链（cause）中的敏感信息同样不得泄漏到响应体")
        void causeChainIsNotLeaked() {
            RuntimeException root = new IllegalStateException("连接失败：" + SECRET);
            RuntimeException wrapper = new RuntimeException("上传落盘失败", root);

            ResponseEntity<Result<Void>> response = handler.handleException(wrapper);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo(ErrorCode.SYSTEM_ERROR.getMessage());
            assertNoLeak(response.getBody().getMessage(), "含 cause 链的异常");
        }

        @Test
        @DisplayName("兜底响应体不携带 data 载荷")
        void fallbackCarriesNoData() {
            ResponseEntity<Result<Void>> response =
                    handler.handleException(new NullPointerException("npe at UserService"));

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getData()).isNull();
        }
    }

    /* ==================================================================== */
    /* 4. ErrorCode 表不变量（分段 / HTTP 映射 / 已裁决红线）                   */
    /* ==================================================================== */

    @Nested
    @DisplayName("4. ErrorCode 表不变量")
    class ErrorCodeInvariants {

        @Test
        @DisplayName("业务码全局唯一，且按码反查可往返（find 无异常 / fromCode fail-fast）")
        void codesAreUniqueAndLookupRoundTrips() {
            assertThat(ErrorCode.values()).extracting(ErrorCode::getCode).doesNotHaveDuplicates();

            for (ErrorCode errorCode : ErrorCode.values()) {
                assertThat(ErrorCode.find(errorCode.getCode()))
                        .as("%s 应可按码反查", errorCode.name())
                        .contains(errorCode);
                assertThat(ErrorCode.fromCode(errorCode.getCode())).isEqualTo(errorCode);
            }

            assertThat(ErrorCode.find(9999)).as("未登记码不得静默返回成功").isEmpty();
            assertThatThrownBy(() -> ErrorCode.fromCode(9999))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("未知错误码");
        }

        @Test
        @DisplayName("0 由 SUCCESS 独占，避免「未登记被当成成功」")
        void successCodeIsZeroAndExclusive() {
            assertThat(ErrorCode.SUCCESS.getCode()).isZero();
            assertThat(ErrorCode.SUCCESS.getHttpStatus()).isEqualTo(200);
            assertThat(ErrorCode.values()).filteredOn(ec -> ec.getCode() == 0).hasSize(1);
        }

        @Test
        @DisplayName("每个错误码的 HTTP 状态必须落在其分段允许集合内，且文案非空")
        void httpStatusIsConsistentWithSegment() {
            Map<Integer, Set<Integer>> allowedBySegment = Map.of(
                    0, Set.of(200),
                    1, Set.of(200, 400, 401, 403, 404, 409),
                    2, Set.of(400),
                    // 403：提取码错误 / 下载凭证无效 / 彻底销毁越权（4010、4017、4018）
                    4, Set.of(200, 400, 403, 404, 409, 410, 413, 415, 429),
                    5, Set.of(500, 502));

            for (ErrorCode errorCode : ErrorCode.values()) {
                int segment = errorCode.getCode() / 1000;
                assertThat(allowedBySegment)
                        .as("%s 的分段 %d 未登记允许的 HTTP 状态", errorCode.name(), segment)
                        .containsKey(segment);
                assertThat(allowedBySegment.get(segment))
                        .as("%s(%d) 的 HTTP 状态 %d 越界", errorCode.name(),
                                errorCode.getCode(), errorCode.getHttpStatus())
                        .contains(errorCode.getHttpStatus());
                assertThat(errorCode.getMessage())
                        .as("%s 必须有非空默认文案", errorCode.name()).isNotBlank();
            }
        }

        @Test
        @DisplayName("策略 B 流程分支码必须 HTTP 200（前端按 code 走分支，不弹错误）")
        void strategyBCodesKeepHttp200() {
            assertThat(List.of(ErrorCode.INSTANT_UPLOAD_MISS, ErrorCode.CHUNK_MISSING,
                            ErrorCode.GRANT_ALREADY_ACTIVE, ErrorCode.APPLICATION_DUPLICATE))
                    .allSatisfy(errorCode -> assertThat(errorCode.getHttpStatus())
                            .as("%s 属策略 B，HTTP 必须为 200", errorCode.name())
                            .isEqualTo(200));
        }

        @Test
        @DisplayName("AT-DIFF-01 红线：1003=NO_AUTH/403；凭证失效段为 1001/1002/1006/1007 且均 401")
        void authSegmentHonoursDecidedContract() {
            assertThat(ErrorCode.NO_AUTH.getCode()).isEqualTo(1003);
            assertThat(ErrorCode.NO_AUTH.getHttpStatus()).isEqualTo(403);
            assertThat(ErrorCode.NO_AUTH.getMessage()).isEqualTo("无操作权限");

            List<ErrorCode> credentialFailures = List.of(ErrorCode.NOT_LOGIN, ErrorCode.TOKEN_EXPIRED,
                    ErrorCode.TOKEN_INVALID, ErrorCode.BAD_CREDENTIALS);
            assertThat(credentialFailures).extracting(ErrorCode::getCode)
                    .containsExactly(1001, 1002, 1006, 1007);
            assertThat(credentialFailures).allSatisfy(errorCode ->
                    assertThat(errorCode.getHttpStatus()).isEqualTo(401));

            assertThat(ErrorCode.TOKEN_INVALID.getCode())
                    .as("原 1003=TOKEN_INVALID 已后移至 1006，不得回退")
                    .isEqualTo(1006);
        }
    }

    /* ==================================================================== */

    /** 断言响应体文案不含堆栈痕迹 / 异常类名 / 内部实现标识 */
    private static void assertNoLeak(String message, String scenario) {
        assertThat(message).as("%s：响应体文案", scenario).isNotNull();
        assertThat(message)
                .as("%s：不得泄露堆栈或内部实现细节", scenario)
                .doesNotContain("Exception")
                .doesNotContain("Error")
                .doesNotContain("at com.anttransfer")
                .doesNotContain("Caused by")
                .doesNotContain("jdbc:")
                .doesNotContain("java.")
                .doesNotContain(".java:");
        assertThat(message.length())
                .as("%s：文案应面向用户而非机器", scenario)
                .isLessThan(120);
    }
}
