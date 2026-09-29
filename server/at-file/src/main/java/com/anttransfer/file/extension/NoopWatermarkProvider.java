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

import com.anttransfer.common.spi.watermark.WatermarkProvider;

import java.io.InputStream;

/**
 * CE 默认水印实现：<b>无水印</b>，原样返回入流。
 *
 * <p>返回入参对象本身而非包装流，保证下发字节与响应头（{@code Content-Length} / {@code Range}）
 * 和接入本扩展点之前完全一致——水印一旦包装流，字节数就变了，而响应头是在取流之前写出的。</p>
 *
 * <p>不标注 {@code @Component}：由 {@code FileSpiConfig} 以 {@code @ConditionalOnMissingBean} 注册，
 * EE 提供自己的 {@link WatermarkProvider}（明水印 / 盲水印）时自动让位。</p>
 *
 * @author AntTransfer CE
 */
public class NoopWatermarkProvider implements WatermarkProvider {

    @Override
    public String providerId() {
        return "noop";
    }

    @Override
    public InputStream wrap(InputStream source, WatermarkContext context) {
        return source;
    }
}
