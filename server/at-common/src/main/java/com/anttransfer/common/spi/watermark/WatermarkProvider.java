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
package com.anttransfer.common.spi.watermark;

import java.io.InputStream;

/**
 * 下载水印扩展点（CE/EE 边界接口）。
 *
 * <p><b>定位</b>：CE 无水印，默认实现原样返回入流，下发字节与接入前完全一致；
 * EE 在此接入明水印（可见水印渲染）或盲水印（频域 / 字符级隐写），用于泄露溯源，
 * 无需改动下载、分享、预览等各条下发链路。</p>
 *
 * <p><b>为什么挂在「流」而不是「响应」</b>：下发链路既有整文件、也有 Range 分片与打包产物，
 * 直接改响应体或响应头会把水印语义和 HTTP 细节纠缠在一起。包装输入流能让所有写出路径共享同一实现，
 * 且写出侧仍由下载服务掌控背压、限速与审计。</p>
 *
 * <p><b>实现约束</b>：</p>
 * <ul>
 *     <li>必须<b>返回包装流</b>（CE 为同一对象）；不得直接读取 {@code source}；</li>
 *     <li>实现需自行处理「非可水印格式」（二进制、已压缩包）的降级策略：返回原流或加盲水印，
 *         但不得因水印失败而中断下载（除非业务明确要求）；</li>
 *     <li>Range 分片下发场景下，EE 应结合 {@link WatermarkContext} 判断是否跳过水印，
 *         否则会造成分片字节错位；CE 透传天然无此问题；</li>
 *     <li>不得记录 {@link WatermarkContext#requesterUserId()} 之外的敏感信息到日志。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
public interface WatermarkProvider {

    /**
     * 提供方标识（{@code noop} / {@code visible-pdf} / {@code blind-image} …），用于审计与排障。
     */
    String providerId();

    /**
     * 包装下载数据源。
     *
     * @param source  底层数据源（响应写出侧负责关闭）
     * @param context 水印上下文（文件、归属、下载者）
     * @return 包装后的数据源；CE 原样返回 {@code source}
     */
    InputStream wrap(InputStream source, WatermarkContext context);

    /**
     * 水印上下文。
     *
     * @param fileId          文件 ID
     * @param originalName    原始文件名（含扩展名）
     * @param ownerUserId     文件归属用户 ID（空表示系统文件）
     * @param requesterUserId 本次下载者用户 ID（分享匿名下载时为 null）
     * @param requesterName   本次下载者展示名（用于可见水印文案；可为 null）
     * @param inline          是否内联预览（预览与下载的水印强度可不同）
     */
    record WatermarkContext(Long fileId,
                            String originalName,
                            Long ownerUserId,
                            Long requesterUserId,
                            String requesterName,
                            boolean inline) {
    }
}
