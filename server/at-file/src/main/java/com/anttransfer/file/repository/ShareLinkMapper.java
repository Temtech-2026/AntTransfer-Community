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

import com.anttransfer.file.model.entity.ShareLink;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * 外发链接 Mapper。
 *
 * <p><b>为什么下载次数必须走这里的原子 SQL（P-8 / 红队 [C-08]）</b>：
 * 「读 downloaded_count → 判断 → 回写」在并发下必然超发。此处以
 * {@code UPDATE ... SET downloaded_count = downloaded_count + 1 WHERE ...} 的单条语句
 * 让数据库做行锁下的判定 + 自增，<b>影响行数 = 1 才放行</b>，从根上杜绝超卖。</p>
 *
 * <p>Redis 的 {@code at:share:count:{token}} 只是<b>前置快速失败闸门</b>（挡掉绝大多数无效请求，
 * 降低 DB 压力），正确性一律以本 Mapper 的影响行数为准——即便 Redis 丢键 / 计数漂移，
 * 也不会多发一次下载。</p>
 *
 * <p>注意：原生 {@code @Update} 不经过 MyBatis-Plus 实体填充与 {@code @TableLogic} 拦截，
 * 因此 SQL 内显式书写 {@code deleted = 0}；{@code update_time} 由表定义的
 * {@code ON UPDATE CURRENT_TIMESTAMP} 维护。过期判定统一用<b>应用时钟</b>入参 {@code now}
 * （单一时钟源，见红队 [T-08]），不使用 {@code now()} 以免双时钟漂移。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface ShareLinkMapper extends BaseMapper<ShareLink> {

    /**
     * 原子占用 1 次下载额度（校验未撤销 + 未过期 + 未达上限），并在<b>用掉最后一次</b>时同一语句内
     * 收敛为「已失效」终态——避免「额度已满但仍显示生效」的悬空状态，也省去一次额外回读。
     *
     * <p><b>赋值顺序是正确性的一部分，勿调整</b>：{@code status} / {@code revoke_at} 必须写在
     * {@code downloaded_count} 之前，因为其 CASE 里引用的 {@code downloaded_count} 必须是<b>自增前</b>
     * 的旧值。MySQL 的 SET 子句按从左到右求值且后续表达式会看到已赋的新值，先读后写才与标准 SQL 一致；
     * 若调换顺序，{@code downloaded_count} 将变成「已 +1」的新值，导致提前（如 limit=2 时首次下载即）
     * 误判为达上限。</p>
     *
     * <p><b>为何不会误伤并发成功者</b>：InnoDB 对同一行加排他锁，并发 UPDATE 严格串行且每次都读最新已提交值，
     * 因此「判定为最后一次」的必然是最后执行的那条；其置 {@code status=2} 之后不会再有本可成功的 UPDATE
     * 被拒（此后所有语句本就因 {@code downloaded_count < download_limit} 不成立而失败）。</p>
     *
     * @param id  链接主键
     * @param now 当前时间（应用时钟）
     * @return 影响行数：1=占用成功；0=链接已撤销 / 已过期 / 额度耗尽（调用方据此裁决 4012 / 4004）
     */
    @Update("update sys_share_link "
            + "set status = case when downloaded_count >= download_limit - 1 then 2 else status end, "
            + "revoke_at = case when downloaded_count >= download_limit - 1 then #{now} else revoke_at end, "
            + "downloaded_count = downloaded_count + 1 "
            + "where id = #{id} and status = 0 and deleted = 0 "
            + "and expire_at > #{now} and downloaded_count < download_limit")
    int consumeDownloadQuota(@Param("id") Long id, @Param("now") LocalDateTime now);

    /**
     * 收敛为「已失效」（过期 / 达上限），CAS 保证只迁移一次。
     *
     * @param id  链接主键
     * @param now 失效时间（应用时钟）
     * @return 影响行数：1=本次完成迁移；0=已非生效态（幂等，无需处理）
     */
    @Update("update sys_share_link set status = 2, revoke_at = #{now} "
            + "where id = #{id} and status = 0 and deleted = 0")
    int markInvalidated(@Param("id") Long id, @Param("now") LocalDateTime now);

    /**
     * 撤销链接（0 生效 → 1 已撤销），CAS 保证只迁移一次。
     *
     * @param id  链接主键
     * @param now 撤销时间（应用时钟）
     * @return 影响行数：1=撤销成功；0=已是终态（调用方据此返回 4012）
     */
    @Update("update sys_share_link set status = 1, revoke_at = #{now} "
            + "where id = #{id} and status = 0 and deleted = 0")
    int revoke(@Param("id") Long id, @Param("now") LocalDateTime now);

    /**
     * 批量撤销：把<b>属于该用户</b>且仍在生效中的链接一次性迁移到「已撤销」终态。
     *
     * <p><b>为什么不是「查出来逐条 revoke」</b>：批量 / 一键失效是破坏性操作，逐条 CAS 会在中途
     * 留下「一部分已撤销、一部分仍生效」的中间态，用户重试时又分不清哪几条还没撤。
     * 单条语句让整批在一个事务里一次成行，<b>影响行数即本批真正失效的条数</b>。</p>
     *
     * <p>{@code owner_user_id} 过滤是<b>越权防线本身</b>而不是优化：令牌来自客户端、不可信，
     * 即便有人构造他人的令牌也匹配不到任何行。返回 0 且不区分「不存在 / 非本人 / 已终态」，
     * 避免用批量接口反向枚举他人链接（与 {@code requireOwnedLink} 的不可区分口径一致）。</p>
     *
     * @param ownerUserId 链接归属人（当前登录用户）
     * @param tokens      目标令牌集合（调用方已去重、非空，上界见 {@code RevokeSharesRequest}）
     * @param now         撤销时间（应用时钟）
     * @return 影响行数 = 实际失效条数（幂等：重复调用返回 0）
     */
    @Update("<script>update sys_share_link set status = 1, revoke_at = #{now} "
            + "where owner_user_id = #{ownerUserId} and status = 0 and deleted = 0 and token in "
            + "<foreach collection='tokens' item='token' open='(' separator=',' close=')'>#{token}</foreach>"
            + "</script>")
    int revokeBatch(@Param("ownerUserId") Long ownerUserId,
                    @Param("tokens") Collection<String> tokens,
                    @Param("now") LocalDateTime now);

    /**
     * 一键失效：把该用户<b>全部</b>生效中的链接迁移到「已撤销」终态。
     *
     * <p>刻意<b>不接</b>「分页 / 条数上限」参数，也不做「查一页撤一页」的补偿式遍历：
     * 语义就是「全部」，漏掉一部分比整批失败更糟——用户会以为全都失效了，实际还有链接可取件。</p>
     *
     * @param ownerUserId 链接归属人（当前登录用户）
     * @param now         撤销时间（应用时钟）
     * @return 影响行数 = 实际失效条数（幂等：没有生效中的链接时返回 0）
     */
    @Update("update sys_share_link set status = 1, revoke_at = #{now} "
            + "where owner_user_id = #{ownerUserId} and status = 0 and deleted = 0")
    int revokeAllActive(@Param("ownerUserId") Long ownerUserId, @Param("now") LocalDateTime now);

    /**
     * 查询该用户全部「生效中」链接的令牌。
     *
     * <p>为什么<b>不</b>用 {@code Wrappers.lambdaQuery().select(...)} 取这一列：本 Mapper 的写路径
     * 全是手写 SQL（原生语句不经过 {@code @TableLogic} 拦截，所以每处都显式写 {@code deleted = 0}），
     * 而这一列的用途只有一个——撤销后按 token 清 Redis 配额镜像。手写单列查询既避免把
     * 提取码哈希等无关列拉回内存，也让这段读路径能脱离 Spring 上下文被单测覆盖。</p>
     *
     * @param ownerUserId 链接归属人（当前登录用户）
     * @return 生效中的令牌列表（无则为空列表）
     */
    @Select("select token from sys_share_link "
            + "where owner_user_id = #{ownerUserId} and status = 0 and deleted = 0")
    List<String> selectActiveTokens(@Param("ownerUserId") Long ownerUserId);
}
