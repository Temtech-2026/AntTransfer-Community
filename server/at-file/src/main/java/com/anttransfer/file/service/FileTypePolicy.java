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
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.file.model.vo.PreviewVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/**
 * 文件类型判定：扩展名归一 + 「能不能缩略图 / 能不能预览 / 怎么预览」的唯一出口。
 *
 * <p><b>为什么必须收敛成一处：</b>同一个判定有三类消费方——预览元信息、缩略图端点、
 * 内容内联判定。若各自持有一份白名单，任何一次配置调整都会出现「预览说能看、缩略图说不支持」
 * 这类两端漂移；更糟的是安全判定（能否内联渲染）一旦分叉，漏洞会出现在没人复查的那一份里。</p>
 *
 * <p><b>内联判定是安全边界，不是体验开关：</b>浏览器对内联响应会按其 MIME 主动渲染，
 * 因此 {@code text/html}、{@code image/svg+xml}、{@code application/xml} 之流一旦内联，
 * 就等于让上传者在本站源下执行脚本（存储型 XSS）。故 {@link #inlineRenderable(String)}
 * 只认「PDF + 光栅图」——这两者即使被渲染也只是「显示内容」，不具备执行脚本的能力。</p>
 *
 * <p><b>但「不能内联」不等于「不能预览」：</b>文本恰好落在两者之间——可见，但绝不能被
 * 当作文档渲染。它有一条独立通道：文件域以 JSON 字符串返回（见 {@code FilePreviewService}），
 * 取件侧由服务端<b>硬编码</b> {@code text/plain} + {@code nosniff} 下发
 * （见 {@code FileDownloadService}）。两条通道都不把 MIME 的决定权交给文件内容，
 * 浏览器仍然没有机会把内容当代码解析。{@link #previewable(String)} 是把这条产品口径
 * （「用户能不能在线看到」）与安全口径（{@link #inlineRenderable(String)}）显式分开的出口。</p>
 *
 * @author AntTransfer CE
 */
@Component
@RequiredArgsConstructor
public class FileTypePolicy {

    /** 从文件名兜底推导扩展名时允许的最大长度：再长的「扩展名」只可能是数据噪声 */
    private static final int MAX_EXT_LENGTH = 16;

    private final FileProperties properties;

    /**
     * 取条目的小写扩展名（无点）：优先用入库时已规范化的 {@code ext}，缺失时从文件名兜底推导。
     *
     * @param node 文件条目
     * @return 小写扩展名；无法判定返回空串（调用方按「不支持」处理）
     */
    public String extOf(FileNode node) {
        String ext = node.getExt();
        if (ext != null && !ext.isBlank()) {
            return ext.toLowerCase(Locale.ROOT);
        }
        return extOfName(node.getName());
    }

    /** 从文件名推导扩展名（小写无点）；无扩展名 / 扩展名过长返回空串。 */
    public static String extOfName(String name) {
        if (name == null) {
            return "";
        }
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        String ext = name.substring(dot + 1).toLowerCase(Locale.ROOT).trim();
        return ext.length() > MAX_EXT_LENGTH ? "" : ext;
    }

    /** 是否支持生成缩略图（仅光栅图；SVG 刻意不在白名单——可内嵌脚本）。 */
    public boolean thumbnailable(String ext) {
        return contains(properties.getThumbnailExtensions(), ext);
    }

    /** 是否支持纯文本内联预览。 */
    public boolean previewableText(String ext) {
        return contains(properties.getPreviewTextExtensions(), ext);
    }

    /** 是否支持浏览器原生内联预览（当前仅 PDF）。 */
    public boolean previewablePdf(String ext) {
        return contains(properties.getPreviewPdfExtensions(), ext);
    }

    /** 是否属「仅下载」类型（Office 系：服务端不做转码，CE 明确不支持预览）。 */
    public boolean downloadOnly(String ext) {
        return contains(properties.getDownloadOnlyExtensions(), ext);
    }

    /**
     * 服务端预览策略。
     *
     * <p><b>判定顺序把「仅下载」放在最前</b>：该清单语义是「拒绝服务端内联」，
     * 一旦某个扩展名被同时写进两个清单（配置误写），宁可退化成仅下载，
     * 也不能因一次误配就把 Office 文件当文本内联出去。</p>
     *
     * @param ext 小写扩展名
     * @return {@link PreviewVO} 中的 {@code STRATEGY_*} 之一
     */
    public String strategyOf(String ext) {
        if (ext == null || ext.isBlank()) {
            return PreviewVO.STRATEGY_NONE;
        }
        if (downloadOnly(ext)) {
            return PreviewVO.STRATEGY_DOWNLOAD_ONLY;
        }
        if (previewablePdf(ext)) {
            return PreviewVO.STRATEGY_PDF;
        }
        if (thumbnailable(ext)) {
            return PreviewVO.STRATEGY_IMAGE;
        }
        if (previewableText(ext)) {
            return PreviewVO.STRATEGY_TEXT;
        }
        return PreviewVO.STRATEGY_NONE;
    }

    /**
     * 是否允许以 {@code Content-Disposition: inline} 下发（浏览器会主动渲染）。
     *
     * <p>白名单只含 PDF 与光栅图：二者即使被渲染也只是「显示内容」，
     * 不具备在本站源下执行脚本的能力。</p>
     */
    public boolean inlineRenderable(String ext) {
        return previewablePdf(ext) || thumbnailable(ext);
    }

    /**
     * 是否存在「在线预览」路径。
     *
     * <p><b>与 {@link #inlineRenderable(String)} 的分工必须守住：</b>本方法回答的是<b>产品问题</b>
     * 「用户能不能在线看到内容」，后者回答的是<b>安全边界问题</b>「能不能让浏览器按 MIME 主动渲染」。
     * 二者混用会出两个方向的错：拿 {@code inlineRenderable} 当「可预览」，会把文本误判成
     * 「无法在线预览」（同一份 {@code .txt} 在文件域能看、发给别人却看不了）；
     * 拿本方法当「可内联」，则等于把 HTML / SVG 之流放上内联网。</p>
     *
     * <p>故本方法只用于<b>能力告知</b>（如会话附件换票下发 {@code previewSupported}），
     * 绝不能用于判定能否内联。</p>
     */
    public boolean previewable(String ext) {
        return inlineRenderable(ext) || previewableText(ext);
    }

    private static boolean contains(List<String> candidates, String ext) {
        if (ext == null || ext.isBlank() || candidates == null) {
            return false;
        }
        for (String candidate : candidates) {
            if (candidate != null && candidate.equalsIgnoreCase(ext)) {
                return true;
            }
        }
        return false;
    }
}
