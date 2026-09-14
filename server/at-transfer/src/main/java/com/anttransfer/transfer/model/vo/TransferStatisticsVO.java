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
package com.anttransfer.transfer.model.vo;

/**
 * 我的传输统计总览——工作台 P0 仪表盘「传输量 / 成功率」卡片的数据源。
 *
 * <h3>口径（全模块唯一，勿在别处另立）</h3>
 * <ul>
 *     <li>数据源 {@code sys_operation_log} 的两个动作：{@code FILE_UPLOAD} / {@code FILE_DOWNLOAD}，
 *         按 {@code user_id} 限定为「我的传输」（工作台只展示自己的数字）；</li>
 *     <li>{@code uploadBytes} / {@code downloadBytes} = <b>实际过网字节数</b>：上传取
 *         {@link com.anttransfer.common.audit.OperationLog#DETAIL_TRANSFERRED_BYTES}
 *         （秒传命中为 0，因为确实没有字节上行），下载取
 *         {@link com.anttransfer.common.audit.OperationLog#DETAIL_SENT_BYTES}
 *         （Range 续传只算本段）。<b>不经结果过滤</b>——失败前已下发的部分同样是真实流量，
 *         而 {@code successRate} 已经单独度量可靠性；</li>
 *     <li>{@code uploadCount} / {@code downloadCount} = <b>成功</b>条数（次数只认成功，
 *         否则成功次数会与失败次数重叠、成功率被自己重复计数）；</li>
 *     <li>{@code successCount} = 上传成功 + 下载成功；{@code failCount} = 失败条数；
 *         {@code successRate} = {@code successCount ÷ (successCount + failCount) × 100}，
 *         保留一位小数，<b>无任何记录时为 {@code null}</b>——「还没有数据」与「全都失败（0%）」
 *         必须在 UI 上可区分。</li>
 * </ul>
 *
 * <p><b>已知口径缺口</b>：上传失败不落审计（{@code FileNodeService} 只在落地成功后记一条），
 * 故当前 {@code failCount} 事实上只反映下载失败。待分片上传（{@code sys_upload_task} 状态机）
 * 落地后，失败口径应以传输任务为准。</p>
 *
 * @param uploadCount   上传成功次数
 * @param uploadBytes   上行实际过网字节数
 * @param downloadCount 下载成功次数
 * @param downloadBytes 下行实际下发字节数
 * @param successCount  成功传输次数合计
 * @param failCount     失败传输次数合计
 * @param successRate   成功率百分比（一位小数）；无记录时为 {@code null}
 * @author AntTransfer CE
 */
public record TransferStatisticsVO(long uploadCount, long uploadBytes,
                                   long downloadCount, long downloadBytes,
                                   long successCount, long failCount,
                                   Double successRate) {
}
