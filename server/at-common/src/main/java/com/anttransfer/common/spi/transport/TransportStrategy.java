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
package com.anttransfer.common.spi.transport;

/**
 * 传输协议策略扩展点（CE/EE 边界接口）。
 *
 * <p><b>定位</b>：CE 只有 HTTP/1.1 + HTTP/2（由容器与反向代理决定）；企业版可能要求 QUIC /
 * 私有加密隧道 / 专线接入。本接口是「客户端该走哪种协议、以及该协议是否可用」的唯一声明点，
 * 客户端据此选择上传下载通道，而不必在服务端代码里散布 {@code if (quicEnabled)}。</p>
 *
 * <p><b>当前接线状态（诚实声明）</b>：CE 的下发与上传 URL 目前全部由 HTTP 端点直接提供，
 * 服务端不存在协议协商分支——因此本扩展点在 CE 属于<b>已就绪但尚未被主链路读取</b>的接缝：
 * 只保证「CE 必有默认 Bean、EE 插入实现不会与 CE 冲突」。EE 启用时需在网关或传输模块中
 * 读取 {@code List&lt;TransportStrategy&gt;} 并对外暴露能力声明（属 EE 侧接线，不在 CE 范围）。</p>
 *
 * <p><b>实现约束</b>：</p>
 * <ul>
 *     <li>{@link #supports(TransportRequest)} 必须无副作用、可重复调用（会被每请求或每能力查询调用）；</li>
 *     <li>同一 {@link #protocol()} 只允许一个实现（重复注册视为配置错误，由装配层校验并拒绝启动）；</li>
 *     <li>不得在此发起网络探测（协议可用性由部署与探测组件负责），避免把启动或请求路径拖入超时。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
public interface TransportStrategy {

    /**
     * 协议标识（{@code http} / {@code quic} …），小写。
     */
    String protocol();

    /**
     * 该协议是否适用于给定请求上下文。
     */
    boolean supports(TransportRequest request);

    /**
     * 传输请求上下文。
     *
     * @param scheme 客户端可见的 scheme（{@code http} / {@code https}）
     * @param port   客户端可见的端口（未知为 {@code -1}）
     * @param secure 是否已建立传输层加密
     */
    record TransportRequest(String scheme, int port, boolean secure) {
    }
}
