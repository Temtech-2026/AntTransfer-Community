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
package com.anttransfer.common.result;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

/**
 * 统一 API 响应体。
 *
 * <p>职责：作为 Controller / Service / 全局异常处理器对外的唯一数据载体，
 * 保证前后端接口契约一致。字段说明：</p>
 * <ul>
 *     <li>{@code code}：业务状态码，{@code 0} 表示成功，非 0 参见 {@link ErrorCode}；</li>
 *     <li>{@code message}：提示信息（成功为“成功”，失败为具体原因）；</li>
 *     <li>{@code data}：业务数据（泛型），无数据时为 {@code null}；</li>
 *     <li>{@code traceId}：链路追踪 ID，由 at-gateway 的 TraceIdFilter 写入
 *         ThreadLocal/MDC，构建响应时自动携带，便于问题排障贯穿日志。</li>
 * </ul>
 *
 * <p>用法示例：</p>
 * <pre>{@code
 *   return Result.ok(userVO);                 // 成功 + 数据
 *   return Result.fail(ErrorCode.PARAM_ERROR); // 失败 + 错误码
 * }</pre>
 *
 * @param <T> 业务数据类型
 * @author AntTransfer CE
 */
@Getter
@Setter
public class Result<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 业务状态码：0 = 成功，非 0 = 失败（具体含义见 {@link ErrorCode}） */
    private int code;

    /** 提示信息：成功或失败的人类可读说明 */
    private String message;

    /** 业务数据载荷，无数据时为空 */
    private T data;

    /** 链路追踪 ID：一次请求内唯一，供日志检索与排障 */
    private String traceId;

    /** 私有构造：禁止外部直接 new，统一走静态工厂方法 */
    private Result(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        // 自动携带当前线程的 traceId（由网关过滤器/异步包装器维护）
        this.traceId = com.anttransfer.common.trace.TraceUtils.getTraceId();
    }

    /* ============================ 成功工厂方法 ============================ */

    /** 成功（无数据返回）：code=0, message=成功 */
    public static <T> Result<T> ok() {
        return new Result<>(ErrorCode.SUCCESS.getCode(), ErrorCode.SUCCESS.getMessage(), null);
    }

    /** 成功（携带数据）：code=0, message=成功 */
    public static <T> Result<T> ok(T data) {
        return new Result<>(ErrorCode.SUCCESS.getCode(), ErrorCode.SUCCESS.getMessage(), data);
    }

    /** 成功（自定义提示 + 数据） */
    public static <T> Result<T> ok(String message, T data) {
        return new Result<>(ErrorCode.SUCCESS.getCode(), message, data);
    }

    /* ============================ 失败工厂方法 ============================ */

    /** 失败（仅错误码，提示取错误码默认文案） */
    public static <T> Result<T> fail(ErrorCode errorCode) {
        return new Result<>(errorCode.getCode(), errorCode.getMessage(), null);
    }

    /** 失败（错误码 + 自定义提示，常用于补充字段级校验信息） */
    public static <T> Result<T> fail(ErrorCode errorCode, String message) {
        return new Result<>(errorCode.getCode(), message, null);
    }

    /** 失败（自定义 code + message 的兜底方式） */
    public static <T> Result<T> fail(int code, String message) {
        return new Result<>(code, message, null);
    }

    /* ============================ 便捷判断 ============================ */

    /** 是否业务成功 */
    public boolean isSuccess() {
        return this.code == ErrorCode.SUCCESS.getCode();
    }
}
