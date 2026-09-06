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

import com.anttransfer.common.trace.TraceUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link Result} 契约测试：字段语义、成功 / 失败工厂方法、traceId 自动携带。
 */
class ResultTest {

    @AfterEach
    void tearDown() {
        TraceUtils.clear();
    }

    @Test
    void ok_shouldCarrySuccessCodeAndData() {
        Result<String> result = Result.ok("file-1");

        assertEquals(0, result.getCode());
        assertEquals("成功", result.getMessage());
        assertEquals("file-1", result.getData());
        assertTrue(result.isSuccess());
    }

    @Test
    void ok_withoutData_shouldReturnNullData() {
        Result<Void> result = Result.ok();

        assertTrue(result.isSuccess());
        assertNull(result.getData());
    }

    @Test
    void fail_shouldUseErrorCodeAndCustomMessage() {
        Result<Void> result = Result.fail(ErrorCode.PARAM_ERROR, "分片序号不能为空");

        assertEquals(2001, result.getCode());
        assertEquals("分片序号不能为空", result.getMessage());
        assertTrue(!result.isSuccess());
    }

    @Test
    void fail_shouldFallbackToDefaultMessageWhenNull() {
        Result<Void> result = Result.fail(ErrorCode.FILE_TOO_LARGE);

        assertEquals(4006, result.getCode());
        assertEquals("文件大小超出限制", result.getMessage());
        assertEquals(413, ErrorCode.FILE_TOO_LARGE.getHttpStatus());
    }

    @Test
    void result_shouldCarryTraceIdFromCurrentContext() {
        TraceUtils.setTraceId("trace-4test");

        Result<Void> result = Result.ok();

        assertEquals("trace-4test", result.getTraceId());
    }

    @Test
    void result_shouldGenerateTraceIdWhenAbsent() {
        Result<Void> result = Result.ok();

        assertNotNull(result.getTraceId());
        assertEquals(32, result.getTraceId().length());
    }

    @Test
    void flowBranchCodes_shouldKeepHttp200() {
        // 流程分支码：HTTP 200 + body.code 分流（docs/api/error-codes.md）
        assertEquals(200, ErrorCode.INSTANT_UPLOAD_MISS.getHttpStatus());
        assertEquals(4001, ErrorCode.INSTANT_UPLOAD_MISS.getCode());
        assertEquals(200, ErrorCode.CHUNK_MISSING.getHttpStatus());
        assertEquals(200, ErrorCode.GRANT_ALREADY_ACTIVE.getHttpStatus());
        assertEquals(200, ErrorCode.APPLICATION_DUPLICATE.getHttpStatus());
    }
}
