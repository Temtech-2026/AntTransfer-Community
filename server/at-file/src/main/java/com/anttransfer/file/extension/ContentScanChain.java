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

import com.anttransfer.common.spi.scan.ContentScanInterceptor;
import com.anttransfer.file.config.ShareProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.AnnotationAwareOrderComparator;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 内容扫描责任链：聚合容器内全部 {@link ContentScanInterceptor}，按 <b>Deny 优先</b> 汇总结论。
 *
 * <p>与 at-permission 的 {@code AccessRuleResolverChain} 同一范式：CE 提供默认实现，
 * EE 追加自己的实现 Bean 即可扩容，主链路（{@code ShareLinkService}）只依赖本类，
 * 不感知具体有多少扫描器。</p>
 *
 * <p><b>短路与容错</b>：</p>
 * <ul>
 *     <li>首个 Deny 立即返回（后续扫描器不再执行，省算力）；</li>
 *     <li>单个扫描器抛异常 <b>不吞</b>：转为 Deny —— 安全组件的失败必须 fail-closed，
 *         否则「DLP 崩了 → 文件顺利外发」将成为绕过通道；</li>
 *     <li>{@code contentScanEnabled=false} 时整链放行（仅应急运维口子，需审计）。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ContentScanChain {

    private final ShareProperties shareProperties;
    private final List<ContentScanInterceptor> interceptors;

    /**
     * 执行扫描责任链。
     *
     * @param context 扫描上下文
     * @return 扫描结论（放行 / 拦截 + 原因）
     */
    public ContentScanInterceptor.ScanResult scan(ContentScanInterceptor.ScanContext context) {
        if (!shareProperties.isContentScanEnabled()) {
            log.warn("外发内容扫描已被配置关闭，本次放行（应急开关，请核查）：fileId={}", context.fileId());
            return ContentScanInterceptor.ScanResult.allow();
        }
        List<ContentScanInterceptor> ordered = new ArrayList<>(interceptors);
        ordered.sort(AnnotationAwareOrderComparator.INSTANCE);
        for (ContentScanInterceptor interceptor : ordered) {
            ContentScanInterceptor.ScanResult result;
            try {
                result = interceptor.scan(context);
            } catch (Exception e) {
                // fail-closed：扫描器异常按拦截处理，避免「扫描器故障 = 外发放行」
                log.error("内容扫描器执行异常，按拦截处理：interceptor={}, fileId={}",
                        interceptor.getClass().getSimpleName(), context.fileId(), e);
                return ContentScanInterceptor.ScanResult.deny(
                        "内容扫描异常（fail-closed）：" + interceptor.getClass().getSimpleName());
            }
            if (result != null && result.denied()) {
                return result;
            }
        }
        return ContentScanInterceptor.ScanResult.allow();
    }
}
