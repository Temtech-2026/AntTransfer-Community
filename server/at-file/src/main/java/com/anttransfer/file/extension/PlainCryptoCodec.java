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

import com.anttransfer.common.spi.crypto.CryptoCodec;

import java.io.InputStream;
import java.io.OutputStream;

/**
 * CE 默认编解码器：<b>不加密</b>，原样透传。
 *
 * <p>返回的正是入参对象本身（而不是包一层 {@code FilterOutputStream}）：<b>零包装 = 零字节差异</b>，
 * 落盘内容与接入本扩展点之前逐字节一致，也让 {@code sha256} 与磁盘字节的对应关系在 CE 里继续成立
 * （内容寻址、秒传、完整性校验都依赖「文件内容 == 摘要」）。</p>
 *
 * <p>不标注 {@code @Component}：由 {@code FileSpiConfig} 以 {@code @ConditionalOnMissingBean} 注册，
 * EE 提供自己的 {@link CryptoCodec}（KMS 信封加密）时自动让位。</p>
 *
 * @author AntTransfer CE
 */
public class PlainCryptoCodec implements CryptoCodec {

    @Override
    public String codecId() {
        return "plain";
    }

    @Override
    public OutputStream encrypt(OutputStream sink, CryptoContext context) {
        return sink;
    }

    @Override
    public InputStream decrypt(InputStream source, CryptoContext context) {
        return source;
    }
}
