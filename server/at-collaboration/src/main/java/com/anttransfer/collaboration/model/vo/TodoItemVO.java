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

import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

import java.time.LocalDateTime;

/**
 * 待办中心条目——由 {@code sys_notify_message} 聚合而成，<b>不新增待办表</b>。
 *
 * <p><b>为什么不建独立待办表：</b>待办（待我审批 / 驳回结果 / 传输完成提醒）本身就是
 * 「需要用户关注的一条通知」，其生命周期与通知完全重合——已读即已办。再建一张待办表
 * 就必须处理两表状态同步（审批单状态 vs 待办状态 vs 通知已读），任何一处漏写都会出现
 * 「待办已办但通知未读」。以通知为唯一事实源，待办只是「按类型 + 未读」的一个投影视图，
 * 天然不会不一致。</p>
 *
 * <p><b>为何显式暴露 {@code pending}：</b>待办列表需要同时展示「未办」与「已办（历史）」，
 * 由服务端判定而非让前端从 {@code readStatus} 反推，避免口径散落在客户端。</p>
 *
 * @param id         消息 ID（即待办项 ID）
 * @param notifyType 通知类型（1-待我审批 2-审批结果 8-传输完成）
 * @param title      标题
 * @param content    正文（含申请单号 / 结论 / 传输结果）
 * @param bizType    关联业务类型（APPLICATION / TRANSFER）
 * @param bizId      关联业务 ID——前端据此跳转到申请单 / 传输详情
 * @param pending    是否未办（未读）
 * @param createTime 产生时间
 * @author AntTransfer CE
 * @implNote ID 字段以字符串过线，理由见 {@code UserVO}；{@code bizId} 是待办跳转的唯一抓手，
 * 被前端舍入后跳转会落到不存在的详情页。
 */
public record TodoItemVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long id,
        Integer notifyType,
        String title,
        String content,
        String bizType,
        @JsonSerialize(using = ToStringSerializer.class)
        Long bizId,
        boolean pending,
        LocalDateTime createTime) {

    public static TodoItemVO from(NotifyMessage message) {
        if (message == null) {
            return null;
        }
        return new TodoItemVO(
                message.getId(),
                message.getNotifyType(),
                message.getTitle(),
                message.getContent(),
                message.getBizType(),
                message.getBizId(),
                message.isUnread(),
                message.getCreateTime());
    }
}
