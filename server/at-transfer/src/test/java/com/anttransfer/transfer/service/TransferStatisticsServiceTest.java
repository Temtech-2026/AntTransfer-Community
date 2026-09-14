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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

/**
 * 传输统计的汇总口径单测：SQL 只做分组求和，所有业务判断都在 Service，故这里不需要数据库。
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class TransferStatisticsServiceTest {

    private static final long USER_ID = 7L;

    @Mock
    private TransferStatisticsMapper transferStatisticsMapper;

    private TransferStatisticsService transferStatisticsService;

    @BeforeEach
    void setUp() {
        transferStatisticsService = new TransferStatisticsService(transferStatisticsMapper);
    }

    @Test
    @DisplayName("按动作 + 结果汇总：次数只认成功，字节不过滤失败")
    void shouldAggregateByActionAndResult() {
        givenAggregates(
                row(OperationLog.ACTION_FILE_UPLOAD, OperationLog.RESULT_SUCCESS, 2L, 3_000L),
                row(OperationLog.ACTION_FILE_DOWNLOAD, OperationLog.RESULT_SUCCESS, 3L, 500L),
                // 下载失败前往往已经下发了半份：这 200 字节是真实流量，算进传输量但不计成功次数
                row(OperationLog.ACTION_FILE_DOWNLOAD, OperationLog.RESULT_FAIL, 1L, 200L));

        TransferStatisticsVO statistics = transferStatisticsService.statistics(USER_ID);

        assertThat(statistics.uploadCount()).isEqualTo(2L);
        assertThat(statistics.uploadBytes()).isEqualTo(3_000L);
        assertThat(statistics.downloadCount()).isEqualTo(3L);
        assertThat(statistics.downloadBytes()).isEqualTo(700L);
        assertThat(statistics.successCount()).isEqualTo(5L);
        assertThat(statistics.failCount()).isEqualTo(1L);
        assertThat(statistics.successRate()).isEqualTo(83.3);
    }

    @Test
    @DisplayName("无任何传输流水：计数为 0，成功率为 null（不是 0%）")
    void shouldReturnNullRateWhenNoActivity() {
        givenAggregates();

        TransferStatisticsVO statistics = transferStatisticsService.statistics(USER_ID);

        assertThat(statistics.uploadCount()).isZero();
        assertThat(statistics.uploadBytes()).isZero();
        assertThat(statistics.downloadCount()).isZero();
        assertThat(statistics.downloadBytes()).isZero();
        assertThat(statistics.successCount()).isZero();
        assertThat(statistics.failCount()).isZero();
        assertThat(statistics.successRate()).isNull();
    }

    @Test
    @DisplayName("只有失败记录：成功率是 0%（与「没有数据」必须可区分）")
    void shouldReturnZeroRateWhenAllFailed() {
        givenAggregates(row(OperationLog.ACTION_FILE_DOWNLOAD, OperationLog.RESULT_FAIL, 2L, 0L));

        TransferStatisticsVO statistics = transferStatisticsService.statistics(USER_ID);

        assertThat(statistics.successCount()).isZero();
        assertThat(statistics.failCount()).isEqualTo(2L);
        assertThat(statistics.successRate()).isZero();
    }

    @Test
    @DisplayName("成功率为整数时也保留一位小数（100.0 而非 100）")
    void shouldKeepOneDecimalWhenRateIsExact() {
        givenAggregates(row(OperationLog.ACTION_FILE_UPLOAD, OperationLog.RESULT_SUCCESS, 1L, 10L));

        assertThat(transferStatisticsService.statistics(USER_ID).successRate()).isEqualTo(100.0);
    }

    @Test
    @DisplayName("聚合列为空（detail 缺字节键 / 计数为 0）时按 0 处理，不抛空指针也不污染合计")
    void shouldTreatNullAggregatesAsZero() {
        givenAggregates(
                row(OperationLog.ACTION_FILE_UPLOAD, OperationLog.RESULT_FAIL, null, null),
                row(OperationLog.ACTION_FILE_UPLOAD, OperationLog.RESULT_SUCCESS, 1L, 10L));

        TransferStatisticsVO statistics = transferStatisticsService.statistics(USER_ID);

        assertThat(statistics.uploadCount()).isEqualTo(1L);
        assertThat(statistics.uploadBytes()).isEqualTo(10L);
        assertThat(statistics.failCount()).isZero();
        assertThat(statistics.successRate()).isEqualTo(100.0);
    }

    private void givenAggregates(TransferActivityRow... rows) {
        given(transferStatisticsMapper.aggregateUserTransfer(USER_ID,
                OperationLog.ACTION_FILE_UPLOAD, OperationLog.ACTION_FILE_DOWNLOAD))
                .willReturn(List.of(rows));
    }

    private static TransferActivityRow row(String action, int result, Long cnt, Long bytes) {
        TransferActivityRow row = new TransferActivityRow();
        row.setAction(action);
        row.setResult(result);
        row.setCnt(cnt);
        row.setBytes(bytes);
        return row;
    }
}
