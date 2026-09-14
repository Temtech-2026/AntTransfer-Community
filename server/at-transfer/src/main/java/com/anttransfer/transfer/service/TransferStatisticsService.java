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
package com.anttransfer.transfer.service;

import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.transfer.model.dto.TransferActivityRow;
import com.anttransfer.transfer.model.vo.TransferStatisticsVO;
import com.anttransfer.transfer.repository.TransferStatisticsMapper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 传输统计：把审计账本上的传输流水折算成工作台 P0 卡片要的两个数字（传输量 / 成功率）。
 *
 * <p>口径定义集中在 {@link TransferStatisticsVO}，本类只负责「怎么算」，不含 SQL——
 * 于是「成功率该不该把失败算进去」「没有数据时是 0% 还是空」这类判断可以脱离数据库单测，
 * 而 SQL 只做纯粹的「按动作 + 结果分组求和」。</p>
 *
 * @author AntTransfer CE
 */
@Service
public class TransferStatisticsService {

    /** 成功率保留一位小数：卡片按百分比展示，更多位数没有信息量。 */
    private static final double RATE_SCALE = 10.0;

    private final TransferStatisticsMapper transferStatisticsMapper;

    public TransferStatisticsService(TransferStatisticsMapper transferStatisticsMapper) {
        this.transferStatisticsMapper = transferStatisticsMapper;
    }

    /**
     * 统计某用户的传输活动。
     *
     * @param userId 用户 ID（由 Controller 从登录态取，不接受前端传入——否则就能看别人的传输量）
     * @return 传输统计总览；该用户没有任何传输流水时各计数为 0、成功率为 {@code null}
     */
    public TransferStatisticsVO statistics(Long userId) {
        List<TransferActivityRow> rows = transferStatisticsMapper.aggregateUserTransfer(userId,
                OperationLog.ACTION_FILE_UPLOAD, OperationLog.ACTION_FILE_DOWNLOAD);

        long uploadCount = 0L;
        long uploadBytes = 0L;
        long downloadCount = 0L;
        long downloadBytes = 0L;
        long failCount = 0L;

        for (TransferActivityRow row : rows) {
            long count = orZero(row.getCnt());
            long bytes = orZero(row.getBytes());
            boolean upload = OperationLog.ACTION_FILE_UPLOAD.equals(row.getAction());

            // 字节不受结果过滤：失败前已经下发的部分同样是真实流量（下载失败前往往已传了半份）。
            // 而次数只认成功——若失败也算进 uploadCount/downloadCount，成功后计数会与 failCount
            // 重叠，成功率分母被自己重复计入。
            if (upload) {
                uploadBytes += bytes;
            } else {
                downloadBytes += bytes;
            }

            if (row.getResult() != null && row.getResult() == OperationLog.RESULT_SUCCESS) {
                if (upload) {
                    uploadCount += count;
                } else {
                    downloadCount += count;
                }
            } else {
                failCount += count;
            }
        }

        long successCount = uploadCount + downloadCount;
        return new TransferStatisticsVO(uploadCount, uploadBytes, downloadCount, downloadBytes,
                successCount, failCount, successRate(successCount, failCount));
    }

    /**
     * 成功率（百分比，一位小数）；没有任何传输记录时返回 {@code null}。
     *
     * <p>返回 {@code null} 而不是 {@code 0.0}：「还没有数据」和「全都失败」在 UI 上必须区分，
     * 否则新装实例的工作台会一直显示刺眼的 0%。</p>
     */
    private static Double successRate(long successCount, long failCount) {
        long attempts = successCount + failCount;
        if (attempts == 0L) {
            return null;
        }
        return Math.round(successCount * 100.0 / attempts * RATE_SCALE) / RATE_SCALE;
    }

    private static long orZero(Long value) {
        return value == null ? 0L : value;
    }
}
