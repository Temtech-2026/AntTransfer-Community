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

import java.util.OptionalLong;

/**
 * 提示音容器的识别（只看文件头魔数）与时长解析（只看容器头声明的时长，不解码音频）。
 *
 * <p><b>为什么上限必须由服务端算，而不是读前端上报的时长：</b>
 * 「提示音不超过 10 秒」是服务端要落库的事实（{@code custom_sound_duration_ms}），
 * 事实不能由被约束方自己申报——请求体里一个字段就能绕过。故本类在服务端从字节里算出时长，
 * 前端那边的时长校验只负责「不等上传就给出超限提示」这一体验层面的价值。</p>
 *
 * <p><b>为什么按魔数而不是按扩展名 / 客户端 MIME：</b>与 {@link ImageTypes} 同理，
 * 两者都来自客户端、可任意伪造。落盘扩展名与响应 {@code Content-Type} 一律由识别结果决定。</p>
 *
 * <p><b>支持面为什么只到 MP3 / WAV / OGG：</b>
 * M4A/AAC 的时长在 {@code moov} 盒链里，要正确解析得走进 MP4 盒树，出错面高一个量级，
 * 而它在提示音场景没有任何独有能力；FLAC/WMA/AMR 的浏览器直出支持面不稳定，
 * 收进来只会得到「上传成功但没声音」。OGG 只认 Vorbis / Opus 两种编码。</p>
 *
 * <p><b>时长口径：</b>WAV 用 {@code data} 字节数 ÷ {@code byteRate}；MP3 优先取 Xing/Info 帧计数
 * （VBR 下唯一准确来源），无该帧时按 CBR 公式推算；OGG 取末页 granule ÷ 采样率
 * （Opus 恒按 48 kHz，见 RFC 7845 §4）。算不出来时返回空，由调用方以 4032 拒绝——
 * <b>不放行</b>：「无法验证」不等于「满足上限」。</p>
 *
 * <p>本类不读磁盘、不持状态、不依赖第三方库，纯函数可单测。</p>
 *
 * @author AntTransfer CE
 * @see NotificationSoundStoragePort
 */
public final class AudioTypes {

    /** 识别所需的最小字节数（RIFF 需要读到第 12 字节的载荷标识）。 */
    public static final int SNIFF_LENGTH = 12;

    /** RIFF 容器头（wav 是 RIFF 的一种载荷） */
    private static final byte[] MAGIC_RIFF = {'R', 'I', 'F', 'F'};
    /** RIFF 载荷类型标识：WAVE */
    private static final byte[] MAGIC_WAVE = {'W', 'A', 'V', 'E'};
    /** Ogg 页头捕获模式（每页都以它开头，故也能从尾部反查末页） */
    private static final byte[] MAGIC_OGGS = {'O', 'g', 'g', 'S'};
    /** ID3v2 标签头（MP3 常见前置标签，解析首帧前要跳过） */
    private static final byte[] MAGIC_ID3 = {'I', 'D', '3'};
    /** Vorbis identification header 的包头类型 + 魔数 */
    private static final byte[] MAGIC_VORBIS = {0x01, 'v', 'o', 'r', 'b', 'i', 's'};
    /** Opus identification header */
    private static final byte[] MAGIC_OPUS = {'O', 'p', 'u', 's', 'H', 'e', 'a', 'd'};
    /** MP3 首帧内的帧计数标识（VBR 写 Xing，CBR 编码器常写 Info，语义等价） */
    private static final byte[] MAGIC_XING = {'X', 'i', 'n', 'g'};
    /** 见 {@link #MAGIC_XING} */
    private static final byte[] MAGIC_INFO = {'I', 'n', 'f', 'o'};
    /** WAV 格式块标识 */
    private static final byte[] CHUNK_FMT = {'f', 'm', 't', ' '};
    /** WAV 采样数据块标识 */
    private static final byte[] CHUNK_DATA = {'d', 'a', 't', 'a'};

    private static final AudioType WAV = new AudioType("wav", "audio/wav");
    private static final AudioType MP3 = new AudioType("mp3", "audio/mpeg");
    private static final AudioType OGG = new AudioType("ogg", "audio/ogg");

    /** MPEG1 Layer III 比特率表（kbps），下标即 4 位 bitrate index；下标 0 与 15 为保留值 */
    private static final int[] BITRATES_MPEG1_LAYER3 =
            {0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0};
    /** MPEG2 / MPEG2.5 Layer III 比特率表（kbps） */
    private static final int[] BITRATES_MPEG2_LAYER3 =
            {0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0};
    /** 采样率表，按 MPEG1 / MPEG2 / MPEG2.5 分行（下标即 2 位 sample rate index） */
    private static final int[][] SAMPLE_RATES = {
            {44100, 48000, 32000},
            {22050, 24000, 16000},
            {11025, 12000, 8000}
    };

