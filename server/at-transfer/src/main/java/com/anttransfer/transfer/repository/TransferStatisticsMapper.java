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
package com.anttransfer.transfer.repository;

import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.transfer.model.dto.TransferActivityRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 传输统计聚合查询：按「动作 + 结果」在审计表上分组，取条数与实际过网字节。
 *
 * <p><b>为什么不另立传输统计表</b>：{@code sys_operation_log} 是共享内核里的横切账本
 * （实体与 Mapper 都在 at-common），上传 / 下载活动本就有流水；再建一张统计表就得靠
 * 双写保证一致，而双写必然漂移。此处只读账本，天然与业务动作同源。</p>
 *
 * <p><b>字节为什么从 detail JSON 里取</b>：{@code detail} 中的字节键由
 * {@link OperationLog} 集中定义（{@code DETAIL_TRANSFERRED_BYTES} / {@code DETAIL_SENT_BYTES}），
 * 写方（at-file）与本 SQL 引用同一常量——键名一旦改动即编译失败，不会退化成
 * 「字段悄悄为 null、统计悄悄变 0」。JSON 异常或键缺失时 {@code coalesce} 归 0，不影响条数。</p>
 *
 * <p><b>性能</b>：走 {@code idx_user_time (user_id, log_time)} 收敛到单人区间；聚合结果最多 4 行，
 * 与流水条数无关。审计表 append-only 且按 {@code log_time} 归档清理，扫描量有上界。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface TransferStatisticsMapper {

    /**
     * 聚合某用户的传输活动（上传 / 下载两动作），按 {@code action + result} 分组。
     *
     * <p>SQL 里显式带 {@code deleted = 0}：本表 {@code deleted} 恒为 0（append-only），
     * 但手写 SQL 不得依赖 MyBatis-Plus 的自动逻辑删除条件（见项目数据访问约定）。</p>
     *
     * @param userId         操作人用户 ID
     * @param uploadAction   上传动作编码（传 {@link OperationLog#ACTION_FILE_UPLOAD}，
     *                       作为参数而非字面量是为了让「统计哪些动作」由调用方一处决定）
     * @param downloadAction 下载动作编码（传 {@link OperationLog#ACTION_FILE_DOWNLOAD}）
     * @return 每个「动作 + 结果」组合一行（无数据时为空列表）
     */
    @Select("select action, result, count(*) as cnt,"
            + " coalesce(sum(case"
            + "     when json_valid(detail) and action = #{uploadAction}"
            + "         then cast(json_unquote(json_extract(detail, '$." + OperationLog.DETAIL_TRANSFERRED_BYTES + "')) as unsigned)"
            + "     when json_valid(detail)"
            + "         then cast(json_unquote(json_extract(detail, '$." + OperationLog.DETAIL_SENT_BYTES + "')) as unsigned)"
            + "     else null end), 0) as bytes"
            + " from sys_operation_log"
            + " where user_id = #{userId}"
            + "   and action in (#{uploadAction}, #{downloadAction})"
            + "   and deleted = 0"
            + " group by action, result")
    List<TransferActivityRow> aggregateUserTransfer(@Param("userId") Long userId,
                                                    @Param("uploadAction") String uploadAction,
                                                    @Param("downloadAction") String downloadAction);
}
