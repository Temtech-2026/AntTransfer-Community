package com.fast.springbootinit.exception;

import com.fast.springbootinit.common.ErrorCode;

/**
 * 自定义业务异常：业务校验不通过时抛出（携带错误码），
 * 由 {@link GlobalExceptionHandler} 统一捕获并转换为 BaseResponse 返回给前端
 *
 * @author <a href="https://github.com/liyupi">程序员鱼皮</a>
 * @from <a href="https://yupi.icu">编程导航知识星球</a>
 */
public class BusinessException extends RuntimeException {

    /**
     * 错误码（对应 {@link ErrorCode} 中的定义）
     */
    private final int code;

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.code = errorCode.getCode();
    }

    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.code = errorCode.getCode();
    }

    public int getCode() {
        return code;
    }
}