    /** Opus 的 granule 恒以 48 kHz 计（RFC 7845 §4） */
    private static final int OPUS_GRANULE_RATE = 48000;

    private AudioTypes() {
    }

    /**
     * 支持的音频类型：落盘扩展名 + 响应 {@code Content-Type} 的唯一真相源。
     *
     * @param extension   规范扩展名（小写、无点；落盘文件名只用它）
     * @param contentType HTTP 响应类型（对外播放只用它）
     */
    public record AudioType(String extension, String contentType) {
    }

    /**
     * 按魔数识别音频容器类型。
     *
     * @param content 文件字节（至少前 {@link #SNIFF_LENGTH} 字节，多传无妨）
     * @return 识别结果；<b>不在支持面内时返回 {@code null}</b>（调用方据此以 4031 拒绝）
     */
    public static AudioType detect(byte[] content) {
        if (content == null || content.length < 4) {
            return null;
        }
        if (content.length >= SNIFF_LENGTH
                && startsWith(content, MAGIC_RIFF)
                && matchesAt(content, MAGIC_WAVE, 8)) {
            return WAV;
        }
        if (startsWith(content, MAGIC_OGGS)) {
            return OGG;
        }
        if (startsWith(content, MAGIC_ID3) || isMpegFrameSync(content, 0)) {
            return MP3;
        }
        return null;
    }

    /**
     * 按已知扩展名反查响应类型。
     *
     * <p>用于「读侧」：读盘时只有落盘扩展名，没有原始字节可嗅探。扩展名由 {@link #detect}
     * 在落盘时写定，故这里是可信输入；不在白名单内的扩展名返回 {@code null}。</p>
     *
     * @param extension 落盘扩展名
     * @return 对应类型；不认识时返回 {@code null}
     */
    public static AudioType byExtension(String extension) {
        if (extension == null) {
            return null;
        }
        return switch (extension.toLowerCase()) {
            case "wav", "wave" -> WAV;
            case "mp3" -> MP3;
            case "ogg", "oga" -> OGG;
            default -> null;
        };
    }

    /**
     * 解析音频时长。
     *
     * @param content 文件字节
     * @param type    由 {@link #detect} 得到的容器类型
     * @return 时长毫秒；<b>算不出来时为空</b>（截断文件、或本类不解析的编码变体），调用方据此以 4032 拒绝
     */
    public static OptionalLong durationMillis(byte[] content, AudioType type) {
        if (content == null || type == null) {
            return OptionalLong.empty();
        }
        if (WAV.equals(type)) {
            return wavDuration(content);
        }
        if (MP3.equals(type)) {
            return mp3Duration(content);
        }
        if (OGG.equals(type)) {
            return oggDuration(content);
        }
        return OptionalLong.empty();
    }

    /** WAV：{@code data} 块字节数 ÷ {@code fmt } 块声明的 byteRate。 */
    private static OptionalLong wavDuration(byte[] content) {
        int offset = 12;
        long byteRate = 0;
        long dataSize = -1;
        while (offset + 8 <= content.length) {
            long chunkSize = le32(content, offset + 4);
            // 块长大于文件本身说明头已损坏；继续走会越界，且 0xFFFFFFFF 的流式写法会让偏移量回绕
            if (chunkSize > content.length) {
                break;
            }
            if (matchesAt(content, CHUNK_FMT, offset)) {
                if (offset + 24 <= content.length) {
                    // fmt 块体：audioFormat(2) channels(2) sampleRate(4) byteRate(4) ...
                    byteRate = le32(content, offset + 16);
                }
            } else if (matchesAt(content, CHUNK_DATA, offset)) {
                // 声明长度可能大于实际剩余字节（截断文件），取两者较小值
                dataSize = Math.min(chunkSize, content.length - (long) offset - 8);
                if (byteRate > 0) {
                    break;
                }
            }
            // RIFF 块按偶数字节对齐
            offset += 8 + (int) chunkSize + (int) (chunkSize & 1L);
        }
        if (byteRate <= 0 || dataSize <= 0) {
            return OptionalLong.empty();
        }
        return OptionalLong.of(Math.round(dataSize * 1000.0 / byteRate));
    }

