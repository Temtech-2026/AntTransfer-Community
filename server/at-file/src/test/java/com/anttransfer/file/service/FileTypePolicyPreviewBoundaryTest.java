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

import com.anttransfer.file.config.FileProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 「可预览」与「可内联」两条口径的边界契约测试。
 *
 * <p>这里守的是一个曾把用户挡在门外的误判：会话附件换票端点原先用
 * {@link FileTypePolicy#inlineRenderable(String)} 决定 {@code previewSupported}，
 * 而该方法是<b>安全边界</b>（能否让浏览器按 MIME 主动渲染），只认 PDF + 光栅图。
 * 于是 {@code .txt} / {@code .md} / {@code .json} 被判为「无法在线预览」——
 * 同一份文件在自己文件域里明明能看，发给别人后却弹出「该类型无法在线预览，
 * 而发送方未允许下载」。{@link FileTypePolicy#previewable(String)} 就是为分开这两件事而存在。</p>
 *
 * <p><b>测试同时守住反方向：</b>修复不能以放宽安全边界为代价。哪怕「文本能预览」了，
 * {@code inlineRenderable} 对文本、HTML、SVG、XML 也必须<b>继续为 false</b>——
 * 一旦为真，浏览器就会按文档 MIME 渲染这些内容，等于让上传者在本站源下执行脚本。</p>
 *
 * @author AntTransfer CE
 */
class FileTypePolicyPreviewBoundaryTest {

    private final FileTypePolicy policy = new FileTypePolicy(new FileProperties());

    /* ==================== 文本：可预览，但绝不可内联 ==================== */

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"txt", "md", "log", "csv", "json", "xml", "yml", "yaml", "ini", "conf",
            "properties", "sql"})
    @DisplayName("文本类型必须判为「可在线预览」——否则别人发来的 .txt 会被提示无法预览")
    void textTypes_mustBePreviewable(String ext) {
        assertThat(policy.previewable(ext))
                .as("%s 属文本预览白名单，必须存在在线预览路径", ext)
                .isTrue();
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"txt", "md", "json", "xml", "yml", "log", "csv", "sql"})
    @DisplayName("文本类型绝不可被判为「可内联渲染」（安全边界不得因本次修复被放宽）")
    void textTypes_mustNotBeInlineRenderable(String ext) {
        assertThat(policy.inlineRenderable(ext))
                .as("%s 一旦可内联，浏览器会按文档 MIME 渲染，构成存储型 XSS 入口", ext)
                .isFalse();
    }

    @Test
    @DisplayName("XML 可预览但不可内联：application/xml 内联会带来 XXE / 脚本执行面")
    void xml_previewableButNeverInline() {
        assertThat(policy.previewable("xml")).isTrue();
        assertThat(policy.inlineRenderable("xml")).isFalse();
    }

    /* ==================== 原生内联类型：两条口径都为真 ==================== */

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"pdf", "jpg", "jpeg", "png", "gif", "bmp", "webp"})
    @DisplayName("PDF 与光栅图既「可预览」也「可内联」（后者被渲染也只是显示内容）")
    void nativeTypes_areBothPreviewableAndInlineRenderable(String ext) {
        assertThat(policy.previewable(ext)).isTrue();
        assertThat(policy.inlineRenderable(ext)).isTrue();
    }

    /* ==================== 确实无预览路径的类型 ==================== */

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"doc", "docx", "xls", "xlsx", "ppt", "pptx", "wps", "zip", "rar", "7z",
            "exe", "apk", "html", "htm", "svg"})
    @DisplayName("Office / 压缩包 / 可执行 / 网页：仍然没有在线预览路径")
    void unsupportedTypes_mustNotBePreviewable(String ext) {
        assertThat(policy.previewable(ext))
                .as("%s 没有服务端预览能力，前端应引导下载而不是开预览页", ext)
                .isFalse();
        assertThat(policy.inlineRenderable(ext)).isFalse();
    }

    @Test
    @DisplayName("空扩展名按「不支持」处理，且不得因空值绕过判定抛异常")
    void blankExtension_isNotPreviewable() {
        assertThat(policy.previewable("")).isFalse();
        assertThat(policy.previewable(null)).isFalse();
        assertThat(policy.inlineRenderable("")).isFalse();
        assertThat(policy.inlineRenderable(null)).isFalse();
    }

    @Test
    @DisplayName("HTML / SVG 是明确的危险内联类型：可执行内容，白名单永远不能收")
    void dangerousTypes_mustNeverBePreviewableOrInline() {
        assertThat(policy.previewable("html")).isFalse();
        assertThat(policy.previewable("htm")).isFalse();
        assertThat(policy.previewable("svg")).isFalse();
        assertThat(policy.inlineRenderable("html")).isFalse();
        assertThat(policy.inlineRenderable("svg")).isFalse();
    }

    @Test
    @DisplayName("previewSupported 的判定必须与 previewable 一致，不得退回 inlineRenderable")
    void previewable_isStrictlyWiderThanInlineRenderable() {
        // 非文本类型上两者必须完全一致：修复只应「新增」文本这条路径，
        // 不得顺带改动 PDF / 图片 / Office 等既有判定
        for (String ext : new String[]{"pdf", "png", "docx", "zip", "html", "exe", ""}) {
            assertThat(policy.previewable(ext))
                    .as("%s 非文本类型上 previewable 必须等于 inlineRenderable", ext)
                    .isEqualTo(policy.inlineRenderable(ext));
        }
        // 文本是唯一的差集：能看，但不能交给浏览器渲染
        assertThat(policy.previewable("txt")).isTrue();
        assertThat(policy.inlineRenderable("txt")).isFalse();
    }
}
