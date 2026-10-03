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
import com.anttransfer.common.file.FileIngestCommand;
import com.anttransfer.common.file.FileMagic;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.extension.FileScanPipeline;
import com.anttransfer.file.model.vo.UploadResultVO;
import com.anttransfer.file.spi.FileIngestAdapter;
import com.anttransfer.file.storage.FileStorage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 上传类型闸门的接线契约测试（红队 [R-02]）。
 *
 * <p><b>守的是「接线」，不是校验算法本身。</b>{@code FileUploadValidator} 自带单测，
 * 但「工具类正确」与「上传链路真的调了它」是两件事——此前它零引用，
 * 校验器写得再好也拦不住任何东西。本测试断言闸门钉在
 * {@link FileContentService#upload} 这个两条链路（直传 / 分片合并）的共同入口上。</p>
 *
 * <p><b>最关键的一条是 {@link #persistsEveryByteAfterSniffing()}：</b>嗅探要读头部字节，
 * 读完必须回推，否则落盘的每份文件都会<b>静默缺掉开头 32 字节</b>——
 * 校验全部通过、上传全部成功、文件全部损坏。这类缺陷不会让任何断言自然失败，
 * 只能靠「落盘流读出来必须等于原字节」显式钉住。</p>
 *
 * <p><b>未覆盖（诚实边界）：</b>本次只拦「新进入库」的内容。此前已落盘的存量文件不会被回溯校验，
 * 秒传（{@code instantUpload}）命中的也是这些存量内容——它不带字节，无法也无需重新嗅探。
 * 存量清理由独立的安全作业负责，不在本闸门职责内。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class FileContentServiceUploadGuardTest {

    private static final String SHA = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    private static final String SHARE_PATH = "9f/86/9f86d081";

    /** PNG 文件头：魔数校验要求「扩展名 png ⇒ 内容是 PNG」。 */
    private static final byte[] PNG = pngBytes();

    @Mock
    private FileStorage fileStorage;
    @Mock
    private FileNodeService fileNodeService;
    @Mock
    private FileVersionService fileVersionService;
    @Mock
    private FileScanPipeline fileScanPipeline;

    private FileProperties properties;
    private FileContentService service;

    @BeforeEach
    void setUp() {
        properties = new FileProperties();
        properties.setAllowedExtensions(Set.of("png", "pdf", "txt", "zip", "docx"));
        service = new FileContentService(fileStorage, fileNodeService, fileVersionService,
                properties, fileScanPipeline);
    }

    @Test
    @DisplayName("直传：危险扩展名（exe）在落盘之前被拒")
    void rejectsDangerousExtensionBeforeWritingAnyByte() {
        assertThatThrownBy(() -> upload("payload.exe", PNG))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.FILE_TYPE_NOT_ALLOWED);

        assertThat(verifyNoWrites()).as("类型闸门必须在落盘之前").isNull();
    }

    @Test
    @DisplayName("直传：扩展名合法但内容伪装（.png 里装文本）同样被拒")
    void rejectsDisguisedContentEvenWithAllowedExtension() {
        byte[] text = "这不是 PNG，只是改了后缀".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> upload("photo.png", text))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.FILE_TYPE_NOT_ALLOWED);

        assertThat(verifyNoWrites()).as("伪装文件不得落盘").isNull();
    }

    @Test
    @DisplayName("分片合并走的 ingest 与直传共用同一道闸门（不再是绕过口）")
    void chunkedIngestSharesTheSameGate() {
        FileIngestAdapter adapter = new FileIngestAdapter(service);
        FileIngestCommand command = new FileIngestCommand(1L, "payload.exe", null, null,
                null, SHA, PNG.length);

        assertThatThrownBy(() -> adapter.ingest(command, new ByteArrayInputStream(PNG)))
                .as("分片上传曾是完全绕过类型校验的入口")
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.FILE_TYPE_NOT_ALLOWED);

        assertThat(verifyNoWrites()).isNull();
    }

    @Test
    @DisplayName("白名单未配置时拒绝全部上传（fail-closed，而非默认放开）")
    void deniesEverythingWhenWhitelistIsNotConfigured() {
        properties.setAllowedExtensions(Set.of());

        assertThatThrownBy(() -> upload("photo.png", PNG))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("未配置上传扩展名白名单");
    }

    @Test
    @DisplayName("放行时：嗅探后每一个字节都必须还在，且 MIME 以服务端结论为准")
    void persistsEveryByteAfterSniffing() throws IOException {
        when(fileStorage.storeContent(any(), eq(SHA))).thenReturn(SHARE_PATH);
        when(fileNodeService.registerStoredContent(any(), any(), any(), any(), any(), any(), anyLong(), any()))
                .thenReturn(mock(UploadResultVO.class));

        // 客户端谎报 MIME：服务端必须用魔数结论覆盖它
        service.upload(1L, "photo.png", null, null, "application/x-msdownload", SHA,
                PNG.length, new ByteArrayInputStream(PNG));

        ArgumentCaptor<InputStream> streamCaptor = ArgumentCaptor.forClass(InputStream.class);
        verify(fileStorage).storeContent(streamCaptor.capture(), eq(SHA));
        assertThat(readAll(streamCaptor.getValue()))
                .as("嗅探读走的头部必须回推，否则每份文件都会静默缺掉开头 %d 字节", FileMagic.SNIFF_LENGTH)
                .isEqualTo(PNG);

        ArgumentCaptor<String> mimeCaptor = ArgumentCaptor.forClass(String.class);
        verify(fileNodeService).registerStoredContent(eq(1L), eq("photo.png"), any(), any(),
                mimeCaptor.capture(), eq(SHA), eq((long) PNG.length), eq(SHARE_PATH));
        assertThat(mimeCaptor.getValue())
                .as("客户端上报的 application/x-msdownload 不可采信")
                .isEqualTo("image/png");
    }

    // ------------------------------------------------------------------ 夹具

    private void upload(String name, byte[] content) {
        service.upload(1L, name, null, null, "application/octet-stream", SHA,
                content.length, new ByteArrayInputStream(content));
    }

    /** 断言「一次落盘都没发生」；返回 null 只为让调用处能写出一句可读的 as(...)。 */
    private Object verifyNoWrites() {
        verifyNoInteractions(fileStorage);
        return null;
    }

    private static byte[] readAll(InputStream stream) {
        try {
            return stream.readAllBytes();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** 8 字节 PNG 签名 + 一段填充，确保长度超过嗅探长度，能暴露「头部丢失」。 */
    private static byte[] pngBytes() {
        byte[] bytes = new byte[128];
        byte[] signature = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        System.arraycopy(signature, 0, bytes, 0, signature.length);
        for (int i = signature.length; i < bytes.length; i++) {
            bytes[i] = (byte) (i % 251);
        }
        return bytes;
    }
}
