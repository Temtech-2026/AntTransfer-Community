package com.fast.springbootinit.constant;

/**
 * 通用常量：统一维护排序方向等跨模块通用常量，
 * 前端传参约定：sortOrder 取值为 ascend（升序）/ descend（降序）
 */
public interface CommonConstant {

    /**
     * 升序
     */
    String SORT_ORDER_ASC = "ascend";

    /**
     * 降序
     */
    String SORT_ORDER_DESC = " descend";
    
}
