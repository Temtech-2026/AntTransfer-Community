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
package com.anttransfer.collaboration.repository;

import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

/**
 * 站内 / 离线消息数据访问（{@code sys_notify_message}，本模块表族）。
 *
 * <p><b>为什么未读数用三条独立 SQL 而不是一条带条件的聚合：</b>「红点（系统通知）」
 * 与「待办数」是<b>两个不同的产品语义</b>——红点排除会话消息（{@code notify_type not in (6,7)}），
 * 待办只算 {@code (1,2,8)}。合成一条 SQL 会让「口径」埋在拼接字符串里，改一个数就动到另一个；
 * 拆开后每条的语义写在方法名与注释里，评审时可逐条对照 PRD。</p>
 *
 * <p><b>手写 SQL 必须显式带 {@code deleted = 0}</b>：MyBatis-Plus 的逻辑删除只作用于
 * 其自动生成的 SQL（BaseMapper / Wrapper），{@code @Select} / {@code @Update} 注解 SQL
 * 属「自己写的」，不享受该拦截——漏写即把已删除消息算进未读数。</p>
 *
 * <p>会话分页 / 通知分页一律走 BaseMapper + LambdaQueryWrapper（见 {@code NotifyMessageService}），
 * 不在此重复造轮子；本类只放「聚合计数」与「批量状态翻转」这类 Wrapper 表达不清的操作。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface NotifyMessageMapper extends BaseMapper<NotifyMessage> {

    /**
     * 指定业务对象是否已发过某类型通知——幂等兜底判定。
     */
    @Select("""
            select count(1)
            from sys_notify_message
            where biz_type = #{bizType}
              and biz_id = #{bizId}
              and notify_type = #{notifyType}
              and deleted = 0
            """)
    int countByBiz(@Param("bizType") String bizType,
                   @Param("bizId") Long bizId,
                   @Param("notifyType") int notifyType);

    /**
     * 未读系统通知数（导航栏红点）——<b>不含</b>单聊 / 群聊消息，会话未读走会话维度。
     */
    @Select("""
            select count(1)
            from sys_notify_message
            where recipient_user_id = #{userId}
              and read_status = 0
              and notify_type not in (6, 7)
              and deleted = 0
            """)
    long countUnreadInbox(@Param("userId") Long userId);

    /**
     * 未读待办数：待我审批(1) / 审批结果(2) / 传输完成提醒(8)。
     */
    @Select("""
            select count(1)
            from sys_notify_message
            where recipient_user_id = #{userId}
              and read_status = 0
              and notify_type in (1, 2, 8)
              and deleted = 0
            """)
    long countUnreadTodo(@Param("userId") Long userId);

    /**
     * 未读会话消息数（单聊 + 群聊合计），用于聊天入口角标。
     */
    @Select("""
            select count(1)
            from sys_notify_message
            where recipient_user_id = #{userId}
              and read_status = 0
              and notify_type in (6, 7)
              and deleted = 0
            """)
    long countUnreadChat(@Param("userId") Long userId);

    /**
     * 一键已读（清零红点）：只翻转系统通知，<b>不动</b>会话消息未读——
     * 「全部已读」是收件箱动作，不应把聊天记录也标记成已读。
     *
     * @return 受影响行数
     */
    @Update("""
            update sys_notify_message
            set read_status = 1,
                read_time = #{now},
                update_time = #{now}
            where recipient_user_id = #{userId}
              and read_status = 0
              and notify_type not in (6, 7)
              and deleted = 0
            """)
    int markAllInboxRead(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    /**
     * 单条已读——{@code recipient_user_id = #{userId}} 即行级归属校验：
     * 别人的消息读不动（受影响行数 0，由 Service 转 4040，不泄露「该 ID 是否存在」）。
     *
     * @return 受影响行数（1=成功，0=不存在 / 非本人 / 已读）
     */
    @Update("""
            update sys_notify_message
            set read_status = 1,
                read_time = #{now},
                update_time = #{now}
            where id = #{id}
              and recipient_user_id = #{userId}
              and read_status = 0
              and deleted = 0
            """)
    int markRead(@Param("id") Long id,
                 @Param("userId") Long userId,
                 @Param("now") LocalDateTime now);

    /**
     * 会话已读：把某会话下我的未读全部翻转（进入会话即清角标）。
     *
     * @return 受影响行数
     */
    @Update("""
            update sys_notify_message
            set read_status = 1,
                read_time = #{now},
                update_time = #{now}
            where recipient_user_id = #{userId}
              and chat_scope = #{scope}
              and chat_target_id = #{targetId}
              and read_status = 0
              and deleted = 0
            """)
    int markSessionRead(@Param("userId") Long userId,
                        @Param("scope") int scope,
                        @Param("targetId") Long targetId,
                        @Param("now") LocalDateTime now);
}
