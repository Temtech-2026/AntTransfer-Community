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

import java.util.Optional;

/**
 * 用户自定义提示音字节的存储端口（SPI）：写入方与读出方都是 at-auth，实现在 at-file
 * （存储介质与落盘布局属于文件域）——与 {@link AvatarStoragePort} 同一分工。
 *
 * <p><b>为什么不复用文件域（{@code sys_file}）与 {@link AvatarStoragePort}：</b>
 * 不复用文件域的理由与头像完全相同（进文件列表 / 要 {@code file:upload} 权限 / 取件票据会过期），
 * 见 {@link AvatarStoragePort} 类注释。也不复用头像端口，是<b>故意的隔离</b>：
 * ① 上限不同（头像 2 MiB、提示音 1 MiB）且会各自演进，共用一个常量等于把两条上限绑死；
 * ② 落盘目录必须分开，否则「删头像」与「删提示音」的清理逻辑会互相误删；
 * ③ 两者的直出路径与鉴权口径不同（见下）。</p>
 *
 * <p><b>直出为什么不像头像那样开放匿名访问：</b>头像要出现在<b>他人</b>的成员名单 / 用户详情里，
 * 匿名直出是刚性需求；提示音只在<b>本人</b>已登录的会话里播放，没有「把提示音地址贴给别人」的用例。
 * 少一个匿名入口就少一处越权面，故本端口的对外路径固定为「本人」语义
 * （{@code /users/me/...}），不接收 userId 参数。</p>
 *
 * <p><b>key 的形态与语义：</b>与头像同——{@link #store} 返回的 key 是<b>不透明</b>的
 * （实现为 {@code <32 位十六进制随机>.<扩展名>}），落库进 {@code sys_user_notify_setting.custom_sound_key}。
 * 调用方不得解析它、不得假设它等于路径、<b>更不得把客户端传来的字符串当作 key 回传</b>。</p>
 *
 * <p><b>缓存口径：</b>每次存储生成全新 key，故「key 变了」等价于「音频变了」，
 * {@link #urlOf} 把 key 编进查询串做版本号，浏览器与中间层可以放心长缓存。</p>
 *
 * @author AntTransfer CE
 * @see com.anttransfer.common.file.AudioTypes
 */
public interface NotificationSoundStoragePort {

    /**
     * 单个提示音字节上限：1 MiB。
     *
     * <p>取值依据（与时长上限 10 秒是<b>配套</b>的两个数，改动须一起看）：
     * 上限最紧的使用方式是未压缩 WAV——10 秒单声道 16 bit 44.1 kHz 约 860 KiB，
     * 故 1 MiB 恰好能容纳「音质最差情况下的最长合规音频」；
     * 反过来若把上限压到 512 KiB，合规时长的 WAV 会被<b>大小</b>这一条挡掉，
     * 用户按「时长没超」去试却一直失败，是很差的错因。MP3 / OGG 的 10 秒远小于此，
     * 这条上限事实上只约束 WAV。</p>
     *
     * <p>上限的作用是让「上传一首 5 分钟的完整歌曲」在读入内存前被拒掉
     * （{@code spring.servlet.multipart.max-file-size} 是 64 MB，不能靠它兜底）。</p>
     */
    long MAX_SOUND_BYTES = 1024L * 1024;

    /**
     * 提示音时长上限：10 秒。
     *
     * <p>取值依据：提示音是「一声」，微信 / 钉钉的自定义提示音都在数秒量级，
     * 10 秒已远超「一声」所需；同时它给 WAV 留出的体积（约 860 KiB）正好落在
     * {@link #MAX_SOUND_BYTES} 之内，两个上限不会互相矛盾。</p>
     *
     * <p>时长由 {@link AudioTypes#durationMillis} 在服务端从容器头解析，
     * <b>不采信前端上报</b>（见 sql/V21 口径）。</p>
     */
    long MAX_SOUND_DURATION_MILLIS = 10_000L;

    /**
     * 本人提示音直出路径（不含 host；{@code /api} 来自 {@code server.servlet.context-path}）。
     *
     * <p>路径里没有 userId，是刻意的：它只有「我的」一种语义，无法被改成读别人的音频。</p>
     */
    String CONTENT_PATH = "/api/v1/users/me/notify-setting/sound/content";

    /**
     * 读出的提示音字节。
     *
     * @param content     音频字节
     * @param contentType 响应 {@code Content-Type}（由落盘扩展名反查，见 {@link AudioTypes#byExtension}）
     * @param etag        内容标识（即存储 key）：同一 key 的内容永不变，可直接用作强 ETag
     */
    record StoredSound(byte[] content, String contentType, String etag) {
    }

    /**
     * 存提示音，返回新的存储 key。
     *
     * <p>实现须保证：① 内容不是支持的音频容器时抛 {@code IllegalArgumentException}
     * （调用方应在此之前用 {@link AudioTypes#detect} 预先校验并回 4031，这里是纵深防御）；
     * ② 落盘是「先写临时文件再原子改名」，避免半截文件被直出成杂音；
     * ③ 同样的字节两次调用返回<b>不同</b>的 key（不做内容寻址去重）——
     * 去重会让「换一个音再换回来」复用旧 key，版本号不变则浏览器不重新拉取。</p>
     *
     * @param content 音频字节（长度由调用方按 {@link #MAX_SOUND_BYTES} 预检）
     * @return 存储 key（不透明，落库进 {@code sys_user_notify_setting.custom_sound_key}）
     */
    String store(byte[] content);

    /**
     * 读提示音。
     *
     * @param key 存储 key（形态非法、文件不存在、或文件大小异常时返回 {@link Optional#empty()}）
     * @return 音频字节；无可直出内容时为空
     */
    Optional<StoredSound> load(String key);

    /**
     * 删提示音（幂等）。
     *
     * <p>调用时机是「更新设置的事务<b>提交后</b>」：提交前删会让回滚后的记录指向一个已消失的文件。
     * 与头像的清理时机同一取舍。</p>
     *
     * @param key 存储 key；为 {@code null} / 空 / 形态非法时不做任何事
     * @return 是否真的删掉了一个文件（用于日志，调用方无需据此决策）
     */
    boolean delete(String key);

    /**
     * 由「存储 key」拼出可直出的提示音地址。
     *
     * <p>与 {@link AvatarStoragePort#urlOf} 一样，把拼接放在端口上是为了让「库里存 key、
     * 对外表现为 URL」只有一处实现——设置回显与上传回执若各拼一次，
     * 路径或版本参数一改就会出现「一边能播一边 404」。</p>
     *
     * <p>{@code v} 参数只做缓存击穿，服务端不据此查文件（实际取哪个仍以库里的 key 为准），
     * 因此老页面继续用旧 {@code v} 只会拿到缓存里的旧音频，不会 404。</p>
     *
     * @param key 存储 key；为 {@code null} / 空时返回 {@code null}（表示「没有自定义提示音」）
     * @return 形如 {@code /api/v1/users/me/notify-setting/sound/content?v=ab12....mp3} 的相对地址
     */
    static String urlOf(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        return CONTENT_PATH + "?v=" + key;
    }
}
