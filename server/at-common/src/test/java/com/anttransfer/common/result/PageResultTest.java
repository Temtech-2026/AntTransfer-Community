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
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * {@link PageResult} 契约测试：与 docs/api/README.md §3 的分页结构保持一致。
 */
class PageResultTest {

    @Test
    void ofIPage_shouldMapRecordsAndCalculatePages() {
        // 仅依赖 mybatis-plus-core 的 IPage 接口（分页实现 Page 在 extension 包，不引入内核）
        @SuppressWarnings("unchecked")
        IPage<String> page = mock(IPage.class);
        when(page.getRecords()).thenReturn(List.of("a", "b"));
        when(page.getTotal()).thenReturn(1024L);
        when(page.getCurrent()).thenReturn(2L);
        when(page.getSize()).thenReturn(20L);

        PageResult<String> result = PageResult.of(page);

        assertEquals(2, result.getCurrent());
        assertEquals(20, result.getPageSize());
        assertEquals(1024, result.getTotal());
        assertEquals(52, result.getPages());
        assertEquals(List.of("a", "b"), result.getRecords());
    }

    @Test
    void pages_shouldRoundUp() {
        PageResult<String> result = PageResult.of(List.of("a"), 101, 1, 20);

        assertEquals(6, result.getPages());
    }

    @Test
    void pages_shouldBeZeroWhenPageSizeInvalid() {
        PageResult<String> result = PageResult.of(List.of("a"), 100, 1, 0);

        assertEquals(0, result.getPages());
    }

    @Test
    void empty_shouldReturnConsistentStructure() {
        PageResult<String> result = PageResult.empty(1, 20);

        assertEquals(0, result.getTotal());
        assertEquals(0, result.getPages());
        assertNotNull(result.getRecords());
        assertTrue(result.getRecords().isEmpty());
    }

    @Test
    void ofNullPage_shouldReturnEmptyStructure() {
        IPage<String> page = null;

        PageResult<String> result = PageResult.of(page);

        assertNotNull(result.getRecords());
        assertEquals(0, result.getTotal());
    }
}
