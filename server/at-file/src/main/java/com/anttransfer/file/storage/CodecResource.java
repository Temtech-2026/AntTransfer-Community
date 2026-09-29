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

import com.anttransfer.common.spi.crypto.CryptoCodec;
import org.springframework.core.io.AbstractResource;
import org.springframework.core.io.Resource;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;

/**
 * 把 {@link CryptoCodec#decrypt} 织进读取路径的资源包装：调用方拿到的流始终是<b>明文</b>。
 *
 * <p><b>为什么要包一层</b>：内容寻址文件有多个读取方（直接下载、分享取件、文本预览、缩略图、
 * 打包），若把解密交给各调用方处理，就会出现「有的路径解密、有的没解」的静默不一致。
 * 在读入口统一织入后，存储加密对上层完全透明。</p>
 *
 * <p><b>CE 行为</b>：{@code PlainCryptoCodec.decrypt} 原样返回入流，本包装除多一次方法调用外
 * 不改变任何字节、不改变 {@code exists/contentLength} 的委托结果。</p>
 *
 * <p><b>对 EE 的约束</b>：加密后磁盘字节长度与明文字节数不再相等，
 * 故 {@link #contentLength()} 委托的是<b>磁盘</b>长度；调用方应以元数据（{@code size_bytes}）为准。
 * 另外 {@link #getFile()} 暴露的是<b>密文</b>文件，EE 启用加密后不得使用它读取内容。</p>
 *
 * @author AntTransfer CE
 */
class CodecResource extends AbstractResource {

    private final Resource delegate;
    private final CryptoCodec codec;
    private final String storageKey;

    CodecResource(Resource delegate, CryptoCodec codec, String storageKey) {
        this.delegate = delegate;
        this.codec = codec;
        this.storageKey = storageKey;
    }

    @Override
    public InputStream getInputStream() throws IOException {
        // 明文长度未知（EE 场景下磁盘长度是密文长度），交给实现自行处理
        return codec.decrypt(delegate.getInputStream(), new CryptoCodec.CryptoContext(storageKey, -1L));
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
        return "codec resource [" + delegate.getDescription() + "]";
    }
}
