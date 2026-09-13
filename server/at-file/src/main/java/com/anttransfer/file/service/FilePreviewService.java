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
import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.file.model.vo.PreviewVO;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.anttransfer.file.service.FileDownloadTicketService.FileTicketPayload;
import com.anttransfer.file.storage.FileStorage;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Dimension;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 预览服务：图片缩略图 + PDF / 文本预览策略（Office 仅下载）。
 *
 * <h3>为什么预览策略由服务端判定并下发</h3>
 * 哪些格式服务端能渲染、Office 为什么只能下载，都是<b>服务端能力与安全口径</b>。
 * 若把判定权交给前端按扩展名猜测，两端策略必然漂移——前端以为能预览、服务端不返回内容，
 * 用户看到的是一个永远转圈的空面板。故策略随 {@link PreviewVO} 一起下发，前端只做分发不做判断。
 *
 * <h3>三条预览路径各自的取向</h3>
 * <ul>
 *     <li><b>文本</b>：读前 N 字节后以 <b>JSON 字符串</b>返回，而不是内联 {@code text/plain}。
 *         这样浏览器永远把它当数据而非文档，{@code .txt} 里写满 HTML 也无从执行。</li>
 *     <li><b>PDF</b>：返回带票据的 {@code contentUrl}，由浏览器内置阅读器渲染（服务端不转码）。</li>
 *     <li><b>图片</b>：返回带票据的 {@code thumbnailUrl}，真正的缩放发生在缩略图端点。</li>
 * </ul>
 * Office 系一律 {@code download-only}：服务端转码需引入 LibreOffice / POI 全量重依赖，CE 不做，
 * 明确下发「只能下载」比让用户对着转圈图标等待诚实得多。
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FilePreviewService {

    /** UTF-8 单字符最长 4 字节，故末尾最多 3 字节可能是被截断的不完整序列 */
    private static final int MAX_CHAR_BYTES = 4;

    /** 缩略图缓存时长（秒）：内容寻址故字节不可变，但 URL 里带票据，只敢给浏览器私有缓存 */
    private static final int THUMBNAIL_CACHE_SECONDS = 300;

    static {
        // 关掉 ImageIO 的磁盘缓存：默认实现会把流落到临时文件，缩略图是高频路径，
        // 既有无谓 IO，也会在异常退出时遗留临时文件
        ImageIO.setUseCache(false);
    }

    private final FileStorage fileStorage;
    private final FileProperties properties;
    private final FileTypePolicy typePolicy;
    private final FileOwnershipGuard ownershipGuard;
    private final FileDownloadTicketService ticketService;
    private final FileAuditLogger auditLogger;

    @PostConstruct
    void logPolicy() {
        log.info("预览策略已加载：缩略图 {} 种 / 文本 {} 种 / PDF {} 种 / 仅下载 {} 种",
                properties.getThumbnailExtensions().size(), properties.getPreviewTextExtensions().size(),
                properties.getPreviewPdfExtensions().size(), properties.getDownloadOnlyExtensions().size());
    }

    /**
     * 取预览元信息（文本策略时附带内容）。
     *
     * @param ownerUserId 当前登录用户
     * @param nodeId      文件条目 ID
     * @return 预览视图
     * @throws BusinessException 条目不存在或不属于该用户（4005）
     */
    public PreviewVO preview(Long ownerUserId, Long nodeId) {
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        String ext = typePolicy.extOf(node);
        String strategy = typePolicy.strategyOf(ext);

        PreviewVO vo = new PreviewVO();
        vo.setNodeId(node.getId());
        vo.setName(node.getName());
        vo.setExt(ext);
        vo.setContentType(node.getContentType());
        vo.setSizeBytes(node.getSizeBytes());
        vo.setStrategy(strategy);
        switch (strategy) {
            case PreviewVO.STRATEGY_TEXT -> fillText(vo, node);
            case PreviewVO.STRATEGY_IMAGE -> vo.setThumbnailUrl(
                    ticketService.thumbnailUrl(node.getId(),
                            ticketService.mint(ownerUserId, node, FileDownloadTicketService.SCOPE_PREVIEW)));
            case PreviewVO.STRATEGY_PDF -> vo.setContentUrl(
                    ticketService.inlineContentUrl(node.getId(),
                            ticketService.mint(ownerUserId, node, FileDownloadTicketService.SCOPE_PREVIEW)));
            default -> {
                // download-only / none：无可下发内容，前端据策略引导下载或提示不支持
            }
        }

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("strategy", strategy);
        extra.put("name", node.getName());
        auditLogger.success(OperationLog.ACTION_FILE_PREVIEW, OperationLog.TARGET_FILE, node.getId(), extra);
        return vo;
    }

    /**
     * 生成并下发图片缩略图（免登录端点，凭预览票取件）。
     *
     * @param nodeId   文件条目 ID
     * @param ticket   预览票据
     * @param response HTTP 响应
     */
    public void writeThumbnail(Long nodeId, String ticket, HttpServletResponse response) {
        FileTicketPayload payload = ticketService.redeem(ticket, nodeId);
        // 下载票亦可取缩略图（能下必然能看）；反向不成立（见 FileDownloadService#resolveInline）
        if (!FileDownloadTicketService.SCOPE_PREVIEW.equals(payload.scope())
                && !FileDownloadTicketService.SCOPE_DOWNLOAD.equals(payload.scope())) {
            throw new BusinessException(ErrorCode.FILE_TICKET_INVALID);
        }
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, payload.userId());

        String ext = typePolicy.extOf(node);
        if (!typePolicy.thumbnailable(ext)) {
            throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED, "该文件类型不支持缩略图");
        }
        String sha256 = node.getSha256();
        if (sha256 == null || sha256.isBlank() || !fileStorage.contentExists(sha256)) {
            log.error("物理内容缺失，无法生成缩略图：nodeId={}, sha256={}", nodeId, sha256);
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "文件内容缺失，无法生成缩略图");
        }

        Thumbnail thumbnail = renderThumbnail(node, sha256);
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType(thumbnail.contentType());
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader(HttpHeaders.CACHE_CONTROL, "private, max-age=" + THUMBNAIL_CACHE_SECONDS);
        response.setContentLength(thumbnail.bytes().length);
        try (OutputStream out = response.getOutputStream()) {
            out.write(thumbnail.bytes());
            out.flush();
        } catch (IOException e) {
            // 缩略图是可选装饰，客户端断开不值得记失败审计
            log.debug("缩略图下发中断：nodeId={}", nodeId, e);
            return;
        }

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("name", node.getName());
        extra.put("thumbnail", true);
        auditLogger.success(OperationLog.ACTION_FILE_PREVIEW, OperationLog.TARGET_FILE, nodeId, extra);
    }

    /* ============================== 文本预览 ============================== */

    /**
     * 读取文本头部填充预览内容。
     *
     * <p>多读 1 字节用于判定截断：{@code truncated} 必须来自「还有没有更多」这一事实，
     * 而不是「读到的字节数恰好等于上限」——后者在文件正好等于上限时会误报。</p>
     */
    private void fillText(PreviewVO vo, FileNode node) {
        String sha256 = node.getSha256();
        if (sha256 == null || sha256.isBlank() || !fileStorage.contentExists(sha256)) {
            log.error("物理内容缺失，无法文本预览：nodeId={}, sha256={}", node.getId(), sha256);
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "文件内容缺失，无法预览");
        }
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
            log.warn("读取文本预览失败：nodeId={}", node.getId(), e);
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "读取文件内容失败");
        }
        int length = (int) Math.min(read, max);
        vo.setTruncated(read > length);
        vo.setContent(decodeText(head, length));
    }

    /**
     * 文本解码：优先严格 UTF-8 → 严格 GBK → ISO-8859-1 兜底。
     *
     * <p><b>为什么必须 try-strict 而不是直接用默认解码器：</b>默认解码器遇到非法字节会静默替换成
     * {@code U+FFFD}，于是「这个文件根本不是 UTF-8」这一关键事实被抹掉，中文 GBK 文件会整篇变成问号。
     * 开 {@code REPORT} 才能把「解不了」变成可判断的信号，进而回退到 GBK（中文环境的实际主力编码）。</p>
     *
     * <p><b>末尾回退重试：</b>截断可能把一个多字节字符切成两半，严格解码会因此报错并误判编码。
     * 故每次失败后退掉最多 3 个字节再试——把「内容被截断」与「编码不对」这两件事区分开。</p>
     */
    private static String decodeText(byte[] bytes, int length) {
        if (length <= 0) {
            return "";
        }
        Charset bomCharset = charsetFromBom(bytes, length);
        if (bomCharset != null) {
            return new String(bytes, 2, length - 2, bomCharset);
        }
        int offset = hasUtf8Bom(bytes, length) ? 3 : 0;
        int size = length - offset;
        if (size <= 0) {
            return "";
        }
        String utf8 = tryDecodeStrict(StandardCharsets.UTF_8, bytes, offset, size);
        if (utf8 != null) {
            return utf8;
        }
        Charset gbk = gbkOrNull();
        if (gbk != null) {
            String decoded = tryDecodeStrict(gbk, bytes, offset, size);
            if (decoded != null) {
                return decoded;
            }
        }
        // 最终兜底：ISO-8859-1 对任意字节序列都可解码，永不抛异常，
        // 保证「编码完全无法识别」时用户看到乱码而不是一个 500
        return new String(bytes, offset, size, StandardCharsets.ISO_8859_1);
    }

    /** 严格解码；失败则逐字节回退重试（应对末尾被截断的多字节字符），全失败返回 {@code null}。 */
    private static String tryDecodeStrict(Charset charset, byte[] bytes, int offset, int length) {
        CharsetDecoder decoder = charset.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);
        int maxTrim = Math.min(MAX_CHAR_BYTES - 1, length);
        for (int trim = 0; trim <= maxTrim; trim++) {
            try {
                return decoder.reset().decode(ByteBuffer.wrap(bytes, offset, length - trim)).toString();
            } catch (CharacterCodingException ignored) {
                // 换更短的尾部再试
            }
        }
        return null;
    }

    /** UTF-16 / UTF-8 BOM 对应的字符集；无 BOM 返回 {@code null}。 */
    private static Charset charsetFromBom(byte[] bytes, int length) {
        if (length >= 2) {
            int b0 = bytes[0] & 0xFF;
            int b1 = bytes[1] & 0xFF;
            if (b0 == 0xFF && b1 == 0xFE) {
                return StandardCharsets.UTF_16LE;
            }
            if (b0 == 0xFE && b1 == 0xFF) {
                return StandardCharsets.UTF_16BE;
            }
        }
        return null;
    }

    private static boolean hasUtf8Bom(byte[] bytes, int length) {
        return length >= 3
                && (bytes[0] & 0xFF) == 0xEF
                && (bytes[1] & 0xFF) == 0xBB
                && (bytes[2] & 0xFF) == 0xBF;
    }

    private static Charset gbkOrNull() {
        try {
            return Charset.isSupported("GBK") ? Charset.forName("GBK") : null;
        } catch (RuntimeException e) {
            return null;
        }
    }

    /* ============================== 缩略图 ============================== */

    private Thumbnail renderThumbnail(FileNode node, String sha256) {
        Resource resource = fileStorage.contentResource(sha256);

        // 先只读图片头拿尺寸再决定是否解码：几 MB 的 PNG 可解出几万 × 几万的位图，
        // 直接 ImageIO.read 等于把堆内存交给上传者支配
        Dimension size = probeSize(resource);
        if (size == null) {
            throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED, "图片内容无法解析");
        }
        long pixels = (long) size.width * size.height;
        long maxPixels = Math.max(properties.getThumbnailMaxSourcePixels(), 1L);
        if (pixels > maxPixels) {
            log.warn("图片像素超限，拒绝生成缩略图：nodeId={}, pixels={}, max={}", node.getId(), pixels, maxPixels);
            throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED, "图片尺寸过大，无法生成缩略图");
        }

        BufferedImage source;
        try (InputStream in = resource.getInputStream()) {
            source = ImageIO.read(in);
        } catch (IOException e) {
            log.warn("读取图片失败：nodeId={}", node.getId(), e);
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "读取图片失败");
        }
        if (source == null) {
            // 扩展名像图片但内容不是（或运行时缺该编解码器）→ 415，而不是 500
            throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED, "图片内容无法解析");
        }

        BufferedImage target = scaleDown(source, Math.max(properties.getThumbnailMaxEdge(), 1));
        // JPEG 不支持透明通道，带 alpha 的图必须转 PNG，否则透明区域会被填黑
        boolean alpha = target.getColorModel().hasAlpha();
        String format = alpha ? "png" : "jpg";
        String contentType = alpha ? MediaType.IMAGE_PNG_VALUE : MediaType.IMAGE_JPEG_VALUE;
        try (ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
            if (!ImageIO.write(target, format, buffer)) {
                throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "缩略图编码失败");
            }
            return new Thumbnail(buffer.toByteArray(), contentType);
        } catch (IOException e) {
            log.warn("缩略图编码失败：nodeId={}", node.getId(), e);
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "缩略图编码失败");
        }
    }

    /** 只读图片头取尺寸，避免整图解码。无法识别返回 {@code null}。 */
    private static Dimension probeSize(Resource resource) {
        try (InputStream in = resource.getInputStream();
             ImageInputStream imageIn = ImageIO.createImageInputStream(in)) {
            if (imageIn == null) {
                return null;
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageIn);
            if (!readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(imageIn, true, true);
                return new Dimension(reader.getWidth(0), reader.getHeight(0));
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            return null;
        }
    }

    /**
     * 等比缩小；小图原样返回。
     *
     * <p><b>不放大</b>：把 32×32 的图标拉到 256×256 只会得到一张更糊且更大的图，
     * 既浪费带宽又降低观感。</p>
     */
    private static BufferedImage scaleDown(BufferedImage source, int maxEdge) {
        int width = source.getWidth();
        int height = source.getHeight();
        if (width <= maxEdge && height <= maxEdge) {
            return source;
        }
        double ratio = Math.min((double) maxEdge / width, (double) maxEdge / height);
        int targetWidth = Math.max((int) Math.round(width * ratio), 1);
        int targetHeight = Math.max((int) Math.round(height * ratio), 1);
        int type = source.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        BufferedImage target = new BufferedImage(targetWidth, targetHeight, type);
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                    RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(source, 0, 0, targetWidth, targetHeight, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    /**
     * 已编码的缩略图。
     *
     * @param bytes       图片字节
     * @param contentType MIME 类型（PNG / JPEG）
     */
    private record Thumbnail(byte[] bytes, String contentType) {
    }
}
