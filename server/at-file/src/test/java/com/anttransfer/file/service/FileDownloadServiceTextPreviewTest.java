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
package com.anttransfer.file.service;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.model.entity.FileObject;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.anttransfer.file.storage.BandwidthLimiter;
import com.anttransfer.file.storage.FileStorage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 文本在线预览下发通道测试：别人发来的 {@code .txt} 必须真的能看。
 *
 * <p>回归的是这条现象：接收方点「预览」，弹「该类型无法在线预览，而发送方未允许下载」，
 * 但同一份文件在发送方自己的文件域里能正常预览。根因是取流层把「可预览」等同于
 * 「可交给浏览器按 MIME 渲染」，而文本不在后者的白名单里。</p>
 *
 * <p>这里只拉起 {@link FileDownloadService}（不启动 Spring 容器）：会话附件与分享取件
 * 两条入口都收敛到 {@link FileDownloadService#streamSharedFile}，故在此验证等于同时覆盖两者。
 * 换票侧「能力告知」（{@code previewSupported}）由
 * {@link FileTypePolicyPreviewBoundaryTest} 独立守住。</p>
 *
 * @author AntTransfer CE
 */
class FileDownloadServiceTextPreviewTest {

    private FileStorage fileStorage;
    private FileProperties properties;
    private FileDownloadService service;

    @BeforeEach
    void setUp() {
        fileStorage = mock(FileStorage.class);
        properties = new FileProperties();
        service = new FileDownloadService(
                fileStorage,
                mock(BandwidthLimiter.class),
                properties,
                mock(FileOwnershipGuard.class),
                new FileTypePolicy(properties),
                mock(FileDownloadTicketService.class),
                mock(FileAuditLogger.class));
    }

    /* ==================== 文本：UTF-8 / GBK 都能正确显示 ==================== */

    @Test
    @DisplayName("UTF-8 文本以 text/plain + nosniff 内联下发（浏览器按纯文本显示）")
    void utf8Text_isServedAsPlainTextInline() throws Exception {
        byte[] bytes = "第一行\n<script>alert(1)</script>\n".getBytes(StandardCharsets.UTF_8);
        MockHttpServletResponse response = serveText("说明.txt", bytes);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getContentType()).startsWith("text/plain");
        assertThat(response.getHeader("X-Content-Type-Options"))
                .as("缺了 nosniff，内容里的 <script> 就可能被当页面执行")
                .isEqualTo("nosniff");
        assertThat(response.getHeader("Content-Disposition")).startsWith("inline");
        assertThat(response.getHeader("Cache-Control")).isEqualTo("private, no-store");
        assertThat(body(response)).isEqualTo("第一行\n<script>alert(1)</script>\n");
        assertThat(response.getHeader("X-Preview-Truncated")).isNull();
    }

    @Test
    @DisplayName("GBK 文本必须解码后再按 UTF-8 输出，否则浏览器整篇乱码")
    void gbkText_isDecodedAndReEncodedAsUtf8() throws Exception {
        Charset gbk = Charset.forName("GBK");
        byte[] bytes = "中文内容测试".getBytes(gbk);
        // 确认码确实不是合法 UTF-8，避免这条用例在纯 ASCII 下静默退化成无效断言
        assertThat(new String(bytes, StandardCharsets.UTF_8)).isNotEqualTo("中文内容测试");

        MockHttpServletResponse response = serveText("笔记.txt", bytes);

        assertThat(body(response)).isEqualTo("中文内容测试");
    }

    @Test
    @DisplayName("超过上限的文本被截断，并通过 X-Preview-Truncated 告知不是文件本身就这么短")
    void oversizedText_isTruncatedAndFlagged() throws Exception {
        properties.setPreviewTextMaxBytes(4L);
        MockHttpServletResponse response = serveText("big.txt", "abcdefghij".getBytes(StandardCharsets.UTF_8));

        assertThat(body(response)).isEqualTo("abcd");
        assertThat(response.getHeader("X-Preview-Truncated")).isEqualTo("true");
    }

    @Test
    @DisplayName("截断落在多字节字符中间时不得出现乱码替换符（解码器已按字符边界回退）")
    void truncationInMiddleOfMultibyteChar_doesNotProduceReplacementChar() throws Exception {
        // "中文" = 6 字节，截到 4 字节恰好切开第二个字
        properties.setPreviewTextMaxBytes(4L);
        MockHttpServletResponse response = serveText("cut.txt", "中文".getBytes(StandardCharsets.UTF_8));

        assertThat(body(response)).isEqualTo("中");
    }

    /* ==================== 仍然拒绝的类型 ==================== */

    @Test
    @DisplayName("Office 文档即使被请求预览也仍然拒绝，绝不降级为下载（那会绕过「仅预览」档位）")
    void officeDocument_isStillRejectedForPreview() {
        FileObject file = file("合同.docx", "sha-docx", "docx-bytes".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThatThrownBy(() -> service.streamSharedFile(file, true, null, null, response))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("不支持在线预览");
    }

    @Test
    @DisplayName("压缩包不允许预览（与文本不同：它没有可在线呈现的形式）")
    void archive_isStillRejectedForPreview() {
        FileObject file = file("数据.zip", "sha-zip", "PK".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThatThrownBy(() -> service.streamSharedFile(file, true, null, null, response))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("物理内容缺失时显式失败，而不是下发一个空预览页")
    void missingContent_failsExplicitly() {
        FileObject file = file("空的.txt", "sha-missing", new byte[0]);
        when(fileStorage.contentSize("sha-missing")).thenReturn(-1L);
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThatThrownBy(() -> service.streamSharedFile(file, true, null, null, response))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("文件内容缺失");
    }

    /* ============================== 辅助方法 ============================== */

    /** 让 {@code name} 对应的文本内容走一次预览取件，返回填充好的响应。 */
    private MockHttpServletResponse serveText(String name, byte[] bytes) throws Exception {
        String sha = "sha-" + name;
        FileObject file = file(name, sha, bytes);
        when(fileStorage.contentSize(sha)).thenReturn((long) bytes.length);
        when(fileStorage.contentResource(sha)).thenReturn(new ByteArrayResource(bytes));

        MockHttpServletResponse response = new MockHttpServletResponse();
        service.streamSharedFile(file, true, null, null, response);
        return response;
    }

    private static FileObject file(String name, String sha, byte[] bytes) {
        FileObject file = new FileObject();
        file.setId(1L);
        file.setOriginalName(name);
        file.setSha256(sha);
        file.setSizeBytes((long) bytes.length);
        return file;
    }

    private static String body(MockHttpServletResponse response) throws Exception {
        return new String(response.getContentAsByteArray(), StandardCharsets.UTF_8);
    }
}
