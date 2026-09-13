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

import com.anttransfer.file.config.ShareProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 外发内容扫描责任链单测：验证 CE 的「后缀黑名单 + 文件名敏感词」与 Deny 优先 / fail-closed 语义。
 *
 * <p>纯 POJO 测试，不起 Spring 上下文（{@link ShareProperties} 直接 new，默认值即生产默认值）。</p>
 *
 * @author AntTransfer CE
 */
class ContentScanChainTest {

    private final ShareProperties props = new ShareProperties();

    private ContentScanChain chainWith(ContentScanInterceptor... extra) {
        List<ContentScanInterceptor> interceptors = new ArrayList<>();
        interceptors.add(new SuffixAndKeywordScanInterceptor(props));
        interceptors.addAll(List.of(extra));
        return new ContentScanChain(props, interceptors);
    }

    private ContentScanInterceptor.ScanContext ctx(String name, String extension) {
        return new ContentScanInterceptor.ScanContext(1L, name, extension, 1024L, 1L);
    }

    @Test
    @DisplayName("后缀黑名单：exe（且大小写不敏感）命中即拦截")
    void blockedExtension_shouldDeny() {
        ContentScanInterceptor.ScanResult result = chainWith().scan(ctx("Tool.EXE", "exe"));

        assertTrue(result.denied());
        assertTrue(result.reason().contains("exe"));
    }

    @Test
    @DisplayName("文件名敏感词：默认名单命中即拦截")
    void sensitiveWord_shouldDeny() {
        ContentScanInterceptor.ScanResult result = chainWith().scan(ctx("2026薪酬明细.xlsx", "xlsx"));

        assertTrue(result.denied());
        assertTrue(result.reason().contains("薪酬"));
    }

    @Test
    @DisplayName("普通文件放行")
    void normalFile_shouldAllow() {
        ContentScanInterceptor.ScanResult result = chainWith().scan(ctx("report.pdf", "pdf"));

        assertFalse(result.denied());
    }

    @Test
    @DisplayName("Deny 优先：任一扩展点拒绝即拦截，且短路后续扫描器")
    void anyDeny_winsAndShortCircuits() {
        List<String> visited = new ArrayList<>();
        ContentScanInterceptor before = context -> {
            visited.add("before");
            return ContentScanInterceptor.ScanResult.allow();
        };
        ContentScanInterceptor after = context -> {
            visited.add("after");
            return ContentScanInterceptor.ScanResult.allow();
        };
        ContentScanChain chain = new ContentScanChain(props, List.of(before, after));
        // 首个扫描器返回 allow，第二个也 allow → 放行，两个都被执行
        assertFalse(chain.scan(ctx("a.txt", "txt")).denied());
        assertTrue(visited.containsAll(List.of("before", "after")));

        ContentScanInterceptor deny = context -> ContentScanInterceptor.ScanResult.deny("命中测试规则");
        ContentScanChain denying = new ContentScanChain(props, List.of(before2(visited), deny, after2(visited)));
        assertTrue(denying.scan(ctx("a.txt", "txt")).denied());
        assertFalse(visited.contains("after-deny"), "Deny 后应短路，不再执行后续扫描器");
    }

    @Test
    @DisplayName("fail-closed：扫描器抛异常按拦截处理，绝不因 DLP 故障而放行")
    void interceptorThrows_shouldFailClosed() {
        ContentScanInterceptor broken = context -> {
            throw new IllegalStateException("DLP 服务不可用");
        };
        ContentScanInterceptor.ScanResult result = chainWith(broken).scan(ctx("safe.txt", "txt"));

        assertTrue(result.denied(), "扫描器异常必须 fail-closed（拦截）");
    }

    @Test
    @DisplayName("contentScanEnabled=false：整链放行（应急开关）")
    void scanDisabled_shouldAllowAll() {
        props.setContentScanEnabled(false);

        assertFalse(chainWith().scan(ctx("Tool.exe", "exe")).denied());
    }

    private ContentScanInterceptor before2(List<String> visited) {
        return context -> {
            visited.add("before");
            return ContentScanInterceptor.ScanResult.allow();
        };
    }

    private ContentScanInterceptor after2(List<String> visited) {
        return context -> {
            visited.add("after-deny");
            return ContentScanInterceptor.ScanResult.allow();
        };
    }
}
