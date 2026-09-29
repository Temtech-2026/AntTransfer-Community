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
package com.anttransfer.file.config;

import com.anttransfer.common.constant.RedisKeyConstants;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

/**
 * 文件管理配置：{@code anttransfer.file.*}（不含 {@code .share} 子树，那部分归 {@link ShareProperties}）。
 *
 * <p>取向与 {@code ShareProperties} 一致：策略可配、不写死。覆盖 PRD US-09（回收站）/
 * US-10（标签搜索）/ US-12（打包与限速）/ US-13（历史版本）中的全部可调参数。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "anttransfer.file")
public class FileProperties {

    /* ============================ 存储与上传 ============================ */

    /**
     * 本地存储根目录。
     *
     * <p>落盘布局 {@code {root}/{sha256[0:2]}/{sha256[2:4]}/{sha256}}——按内容寻址，
     * 同一内容重复落盘天然写到同一路径，物理去重无需额外协调。</p>
     */
    private String storageRoot = "./data/files";

    /** 单文件大小上限：默认 10 GiB（超出以 4006 拒绝） */
    private long maxFileSize = 10L * 1024 * 1024 * 1024;

    /** 分片大小：默认 8 MiB（与 sys_upload_task.chunk_size 默认一致） */
    private int chunkSize = 8 * 1024 * 1024;

    /** 目录最大嵌套深度（超出以 2005 拒绝，防物化路径过长与整树搬迁代价失控） */
    private int maxFolderDepth = 20;

    /** 临时 / 打包产物子目录名（位于 storageRoot 下，与内容寻址区隔离便于单独清理） */
    private String tempDirName = "_tmp";

    /**
     * 用户头像子目录名（位于 storageRoot 下）。
     *
     * <p>与内容寻址区（{@code {root}/{sha256[0:2]}/{sha256[2:4]}/{sha256}}）隔离：
     * 头像<b>刻意不做内容寻址</b>——同一张图被两个人用、或同一人换回旧图，
     * 都必须产生新的文件名，否则「key 变了 = 头像变了」这个缓存失效依据就不成立
     * （详见 {@code AvatarStoragePort}）。</p>
     */
    private String avatarDirName = "_avatars";

    /**
     * 用户自定义消息提示音子目录名（位于 storageRoot 下）。
     *
     * <p>与头像目录<b>刻意分开</b>：两者上限不同（头像 2 MiB / 提示音 1 MiB）、
     * 生命周期不同（提示音会随「切回内置音色」被清掉），落在一起会让清理逻辑互相误扫。
     * 同样不做内容寻址——「换一个音再换回来」必须换新 key，否则 {@code ?v=} 版本号不变，
     * 浏览器一直播旧音频（详见 {@code NotificationSoundStoragePort}）。</p>
     */
    private String notifySoundDirName = "_notify_sounds";

    /* ============================== 回收站 ============================== */

    /** 回收站保留期：默认 30 天（PRD US-09 权威口径，到期物理清理） */
    private int recycleRetentionDays = 30;

    /** 到期清理 cron：默认每日 03:30（与产物清理错峰，避免同刻 IO 叠加） */
    private String recycleCleanupCron = "0 30 3 * * ?";

    /** 单轮清理最大条数：分批物理删除，避免长事务与磁盘 IO 尖峰 */
    private int recycleCleanupBatchSize = 500;

    /* ============================= 历史版本 ============================= */

    /** 历史版本总开关（P1）：关闭后不记录新版本、版本列表返回空，已有版本数据不受影响 */
    private boolean versionEnabled = true;

    /** 保留最近版本数：默认 10（PRD US-13「近 N 版」），超出部分逻辑删除（保留审计痕迹） */
    private int versionKeepCount = 10;

    /* ========================== 下载票据与限速 ========================== */

    /** 下载票据 TTL：默认 5min（仅需覆盖「换票 → 取件」间隔，越短越安全） */
    private Duration downloadTicketTtl = Duration.ofSeconds(RedisKeyConstants.FILE_TICKET_TTL_SECONDS);

    /** 单任务默认速率上限（字节/秒，0=不限）；创建打包任务未显式指定时使用（PRD US-12） */
    private long defaultSpeedLimit = 0L;

    /**
     * 全局速率上限（字节/秒，0=不限）：所有下载流共享的兜底带宽。
     *
     * <p>与任务级限速的关系：任务级是「这一条流最多多快」，全局是「所有流加起来最多多快」。
     * 两者同时生效时取更严者；超限表现为<b>等待（背压）</b>而非报错——流已经开始就不能再回 429，
     * 否则用户拿到的是半个文件。真正以 4103 拒绝的场景在打包任务<b>创建入口</b>（未开始传输）。</p>
     */
    private long globalSpeedLimit = 0L;

    /* =========================== 缩略图与预览 =========================== */

    /** 缩略图最长边像素：默认 256（等比缩放，不放大——小图放大会糊且浪费带宽） */
    private int thumbnailMaxEdge = 256;

    /**
     * 缩略图源图最大像素数（宽 × 高）：默认 4000 万，超出以 4007 拒绝。
     *
     * <p>防的是「解压炸弹」：一个几 MB 的 PNG 可以解出几万 × 几万的位图，
     * 解码即耗尽堆内存。故缩略图链路先读图片头拿尺寸做准入，再决定是否真正解码。</p>
     */
    private long thumbnailMaxSourcePixels = 40_000_000L;

    /** 支持缩略图的扩展名（仅光栅图；SVG 不在此列——它可内嵌脚本，当图片渲染有 XSS 风险） */
    private List<String> thumbnailExtensions = List.of("jpg", "jpeg", "png", "gif", "bmp", "webp");

    /** 文本预览一次性返回的字节上限：默认 2 MiB（超出截断并置 truncated=true） */
    private long previewTextMaxBytes = 2L * 1024 * 1024;

    /** 支持纯文本预览的扩展名 */
    private List<String> previewTextExtensions = List.of(
            "txt", "md", "log", "csv", "json", "xml", "yml", "yaml", "ini", "conf", "properties", "sql");

    /** 支持服务端内联预览的扩展名（浏览器原生渲染；Office 系列一律走下载，见 previewStrategy） */
    private List<String> previewPdfExtensions = List.of("pdf");

    /**
     * 仅允许下载、不做服务端预览的扩展名（Office 三件套 + WPS 系）。
     *
     * <p>原因：服务端转码 Office 需引入重依赖（LibreOffice / POI 全量），CE 不做；
     * 返回 4021 之外的明确分支由前端引导下载，避免「点了预览转半天没反应」。</p>
     */
    private List<String> downloadOnlyExtensions = List.of(
            "doc", "docx", "xls", "xlsx", "ppt", "pptx", "wps", "et", "dps", "vsd", "vsdx");

    /* ============================== 打包下载 ============================== */

    /** 单次打包文件数上限：默认 200（PRD US-12，超出以 4019 在创建入口拒绝） */
    private int packMaxFileCount = 200;

    /** 单次打包合计大小上限：默认 20 GiB（PRD US-12，超出以 4019 在创建入口拒绝） */
    private long packMaxTotalBytes = 20L * 1024 * 1024 * 1024;

    /** 产物保留时长：默认 24h（到期定时清理并置 4-已过期） */
    private Duration packProductTtl = Duration.ofHours(24);

    /** 每用户同时进行的打包任务上限：默认 2（超出以 4103 拒绝，防单用户占满打包线程） */
    private int packMaxConcurrentPerUser = 2;

    /** 产物清理 cron：默认每小时第 10 分（比回收站清理更频繁——产物生命周期短、磁盘占用急） */
    private String packCleanupCron = "0 10 * * * ?";

    /** 单轮产物 / 僵尸任务清理的最大条数：默认 200（分批，避免一次捞出天量任务） */
    private int packCleanupBatchSize = 200;

    /**
     * 僵尸任务判定阈值：默认 1h。
     *
     * <p>打包依赖进程内线程池，线程池拒绝或进程重启都可能让任务永远停在「排队中」。
     * 超过该时长仍未结束的任务按失败收口，把「每用户并发名额」还回去——
     * 宁可让用户重试一次，也不能让名额泄漏成永久性故障。</p>
     */
    private Duration packStaleTimeout = Duration.ofHours(1);

    /* =============================== 标签 =============================== */

    /** 单文件最多可打标签数（超出以 2005 拒绝） */
    private int tagMaxPerFile = 20;

    /** 标签名最大长度（超出以 2005 拒绝） */
    private int tagMaxLength = 32;
}
