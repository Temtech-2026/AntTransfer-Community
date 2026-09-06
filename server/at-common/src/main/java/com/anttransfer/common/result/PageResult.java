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

import com.baomidou.mybatisplus.core.metadata.IPage;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 统一分页响应体。
 *
 * <p>职责：作为所有分页列表接口 {@code Result.data} 的固定结构，与
 * {@code docs/api/README.md} §3 契约一致——请求参数 {@code current / pageSize / sort}，
 * 响应体 {@code records / total / current / pageSize / pages}。</p>
 *
 * <p>用法示例：</p>
 * <pre>{@code
 *   IPage<UserVO> page = userService.page(new Page<>(current, pageSize), wrapper);
 *   return Result.ok(PageResult.of(page));
 * }</pre>
 *
 * <p>约束：{@code pageSize} 由 {@code at.common.mybatis.MybatisPlusConfig} 的分页插件
 * 限制上限为 100（超限自动收敛），前端不得依赖更大的页长。</p>
 *
 * @param <T> 单条记录类型
 * @author AntTransfer CE
 */
@Getter
@Setter
public class PageResult<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 当前页数据（无数据时为空数组，永不为 null） */
    private List<T> records = new ArrayList<>();

    /** 总记录数 */
    private long total;

    /** 当前页码（回显请求值，从 1 开始） */
    private long current;

    /** 每页条数（回显请求值） */
    private long pageSize;

    /** 总页数（由 total 与 pageSize 计算） */
    private long pages;

    /**
     * 依据 MyBatis-Plus 分页对象组装（推荐入口）。
     *
     * @param page MP 分页结果，为 null 时返回空页
     */
    public static <T> PageResult<T> of(IPage<T> page) {
        if (page == null) {
            return new PageResult<>();
        }
        return of(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize());
    }

    /**
     * 依据明细数据组装。
     *
     * @param records   当前页数据，为 null 时视为空数组
     * @param total     总记录数
     * @param current   当前页码（从 1 开始）
     * @param pageSize  每页条数
     */
    public static <T> PageResult<T> of(List<T> records, long total, long current, long pageSize) {
        PageResult<T> result = new PageResult<>();
        result.setRecords(records == null ? new ArrayList<>() : records);
        result.setTotal(total);
        result.setCurrent(current);
        result.setPageSize(pageSize);
        result.setPages(calculatePages(total, pageSize));
        return result;
    }

    /** 空页（无数据场景，保持结构一致，避免前端判空分支） */
    public static <T> PageResult<T> empty(long current, long pageSize) {
        return of(new ArrayList<T>(), 0L, current, pageSize);
    }

    /** 总页数：pageSize 非正数时为 0，避免除零 */
    private static long calculatePages(long total, long pageSize) {
        if (pageSize <= 0) {
            return 0L;
        }
        return (total + pageSize - 1) / pageSize;
    }
}
