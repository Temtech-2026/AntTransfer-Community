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
package com.anttransfer.file.storage;

import com.anttransfer.common.spi.watermark.WatermarkProvider;
import org.springframework.core.io.AbstractResource;
import org.springframework.core.io.Resource;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;

/**
 * 把 {@link WatermarkProvider#wrap} 织进下发路径的资源包装。
 *
 * <p><b>为什么在资源层而不是在响应层</b>：下发循环（背压、限速、Range 偏移、审计）属于传输关注点，
 * 水印属于内容关注点。在「取哪份字节」这一层织入，可以让所有下发路径共享同一实现，
 * 而传输循环一行都不必改。</p>
 *
 * <p><b>CE 行为</b>：{@code NoopWatermarkProvider.wrap} 原样返回入流，字节与响应头（在取流之前
 * 就已写出）两者都保持不变。</p>
 *
 * <p><b>对 EE 的约束</b>：水印会改变字节数，而 {@code Content-Length} 与 {@code Range} 偏移
 * 早在取流之前就已按<b>原始</b>长度写好——故 EE 实现必须保证「不改长度」（如盲水印、等长填充），
 * 或对 Range 分片请求返回原流（由 {@link WatermarkProvider.WatermarkContext} 判断）。
 * {@link #contentLength()} 委托的是原始文件长度，不反映水印后的长度。</p>
 *
 * @author AntTransfer CE
 */
public class WatermarkResource extends AbstractResource {

    private final Resource delegate;
    private final WatermarkProvider provider;
    private final WatermarkProvider.WatermarkContext context;

    public WatermarkResource(Resource delegate, WatermarkProvider provider,
                             WatermarkProvider.WatermarkContext context) {
        this.delegate = delegate;
        this.provider = provider;
        this.context = context;
    }

    @Override
    public InputStream getInputStream() throws IOException {
        return provider.wrap(delegate.getInputStream(), context);
    }

    @Override
    public boolean exists() {
        return delegate.exists();
    }

    @Override
    public long contentLength() throws IOException {
        return delegate.contentLength();
    }

    @Override
    public long lastModified() throws IOException {
        return delegate.lastModified();
    }

    @Override
    public String getFilename() {
        return delegate.getFilename();
    }

    @Override
    public File getFile() throws IOException {
        return delegate.getFile();
    }

    @Override
    public String getDescription() {
        return "watermark resource [" + delegate.getDescription() + "]";
    }
}
