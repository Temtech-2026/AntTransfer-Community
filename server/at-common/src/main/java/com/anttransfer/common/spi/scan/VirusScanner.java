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
package com.anttransfer.common.spi.scan;

/**
 * 入库病毒扫描扩展点（CE/EE 边界接口）。
 *
 * <p><b>定位</b>：区分于 {@link ContentScanInterceptor}（外发闸门，只看元数据、不读内容），
 * 本接口是<b>入库闸门</b>：文件内容落盘后、元数据登记前调用，实现可以读字节（ClamAV、企业
 * 病毒网关、静态特征库）。CE 无杀毒引擎，默认实现恒返回「干净」，行为与接入前完全一致。</p>
 *
 * <p><b>为什么是同步而非异步事件</b>：异步扫描只能事后隔离，而恶意文件在「已入库、可被分享」
 * 的时间窗内已经完成扩散。入库同步闸门才具备真实的阻断能力；扫描耗时由 EE 侧自行控制
 * （超时、并发上限、按大小跳过），CE 不受影响。</p>
 *
 * <p><b>扩展方式</b>：EE 声明 {@link VirusScanner} Bean 即可；{@code FileScanPipeline} 依次执行
 * 全部实现，<b>命中即拒绝</b>（Deny 优先），由文件服务删除已落盘内容并落审计。</p>
 *
 * <p><b>实现约束</b>：</p>
 * <ul>
 *     <li>必须无副作用、可重入；不得修改被扫描的文件；</li>
 *     <li>读内容请用 {@link VirusScanContext#content()} 的惰性访问器，不要假设存储路径；</li>
 *     <li>扫描失败（引擎不可用）时应显式返回命中或抛出业务异常由上层决定，<b>不得静默放行</b>；</li>
 *     <li>不得记录文件内容明文到日志。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
public interface VirusScanner {

    /**
     * 扫描器标识（{@code noop} / {@code clamav} …），用于日志与审计。
     */
    String scannerId();

    /**
     * 扫描一份已落盘的文件内容。
     *
     * @param context 扫描上下文（含惰性内容访问器）
     * @return 扫描结论；{@link VirusScanResult#infected(String)} 表示拒绝入库
     */
    VirusScanResult scan(VirusScanContext context);

    /**
     * 扫描上下文。
     *
     * @param sha256       内容寻址键（同一内容多次入库共用）
     * @param originalName 原始文件名（含扩展名）
     * @param extension    归一化扩展名（小写、不含点；无扩展名为空串）
     * @param sizeBytes    文件字节数
     * @param ownerUserId  上传者用户 ID（空表示系统写入）
     * @param content      内容惰性访问器（不读则零开销）
     */
    record VirusScanContext(String sha256,
                            String originalName,
                            String extension,
                            long sizeBytes,
                            Long ownerUserId,
                            ContentAccess content) {
    }

    /**
     * 扫描结论。
     *
     * @param infected 是否检出威胁
     * @param threat   威胁名称 / 规则 ID（干净时为 {@code null}）
     */
    record VirusScanResult(boolean infected, String threat) {

        /** 干净 */
        public static VirusScanResult clean() {
            return new VirusScanResult(false, null);
        }

        /** 检出威胁（会写入审计日志 detail） */
        public static VirusScanResult infected(String threat) {
            return new VirusScanResult(true, threat);
        }
    }
}
