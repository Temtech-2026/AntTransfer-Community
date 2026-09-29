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

import com.anttransfer.collaboration.model.entity.ChatPeerAlias;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 会话对端备注数据访问（{@code sys_chat_peer_alias}，本模块表族）。
 *
 * <p><b>为什么这里要手写 SQL（而不是全走 Wrapper）：</b>备注的「设置」是一次
 * <b>复活语义的 upsert</b>——{@code (owner, peer)} 那一行可能在取消备注时被置了
 * {@code deleted=1}，而 MyBatis-Plus 的逻辑删除会把 {@code deleted=0} 追加到它生成的
 * 每一条 SQL 上，于是「查得到那行」与「能改那行」这两件事都做不到：</p>
 * <ul>
 *     <li>{@code @Select} 查不到已删除行 → 会误判为「还没设备注」而插入第二行，
 *         直接撞 {@code uk_owner_peer}；</li>
 *     <li>{@code updateById} 自动带 {@code deleted=0} 条件 → 复活那一行会静默影响 0 行。</li>
 * </ul>
 * <p>因此本类显式提供「忽略逻辑删除地找到那一行」与「把它复活」两个操作。
 * 手写的 SQL 不享受逻辑删除拦截，条件必须自己写全（此处是刻意的）。</p>
 *
 * <p>批量读取（会话列表填充备注）不需要这些：那是纯粹的「活的」查询，
 * 走 {@code BaseMapper.selectList} + Wrapper 即可，自动带 {@code deleted=0}。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface ChatPeerAliasMapper extends BaseMapper<ChatPeerAlias> {

    /**
     * 找 {@code (owner, peer)} 那一行——<b>包括已被取消（{@code deleted=1}）的那行</b>。
     *
     * <p>刻意不带 {@code deleted} 条件：调用方要据此决定「复活」还是「新建」。
     * 漏掉这个语义就会走成「插入第二行」，而唯一键不含 {@code deleted}，
     * 结果是保存备注直接报重复键。</p>
     *
     * @param ownerUserId 备注归属者（当前登录人）
     * @param peerUserId  被备注的人
     * @return 命中行（可能为已删除状态）；不存在返回 {@code null}
     */
    @Select("""
            select id,
                   owner_user_id as ownerUserId,
                   peer_user_id  as peerUserId,
                   alias         as alias,
                   deleted       as deleted
            from sys_chat_peer_alias
            where owner_user_id = #{ownerUserId}
              and peer_user_id = #{peerUserId}
            limit 1
            """)
    ChatPeerAlias selectAny(@Param("ownerUserId") Long ownerUserId,
                            @Param("peerUserId") Long peerUserId);

    /**
     * 写入备注并<b>复活</b>该行（{@code deleted} 归 0）。
     *
     * <p>用 UPDATE 而不是「删旧插新」：唯一键不含 {@code deleted}，插新必撞键；
     * 且复活是幂等的——重复保存只改 {@code alias}，不产生任何新行。</p>
     *
     * @param id         命中行主键（来自 {@link #selectAny}）
     * @param alias      新备注名（调用方已 trim 且非空）
     * @param operatorId 操作人（当前登录人，写入 update_by）
     * @return 影响行数
     */
    @Update("""
            update sys_chat_peer_alias
            set alias       = #{alias},
                deleted     = 0,
                update_by   = #{operatorId},
                update_time = now()
            where id = #{id}
            """)
    int revive(@Param("id") Long id,
               @Param("alias") String alias,
               @Param("operatorId") Long operatorId);

    /**
     * 按 {@code (owner, peer)} 直接把备注写成「生效」状态——<b>当前读</b>版复活。
     *
     * <p>专供 {@code ChatService#setPeerAlias} 的撞键兜底。并发首次设置时，输家的第一次
     * {@link #selectAny} 建立的事务快照早于赢家提交（MySQL 默认 REPEATABLE READ），
     * 于是撞键后再拿 {@link #selectAny} 回查，读到的依旧是「没有这一行」——重复键会被原样抛给用户
     * （连点保存 / 弱网重发就能复现）。而 UPDATE 是当前读，能看到赢家已提交的那一行，
     * 直接收敛成「改成我这次的备注」。</p>
     *
     * <p>与 {@link #revive} 的分工：那条路径先 {@code selectAny} 拿到主键再改（精确、可读），
     * 只在「本来就查得到」时走；本条不依赖任何先验读取，是撞键后唯一正确的出路。</p>
     *
     * @param ownerUserId 备注归属者（当前登录人）
     * @param peerUserId  被备注的人
     * @param alias       新备注名（调用方已 trim 且非空）
     * @param operatorId  操作人（当前登录人，写入 update_by）
     * @return 影响行数；0 表示该行并不存在（冲突另有原因，调用方应如实上抛而非假装成功）
     */
    @Update("""
            update sys_chat_peer_alias
            set alias       = #{alias},
                deleted     = 0,
                update_by   = #{operatorId},
                update_time = now()
            where owner_user_id = #{ownerUserId}
              and peer_user_id = #{peerUserId}
            """)
    int reviveByOwnerPeer(@Param("ownerUserId") Long ownerUserId,
                          @Param("peerUserId") Long peerUserId,
                          @Param("alias") String alias,
                          @Param("operatorId") Long operatorId);
}
