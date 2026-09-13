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
package com.anttransfer.file.model.vo;

import lombok.Getter;
import lombok.Setter;

/**
 * 预览元信息视图对象。
 *
 * <p>「预览策略」由服务端判定并随响应下发，而不是让前端按扩展名自行猜测：
 * 哪些格式服务端能渲染、Office 为什么只能下载，都是服务端能力与安全口径，
 * 把判定权放前端会导致两端策略漂移（前端以为能预览，实际服务端不返回内容）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class PreviewVO {

    /** 预览策略：文本内联（内容随响应体返回，前端按纯文本渲染）。 */
    public static final String STRATEGY_TEXT = "text";

    /** 预览策略：浏览器原生内联（当前仅 PDF；配 {@code contentUrl} 供 iframe / embed 使用）。 */
    public static final String STRATEGY_PDF = "pdf";

    /** 预览策略：图片（配 {@code thumbnailUrl}）。 */
    public static final String STRATEGY_IMAGE = "image";

    /** 预览策略：仅下载（Office 系，服务端不转码；前端引导下载，不要原地转圈等预览）。 */
    public static final String STRATEGY_DOWNLOAD_ONLY = "download-only";

    /** 预览策略：不支持预览。 */
    public static final String STRATEGY_NONE = "none";

    /** 文件条目 ID。 */
    private Long nodeId;

    /** 文件名。 */
    private String name;

    /** 扩展名（小写无点）。 */
    private String ext;

    /** MIME 类型。 */
    private String contentType;

    /**
     * 预览策略：
     * {@code text} 文本内联 / {@code pdf} 浏览器内联 / {@code image} 图片（配 {@code thumbnailUrl}）
     * / {@code download-only} 仅下载（Office）/ {@code none} 不支持预览。
     */
    private String strategy;

    /** 文本内容是否被截断（仅 {@code text} 策略有意义）。 */
    private boolean truncated;

    /** 文本内容（仅 {@code text} 策略非空）。 */
    private String content;

    /** 图片缩略图地址（仅 {@code image} 策略非空）。 */
    private String thumbnailUrl;

    /**
     * 内容地址（仅 {@code pdf} 策略非空，已带 {@code disposition=inline} 与短时票据）。
     *
     * <p>之所以由服务端连票据一起下发，而不是让前端自己再换一次票：预览票据的权限口径
     * （{@code file:preview}）与下载票据（{@code file:download}）不同，前端无从得知该用哪一种；
     * 且 {@code <iframe src>} 无法携带 Authorization 头，票据是唯一可行的凭证载体。</p>
     */
    private String contentUrl;

    /** 字节数。 */
    private Long sizeBytes;
}
