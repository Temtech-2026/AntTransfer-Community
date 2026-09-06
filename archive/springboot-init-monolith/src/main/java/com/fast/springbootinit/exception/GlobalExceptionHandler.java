package com.fast.springbootinit.exception;

import com.fast.springbootinit.common.BaseResponse;
import com.fast.springbootinit.common.ErrorCode;
import com.fast.springbootinit.common.ResultUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理器：统一捕获 Controller 抛出的异常并转换为 BaseResponse，
 * 业务代码无需自行 try-catch，只需抛出异常即可
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /**
     * 业务异常：返回业务代码中定义的错误码和提示信息
     */
    @ExceptionHandler(BusinessException.class)
    public BaseResponse<?> businessExceptionHandler(BusinessException e) {
        log.error("BusinessException", e);
        return ResultUtils.error(e.getCode(), e.getMessage());
    }

    /**
     * 兜底异常：未捕获的运行时异常统一返回“系统错误”，避免异常堆栈泄露给前端
     */
    @ExceptionHandler(RuntimeException.class)
    public BaseResponse<?> runtimeExceptionHandler(RuntimeException e) {
        log.error("RuntimeException", e);
        return ResultUtils.error(ErrorCode.SYSTEM_ERROR, "系统错误");
    }
}
