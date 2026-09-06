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
package com.anttransfer.common.exception;

import com.anttransfer.common.result.ErrorCode;

/**
 * 认证 / 授权异常（{@link ErrorCode} 的 1xxx 段）。
 *
 * <p>职责：与“业务可控失败”{@link BusinessException} 区分开，
 * 专用于登录态与权限判定失败，便于全局异常处理器按类分级处理——
 * 认证类失败需要前端区分「静默换令牌」还是「跳登录」，
 * 与参数错误（2xxx）、文件传输（4xxx）处理策略完全不同。</p>
 *
 * <p>推荐使用的错误码（详见 {@code docs/api/error-codes.md}）：</p>
 * <ul>
 *     <li>{@link ErrorCode#NOT_LOGIN}（1001）：未携带 token；</li>
 *     <li>{@link ErrorCode#TOKEN_EXPIRED}（1002）：access token 过期，前端应静默刷新并重放；</li>
 *     <li>{@link ErrorCode#TOKEN_INVALID}（1003）：令牌伪造 / 签名错误 / 已吊销；</li>
 *     <li>{@link ErrorCode#NO_AUTH}（1004）：已登录但无权限点或数据范围不足；</li>
 *     <li>{@link ErrorCode#ACCOUNT_LOCKED}（1005）、{@link ErrorCode#ACCOUNT_DISABLED}（1006）。</li>
 * </ul>
 *
 * <p>用法示例：</p>
 * <pre>{@code
 *   if (loginUser == null) {
 *       throw new AuthException(ErrorCode.NOT_LOGIN);
 *   }
 *   if (!accessControl.canDownload(loginUser, fileId)) {
 *       throw new AuthException(ErrorCode.NO_AUTH);
 *   }
 * }</pre>
 *
 * <p>接入说明：at-auth 引入 Spring Security 后，应在其认证入口将
 * {@code AuthenticationException} / {@code AccessDeniedException} 转换为本异常，
 * 以保证响应体恒为 {@code Result{code,message,data,traceId}}。</p>
 *
 * @author AntTransfer CE
 */
public class AuthException extends BusinessException {

    private static final long serialVersionUID = 1L;

    /**
     * 仅错误码：message 复用 {@link ErrorCode#getMessage()}。
     */
    public AuthException(ErrorCode errorCode) {
        super(errorCode);
    }

    /**
     * 错误码 + 自定义提示。
     */
    public AuthException(ErrorCode errorCode, String message) {
        super(errorCode, message);
    }

    /**
     * 错误码 + 根因（内部记录，不对外暴露）。
     */
    public AuthException(ErrorCode errorCode, Throwable cause) {
        super(errorCode, cause);
    }
}
