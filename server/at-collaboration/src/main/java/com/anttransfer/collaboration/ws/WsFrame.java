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
package com.anttransfer.collaboration.ws;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 下行帧信封（{@code {type, data, ts}}）。
 *
 * <p>{@code data} 用 {@code Object} 承载——帧类型不同、载荷结构不同，用泛型 record 会把
 * 序列化类型信息搞复杂；Jackson 按运行时类型序列化即可。客户端按 {@code type} 决定解析分支。</p>
 *
 * <p>{@code ts} 为服务端出帧时刻（epoch millis）：客户端可用于乱序丢弃（跨实例广播
 * 经 Redis 中转，理论上可能出现重放/乱序）与「消息延迟」埋点。</p>
 *
 * @param type 帧类型，取值见 {@link WsProtocol}
 * @param data 载荷（可为 null，如 PONG）
 * @param ts   出帧时刻（epoch millis）
 * @author AntTransfer CE
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WsFrame(String type, Object data, long ts) {

    /** 构造一个带当前时间戳的帧。 */
    public static WsFrame of(String type, Object data) {
        return new WsFrame(type, data, System.currentTimeMillis());
    }

    /** 无载荷帧（PONG / PING）。 */
    public static WsFrame signal(String type) {
        return new WsFrame(type, null, System.currentTimeMillis());
    }
}
