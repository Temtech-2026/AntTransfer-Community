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
package com.anttransfer.file.util;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * 上传内容指纹工具：<b>服务端</b>流式计算 SHA-256。
 *
 * <p><b>为什么不信任客户端上报的 sha256：</b>内容寻址存储以哈希决定落盘路径。客户端一旦可以
 * 谎报哈希，就能把 A 的字节写进 B 的路径，污染全局去重——之后真的 B 上传时会被判成「秒传命中」，
 * 拿到的却是 A 的内容。故上传与上传新版本两条链路都必须自行计算。</p>
 *
 * @author AntTransfer CE
 */
public final class FileHashUtils {

    /** 摘要计算缓冲区：8 KiB（与磁盘块大小同量级，兼顾吞吐与内存）。 */
    private static final int HASH_BUFFER_SIZE = 8192;

    private FileHashUtils() {
    }

    /**
     * 计算 multipart 上传文件的 SHA-256（小写十六进制）。
     *
     * @param file 上传文件
     * @return 十六进制指纹
     */
    public static String sha256Hex(MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            return sha256Hex(in);
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL, "读取上传文件失败");
        }
    }

    /**
     * 流式计算任意输入流的 SHA-256（小写十六进制）。
     *
     * @param in 输入流（由调用方负责关闭）
     * @return 十六进制指纹
     * @throws IOException 读取失败
     */
    public static String sha256Hex(InputStream in) throws IOException {
        MessageDigest digest = newDigest();
        byte[] buffer = new byte[HASH_BUFFER_SIZE];
        int read;
        while ((read = in.read(buffer)) != -1) {
            digest.update(buffer, 0, read);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static MessageDigest newDigest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 是 JLS 强制要求每个 JVM 实现的算法，走到这里说明运行环境已不可信
            throw new IllegalStateException("当前 JVM 不支持 SHA-256", e);
        }
    }
}
