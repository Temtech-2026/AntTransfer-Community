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
package com.anttransfer.gateway.transport;

import com.anttransfer.common.spi.transport.TransportStrategy;
import org.springframework.util.StringUtils;

/**
 * CE 默认传输策略：<b>HTTP/1.1 与 HTTP/2</b>（具体版本由容器与反向代理决定，应用层不区分）。
 *
 * <p><b>为什么 {@code supports} 对 https 也返回 true</b>：本接口的 {@code protocol()} 是「传输通道族」，
 * 不是「是否加密」——TLS 由 {@code secure} 字段单独表达。把 https 判为不支持，会让「一个部署只装了
 * CE HTTP 策略」在 HTTPS 请求下选不到任何策略，属于自己把自己挡在门外。</p>
 *
 * <p><b>为什么 scheme 缺失时返回 true</b>：网关是入口，可能拿不到客户端可见 scheme（未经反向代理
 * 透传 {@code X-Forwarded-Proto}）。此时按「CE 只有这一条通道」兜底，而不是返回「无可用协议」。</p>
 *
 * <p>不提供无参单例以外的状态，{@code supports} 无副作用、可重复调用（满足 SPI 约束）。</p>
 *
 * @author AntTransfer CE
 */
public class HttpTransportStrategy implements TransportStrategy {

    /** 协议标识，同时是装配层去重键 */
    public static final String PROTOCOL = "http";

    @Override
    public String protocol() {
        return PROTOCOL;
    }

    @Override
    public boolean supports(TransportRequest request) {
        if (request == null || !StringUtils.hasText(request.scheme())) {
            return true;
        }
        String scheme = request.scheme().trim();
        return PROTOCOL.equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
    }
}
