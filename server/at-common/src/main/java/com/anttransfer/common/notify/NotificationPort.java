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
package com.anttransfer.common.notify;

import java.util.Collection;
import java.util.List;

/**
 * 通知发送端口（SPI）——业务模块 → 通知域的<b>唯一</b>入口。
 *
 * <p><b>为何是接口：</b>通知域（{@code sys_notify_message} 的落库、在线推送、离线补拉、
 * 待办聚合）整体归 at-collaboration；而通知的<b>触发方</b>是 at-permission、at-file、
 * at-transfer 等。架构铁律禁止业务模块互相依赖，故按模块依赖倒置（SPI 置于共享内核
 * at-common，实现置于归属模块 at-collaboration）——与 {@code RequiresPerm} 注解
 * 「契约在 at-common、实现在 at-permission」同一处理方式。</p>
 *
 * <p><b>事务语义：</b>实现与调用方<b>同事务</b>落库（保证「审批通过 ↔ 申请人查到结果通知」
 * 一致可见）；WebSocket 推送一律推迟到<b>事务提交后</b>执行——否则会出现「事务回滚但
 * 消息已推送」的幻影通知。跨实例推送经 Redis Pub/Sub（{@code at:ws:channel}）扇出，
 * 推送失败不影响落库，仅转为「离线未读」。</p>
 *
 * <p><b>可用性：</b>通知属「尽力而为」通道，实现内部对单条失败做隔离并吞掉异常；
 * 但<b>配额与落库失败</b>不吞（抛出后由调用方事务决策），避免静默丢通知。</p>
 *
 * @author AntTransfer CE
 */
public interface NotificationPort {

    /**
     * 发送单条通知（同事务落库 + 提交后推送）。
     *
     * @return 落库后的消息 ID；接收人为空或类型非法时返回 {@code null}（跳过并告警）
     */
    Long send(NotificationCommand command);

    /**
     * 批量发送（如群发提醒），逐条隔离失败，返回成功落库的消息 ID 列表。
     */
    List<Long> sendAll(Collection<NotificationCommand> commands);

    /**
     * 未读系统通知数（不含会话消息），用于导航栏红点。
     */
    long unreadCount(long userId);

    /**
     * 指定业务对象是否已发过某类型通知——幂等兜底判定（权威源仍是调用方 Redis 幂等键）。
     */
    boolean existsForBiz(String bizType, Long bizId, int notifyType);
}
