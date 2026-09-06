package com.fast.springbootinit.common;

import com.fast.springbootinit.constant.CommonConstant;
import lombok.Data;

/**
 * 分页请求基类：业务分页查询请求（如 PostQueryRequest）继承该类，
 * 即可自动获得 current/pageSize/sortField/sortOrder 四个通用分页参数
 */
@Data
public class PageRequest {

    /**
     * 当前页号
     */
    private int current = 1;

    /**
     * 页面大小
     */
    private int pageSize = 10;

    /**
     * 排序字段
     */
    private String sortField;

    /**
     * 排序顺序（默认升序）
     */
    private String sortOrder = CommonConstant.SORT_ORDER_ASC;
}
