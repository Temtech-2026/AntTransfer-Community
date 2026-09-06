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
package com.anttransfer.common.exception;

import com.anttransfer.common.result.ErrorCode;
import lombok.Getter;

/**
 * 业务异常。
 *
 * <p>职责：业务代码中“预期内”的可控失败统一抛本异常，
 * 由 at-gateway 的 {@code GlobalExceptionHandler} 捕获并转换为
 * {@code Result.fail(ErrorCode)} 返回给前端，避免将堆栈直接暴露给调用方。</p>
 *
 * <p>用法示例：</p>
 * <pre>{@code
 *   if (record == null) {
 *       throw new BusinessException(ErrorCode.TRANSFER_TASK_NOT_FOUND);
 *   }
 * }</pre>
 *
 * @author AntTransfer CE
 */
@Getter
public class BusinessException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** 业务错误码（携带 code 与默认 message） */
    private final ErrorCode errorCode;

    /**
     * 仅错误码：message 复用 {@link ErrorCode#getMessage()}。
     */
    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    /**
     * 错误码 + 自定义提示（通常用于补充错误详情，如字段名）。
     */
    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    /**
     * 错误码 + 根因（内部记录，不对外暴露）。
     */
    public BusinessException(ErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }

    /** 数字错误码，便于日志 / 埋点直接使用 */
    public int getCode() {
        return errorCode.getCode();
    }
}
