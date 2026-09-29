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

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.spi.scan.VirusScanner;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.AnnotationAwareOrderComparator;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 入库安全扫描管道：聚合容器内全部 {@link VirusScanner}，任一命中即拒绝登记。
 *
 * <p><b>语义</b>：与 {@code ContentScanChain}（外发闸门）同一范式——<b>Deny 优先 + fail-closed</b>。
 * 区别在于扫描时机与素材：本管道在文件<b>内容已落盘、元数据尚未登记</b>时同步执行，实现可以读取字节。</p>
 *
 * <p><b>为什么在「落盘后、登记前」</b>：</p>
 * <ul>
 *     <li>落盘前扫描需要把上传流交给扫描器，而流是单次消费的（扫描完就无法再落盘），
 *         要么强制全部实现支持 mark/reset，要么先缓冲整份内容——对大文件都是不可接受的代价；</li>
 *     <li>落盘后扫描拿到的是内容寻址文件，实现可按需重复读取，且 CE 的默认实现（恒放行）
 *         连一次读盘都不会发生。</li>
 * </ul>
 *
 * <p><b>为什么不删除已落盘的物理内容</b>：内容寻址是<b>共享</b>的——同一份字节可能已被别的文件条目
 * 或历史版本引用。命中时删物理文件会把「拒绝这一次登记」放大成「悄悄破坏别人的文件」。
 * 故此处只拒绝登记并留日志；EE 若要清理，应基于引用计数在自身侧处理。</p>
 *
 * <p><b>为什么抛 {@link ErrorCode#FILE_TYPE_NOT_ALLOWED}</b>：与分享侧的 DLP 拦截（
 * {@code ShareLinkService} 命中内容扫描后同样回 4007）保持同一对外语义——「这份内容不允许流转」，
 * 而不是「服务器暂时故障，请重试」。这样前端无需为入库安全新增分支。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
public class FileScanPipeline {

    private final List<VirusScanner> scanners;

    public FileScanPipeline(List<VirusScanner> scanners) {
        this.scanners = List.copyOf(scanners);
        log.info("[file] 入库安全扫描管道已装配 {} 个扫描器: {}", this.scanners.size(),
                this.scanners.stream().map(VirusScanner::scannerId).toList());
    }

    /**
     * 校验一份已落盘的内容是否可以登记为文件条目；命中威胁时抛出业务异常。
     *
     * @param context 扫描上下文（含惰性内容访问器）
     * @throws BusinessException 检出威胁（4007）或扫描器异常（fail-closed）
     */
    public void assertClean(VirusScanner.VirusScanContext context) {
        if (scanners.isEmpty()) {
            // 理论上不可达：CE 至少有 Noop 扫描器。真出现说明装配被人为清空，此时录入没有安全能力
            // 的部署不应静默视为「全部干净」，故显式告警而不是假装扫过
            log.warn("入库安全扫描管道为空，本次未做任何安全校验：sha256={}", context.sha256());
            return;
        }
        List<VirusScanner> ordered = new ArrayList<>(scanners);
        ordered.sort(AnnotationAwareOrderComparator.INSTANCE);
        for (VirusScanner scanner : ordered) {
            VirusScanner.VirusScanResult result;
            try {
                result = scanner.scan(context);
            } catch (Exception e) {
                // fail-closed：扫描器故障按「拒绝入库」处理，避免「引擎挂了 = 什么东西都能进」
                log.error("病毒扫描器执行异常，按拒绝处理：scanner={}, sha256={}",
                        scanner.getClass().getSimpleName(), context.sha256(), e);
                throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED, "文件安全检查异常，请联系管理员");
            }
            if (result != null && result.infected()) {
                log.warn("文件未通过入库安全检查：scanner={}, sha256={}, name={}, threat={}",
                        scanner.scannerId(), context.sha256(), context.originalName(), result.threat());
                throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED,
                        "文件未通过安全检查" + (result.threat() == null ? "" : "：" + result.threat()));
            }
        }
    }
}