    /** MP3：优先取 Xing/Info 帧计数，退化为 CBR 推算。 */
    private static OptionalLong mp3Duration(byte[] content) {
        int frameOffset = findFrameSync(content, id3v2Length(content));
        if (frameOffset < 0) {
            return OptionalLong.empty();
        }
        Mp3Frame frame = parseMp3Frame(content, frameOffset);
        if (frame == null) {
            return OptionalLong.empty();
        }
        long frames = xingFrameCount(content, frameOffset + frame.xingOffset());
        if (frames > 0) {
            return OptionalLong.of(
                    Math.round(frames * (double) frame.samplesPerFrame() * 1000.0 / frame.sampleRate()));
        }
        long audioBytes = content.length - (long) frameOffset;
        if (audioBytes <= 0) {
            return OptionalLong.empty();
        }
        // 字节 × 8 ÷ kbps 即为毫秒：(bits ÷ (kbps × 1000)) × 1000 约去一个 1000
        return OptionalLong.of(Math.round(audioBytes * 8.0 / frame.bitrateKbps()));
    }

    /** OGG：末页 granule ÷ 采样率。 */
    private static OptionalLong oggDuration(byte[] content) {
        int sampleRate = oggSampleRate(content);
        if (sampleRate <= 0) {
            return OptionalLong.empty();
        }
        long granule = lastOggGranule(content);
        if (granule <= 0) {
            return OptionalLong.empty();
        }
        return OptionalLong.of(Math.round(granule * 1000.0 / sampleRate));
    }

    /** OGG 采样率：Vorbis 取 identification header 的值，Opus 恒 48 kHz。 */
    private static int oggSampleRate(byte[] content) {
        if (content.length < 28) {
            return -1;
        }
        int pageSegments = content[26] & 0xFF;
        int packetAt = 27 + pageSegments;
        if (packetAt >= content.length) {
            return -1;
        }
        if (matchesAt(content, MAGIC_OPUS, packetAt)) {
            return OPUS_GRANULE_RATE;
        }
        // Vorbis identification header：包类型(1) + "vorbis"(6) + version(4) + channels(1) + sampleRate(4)
        if (matchesAt(content, MAGIC_VORBIS, packetAt) && packetAt + 16 <= content.length) {
            return (int) le32(content, packetAt + 12);
        }
        return -1;
    }

    /** 末页 granule position：从尾往前找第一个页头（页头第 6 字节起是 8 字节小端 granule）。 */
    private static long lastOggGranule(byte[] content) {
        for (int i = content.length - 27; i >= 0; i--) {
            if (matchesAt(content, MAGIC_OGGS, i) && i + 14 <= content.length) {
                return le64(content, i + 6);
            }
        }
        return -1;
    }

    /**
     * MP3 首帧头解析出的取值集合。
     *
     * @param sampleRate      采样率（Hz）
     * @param bitrateKbps     码率（kbps）：Xing 帧存在时只用于兜底推算，否则是 CBR 推算的除数
     * @param samplesPerFrame 每帧采样数（MPEG1 Layer III 为 1152，MPEG2/2.5 为 576）
     * @param mpeg1           是否 MPEG1（决定帧头后续的 side info 长度）
     * @param mono            是否单声道（Xing 帧的偏移量随声道数变化）
     */
    private record Mp3Frame(int sampleRate, int bitrateKbps, int samplesPerFrame, boolean mpeg1, boolean mono) {

        /**
         * Xing/Info 帧相对帧头的偏移：4 字节帧头 + side info。
         *
         * <p>side info 长度由「MPEG 版本 + 声道数」唯一决定（MPEG1：单声道 17 / 双声道 32；
         * MPEG2、2.5：单声道 9 / 双声道 17），写死这四个常数即可，无需引入解析库。</p>
         */
        int xingOffset() {
            int sideInfo = mpeg1 ? (mono ? 17 : 32) : (mono ? 9 : 17);
            return 4 + sideInfo;
        }
    }

