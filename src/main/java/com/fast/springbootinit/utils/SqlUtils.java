package com.fast.springbootinit.utils;

import org.apache.commons.lang3.StringUtils;

/**
 * SQL 工具类：校验排序字段合法性，防止前端传入恶意字段名拼接 order by 造成 SQL 注入，
 * 分页查询组装 QueryWrapper 前先调用 validSortField 校验
 *
 * @author <a href="https://github.com/liyupi">程序员鱼皮</a>
 * @from <a href="https://yupi.icu">编程导航知识星球</a>
 */
public class SqlUtils {

    /**
     * 校验排序字段是否合法（防止 SQL 注入）
     *
     * @param sortField
     * @return
     */
    public static boolean validSortField(String sortField) {
        if (StringUtils.isBlank(sortField)) {
            return false;
        }
        return !StringUtils.containsAny(sortField, "=", "(", ")", " ");
    }
}
