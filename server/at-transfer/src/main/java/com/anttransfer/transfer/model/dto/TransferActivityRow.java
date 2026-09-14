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
package com.anttransfer.transfer.model.dto;

import lombok.Data;

/**
 * 传输审计聚合行：{@code sys_operation_log} 按 {@code action + result} 分组后的一行投影。
 *
 * <p>只承载 SQL 聚合结果，不是对外契约（对外见 {@link com.anttransfer.transfer.model.vo.TransferStatisticsVO}）。
 * 刻意用可变 POJO 而非 record：MyBatis 的列名自动映射默认不走构造器
 * （{@code argNameBasedConstructorAutoMapping} 未开启），record 还需额外的
 * {@code @ConstructorArgs} 才能映射，不值得为几行投影引入。</p>
 *
 * <p>分组粒度选 {@code action + result} 而不是「一条 SQL 算出全部指标」：单次最多返回 4 行
 * （2 个动作 × 2 种结果），与表体量无关；同时把「怎么定义成功率」这类业务判断留在
 * {@code TransferStatisticsService} 的 Java 代码里，可以脱离数据库做单元测试。</p>
 *
 * @author AntTransfer CE
 */
@Data
public class TransferActivityRow {

    /** 审计动作：FILE_UPLOAD / FILE_DOWNLOAD */
    private String action;

    /** 结果：0-成功 1-失败（对应 {@code OperationLog.RESULT_*}） */
    private Integer result;

    /** 该组的条数 */
    private Long cnt;

    /** 该组的实际过网字节合计（detail JSON 里的 transferredBytes / sentBytes） */
    private Long bytes;
}
