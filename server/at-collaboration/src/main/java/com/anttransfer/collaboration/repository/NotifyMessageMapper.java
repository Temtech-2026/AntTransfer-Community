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
import java.util.Collection;
import java.util.List;

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
     * 会话列表聚合：按 {@code (chat_scope, chat_target_id)} 分组，取每组最后一条消息 ID 与未读数。
     *
     * <p><b>为什么「最后一条」用 {@code max(id)} 而不是 {@code max(create_time)}：</b>
     * {@code id} 是自增主键，与插入顺序同序，且不存在「同一秒内的多条消息谁更新」的并列问题；
     * {@code create_time} 受应用时钟与 DB 时钟差异影响，一旦回拨就会让刚发的消息排到旧消息之后，
     * 会话列表的顺序会肉眼可见地跳。</p>
     *
     * <p><b>这条 SQL 正是 {@code idx_session} 的用武之地</b>：索引列序
     * {@code (recipient_user_id, chat_scope, chat_target_id, id)} 恰好匹配
     * 「接收人等值 + 按会话分组 + 取最大 id」，可在索引内顺序完成；
     * 若改成「先拉回全部会话消息再在内存分组」，开销会随历史消息总量线性增长。</p>
     *
     * <p>未读数用 {@code count(case when ... then 1 end)} 而非 {@code sum(read_status = 0)}：
     * 前者返回 BIGINT，与 {@code Long unreadCount} 天然对齐；{@code sum()} 在 MySQL 返回 DECIMAL，
     * 要依赖 JDBC 的隐式数值转换，属无谓的风险。</p>
     *
     * <p>条数上限由调用方先按 {@code notify.chat-conversation-limit} 收敛再传入——
     * 只有把 {@code limit} 下推到 SQL，才能真正省掉「查出来再丢掉」的开销。</p>
     *
     * @param userId 接收人（会话列表的归属者）
     * @param limit  返回的会话数上限
     * @return 按最后一条消息 ID 倒序的会话摘要（最新活跃的排在前）
     */
    @Select("""
            select chat_scope                                  as chatScope,
                   chat_target_id                              as chatTargetId,
                   max(id)                                     as lastMessageId,
                   count(case when read_status = 0 then 1 end) as unreadCount
            from sys_notify_message
            where recipient_user_id = #{userId}
              and notify_type in (6, 7)
              and deleted = 0
            group by chat_scope, chat_target_id
            order by lastMessageId desc
            limit #{limit}
            """)
    List<ConversationSummary> selectConversationSummaries(@Param("userId") Long userId,
                                                          @Param("limit") int limit);

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

    /**
     * 已读回执：取「我发的这批消息」里已被读过的行（消息 × 读者 = 一行）。
     *
     * <p><b>镜像行的定位：</b>写扩散下「我发给 B 的消息」在 B 那里是
     * {@code (recipient=B, sender=我, chat_target_id=我)}——单聊的镜像行 target 指向发送人自己
     * （见 {@code V5} 注释 c：两侧 target 互指对端）。故本查询的
     * {@code mirrorTargetId}：单聊传<b>发送人自己</b>，群聊传<b>群 ID</b>（群内所有行 target 都是群 ID）。</p>
     *
     * <p><b>为什么按 {@code client_msg_id} 逐条点查而不是按会话扫全部镜像行：</b>
     * 会话历史一页最多 {@code notify.chat-history-limit} 条，把这批 client_msg_id 作为 IN 列表下来，
     * 命中量 = 页内条数 × 参与人数，与「该会话历史总量」无关；
     * 反之若只按 (sender, scope, target) 过滤，长会话每次翻页都要把全部镜像行拉出来再丢。
     * 该形态由 {@code V13__chat_read_receipt.sql} 的 {@code idx_sender_session} 支撑。</p>
     *
     * <p>{@code recipient_user_id != senderId} 排除发送人自己那一行：自己发的消息自己必然「已读」
     * （落库即置读），若不排除，每条消息都会把自己算成一位读者。</p>
     *
     * @param senderId        发送人（当前登录人）
     * @param scope           会话范围（1-单聊 2-群聊）
     * @param mirrorTargetId  镜像行侧 target：单聊=发送人自己，群聊=群 ID
     * @param clientMsgIds    待查的客户端消息 ID（非空，由调用方保证；空集合会生成非法 SQL）
     * @return 已读事实（可能同一消息多行 = 多人已读），按行 id 升序
     * @implNote 显式 {@code order by id}：结果集只有「本页条数 × 参与人数」量级，
     * 排序代价可忽略，换来的是「气泡下头像顺序」稳定——不排的话顺序由执行计划决定，
     * 同一会话两次请求可能给出不同顺序，前端列表会无谓重排。
     */
    @Select("""
            <script>
            select client_msg_id     as clientMsgId,
                   recipient_user_id as readerUserId
            from sys_notify_message
            where sender_user_id = #{senderId}
              and chat_scope = #{scope}
              and chat_target_id = #{mirrorTargetId}
              and client_msg_id in
              <foreach collection="clientMsgIds" item="clientMsgId" open="(" separator="," close=")">
                  #{clientMsgId}
              </foreach>
              and recipient_user_id != #{senderId}
              and read_status = 1
              and deleted = 0
            order by id
            </script>
            """)
    List<ChatReadRow> selectReadReceipts(@Param("senderId") Long senderId,
                                         @Param("scope") int scope,
                                         @Param("mirrorTargetId") Long mirrorTargetId,
                                         @Param("clientMsgIds") Collection<String> clientMsgIds);

    /**
     * 会话内「即将被置读」的未读行快照——置读的回执要告诉发送人「刚被读了哪些条」，
     * 而 {@link #markSessionRead} 只回受影响行数，故置读前先取一次快照。
     *
     * <p>WHERE 与 {@code markSessionRead} <b>刻意保持一致</b>（同一谓词、同一索引
     * {@code idx_session}）：两者取的是同一批行，只是动作不同（一个读、一个写）。</p>
     *
     * <p>取最新的 {@code limit} 条即可，不必全取：回执帧只是「加速通道」，
     * 真值始终在 {@code selectReadReceipts}（历史查询）里。一次进入会话可能有上千条未读，
     * 全量塞进一帧会把推送体放大到几百 KB，而前端当前视口就一页——回带多了也看不见。</p>
     *
     * @param userId  接收人（= 本次的读者）
     * @param scope   会话范围
     * @param targetId 会话目标（读者视角）
     * @param limit   最多返回的条数（取最新，同 {@code notify.chat-history-limit}）
     * @return 未读行快照（按 id 倒序）
     */
    @Select("""
            select client_msg_id     as clientMsgId,
                   sender_user_id    as senderUserId,
                   chat_scope        as chatScope,
                   chat_target_id    as chatTargetId,
                   recipient_user_id as readerUserId
            from sys_notify_message
            where recipient_user_id = #{userId}
              and chat_scope = #{scope}
              and chat_target_id = #{targetId}
              and read_status = 0
              and deleted = 0
            order by id desc
            limit #{limit}
            """)
    List<ChatReadRow> selectSessionUnreadRows(@Param("userId") Long userId,
                                             @Param("scope") int scope,
                                             @Param("targetId") Long targetId,
                                             @Param("limit") int limit);

    /**
     * 取「我发的这条逻辑消息」的全部落库行（撤回的定位查询）。
     *
     * <p><b>为什么按 {@code (sender, clientMsgId)} 而不是按行 id：</b>写扩散下一条消息落 N 行
     * （单聊 2 行、群聊 N 行），各行 id 不同、单聊的 {@code chat_target_id} 还互指对端，
     * 只有发送人与幂等键这两列在所有行上一致。按 id 撤只会撤掉自己那一行，
     * 对方那一行原样留着——表现为「我撤了，他还能看到」。</p>
     *
     * <p>只取所需的几列（撤回要用的定位信息 + 时间窗判定用的 {@code create_time}）：
     * 本查询的结果只进内存做「能否撤回」的判定与推送寻址，不返回给调用方，
     * 因此不必把 {@code title / biz_* / read_*} 等列一并拉回。</p>
     *
     * @param senderId    发送人（当前登录人，取自登录态）
     * @param clientMsgId 客户端消息 ID（幂等键）
     * @return 该逻辑消息的所有行（含发送人自己的行与全部镜像行）；不存在或非本人发送时为空
     */
    @Select("""
            select id                as id,
                   recipient_user_id as recipientUserId,
                   sender_user_id    as senderUserId,
                   chat_scope        as chatScope,
                   chat_target_id    as chatTargetId,
                   client_msg_id     as clientMsgId,
                   recall_status     as recallStatus,
                   create_time       as createTime
            from sys_notify_message
            where sender_user_id = #{senderId}
              and client_msg_id = #{clientMsgId}
              and notify_type in (6, 7)
              and deleted = 0
            """)
    List<NotifyMessage> selectOwnMessageRows(@Param("senderId") Long senderId,
                                            @Param("clientMsgId") String clientMsgId);

    /**
     * 批量置撤回：把该逻辑消息的所有行一起翻转（{@link #selectOwnMessageRows} 的写侧）。
     *
     * <p><b>{@code content} 一并清空</b>，理由见 {@code V15} 口径 ②：只置状态不清正文，
     * 等于「撤回」只发生在渲染层，任何一次历史拉取仍能把原文读回来。</p>
     *
     * <p>{@code recall_status = 0} 是<b>幂等条件也</b>是并发保护：两个端同时点撤回，
     * 第二次受影响行数为 0，调用方据此走「已经是撤回态」的幂等分支而不是报错。</p>
     *
     * @return 受影响行数（0 = 不存在 / 非本人发送 / 已撤回）
     */
    @Update("""
            update sys_notify_message
            set recall_status = 1,
                recall_time = #{now},
                content = '',
                update_time = #{now}
            where sender_user_id = #{senderId}
              and client_msg_id = #{clientMsgId}
              and recall_status = 0
              and deleted = 0
            """)
    int recallOwnMessageRows(@Param("senderId") Long senderId,
                             @Param("clientMsgId") String clientMsgId,
                             @Param("now") LocalDateTime now);

    /**
     * 取「我视角下的某条消息」——引用回复写入前的快照来源。
     *
     * <p>查询维度是 {@code recipient_user_id = 我}：被引用的消息既可能是我收到的（对方发的），
     * 也可能是我自己发的（自己那一行 recipient 也是我），两种情形在这一维度下统一，
     * 不必按方向分两条 SQL。</p>
     *
     * <p>取 {@code content} 与 {@code recall_status} 两项即可：前者进快照列，
     * 后者用于拒绝「引用一条已撤回的消息」（正文已清空，引用块会渲染成空白）。</p>
     *
     * @param recipientUserId 接收人（当前登录人）
     * @param clientMsgId     客户端消息 ID
     * @return 命中行；不存在为空（同一逻辑消息在我这里至多一行，故无需取列表）
     */
    @Select("""
            select id               as id,
                   sender_user_id   as senderUserId,
                   chat_scope       as chatScope,
                   chat_target_id   as chatTargetId,
                   client_msg_id    as clientMsgId,
                   content          as content,
                   recall_status    as recallStatus
            from sys_notify_message
            where recipient_user_id = #{recipientUserId}
              and client_msg_id = #{clientMsgId}
              and notify_type in (6, 7)
              and deleted = 0
            order by id
            limit 1
            """)
    NotifyMessage selectQuotableMessage(@Param("recipientUserId") Long recipientUserId,
                                        @Param("clientMsgId") String clientMsgId);
}
