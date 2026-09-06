package com.fast.springbootinit.common;

import java.io.Serializable;
import lombok.Data;

/**
 * 通用删除请求：按 id 删除的接口统一使用该请求体
 */
@Data
public class DeleteRequest implements Serializable {

    /**
     * id
     */
    private Long id;

    private static final long serialVersionUID = 1L;
}