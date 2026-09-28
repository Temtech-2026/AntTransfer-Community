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

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Redis 广播信封（{@code at:ws:channel} 上流动的报文）。
 *
 * <p><b>为什么载荷是 {@link JsonNode} 而不是 {@link WsFrame}：</b>订阅端拿到消息后
 * 只需要「原样转发给本机会话」——若在订阅端做「反序列化成 WsFrame 再序列化」，
 * 等于对每条消息多两次对象映射，且一旦两端 DTO 版本不一致（滚动发布期间新旧实例共存）
 * 就会反序列化失败而<b>整条丢弃</b>。改用 {@code JsonNode} 后，订阅端只认
 * {@code userId} 这一个字段，帧体对它是不可见的黑盒——新旧版本可安全共存。</p>
 *
 * <p><b>{@code userId} 为 {@code null} 表示「全员广播」</b>（订阅端投给本机所有连接，
 * 不做用户筛选），用于「所有端都该知道」的少量帧（当前唯一用例是资料变更
 * {@code PROFILE}）。之所以复用同一个信封而不是新开一个 record：订阅端只需多一个
 * {@code null} 分支，滚动发布期间也天然兼容——旧实例收到 {@code userId=null} 按原逻辑
 * 直接丢弃（不投递、不报错），新实例则照常广播，不存在新旧协议互相打脸的情况。</p>
 *
 * @param userId 目标用户 ID（订阅端据此筛选本机连接）；为 {@code null} 表示全员广播
 * @param frame  帧体（不透明转发，订阅端不做结构假设）
 * @author AntTransfer CE
 */
public record WsDelivery(Long userId, JsonNode frame) {
}
