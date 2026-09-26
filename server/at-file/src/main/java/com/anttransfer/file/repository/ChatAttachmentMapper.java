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
package com.anttransfer.file.repository;

import com.anttransfer.file.model.entity.ChatAttachment;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

/**
 * 会话附件授权 Mapper。
 *
 * <p>除 MyBatis-Plus 的常规 CRUD 外，只有两个方法，全部是<b>手写 SQL 的原子状态迁移</b>：
 * {@link #consumeDownloadQuota} 与 {@link #revoke}。它们共同的特点是「判定条件与写入必须在
 * 同一条 UPDATE 里完成」，不允许拆成「先查后写」。</p>
 *
 * <p><b>为什么不能用 {@code @TableLogic} 自动拼 deleted：</b>手写 SQL 不经过 MyBatis-Plus 的
 * 条件构造器，逻辑删除条件不会被注入，因此两处都显式写了 {@code deleted = 0}。
 * 漏写会让「已逻辑删除的行」重新变得可被扣减额度，是静默越权。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface ChatAttachmentMapper extends BaseMapper<ChatAttachment> {

    /**
     * 原子消耗一次下载额度（下载放行的唯一裁决点）。
     *
     * <p>把「是否还能下载」与「扣减」压进同一条 UPDATE 的 WHERE 里，是防超卖的关键：
     * 若拆成「先 select 判 download_count &lt; download_limit，再 update +1」，
     * 并发请求会同时读到未超限的旧值，把「限 1 次」卖成 N 次。</p>
     *
     * <p>三重守卫：{@code status = 0}（未撤销、未失效）、{@code expire_at} 未过、
     * {@code download_limit = 0 or download_count < download_limit}（未超限）。</p>
     *
     * <p>额度恰好用尽时顺手收敛为 {@link ChatAttachment#STATUS_EXPIRED}（同
     * {@code sys_share_link} 的口径）：否则该行会永远停在「生效但额度为 0」的状态，
     * 让接收方反复换来一张必然取不到件的票据。本次扣减本身仍然成功（影响行数为 1）。</p>
     *
     * @param id  附件授权 ID
     * @param now 判定「是否已过期」的服务端时间（由调用方统一注入，避免 SQL 内取时钟导致不可测）
     * @return 影响行数：1=已放行并扣减；0=不允许取件（已撤销 / 已过期 / 额度用尽 / 行不存在）
     */
    @Update("""
            update sys_chat_attachment
               set download_count = download_count + 1,
                   status = case
                                when download_limit > 0 and download_count + 1 >= download_limit then 2
                                else status
                            end,
                   update_time = #{now}
             where id = #{id}
               and deleted = 0
               and status = 0
               and (expire_at is null or expire_at > #{now})
               and (download_limit = 0 or download_count < download_limit)
            """)
    int consumeDownloadQuota(@Param("id") Long id, @Param("now") LocalDateTime now);

    /**
     * 撤销授权（发送方的绝对否决）。
     *
     * <p>带 {@code sender_user_id} 与 {@code status = 0} 双重守卫：
     * 前者保证只有发送方能撤销自己的授权（越权影响行数为 0，由服务层转为「不存在」）；
     * 后者让撤销成为幂等操作——重复撤销不会把 {@link ChatAttachment#STATUS_EXPIRED}
     * 抹回 {@link ChatAttachment#STATUS_REVOKED}，避免覆盖「因过期而失效」这一事实。</p>
     *
     * @param id           附件授权 ID
     * @param senderUserId 操作人（必须等于行的发送方）
     * @param now          操作时间
     * @return 影响行数：1=本次真正撤销；0=已处于终态 / 非本人 / 行不存在
     */
    @Update("""
            update sys_chat_attachment
               set status = 1, update_by = #{senderUserId}, update_time = #{now}
             where id = #{id}
               and deleted = 0
               and status = 0
               and sender_user_id = #{senderUserId}
            """)
    int revoke(@Param("id") Long id,
               @Param("senderUserId") Long senderUserId,
               @Param("now") LocalDateTime now);

    /**
     * 把「已过期但仍停在生效态」的行收敛为终态（{@link ChatAttachment#STATUS_EXPIRED}）。
     *
     * <p><b>为什么需要这次主动收敛：</b>过期本身是按 {@code expire_at} 与当前时间比较判出来的，
     * 不依赖任何写入——但若从不在库里落地，发送方与接收方的列表会一直把一条早已无效的授权
     * 显示成「生效中」，两边对「还能不能取件」的认知不一致。因此每次判定命中过期时顺手收敛一次，
     * 让状态列最终自洽。</p>
     *
     * <p><b>只收敛「过期」，不收敛「额度用尽」：</b>后者已由
     * {@link #consumeDownloadQuota} 在扣减的同一条 UPDATE 里完成，重复收敛没有必要；
     * 更重要的是本方法<b>不能</b>覆盖 {@link ChatAttachment#STATUS_REVOKED}——
     * 撤销是发送方的绝对否决，语义上高于「恰好过期」。</p>
     *
     * @param id  附件授权 ID
     * @param now 判定时间
     * @return 影响行数：1=本次真正收敛；0=行不存在 / 非生效态 / 尚未过期
     */
    @Update("""
            update sys_chat_attachment
               set status = 2, update_time = #{now}
             where id = #{id}
               and deleted = 0
               and status = 0
               and expire_at is not null
               and expire_at <= #{now}
            """)
    int markExpired(@Param("id") Long id, @Param("now") LocalDateTime now);
}
