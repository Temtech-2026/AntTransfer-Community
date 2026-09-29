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
package com.anttransfer.common.spi.crypto;

import java.io.InputStream;
import java.io.OutputStream;

/**
 * 内容编解码扩展点（CE/EE 边界接口）——存储加密（信封加密 / KMS）的唯一插入点。
 *
 * <p><b>定位</b>：CE 不加密，默认实现 {@code PlainCryptoCodec} 原样透传，落盘字节与接入前逐字节相同；
 * EE 在此接入 KMS 信封加密（数据密钥加密内容、主密钥只解数据密钥），无需改动文件服务与下载链路。</p>
 *
 * <p><b>与内容寻址的关系（重要）</b>：{@code sha256} 始终是<b>明文</b>的摘要，用于去重、秒传与
 * 完整性校验；加密发生在摘要计算之后。因此 EE 启用加密后：</p>
 * <ul>
 *     <li>秒传 / 去重语义不变（键仍是明文摘要）；</li>
 *     <li>Range 下载必须先解密再切片，实现方需保证返回流可按字节顺序读取；</li>
 *     <li>更换算法或轮换主密钥必须与 {@link CryptoContext#storageKey()} 的版本信息一同演进。</li>
 * </ul>
 *
 * <p><b>实现约束</b>：</p>
 * <ul>
 *     <li>两个方法都必须<b>返回包装流</b>而非直接读写 sink/source，让调用方全权掌控关闭时机；</li>
 *     <li>包装流的 {@code close()} 需先 flush 自身数据；是否关闭底层流由调用方决定（CE 透传即同一对象，
 *         重复关闭必须无副作用）；</li>
 *     <li>不得在日志中输出密钥、明文片段。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
public interface CryptoCodec {

    /**
     * 编解码器标识（{@code plain} / {@code aes-gcm-kms} …），用于审计与排障。
     */
    String codecId();

    /**
     * 包装写出口：调用方写入返回流的数据最终落到 {@code sink}。
     *
     * @param sink    底层写出口（文件输出流）
     * @param context 编解码上下文（存储键、预期字节数）
     * @return 包装后的写出口；CE 原样返回 {@code sink}
     */
    OutputStream encrypt(OutputStream sink, CryptoContext context);

    /**
     * 包装读入口：调用方从返回流读到的数据是原始明文字节。
     *
     * @param source  底层读入口
     * @param context 编解码上下文
     * @return 包装后的读入口；CE 原样返回 {@code source}
     */
    InputStream decrypt(InputStream source, CryptoContext context);

    /**
     * 编解码上下文。
     *
     * @param storageKey 内容寻址键（明文摘要），同时作为密钥派生 / 元数据定位的依据
     * @param sizeBytes  明文字节数（负值表示未知）
     */
    record CryptoContext(String storageKey, long sizeBytes) {
    }
}
