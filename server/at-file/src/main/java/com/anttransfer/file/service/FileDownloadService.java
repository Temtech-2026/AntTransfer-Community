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
package com.anttransfer.file.service;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.spi.watermark.WatermarkProvider;
import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.file.model.entity.FileObject;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.anttransfer.file.service.FileDownloadTicketService.FileTicketPayload;
import com.anttransfer.file.storage.BandwidthLimiter;
import com.anttransfer.file.storage.FileStorage;
import com.anttransfer.file.storage.WatermarkResource;
import com.anttransfer.file.util.TextPreviewDecoder;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * 文件内容下发：Range 断点续传 + 任务级可选限速。
 *
 * <h3>为什么自己写流式循环，而不是返回 {@code ResponseEntity<Resource>}</h3>
 * 两个硬需求框架层都做不到：<b>①</b> 按块限速——必须在「每写一块之前」插入背压等待，
 * 交给框架写等于把节奏让了出去；<b>②</b> 精确的 Range 语义与 416 响应头。
 * 自行接管 {@code OutputStream} 换来的是对传输节奏与协议细节的完整控制权。
 *
 * <h3>限速为什么是「等待」而不是「拒绝」</h3>
 * 限速作用在已经开始传输的流上，此时响应头早已发出，没有任何办法回头告诉客户端「你超限了」。
 * 掐断会让用户拿到半截文件且无法续传，体验远差于慢速下完。故超限表现为背压（{@link BandwidthLimiter}），
 * 真正以错误码拒绝的场景在「还没开始传输」的准入判定（如打包任务创建）。
 *
 * <h3>限速维度</h3>
 * <ul>
 *     <li><b>任务级</b>（本请求）：{@code speedLimit} 查询参数；未传则取
 *         {@code defaultSpeedLimit}。每一条下载流一个独立桶——「任务」的粒度就是一次传输，
 *         若共用文件级桶，两个并发下载会互相抢额度，各自都跑不到预期速率。</li>
 *     <li><b>全局级</b>：{@code globalSpeedLimit}，所有下载流共享的兜底带宽。</li>
 * </ul>
 * 两者同时生效即天然取更严者。顺序上先任务后全局：全局桶的等待时间不会被单任务的长等待挤占。
 *
 * <h3>安全口径</h3>
 * 本端点必须放行匿名请求（{@code <a href>} / {@code <img src>} / 下载工具都无法携带 Authorization 头），
 * 故鉴权完全依赖短时票据。票据只承载「签发时已判定的权限范围」，真正的内容访问权
 * 仍以<b>当次重新加载的条目归属</b>为准（见 {@link FileOwnershipGuard#requireOwnedNode(Long, Long)}），
 * 避免「票据签发后归属变更，票仍在用」的窗口。
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileDownloadService {

    /** 流式输出块大小：64 KiB（兼顾 syscall 次数与首字节时延） */
    private static final int CHUNK_SIZE = 64 * 1024;

    /** 全局限速桶 key（所有下载流共享） */
    private static final String GLOBAL_BUCKET = "global";

    /** 任务级限速桶 key 前缀 */
    private static final String TASK_BUCKET_PREFIX = "download:";

    /** 打包产物限速桶 key 前缀（与普通下载分开，便于排查时区分两类流量） */
    private static final String PACK_BUCKET_PREFIX = "pack:";

    private static final String DISPOSITION_INLINE = "inline";
    private static final String DISPOSITION_ATTACHMENT = "attachment";

    private final FileStorage fileStorage;
    private final BandwidthLimiter bandwidthLimiter;
    private final FileProperties properties;
    private final FileOwnershipGuard ownershipGuard;
    private final FileTypePolicy typePolicy;
    private final FileDownloadTicketService ticketService;
    private final FileAuditLogger auditLogger;
    private final WatermarkProvider watermarkProvider;

    /**
     * 把文件内容写入响应（支持 Range）。
     *
     * @param nodeId              文件条目 ID（来自路径，须与票据绑定的一致）
     * @param ticket              下载票据（查询串）
     * @param requestedSpeedLimit 任务级速率上限（字节/秒，可空；{@code 0} 表示不限速）
     * @param disposition         {@code inline} / {@code attachment}（可空，默认 attachment）
     * @param rangeHeader         {@code Range} 请求头（可空）
     * @param response            HTTP 响应
     */
    public void download(Long nodeId, String ticket, Long requestedSpeedLimit, String disposition,
                         String rangeHeader, HttpServletResponse response) {
        FileTicketPayload payload = ticketService.redeem(ticket, nodeId);
        // 归属以「当次读库」为准，而不是相信票据里的快照
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, payload.userId());
        String ext = typePolicy.extOf(node);

        // 所有校验必须在写出任何响应字节之前完成 —— 一旦提交了响应头，就再无机会改状态码
        boolean inline = resolveInline(payload.scope(), disposition, ext);
        long taskLimit = resolveTaskLimit(requestedSpeedLimit);

        String sha256 = node.getSha256();
        long total = (sha256 == null || sha256.isBlank()) ? -1L : fileStorage.contentSize(sha256);
        if (total < 0L) {
            // 元数据在、字节流不在：属存储侧异常，必须显式失败而不是下发空文件
            log.error("物理内容缺失：nodeId={}, sha256={}", nodeId, sha256);
            auditLogger.fail(OperationLog.ACTION_FILE_DOWNLOAD, OperationLog.TARGET_FILE, nodeId, "物理内容缺失");
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "文件内容缺失，请联系管理员");
        }

        long start = 0L;
        long end = total - 1;
        boolean partial = false;
        if (rangeHeader != null && !rangeHeader.isBlank()) {
            try {
                long[] range = parseRange(rangeHeader, total);
                if (range != null) {
                    start = range[0];
                    end = range[1];
                    partial = true;
                }
            } catch (UnsatisfiableRangeException e) {
                // 416 是正常的协议协商结果（客户端持有过期长度），不是失败，故不记失败审计
                response.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
                response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes */" + total);
                response.setContentLength(0);
                return;
            }
        }

        long length = end - start + 1;
        writeHeaders(response, node.getName(), contentTypeFor(node, inline), inline,
                total, start, end, length, partial);

        stream(node, sha256, start, length, taskLimit, inline, response);
    }

    /**
     * 下发打包产物（{@code _tmp} 区的 zip）。
     *
     * <p><b>为什么与文件下载共用一条链路：</b>Range 解析、206/416 语义、分块限速、响应头口径
     * 都是协议级约定，一旦复制出第二份实现，两份就会各自漂移——最典型的后果是「普通下载能续传、
     * 打包下载不能」，而这种差异在测试里几乎不会有人专门覆盖。故只把「取哪份字节」参数化。</p>
     *
     * <p>产物一律 {@code attachment} 且 MIME 固定为 {@code application/octet-stream}：
     * zip 是服务端按用户选择现场生成的、内容不可信，绝不能给它内联渲染的机会。</p>
     *
     * @param relativePath        产物相对路径（来自 {@code sys_pack_task.product_path}）
     * @param productName         展示用文件名（含 {@code .zip}）
     * @param requestedSpeedLimit 任务级速率上限（字节/秒，可空；{@code 0} 表示不限速）
     * @param rangeHeader         {@code Range} 请求头（可空）
     * @param response            HTTP 响应
     * @return 实际写出的字节数与失败原因（供调用方按自身审计口径落账）
     */
    public StreamOutcome streamProduct(String relativePath, String productName, Long requestedSpeedLimit,
                                       String rangeHeader, HttpServletResponse response) {
        Resource resource = fileStorage.resource(relativePath);
        long total;
        try {
            if (!resource.exists()) {
                // 产物可能已被清理任务回收：这是「过期」而不是「服务器故障」
                throw new BusinessException(ErrorCode.PACK_PRODUCT_EXPIRED);
            }
            total = resource.contentLength();
        } catch (IOException e) {
            log.warn("打包产物不可读：path={}", relativePath, e);
            throw new BusinessException(ErrorCode.PACK_PRODUCT_EXPIRED);
        }
        long taskLimit = resolveTaskLimit(requestedSpeedLimit);

        long start = 0L;
        long end = total - 1;
        boolean partial = false;
        if (rangeHeader != null && !rangeHeader.isBlank()) {
            try {
                long[] range = parseRange(rangeHeader, total);
                if (range != null) {
                    start = range[0];
                    end = range[1];
                    partial = true;
                }
            } catch (UnsatisfiableRangeException e) {
                response.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
                response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes */" + total);
                response.setContentLength(0);
                return new StreamOutcome(0L, "range-unsatisfiable");
            }
        }

        long length = end - start + 1;
        // inline = false：产物只允许下载，不给内联渲染的机会
        writeHeaders(response, productName, MediaType.APPLICATION_OCTET_STREAM_VALUE, false,
                total, start, end, length, partial);
        StreamOutcome outcome = pump(resource, PACK_BUCKET_PREFIX + UUID.randomUUID(), start, length,
                taskLimit, response, "pack=" + relativePath);
        if (!outcome.ok()) {
            log.warn("打包产物下发未完成：path={}, sent={}, reason={}",
                    relativePath, outcome.sent(), outcome.failureReason());
        }
        return outcome;
    }

    /**
     * 下发分享取件内容（免登录，凭核销后取件票）。
     *
     * <p><b>为什么不复用 {@link #download}</b>：登录侧取件的权限载体是
     * {@code userId + nodeId} 票据与条目归属守卫（{@link FileOwnershipGuard}），
     * 而分享访客没有 userId、也没有条目（{@code FileNode}），只有一张已核销的物理文件
     * （{@code FileObject}）——权限已在核销时由「令牌 + 提取码 + 次数」判定完毕。
     * 参数化的只有「取哪份字节、叫什么名、内联还是下载」，Range / 限速 / 响应头等协议细节
     * 仍走同一套 {@link #writeHeaders} + {@link #pump}，不会产生第二份会漂移的实现。</p>
     *
     * <p><b>审计口径</b>：分享取件在核销瞬间已落一条 {@code SHARE_DOWNLOAD / SHARE_PREVIEW}
     * （见 {@code ShareAccessService#redeem}），本方法<b>不再审计</b>——取件票在 TTL 内可被
     * 重复读取（{@code Range} 分段、浏览器重试），若在此重复落账，审计条数会与「已用次数」脱钩。
     * 传输未走完只记日志。</p>
     *
     * @param file                待下发的物理文件
     * @param inline              {@code true} = 在线预览（PDF / 光栅图原生内联，文本走专用通道），{@code false} = 下载
     * @param requestedSpeedLimit 任务级速率上限（字节/秒，可空；{@code 0} 表示不限速）
     * @param rangeHeader         {@code Range} 请求头（可空）
     * @param response            HTTP 响应
     */
    public void streamSharedFile(FileObject file, boolean inline, Long requestedSpeedLimit,
                                 String rangeHeader, HttpServletResponse response) {
        String ext = FileTypePolicy.extOfName(file.getOriginalName());
        if (inline && typePolicy.previewableText(ext)) {
            // 文本可见但不能按文档 MIME 内联，走专用通道（见 streamTextPreview）
            streamTextPreview(file, response);
            return;
        }
        if (inline && !typePolicy.inlineRenderable(ext)) {
            // 预览票承载的是「能看」而不是「能拿走」：不可安全内联的类型没有预览路径，
            // 也绝不能为它退回 attachment —— 那等于把预览票降级成下载票
            throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED, "该文件类型不支持在线预览，请下载后查看");
        }
        long taskLimit = resolveTaskLimit(requestedSpeedLimit);

        String sha256 = file.getSha256();
        long total = (sha256 == null || sha256.isBlank()) ? -1L : fileStorage.contentSize(sha256);
        if (total < 0L) {
            // 元数据在、字节流不在：属存储侧异常，必须显式失败而不是下发空文件
            log.error("分享取件物理内容缺失：fileId={}, sha256={}", file.getId(), sha256);
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "文件内容缺失，请联系管理员");
        }

        long start = 0L;
        long end = total - 1;
        boolean partial = false;
        if (rangeHeader != null && !rangeHeader.isBlank()) {
            try {
                long[] range = parseRange(rangeHeader, total);
                if (range != null) {
                    start = range[0];
                    end = range[1];
                    partial = true;
                }
            } catch (UnsatisfiableRangeException e) {
                response.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
                response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes */" + total);
                response.setContentLength(0);
                return;
            }
        }

        long length = end - start + 1;
        writeHeaders(response, file.getOriginalName(),
                inline ? inlineContentType(ext) : storedContentType(file.getContentType()),
                inline, total, start, end, length, partial);

        String bucketKey = TASK_BUCKET_PREFIX + "share:" + file.getId() + ":" + UUID.randomUUID();
        StreamOutcome outcome = pump(
                watermarked(fileStorage.contentResource(sha256), file.getId(), file.getOriginalName(),
                        file.getUploadUserId(), inline),
                bucketKey, start, length, taskLimit, response, "shareFileId=" + file.getId());
        if (!outcome.ok()) {
            log.warn("分享取件下发未完成：fileId={}, sent={}, reason={}",
                    file.getId(), outcome.sent(), outcome.failureReason());
        }
    }

    /* ============================== 文本预览 ============================== */

    /**
     * 文本在线预览：以服务端强制的 {@code text/plain} 直出内容。
     *
     * <p><b>为什么不能复用 {@link #pump} 的流式链路：</b>文本必须先完成编码判定
     * （见 {@link TextPreviewDecoder}）再按 UTF-8 重新编码写出，否则 GBK 文件在浏览器里会整篇乱码；
     * 而「判定编码」天然要求先把字节读进内存。代价是必须设上限，故截断到
     * {@code previewTextMaxBytes}（与文件域文本预览同一上限、同一解码实现，保证两处看到的内容一致），
     * 截断时回 {@code X-Preview-Truncated} 供排障区分「文件就这么长」与「被截断了」。</p>
     *
     * <p><b>为什么这里可以内联（与 {@link FileTypePolicy} 的安全口径不冲突）：</b>
     * 危险来自 MIME——{@code text/html} / {@code image/svg+xml} 会让浏览器执行内容。
     * 本方法的 MIME 是<b>硬编码</b>的 {@code text/plain} 且附 {@code nosniff}，
     * 内容里写满 {@code <script>} 也只会被当可见字符显示，不会进入 HTML 解析器。</p>
     *
     * <p>本通道刻意不支持 {@code Range}：文本上限仅几 MiB，而按字节分段会把多字节字符切断、
     * 使每段都解码失败。浏览器对 {@code text/plain} 预览也不会发 Range。</p>
     *
     * @param file     待下发的物理文件
     * @param response HTTP 响应
     */
    private void streamTextPreview(FileObject file, HttpServletResponse response) {
        String sha256 = file.getSha256();
        long total = (sha256 == null || sha256.isBlank()) ? -1L : fileStorage.contentSize(sha256);
        if (total < 0L) {
            // 元数据在、字节流不在：属存储侧异常，必须显式失败而不是下发空内容
            log.error("文本预览物理内容缺失：fileId={}, sha256={}", file.getId(), sha256);
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "文件内容缺失，请联系管理员");
        }

        // 多读 1 字节用于判定截断：truncated 必须来自「还有没有更多」这一事实
        long max = Math.max(properties.getPreviewTextMaxBytes(), 1L);
        int capacity = (int) Math.min(max + 1L, Integer.MAX_VALUE);
        byte[] head = new byte[capacity];
        int read = 0;
        try (InputStream in = fileStorage.contentResource(sha256).getInputStream()) {
            while (read < capacity) {
                int n = in.read(head, read, capacity - read);
                if (n < 0) {
                    break;
                }
                read += n;
            }
        } catch (IOException e) {
            log.warn("读取文本预览失败：fileId={}", file.getId(), e);
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "读取文件内容失败");
        }
        int length = (int) Math.min(read, max);
        boolean truncated = read > length;
        byte[] body = TextPreviewDecoder.decode(head, length).getBytes(StandardCharsets.UTF_8);

        // 所有校验与解码都已完成，此刻才提交响应头
        response.setStatus(HttpServletResponse.SC_OK);
        // MIME 硬编码 + nosniff：缺任意一项，内容里的标签都可能被浏览器当文档执行
        response.setContentType("text/plain;charset=UTF-8");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(file.getOriginalName(), true));
        response.setHeader(HttpHeaders.CACHE_CONTROL, "private, no-store");
        if (truncated) {
            response.setHeader("X-Preview-Truncated", "true");
        }
        response.setContentLength(body.length);
        try (OutputStream out = response.getOutputStream()) {
            out.write(body);
            out.flush();
        } catch (IOException e) {
            // 响应头已提交，改不了状态码；预览场景客户端断开是常态，不值得告警
            log.debug("文本预览下发中断：fileId={}", file.getId(), e);
        }
    }

    /* ============================== 响应头 ============================== */

    private void writeHeaders(HttpServletResponse response, String fileName, String contentType, boolean inline,
                              long total, long start, long end, long length, boolean partial) {
        if (partial) {
            response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);
            response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + total);
        } else {
            response.setStatus(HttpServletResponse.SC_OK);
        }
        // 声明支持 Range，客户端才会在续传时发 Range 而非从头再来
        response.setHeader(HttpHeaders.ACCEPT_RANGES, "bytes");
        // 禁止 MIME 嗅探：否则一个名为 .txt 的 HTML 内容可能被浏览器当页面渲染（存储型 XSS）
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(fileName, inline));
        response.setHeader(HttpHeaders.CACHE_CONTROL, "private, no-store");
        response.setContentType(contentType);
        response.setContentLengthLong(length);
    }

    /**
     * 下发用的 MIME 类型。
     *
     * <p>内联时按<b>白名单反查</b>给显式类型，绝不回显条目上存的 {@code contentType}：
     * 那是上传时客户端自报的值（不可信），内联场景下等于让上传者指定浏览器用什么引擎渲染，
     * 属于典型的「把安全判定交给攻击者」。下载（attachment）则回显原值——有 attachment 与
     * nosniff 兜底，仅用于让下载器展示更准确的文件类型。</p>
     */
    private String contentTypeFor(FileNode node, boolean inline) {
        if (inline) {
            return inlineContentType(typePolicy.extOf(node));
        }
        return storedContentType(node.getContentType());
    }

    /** 内联场景的 MIME：只认白名单扩展名（PDF / 光栅图）。 */
    private String inlineContentType(String ext) {
        if (typePolicy.previewablePdf(ext)) {
            return MediaType.APPLICATION_PDF_VALUE;
        }
        return switch (ext) {
            case "png" -> MediaType.IMAGE_PNG_VALUE;
            case "gif" -> "image/gif";
            case "bmp" -> "image/bmp";
            case "webp" -> "image/webp";
            default -> MediaType.IMAGE_JPEG_VALUE;
        };
    }

    /** 下载场景的 MIME：回显存储值（有 attachment 与 nosniff 兜底）。 */
    private static String storedContentType(String stored) {
        return (stored == null || stored.isBlank()) ? MediaType.APPLICATION_OCTET_STREAM_VALUE : stored;
    }

    /**
     * 构造 {@code Content-Disposition}：同时给 ASCII 回退名与 RFC 5987 编码名。
     *
     * <p>只给 {@code filename} 会让中文名在部分客户端变成乱码或被截断；只给 {@code filename*}
     * 又会让老客户端拿不到名字。两者并存是唯一稳妥写法。</p>
     */
    private static String contentDisposition(String fileName, boolean inline) {
        String type = inline ? DISPOSITION_INLINE : DISPOSITION_ATTACHMENT;
        String name = (fileName == null || fileName.isBlank()) ? "download" : fileName;
        // 控制字符会截断头部、引号与反斜杠会破坏参数边界，一律替换
        String asciiFallback = name.replaceAll("[^\\x20-\\x7E]", "_").replaceAll("[\"\\\\]", "_");
        String encoded = URLEncoder.encode(name, StandardCharsets.UTF_8).replace("+", "%20");
        return type + "; filename=\"" + asciiFallback + "\"; filename*=UTF-8''" + encoded;
    }

    /**
     * 织入水印扩展点。
     *
     * <p>CE 的 {@code NoopWatermarkProvider} 原样返回入流：字节不变，响应头（在取流之前就已按
     * 原始长度写出）也不变。EE 启用明水印时，下载者身份由 EE 实现自行从安全上下文读取——
     * 本方法只传文件侧信息，避免为了填两个字段而在<b>匿名分享下载</b>这条必须放行匿名请求的
     * 链路上调用「当前登录用户」而引入新的异常面。</p>
     */
    private Resource watermarked(Resource raw, Long fileId, String originalName,
                                 Long ownerUserId, boolean inline) {
        return new WatermarkResource(raw, watermarkProvider,
                new WatermarkProvider.WatermarkContext(fileId, originalName, ownerUserId, null, null, inline));
    }

    /* ============================== 流式输出 ============================== */

    private void stream(FileNode node, String sha256, long start, long length,
                        long taskLimit, boolean inline, HttpServletResponse response) {
        // 每一条下载流一个独立桶：任务粒度 = 一次传输，避免并发下载互相抢同一份额度
        String bucketKey = TASK_BUCKET_PREFIX + node.getId() + ":" + UUID.randomUUID();
        StreamOutcome outcome = pump(
                watermarked(fileStorage.contentResource(sha256), node.getId(), node.getName(),
                        node.getOwnerUserId(), inline),
                bucketKey, start, length, taskLimit, response, "nodeId=" + node.getId());
        if (outcome.ok()) {
            auditSuccess(node, outcome.sent());
        } else {
            auditDownload(node, outcome.sent(), outcome.failureReason());
        }
    }

    /**
     * 流式写出内核：把 {@code resource} 自 {@code start} 起（跳过前 {@code start} 字节）的
     * {@code length} 字节写入响应，并在每块之前施加任务级 + 全局级背压。
     *
     * <p><b>为什么返回结局对象而不是抛异常：</b>异常在这里不是「出错了要中断流程」，
     * 而是「传输没走完」这一<b>正常业务结局</b>——响应头早已提交，调用方唯一能做的是把
     * 已发送字节数与原因记进审计。用返回值表达既避免了「异常只为了记日志」的反模式，
     * 也让「写了多少」这个关键数字不会在抛出过程中丢失。</p>
     *
     * @param resource 数据源
     * @param bucketKey 任务级限速桶 key
     * @param start     起始偏移
     * @param length    期望写出字节数
     * @param taskLimit 任务级速率上限（0 = 不限速）
     * @param response  HTTP 响应
     * @param logTag    日志标识（{@code nodeId=..} / {@code pack=..}）
     */
    private StreamOutcome pump(Resource resource, String bucketKey, long start, long length,
                               long taskLimit, HttpServletResponse response, String logTag) {
        long globalLimit = properties.getGlobalSpeedLimit();
        long sent = 0L;
        try (InputStream in = resource.getInputStream();
             OutputStream out = response.getOutputStream()) {
            if (start > 0L) {
                in.skipNBytes(start);
            }
            byte[] buffer = new byte[(int) Math.min(CHUNK_SIZE, Math.max(length, 1L))];
            while (sent < length) {
                int want = (int) Math.min(buffer.length, length - sent);
                int read = in.read(buffer, 0, want);
                if (read < 0) {
                    break;
                }
                // 先任务级后全局级：全局桶的等待不会被单任务的长等待挤占
                bandwidthLimiter.acquire(bucketKey, taskLimit, read);
                bandwidthLimiter.acquire(GLOBAL_BUCKET, globalLimit, read);
                out.write(buffer, 0, read);
                sent += read;
            }
            out.flush();
            if (sent < length) {
                // 物理文件比元数据短：响应头已发出，无法改状态码，只能截断并显式告警（属存储侧不一致）
                log.error("下发字节数不足：{}，expected={}, actual={}", logTag, length, sent);
                return new StreamOutcome(sent, "物理文件字节数不足");
            }
            return new StreamOutcome(sent, null);
        } catch (InterruptedException e) {
            // 线程被中断（关停 / 超时）：必须恢复中断标记，否则中断信号会被吞掉
            Thread.currentThread().interrupt();
            log.warn("下发被中断：{}，sent={}", logTag, sent);
            return new StreamOutcome(sent, "传输被中断");
        } catch (IOException e) {
            // 响应头已提交，改不了状态码。客户端主动断开（暂停 / 关页 / 移动网络切换）是常态，
            // 不该报 error 更不该抛给全局异常处理（那会尝试再写一次响应体）
            log.warn("下发流出错：{}，sent={}", logTag, sent, e);
            return new StreamOutcome(sent, "传输异常：" + e.getClass().getSimpleName());
        }
    }

    /**
     * 一次下发的结局。
     *
     * @param sent          实际写出字节数
     * @param failureReason 失败原因；{@code null} 表示完整下发成功
     */
    public record StreamOutcome(long sent, String failureReason) {

        /** 是否完整下发。 */
        public boolean ok() {
            return failureReason == null;
        }
    }

    /* ============================== 参数解析 ============================== */

    /**
     * 解析是否内联下发。
     *
     * <p>预览票（{@code SCOPE_PREVIEW}）<b>强制</b>内联且必须落在可内联类型上：
     * 它承载的是「能看」而非「能拿走」，若允许它走 attachment，{@code file:preview}
     * 就等价于 {@code file:download}，权限点形同虚设。</p>
     */
    private boolean resolveInline(String scope, String disposition, String ext) {
        if (!FileDownloadTicketService.SCOPE_DOWNLOAD.equals(scope)
                && !FileDownloadTicketService.SCOPE_PREVIEW.equals(scope)) {
            throw new BusinessException(ErrorCode.FILE_TICKET_INVALID);
        }
        if (disposition != null && !disposition.isBlank()) {
            String normalized = disposition.trim().toLowerCase(Locale.ROOT);
            if (!DISPOSITION_INLINE.equals(normalized) && !DISPOSITION_ATTACHMENT.equals(normalized)) {
                throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "disposition 仅支持 inline / attachment");
            }
        }
        if (FileDownloadTicketService.SCOPE_PREVIEW.equals(scope)) {
            if (!typePolicy.inlineRenderable(ext)) {
                // 不可安全内联的类型（Office / 压缩包 / HTML…）没有「预览取件」这条路径
                throw new BusinessException(ErrorCode.FILE_TICKET_INVALID);
            }
            return true;
        }
        return DISPOSITION_INLINE.equalsIgnoreCase(disposition) && typePolicy.inlineRenderable(ext);
    }

    /**
     * 解析任务级速率上限。
     *
     * <p>未传参用配置默认值，显式传 {@code 0} 表示本条流不限速——两者语义不同，
     * 不能把「没传」也当成「不限」，否则配置的默认限速永远不生效。</p>
     */
    private long resolveTaskLimit(Long requestedSpeedLimit) {
        if (requestedSpeedLimit == null) {
            return Math.max(properties.getDefaultSpeedLimit(), 0L);
        }
        if (requestedSpeedLimit < 0L) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "限速值不能为负数");
        }
        return requestedSpeedLimit;
    }

    /**
     * 解析单段 Range 请求头。
     *
     * @param header {@code Range} 头
     * @param total  资源总字节数
     * @return {@code [start, end]}（闭区间）；{@code null} 表示按整份下发
     * @throws UnsatisfiableRangeException 起点越界：须回 416 + {@code Content-Range: bytes *&#47;total}
     */
    private static long[] parseRange(String header, long total) {
        String value = header.trim();
        // 多段（含逗号）按整份下发：多段响应需 multipart/byteranges，复杂度与收益不成正比，
        // 且各客户端对多段支持参差；HTTP 允许服务端忽略不支持的 Range
        if (!value.regionMatches(true, 0, "bytes=", 0, 6) || value.indexOf(',') >= 0) {
            return null;
        }
        String spec = value.substring(6).trim();
        int dash = spec.indexOf('-');
        if (dash < 0) {
            return null;
        }
        String rawStart = spec.substring(0, dash).trim();
        String rawEnd = spec.substring(dash + 1).trim();
        long start;
        long end;
        try {
            if (rawStart.isEmpty()) {
                // 后缀式 bytes=-N：取最后 N 字节
                long suffix = Long.parseLong(rawEnd);
                if (suffix <= 0L) {
                    throw new UnsatisfiableRangeException();
                }
                start = Math.max(total - suffix, 0L);
                end = total - 1L;
            } else {
                start = Long.parseLong(rawStart);
                end = rawEnd.isEmpty() ? total - 1L : Long.parseLong(rawEnd);
            }
        } catch (NumberFormatException e) {
            // 语法不合法：HTTP 明确允许忽略无法解析的 Range，按整份下发比报 400 更宽容
            return null;
        }
        if (start < 0L || start >= total) {
            throw new UnsatisfiableRangeException();
        }
        if (end >= total) {
            end = total - 1L;
        }
        if (end < start) {
            return null;
        }
        return new long[]{start, end};
    }

    /* ============================== 审计 ============================== */

    private void auditSuccess(FileNode node, long sent) {
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("name", node.getName());
        extra.put(OperationLog.DETAIL_SIZE_BYTES, node.getSizeBytes());
        extra.put(OperationLog.DETAIL_SENT_BYTES, sent);
        auditLogger.success(OperationLog.ACTION_FILE_DOWNLOAD, OperationLog.TARGET_FILE, node.getId(), extra);
    }

    private void auditDownload(FileNode node, long sent, String reason) {
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("name", node.getName());
        extra.put(OperationLog.DETAIL_SENT_BYTES, sent);
        extra.put("reason", reason);
        auditLogger.log(OperationLog.ACTION_FILE_DOWNLOAD, OperationLog.TARGET_FILE, node.getId(), false, extra);
    }

    /**
     * Range 起点越界（须回 416）。
     *
     * <p>刻意用私有异常在本地捕获，而不是返回三态枚举 / 空数组：分支只在
     * {@link #download} 的一处 catch 里被消化，用异常表达「这个分支要返回完全不同的响应」最直白。</p>
     */
    private static final class UnsatisfiableRangeException extends RuntimeException {
    }
}
