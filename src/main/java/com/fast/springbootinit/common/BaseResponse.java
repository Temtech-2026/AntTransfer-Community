package com.fast.springbootinit.common;

import java.io.Serializable;
import lombok.Data;

/**
 * 通用返回类：所有接口统一返回该结构（code 状态码 + data 数据 + message 提示信息），
 * 前端根据 code 判断请求是否成功（0 为成功），成功时从 data 取业务数据
 *
 * @param <T> 返回数据类型
 * @author <a href="https://github.com/liyupi">程序员鱼皮</a>
 * @from <a href="https://yupi.icu">编程导航知识星球</a>
 */
@Data
public class BaseResponse<T> implements Serializable {

    /**
     * 状态码（0 成功，其余见 {@link ErrorCode}）
     */
    private int code;

    /**
     * 返回数据（成功时承载业务数据）
     */
    private T data;

    /**
     * 提示信息（失败时描述错误原因）
     */
    private String message;

    public BaseResponse(int code, T data, String message) {
        this.code = code;
        this.data = data;
        this.message = message;
    }

    public BaseResponse(int code, T data) {
        this(code, data, "");
    }

    public BaseResponse(ErrorCode errorCode) {
        this(errorCode.getCode(), null, errorCode.getMessage());
    }
}
