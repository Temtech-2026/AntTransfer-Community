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
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * CE 默认内容扫描器：<b>后缀黑名单 + 文件名敏感词</b>（零外部依赖、无 IO）。
 *
 * <p>规则全部来自配置 {@code anttransfer.file.share.blocked-extensions} /
 * {@code sensitive-words}，命中即拦截（原因会写入审计）：
 * 后缀如 {@code exe / sh / bat / msi / com / scr}，敏感词如「机密」「身份证」。</p>
 *
 * <p>局限（CE 有意为之，见红队 [V-04]）：改名换后缀即可绕过，且不检测文件内容。
 * 因此企业版应在此之后追加 EE 的 AI DLP 实现，或直接改为「白名单 + 内容嗅探」。</p>
 *
 * @author AntTransfer CE
 */
@Component
@Order(100)
@RequiredArgsConstructor
public class SuffixAndKeywordScanInterceptor implements ContentScanInterceptor {

    private final ShareProperties shareProperties;

    @Override
    public ScanResult scan(ScanContext context) {
        String extension = context.extension() == null ? "" : context.extension().toLowerCase(Locale.ROOT);
        if (!extension.isEmpty() && shareProperties.getBlockedExtensions() != null) {
            for (String blocked : shareProperties.getBlockedExtensions()) {
                if (blocked != null && blocked.trim().toLowerCase(Locale.ROOT).equals(extension)) {
                    return ScanResult.deny("扩展名命中外发黑名单：" + extension);
                }
            }
        }
        String name = context.originalName() == null ? "" : context.originalName().toLowerCase(Locale.ROOT);
        if (shareProperties.getSensitiveWords() != null) {
            for (String word : shareProperties.getSensitiveWords()) {
                if (word != null && !word.isBlank() && name.contains(word.trim().toLowerCase(Locale.ROOT))) {
                    return ScanResult.deny("文件名命中敏感词：" + word.trim());
                }
            }
        }
        return ScanResult.allow();
    }
}
