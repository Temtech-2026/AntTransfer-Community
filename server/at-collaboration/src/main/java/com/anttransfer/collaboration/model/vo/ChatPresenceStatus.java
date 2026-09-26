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
package com.anttransfer.collaboration.model.vo;

/**
 * 对端在线状态三态（{@code PRESENCE} 帧与 {@code POST /v1/chat/presence/watch} 共用取值）。
 *
 * <p><b>三态各自的事实依据：</b>
 * <ul>
 *     <li>{@link #ONLINE}（前端绿点）：Redis 里有该用户的活跃记录，且最近活跃时刻在
 *         「健康窗口」（{@code presence-healthy-seconds}，默认 45s = 1.5 × 心跳间隔）以内；</li>
 *     <li>{@link #UNSTABLE}（前端红点）：记录还在，但最近活跃时刻已超出健康窗口——
 *         连接尚未被判死（心跳超时 90s 才清理），却已经开始丢帧 / 卡顿，
 *         正是「网络状态不佳」这一态；</li>
 *     <li>{@link #OFFLINE}（前端灰点）：没有任何活跃记录——要么从未连接，要么记录已随
 *         心跳超时自然过期，要么正常断开时被显式清除。</li>
 * </ul></p>
 *
 * <p><b>为什么「网络不佳」不与「在线」合并成布尔值：</b>三态在 UI 上是三个不同承诺：
 * 绿点承诺「现在发消息他能实时收到」，红点提示「可能收不到、别等回执」，灰点说明
 * 「消息会进他的离线收件箱」。压成两态就必须选一个谎言——要么把弱网画成在线（发送方
 * 干等已读），要么把弱网画成离线（其实对方马上回来了）。</p>
 *
 * <p><b>它是加速态的派生结论，不是权威裁决：</b>三态全部由「Redis 活跃记录 + 本地时钟」
 * 推导，不含任何 DB 判定；判断错（例如时钟漂移导致误判红点）的代价只是点位显示不准，
 * 不影响消息投递与未读——后者与在线与否无关（P-8）。</p>
 *
 * @author AntTransfer CE
 */
public enum ChatPresenceStatus {

    /** 在线：有活跃记录且心跳新鲜（前端绿点） */
    ONLINE,

    /** 网络状态不佳：记录在但心跳已迟到（前端红点） */
    UNSTABLE,

    /** 离线：无活跃记录（前端灰点） */
    OFFLINE
}
