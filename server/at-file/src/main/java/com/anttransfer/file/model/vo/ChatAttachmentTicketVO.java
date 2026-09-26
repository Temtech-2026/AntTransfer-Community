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

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Builder;
import lombok.Getter;

/**
 * 会话附件取件票据视图。
 *
 * <p>两步式取件的产物：换票端点（登录态，判定附件行）→ 取件端点（免登录，只验票）。
 * 之所以要拆两步，是因为浏览器原生下载 / {@code <img src>} / 播放器都<b>无法携带
 * Authorization 头</b>，取件端点必须匿名可达；而匿名端点能安全存在的前提，是
 * 全部判定已经在一个登录态端点里做完并把结论封进了票据。</p>
 *
 * <p>{@link #contentUrl} 由服务端拼好下发，前端不再自行拼路径：换绑路径拼接规则时
 * 只需改一处，否则前端散落的字符串拼接会静默失效（点了没反应）。</p>
 *
 * <p>ID 字段与 {@link ChatAttachmentVO} 同口径，逐字段标 {@link ToStringSerializer}
 * 以字符串下发——19 位雪花 ID 按 number 下发会被浏览器取整（见文件域 ID 契约用例）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Builder
public class ChatAttachmentTicketVO {

    /** 取件票据（短时有效，绑定附件 + 取件人 + 用途档位，见 RedisKeyConstants） */
    private final String ticket;

    /** 授权 ID */
    @JsonSerialize(using = ToStringSerializer.class)
    private final Long attachmentId;

    /** 文件条目 ID */
    @JsonSerialize(using = ToStringSerializer.class)
    private final Long nodeId;

    /** 文件名快照（前端可直接用于另存为的文件名） */
    private final String fileName;

    /** 文件大小快照（字节） */
    private final Long sizeBytes;

    /** 用途档位：1-仅预览 2-可下载 3-可转发转存 */
    private final Integer usageMode;

    /** 本次票据的取件类型：{@code preview} / {@code download} */
    private final String accessType;

    /** 取件地址（含票据，免登录可直接打开） */
    private final String contentUrl;

    /** 票据有效期（秒） */
    private final Long expiresIn;

    /**
     * 是否支持在线预览（PDF / 光栅图 / 文本）。
     *
     * <p><b>注意语义是「能不能看」，不是「能不能交给浏览器渲染」。</b>文本属于「能看」但
     * 「不能按文档 MIME 渲染」的一类，取流层会为它切到 {@code text/plain} 专用通道；
     * 前端无需区分，照常打开 {@link #contentUrl} 即可（浏览器会以纯文本显示）。</p>
     *
     * <p>为 {@code false} 时前端<b>不要</b>开预览标签页：预览票只发 {@code inline}，
     * 而 Office / 压缩包等类型在取流层会被以「不支持在线预览」拒绝，<b>不会</b>降级为下载
     * （降级等于把预览票变成下载票，绕过「仅预览」档位）。前端若照旧按内联渲染，
     * 拿到的是错误响应而不是字节。</p>
     */
    private final Boolean previewSupported;
}
