/*
 * Copyright (c) 2026 AntTransfer Community Contributors
 * Licensed under the Apache License, Version 2.0.
 */
package com.anttransfer.transfer.service;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.transfer.config.TransferProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.stream.Stream;

/**
 * 分片暂存区：负责分片的落盘、整件拼接与 SHA-256 重算。
 *
 * <p>这里只处理<b>任务暂存</b>，不是文件域的内容存储——合并完成后字节会通过
 * {@code FileIngestPort} 交给 at-file 按内容寻址落库，随后本目录即被清理。
 * 因此目录布局以任务为界：{@code <stagingRoot>/<uploadId>/<index>.part}。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class ChunkStore {

    private static final String MERGED_FILE_NAME = "merged.bin";
    private static final String TMP_SUFFIX = ".tmp";

    private final Path stagingRoot;

    public ChunkStore(TransferProperties properties) {
        this.stagingRoot = Paths.get(properties.getStagingRoot()).toAbsolutePath().normalize();
    }

    /** 确保任务目录存在。 */
    public void ensureTaskDir(long uploadId) {
        try {
            Files.createDirectories(taskDir(uploadId));
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL);
        }
    }

    /** 任务目录。 */
    public Path taskDir(long uploadId) {
        return stagingRoot.resolve(Long.toString(uploadId));
    }

    /** 指定分片的落盘路径。 */
    public Path chunkPath(long uploadId, int index) {
        return taskDir(uploadId).resolve(index + ".part");
    }

    /** 分片是否已落盘（原子改名后才可见，见 {@link #writeChunk}）。 */
    public boolean hasChunk(long uploadId, int index) {
        return Files.isRegularFile(chunkPath(uploadId, index));
    }

    /**
     * 写入分片：先写 {@code .tmp} 再原子改名，保证 {@link #hasChunk} 不会把
     * 「写到一半的残片」误判为已收到（后者会导致合片时静默拼出错文件）。
     *
     * @param content 分片字节流，本方法负责关闭
     * @param size    期望字节数
     */
    public void writeChunk(long uploadId, int index, InputStream content, long size) {
        Path dir = taskDir(uploadId);
        Path tmp = dir.resolve(index + TMP_SUFFIX);
        Path target = chunkPath(uploadId, index);
        try {
            Files.createDirectories(dir);
            try (InputStream in = content) {
                Files.copy(in, tmp, StandardCopyOption.REPLACE_EXISTING);
            }
            if (Files.size(tmp) != size) {
                Files.deleteIfExists(tmp);
                throw new BusinessException(ErrorCode.PARAM_FORMAT_ERROR);
            }
            moveAtomically(tmp, target);
        } catch (IOException e) {
            deleteQuietly(tmp);
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL);
        }
    }

    /** 删除指定分片（校验失败时回退，避免残片被后续续传误认为有效）。 */
    public void deleteChunk(long uploadId, int index) {
        deleteQuietly(chunkPath(uploadId, index));
    }

    /**
     * 按索引升序拼接所有分片成整件文件。
     *
     * <p>缺片立即以 4002 中断（交由上层汇总缺失清单），绝不静默跳过——
     * 跳过会拼出「长度对但内容错」的文件，比直接失败危险得多。</p>
     *
     * @return 整件文件路径
     */
    public Path merge(long uploadId, int chunkCount) {
        Path merged = taskDir(uploadId).resolve(MERGED_FILE_NAME);
        try (OutputStream out = Files.newOutputStream(merged)) {
            for (int index = 0; index < chunkCount; index++) {
                Path part = chunkPath(uploadId, index);
                if (!Files.isRegularFile(part)) {
                    throw new BusinessException(ErrorCode.CHUNK_MISSING);
                }
                Files.copy(part, out);
            }
            return merged;
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL);
        }
    }

    /** 计算文件 SHA-256（64 位小写十六进制），流式读取，内存占用与文件大小无关。 */
    public String sha256(Path file) {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("运行环境缺少 SHA-256 实现", e);
        }
        byte[] buffer = new byte[8192];
        try (DigestInputStream in = new DigestInputStream(Files.newInputStream(file), digest)) {
            while (in.read(buffer) != -1) {
                // 读取即更新摘要
            }
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    /** 递归删除任务暂存目录（成功 / 取消 / 完整性失败后调用）。 */
    public void deleteTaskDir(long uploadId) {
        Path dir = taskDir(uploadId);
        if (!Files.exists(dir)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(dir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(ChunkStore::deleteQuietly);
        } catch (IOException e) {
            // 清理失败不影响主流程：残留目录由 TTL 巡检兜底
            deleteQuietly(dir);
        }
    }

    private static void moveAtomically(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // 尽力而为
        }
    }
}
