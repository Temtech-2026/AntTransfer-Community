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
package com.anttransfer.file.extension;

import com.anttransfer.common.spi.scan.VirusScanner;

/**
 * CE 默认病毒扫描器：<b>恒判定为干净</b>，且<b>不读取文件内容</b>。
 *
 * <p>CE 不内置杀毒引擎：本实现的作用不是「假装扫过」，而是让入库链路在没有杀毒能力时保持
 * 与接入前完全一致的行为（读取内容会带来一次无意义的磁盘 IO，故连流都不打开）。</p>
 *
 * <p>不标注 {@code @Component}：由 {@code FileSpiConfig} 以 {@code @ConditionalOnMissingBean} 注册，
 * EE 提供自己的 {@link VirusScanner}（ClamAV / 企业病毒网关）时自动让位。</p>
 *
 * @author AntTransfer CE
 */
public class NoopVirusScanner implements VirusScanner {

    @Override
    public String scannerId() {
        return "noop";
    }

    @Override
    public VirusScanResult scan(VirusScanContext context) {
        return VirusScanResult.clean();
    }
}