    /**
     * 解析 MP3 帧头。
     *
     * <p><b>只解析 Layer III</b>：所有常见提示音与音乐 mp3 都是 Layer III；
     * Layer I/II 直接返回 {@code null}，由调用方以 4032 拒绝（提示用户换 WAV/OGG），
     * 而不是用不相干的表硬算出一个错时长。</p>
     */
    private static Mp3Frame parseMp3Frame(byte[] content, int offset) {
        if (offset + 4 > content.length) {
            return null;
        }
        int b2 = content[offset + 1] & 0xFF;
        int b3 = content[offset + 2] & 0xFF;
        int b4 = content[offset + 3] & 0xFF;
        int versionBits = (b2 >> 3) & 0x03;
        int layerBits = (b2 >> 1) & 0x03;
        // versionBits=1 与 layerBits=0 都是保留值
        if (versionBits == 1 || layerBits == 0 || layerBits != 1) {
            return null;
        }
        int bitrateIndex = (b3 >> 4) & 0x0F;
        int sampleRateIndex = (b3 >> 2) & 0x03;
        if (bitrateIndex == 0 || bitrateIndex == 15 || sampleRateIndex == 3) {
            return null;
        }
        boolean mpeg1 = versionBits == 3;
        int bitrate = (mpeg1 ? BITRATES_MPEG1_LAYER3 : BITRATES_MPEG2_LAYER3)[bitrateIndex];
        if (bitrate <= 0) {
            return null;
        }
        int[] rates = mpeg1 ? SAMPLE_RATES[0] : (versionBits == 2 ? SAMPLE_RATES[1] : SAMPLE_RATES[2]);
        return new Mp3Frame(rates[sampleRateIndex], bitrate, mpeg1 ? 1152 : 576, mpeg1, (b4 >> 6) == 3);
    }

    /**
     * 读 Xing/Info 帧里的总帧数。
     *
     * @return 帧数；无该帧或未置「帧数有效」标志位时返回 {@code -1}
     */
    private static long xingFrameCount(byte[] content, int offset) {
        if (offset + 12 > content.length) {
            return -1;
        }
        if (!matchesAt(content, MAGIC_XING, offset) && !matchesAt(content, MAGIC_INFO, offset)) {
            return -1;
        }
        // 标识后 4 字节是 flags，第 0 位置位才表示「帧数」字段有效
        int flags = be32(content, offset + 4);
        if ((flags & 0x01) == 0) {
            return -1;
        }
        return be32(content, offset + 8) & 0xFFFFFFFFL;
    }

    /** ID3v2 标签总长度（含 10 字节头）；无标签时返回 0。 */
    private static int id3v2Length(byte[] content) {
        if (content.length < 10 || !matchesAt(content, MAGIC_ID3, 0)) {
            return 0;
        }
        // 长度字段是 syncsafe 编码：每字节只用低 7 位
        int size = ((content[6] & 0x7F) << 21)
                | ((content[7] & 0x7F) << 14)
                | ((content[8] & 0x7F) << 7)
                | (content[9] & 0x7F);
        int total = 10 + size;
        // 置了 footer 标志时，标签末尾还有 10 字节 footer
        if ((content[5] & 0x10) != 0) {
            total += 10;
        }
        return Math.min(Math.max(total, 0), content.length);
    }

    /** 从 {@code from} 起找第一个合法的 MPEG 帧同步字。 */
    private static int findFrameSync(byte[] content, int from) {
        for (int i = Math.max(from, 0); i + 1 < content.length; i++) {
            if (isMpegFrameSync(content, i)) {
                return i;
            }
        }
        return -1;
    }

    /** 11 位全 1 的帧同步字（后 5 位是版本/层/保护位，不参与同步判断）。 */
    private static boolean isMpegFrameSync(byte[] content, int offset) {
        if (offset + 1 >= content.length) {
            return false;
        }
        return (content[offset] & 0xFF) == 0xFF && (content[offset + 1] & 0xE0) == 0xE0;
    }

    private static boolean startsWith(byte[] content, byte[] magic) {
        return matchesAt(content, magic, 0);
    }

    private static boolean matchesAt(byte[] content, byte[] magic, int offset) {
        if (offset < 0 || offset + magic.length > content.length) {
            return false;
        }
        for (int i = 0; i < magic.length; i++) {
            if (content[offset + i] != magic[i]) {
                return false;
            }
        }
        return true;
    }

    /** 小端 32 位无符号读取（返回 long，避免 0xFFFFFFFF 被当成负数）。 */
    private static long le32(byte[] content, int offset) {
        return (content[offset] & 0xFFL)
                | ((content[offset + 1] & 0xFFL) << 8)
                | ((content[offset + 2] & 0xFFL) << 16)
                | ((content[offset + 3] & 0xFFL) << 24);
    }

    /** 小端 64 位读取（Ogg granule position）。 */
    private static long le64(byte[] content, int offset) {
        long value = 0;
        for (int i = 7; i >= 0; i--) {
            value = (value << 8) | (content[offset + i] & 0xFFL);
        }
        return value;
    }

    /** 大端 32 位读取（MP3 帧头的 flags 与帧数）。 */
    private static int be32(byte[] content, int offset) {
        return ((content[offset] & 0xFF) << 24)
                | ((content[offset + 1] & 0xFF) << 16)
                | ((content[offset + 2] & 0xFF) << 8)
                | (content[offset + 3] & 0xFF);
    }
}
