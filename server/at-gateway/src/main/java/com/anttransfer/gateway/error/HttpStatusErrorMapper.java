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
package com.anttransfer.gateway.error;

import com.anttransfer.common.result.ErrorCode;

/**
 * HTTP 状态码 → 业务错误码的兜底映射。
 *
 * <p>适用场景：容器已判定请求失败，但请求<b>未进入 Spring MVC 异常处理链</b>，
 * 原始异常语义已丢失（{@code /error} 派发、Tomcat 连接器级拒绝等）。
 * 此时只能依据 HTTP 状态码反推一个<b>已登记</b>的业务错误码，
 * 保证对外仍是统一 {@code Result} 结构。</p>
 *
 * <p>映射原则：</p>
 * <ul>
 *     <li>只做语义确定的映射（401/403/404/413/415/429/502）；</li>
 *     <li>其余 4xx 降级为 {@link ErrorCode#PARAM_ERROR}，5xx 降级为 {@link ErrorCode#SYSTEM_ERROR}；</li>
 *     <li><b>绝不在此新建错误码</b>——新增业务码须先登记到
 *         {@code docs/api/error-codes.md} 并经契约评审（见 {@link ErrorCode} 类注释规约）。</li>
 * </ul>
 *
 * <p>注意：本类只决定「响应体里的业务码」，HTTP 状态码仍由容器/调用方原值透传，
 * 不做改写（例如 414 仍回 414，仅把业务码降级为 2001）。</p>
 *
 * @author AntTransfer CE
 */
public final class HttpStatusErrorMapper {

    /** 工具类禁止实例化 */
    private HttpStatusErrorMapper() {
    }

    /**
     * 按 HTTP 状态码解析兜底业务错误码。
     *
     * @param httpStatus HTTP 状态码（非法值按 500 处理）
     * @return 已登记的业务错误码，永不为 {@code null}
     */
    public static ErrorCode resolve(int httpStatus) {
        return switch (httpStatus) {
            case 401 -> ErrorCode.NOT_LOGIN;
            case 403 -> ErrorCode.NO_AUTH;
            case 404 -> ErrorCode.RESOURCE_NOT_FOUND;
            case 413 -> ErrorCode.FILE_TOO_LARGE;
            case 415 -> ErrorCode.FILE_TYPE_NOT_ALLOWED;
            case 429 -> ErrorCode.RATE_LIMITED;
            case 502 -> ErrorCode.REMOTE_CALL_ERROR;
            default -> httpStatus >= 500 ? ErrorCode.SYSTEM_ERROR : ErrorCode.PARAM_ERROR;
        };
    }
}
