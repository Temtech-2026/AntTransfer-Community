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
package com.anttransfer.common.file;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 提示音容器识别与时长解析的回归证据。
 *
 * <p>守三件事：</p>
 * <ol>
 *     <li><b>识别只看魔数</b>：扩展名 / 客户端 MIME 不参与（与 {@code ImageTypes} 同口径），
 *     不支持的容器一律返回 {@code null}（调用方据此以 4031 拒绝）。</li>
 *     <li><b>时长来自容器头，不来自调用方</b>：WAV 走 {@code data ÷ byteRate}、
 *     MP3 走 Xing 帧计数或 CBR 推算、OGG 走末页 granule ÷ 采样率。</li>
 *     <li><b>「算不出来」必须体现为空</b>：截断文件不得被当成 0 秒放行
 *     （放行等于把「无法验证」当成「满足上限」）。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
class AudioTypesTest {

    /* ==================== 识别 ==================== */

    @Test
    @DisplayName("WAV：RIFF 头 + WAVE 载荷标识识别为 wav / audio/wav")
    void detect_wav() {
        AudioTypes.AudioType type = AudioTypes.detect(wav(8000, 8000));

        assertThat(type).isNotNull();
        assertThat(type.extension()).isEqualTo("wav");
        assertThat(type.contentType()).isEqualTo("audio/wav");
    }

    @Test
    @DisplayName("MP3：裸帧同步字识别为 mp3；带 ID3v2 标签时同样识别")
    void detect_mp3() {
        assertThat(AudioTypes.detect(mp3Cbr(1600))).isNotNull();
        assertThat(AudioTypes.detect(mp3Cbr(1600)).extension()).isEqualTo("mp3");

        byte[] withId3 = concat(id3v2Tag(32), mp3Cbr(1600));
        assertThat(AudioTypes.detect(withId3)).isNotNull();
        assertThat(AudioTypes.detect(withId3).contentType()).isEqualTo("audio/mpeg");
    }

