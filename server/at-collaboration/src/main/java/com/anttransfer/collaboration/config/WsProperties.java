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
package com.anttransfer.collaboration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * WebSocket 通道配置：{@code anttransfer.collaboration.ws.*}。
 *
 * <p><b>心跳两个阈值的取值逻辑：</b>探测间隔取 30s、超时取 90s（= 3 倍间隔）。</p>
 * <ul>
 *     <li><b>间隔 30s</b>：需远小于常见 NAT / 负载均衡的空闲连接回收时间（通常 60~300s），
 *         否则连接会在「服务端还以为在线」时被中间设备静默掐断；</li>
 *     <li><b>超时 90s</b>：必须 &gt; 间隔，且留有 3 次容错——一次抖动、一次 GC 停顿、
 *         一次丢包都不至于误判离线。宁可晚 60s 清理僵尸连接，也不要频繁误踢真实用户
 *         （误踢的代价是用户漏收实时推送 + 反复重连）。</li>
 * </ul>
 *
 * <p><b>发送缓冲上限的意义：</b>连接「只收不消费」（客户端假死）时，待发队列会无限堆积，
 * 最终 OOM。设定发送超时与缓冲上限后，写不出去即判定该连接已死并踢掉——
 * 保消息可查（库里有），舍「必须送到这条僵尸连接」。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "anttransfer.collaboration.ws")
public class WsProperties {

    /** 心跳探测间隔（秒）：服务端每隔该时长向本机全部连接发 PING */
    private int heartbeatIntervalSeconds = 30;

    /** 心跳超时（秒）：超过该时长未收到任何上行帧即判定掉线并清理（须 > 探测间隔） */
    private int heartbeatTimeoutSeconds = 90;

    /** 单条消息发送超时（毫秒）：超过即判定连接写阻塞，踢除 */
    private int sendTimeLimitMillis = 5_000;

    /** 单连接发送缓冲上限（字节）：堆积超过该值判定客户端停止消费，踢除（默认 512KB） */
    private int bufferSizeLimitBytes = 512 * 1024;

    /** 单帧文本消息上限（字节）：防超大帧打爆内存，默认 64KB（通知远小于此） */
    private int textMessageSizeLimitBytes = 64 * 1024;
}