    @Test
    @DisplayName("OGG：OggS 捕获模式识别为 ogg / audio/ogg")
    void detect_ogg() {
        AudioTypes.AudioType type = AudioTypes.detect(oggVorbis(8000, 8000));

        assertThat(type).isNotNull();
        assertThat(type.extension()).isEqualTo("ogg");
        assertThat(type.contentType()).isEqualTo("audio/ogg");
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"fLaC", "ftypM4A", "\u0000\u0000\u0000\u0000#!AMR", "RIFFxxxxAVI "})
    @DisplayName("支持面外的容器（FLAC / M4A / AMR / AVI）必须识别为 null：不做「尽力而为」的猜测")
    void detect_rejectsUnsupportedContainers(String prefix) {
        byte[] content = pad(prefix.getBytes(StandardCharsets.ISO_8859_1), 64);

        assertThat(AudioTypes.detect(content)).isNull();
    }

    @Test
    @DisplayName("空 / 过短 / null 输入不抛异常，返回 null")
    void detect_toleratesDegenerateInput() {
        assertThat(AudioTypes.detect(null)).isNull();
        assertThat(AudioTypes.detect(new byte[0])).isNull();
        assertThat(AudioTypes.detect(new byte[]{'O', 'g'})).isNull();
    }

    @Test
    @DisplayName("RIFF 但不是 WAVE（例如 AVI）不算 wav")
    void detect_riffNonWave_isNotWav() {
        byte[] riff = concat("RIFF".getBytes(StandardCharsets.ISO_8859_1), new byte[4]);
        riff = concat(riff, "AVI ".getBytes(StandardCharsets.ISO_8859_1));

        assertThat(AudioTypes.detect(riff)).isNull();
    }

    /* ==================== 按扩展名反查（读侧） ==================== */

    @Test
    @DisplayName("byExtension 覆盖大小写与别名（wave / oga），不做路径拼接")
    void byExtension_coversAliasesAndCase() {
        assertThat(AudioTypes.byExtension("wav").contentType()).isEqualTo("audio/wav");
        assertThat(AudioTypes.byExtension("WAVE").extension()).isEqualTo("wav");
        assertThat(AudioTypes.byExtension("MP3").contentType()).isEqualTo("audio/mpeg");
        assertThat(AudioTypes.byExtension("oga").extension()).isEqualTo("ogg");
        assertThat(AudioTypes.byExtension("exe")).isNull();
        assertThat(AudioTypes.byExtension(null)).isNull();
    }

    /* ==================== 时长：WAV ==================== */

    @Test
    @DisplayName("WAV 时长 = data 字节数 ÷ byteRate：8000 字节 @ 8000 B/s = 1000 ms")
    void wavDuration_isDataOverByteRate() {
        byte[] content = wav(8000, 8000);

        OptionalLong duration = AudioTypes.durationMillis(content, AudioTypes.detect(content));

        assertThat(duration).hasValue(1000L);
    }

    @Test
    @DisplayName("WAV 的 data 声明长度大于文件本身（截断）时时长为空：不按剩余字节硬算出一个小数字")
    void wavDuration_truncatedData_isEmpty() {
        byte[] full = wav(8000, 8000);
        // 声明 8000 字节的 data，实际只留 4000 字节（截断一半）
        byte[] truncated = new byte[full.length - 4000];
        System.arraycopy(full, 0, truncated, 0, truncated.length);

        // 截断文件的头部已不可信：这里必须返回空、由调用方以 4032 拒绝，
        // 而不是「用剩余字节除以 byteRate」给出一个看起来合理却错的时长
        assertThat(AudioTypes.durationMillis(truncated, AudioTypes.byExtension("wav"))).isEmpty();
    }

    @Test
    @DisplayName("WAV 缺少 fmt / data 块时时长为空：不给出一个假的数字")
    void wavDuration_missingChunks_isEmpty() {
        byte[] headerOnly = "RIFF\u0004\u0000\u0000\u0000WAVE".getBytes(StandardCharsets.ISO_8859_1);

        assertThat(AudioTypes.durationMillis(headerOnly, AudioTypes.byExtension("wav"))).isEmpty();
    }

    /* ==================== 时长：MP3 ==================== */

    @Test
    @DisplayName("MP3 无 Xing 帧时按 CBR 推算：字节 × 8 ÷ kbps")
    void mp3Duration_withoutXing_computesFromBitrate() {
        // 128 kbps：16000 字节 → 16000 × 8 ÷ 128 = 1000 ms
        byte[] content = mp3Cbr(16000);

        OptionalLong duration = AudioTypes.durationMillis(content, AudioTypes.detect(content));

        assertThat(duration).hasValue(1000L);
    }

    @Test
    @DisplayName("MP3 Xing 帧存在时取帧计数（VBR 下唯一准确来源），忽略 CBR 公式")
    void mp3Duration_withXing_usesFrameCount() {
        // 首帧 128 kbps / 44100 Hz 单声道 → Xing 偏移 4 + 17 = 21；
        // 帧数 38 帧 × 1152 采样 ÷ 44100 ≈ 993 ms（若走 CBR 公式会得到完全不同的值）
        byte[] content = mp3WithXing(128, 38, 16000);

        OptionalLong duration = AudioTypes.durationMillis(content, AudioTypes.detect(content));

        assertThat(duration).hasValue(993L);
    }

    @Test
    @DisplayName("ID3v2 前置标签被跳过：时长不把标签字节算进音频长度")
    void mp3Duration_skipsId3v2Tag() {
        byte[] plain = mp3Cbr(16000);
        byte[] tagged = concat(id3v2Tag(100), plain);

        OptionalLong duration = AudioTypes.durationMillis(tagged, AudioTypes.detect(tagged));
        OptionalLong reference = AudioTypes.durationMillis(plain, AudioTypes.detect(plain));

        assertThat(duration).isEqualTo(reference);
    }

    @Test
    @DisplayName("MP3 Layer I/II（非 Layer III）时长为空：不给错时长，交由调用方拒绝")
    void mp3Duration_rejectsNonLayerThree() {
        // 0xFF 0xFD：MPEG1 Layer II
        byte[] layerTwo = pad(new byte[]{(byte) 0xFF, (byte) 0xFD, (byte) 0x90, (byte) 0xC0}, 16000);

        assertThat(AudioTypes.durationMillis(layerTwo, AudioTypes.detect(layerTwo))).isEmpty();
    }

    /* ==================== 时长：OGG ==================== */

    @Test
    @DisplayName("OGG Vorbis 时长 = 末页 granule ÷ 采样率：8000 ÷ 8000 = 1000 ms")
    void oggDuration_vorbis_isGranuleOverSampleRate() {
        byte[] content = oggVorbis(8000, 8000);

        OptionalLong duration = AudioTypes.durationMillis(content, AudioTypes.detect(content));

        assertThat(duration).hasValue(1000L);
    }

    @Test
    @DisplayName("OGG 采样率读不出（非 Vorbis / Opus）时时长为空")
    void oggDuration_unknownCodec_isEmpty() {
        // 首包既不是 vorbis 也不是 Opus：采样率无从得知，时长必须为空而不是猜一个
        byte[] content = concat(oggPage(0, 1), "\u0001theora".getBytes(StandardCharsets.ISO_8859_1));
        content = concat(content, oggPage(8000, 0));

        assertThat(AudioTypes.durationMillis(content, AudioTypes.detect(content))).isEmpty();
    }

    @Test
    @DisplayName("截断的 MP3（只剩 ID3 标签）时长为空，不得误判为 0 秒放行")
    void mp3Duration_truncated_isEmpty() {
        byte[] tagOnly = id3v2Tag(64);

        assertThat(AudioTypes.durationMillis(tagOnly, AudioTypes.detect(tagOnly))).isEmpty();
    }

    /* ==================== 构造工具 ==================== */

    /** 构造 WAV：RIFF/WAVE + fmt(16) + data，采样率与字节率给定，data 长度 = byteRate（即 1 秒）。 */
    private static byte[] wav(int sampleRate, int byteRate) {
        int dataSize = byteRate; // 1 秒
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes("RIFF".getBytes(StandardCharsets.ISO_8859_1));
        out.writeBytes(le32(36 + dataSize));
        out.writeBytes("WAVE".getBytes(StandardCharsets.ISO_8859_1));
        out.writeBytes("fmt ".getBytes(StandardCharsets.ISO_8859_1));
        out.writeBytes(le32(16));
        out.writeBytes(le16(1));            // PCM
        out.writeBytes(le16(1));            // mono
        out.writeBytes(le32(sampleRate));
        out.writeBytes(le32(byteRate));
        out.writeBytes(le16(1));            // blockAlign
        out.writeBytes(le16(8));            // bitsPerSample
        out.writeBytes("data".getBytes(StandardCharsets.ISO_8859_1));
        out.writeBytes(le32(dataSize));
        out.writeBytes(new byte[dataSize]);
        return out.toByteArray();
    }

    /** 构造 CBR MP3：一个 128 kbps 首帧头 + 填充字节（无 Xing 帧）。 */
    private static byte[] mp3Cbr(int totalBytes) {
        // MPEG1 Layer III 比特率表下标 9 = 128 kbps；采样率下标 0 = 44100 Hz
        int bitrateIndex = 9;
        byte[] frame = {
                (byte) 0xFF, (byte) 0xFB,
                (byte) ((bitrateIndex << 4) | (0 << 2)),
                (byte) 0xC0 // 单声道
        };
        return pad(frame, totalBytes);
    }

    /** 构造带 Xing 帧的 MP3：首帧头部后紧跟 Xing 帧计数。 */
    private static byte[] mp3WithXing(int bitrateKbps, int frameCount, int totalBytes) {
        byte[] head = {
                (byte) 0xFF, (byte) 0xFB,
                (byte) (0x90),           // 128 kbps / 44100 Hz
                (byte) 0xC0              // 单声道 → side info 17 → Xing 偏移 21
        };
        byte[] result = new byte[totalBytes];
        System.arraycopy(head, 0, result, 0, head.length);
        byte[] xing = concat("Xing".getBytes(StandardCharsets.ISO_8859_1), be32(0x01));
        xing = concat(xing, be32(frameCount));
        System.arraycopy(xing, 0, result, 21, xing.length);
        return result;
    }

    /** 构造含 ID3v2.3 标签（syncsafe 长度）的字节。 */
    private static byte[] id3v2Tag(int size) {
        byte[] tag = new byte[10 + size];
        tag[0] = 'I';
        tag[1] = 'D';
        tag[2] = '3';
        tag[3] = 3;                      // 版本
        tag[5] = 0;                      // 无 footer
        tag[6] = (byte) ((size >> 21) & 0x7F);
        tag[7] = (byte) ((size >> 14) & 0x7F);
        tag[8] = (byte) ((size >> 7) & 0x7F);
        tag[9] = (byte) (size & 0x7F);
        return tag;
    }

    /** 构造一个 Ogg 页头（无段表数据），granule 为页级 granule position。 */
    private static byte[] oggPage(long granule, int segmentCount) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes("OggS".getBytes(StandardCharsets.ISO_8859_1));
        out.write(0);                        // 版本
        out.write(0);                        // 页类型
        out.writeBytes(le64(granule));
        out.writeBytes(new byte[4]);         // serial
        out.writeBytes(new byte[4]);         // page seq
        out.writeBytes(new byte[4]);         // crc
        out.write(segmentCount);
        return out.toByteArray();
    }

    /** 构造最小可解析的 OGG Vorbis：首页（含 identification header）+ 末页（带 granule）。 */
    private static byte[] oggVorbis(int sampleRate, long granule) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        // 首页：1 个段，段表长度需覆盖整个 identification header（16 字节）
        out.writeBytes("OggS".getBytes(StandardCharsets.ISO_8859_1));
        out.write(0);
        out.write(2);                        // BOS
        out.writeBytes(le64(0));
        out.writeBytes(new byte[4]);
        out.writeBytes(new byte[4]);
        out.writeBytes(new byte[4]);
        out.write(1);                        // 段数
        out.write(16);                       // 段表：该段 16 字节（但本实现不校验长度）
        // identification header：0x01 + "vorbis"(6) + version(4) + channels(1) + sampleRate(4)
        out.write(1);
        out.writeBytes("vorbis".getBytes(StandardCharsets.ISO_8859_1));
        out.writeBytes(le32(0));             // version
        out.write(1);                        // channels
        out.writeBytes(le32(sampleRate));
        // 末页：带 granule，段数 0
        out.writeBytes(oggPage(granule, 0));
        return out.toByteArray();
    }

    private static byte[] pad(byte[] prefix, int totalLength) {
        byte[] result = new byte[Math.max(totalLength, prefix.length)];
        System.arraycopy(prefix, 0, result, 0, prefix.length);
        return result;
    }

    private static byte[] concat(byte[] first, byte[] second) {
        byte[] result = new byte[first.length + second.length];
        System.arraycopy(first, 0, result, 0, first.length);
        System.arraycopy(second, 0, result, first.length, second.length);
        return result;
    }

    private static byte[] le16(int value) {
        return new byte[]{(byte) value, (byte) (value >> 8)};
    }

    private static byte[] le32(long value) {
        return new byte[]{(byte) value, (byte) (value >> 8), (byte) (value >> 16), (byte) (value >> 24)};
    }

    private static byte[] le64(long value) {
        byte[] result = new byte[8];
        for (int i = 0; i < 8; i++) {
            result[i] = (byte) (value >> (8 * i));
        }
        return result;
    }

    private static byte[] be32(int value) {
        return new byte[]{(byte) (value >> 24), (byte) (value >> 16), (byte) (value >> 8), (byte) value};
    }
}
