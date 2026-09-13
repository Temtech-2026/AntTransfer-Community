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
import com.anttransfer.common.result.PageResult;
import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.config.FileSchedulingConfig;
import com.anttransfer.file.model.dto.CreatePackRequest;
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.file.model.entity.PackTask;
import com.anttransfer.file.model.vo.PackTaskVO;
import com.anttransfer.file.repository.PackTaskMapper;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.anttransfer.file.storage.FileStorage;
import com.anttransfer.file.util.AfterCommitUtils;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.RejectedExecutionException;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 批量打包下载服务（P1）：异步 zip 构建 + 产物下发 + 过期清理。
 *
 * <h3>为什么是「异步任务 + 产物」而不是「请求内边压边发」</h3>
 * <ul>
 *     <li><b>可续传</b>：产物是磁盘上的普通 zip，Range 直接作用其上；请求内直发则断线即前功尽弃；</li>
 *     <li><b>可在入口拒绝</b>：文件数 / 合计大小 / 每用户并发都能在任务创建时判掉，
 *         不会出现「压到一半才发现超限」；</li>
 *     <li><b>可过期回收</b>：产物有明确生命周期，不会成为永远查不出来的磁盘占用。</li>
 * </ul>
 *
 * <h3>执行线程与事务的边界</h3>
 * <p>打包是长耗时 IO，必须移出请求线程；而任务行要先提交、工作线程才看得见，所以提交动作挂在
 * {@link AfterCommitUtils#run} 上。线程池用有界队列 + 中止策略：拒绝时任务直接判失败，
 * 而不是静默排队——队列里排着一堆用户以为「正在打包」的任务，比明确失败更难排查。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PackService {

    private static final DateTimeFormatter TASK_NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");

    private static final String ZIP_SUFFIX = ".zip";

    /** zip 内单个条目名的长度上限：过长会让部分解压工具直接报错。 */
    private static final int MAX_ENTRY_NAME_LENGTH = 180;

    /** 文件名中不允许出现的字符（统一替换为下划线，避免各平台解压时炸开）。 */
    private static final String ILLEGAL_NAME_CHARS = "[\\\\/:*?\"<>|\\p{Cntrl}]";

    private final PackTaskMapper packTaskMapper;
    private final FileOwnershipGuard ownershipGuard;
    private final FileAuditLogger auditLogger;
    private final FileProperties properties;
    private final FileStorage fileStorage;
    private final FileDownloadService fileDownloadService;

    /** 打包专用线程池：按 Bean 名注入，避免与全局异步池抢线程（见 {@link FileSchedulingConfig}）。 */
    @Resource(name = FileSchedulingConfig.PACK_EXECUTOR)
    private ThreadPoolTaskExecutor packExecutor;

    /**
     * 创建打包任务（入口即做全部准入判定）。
     *
     * @param ownerUserId 发起用户 ID
     * @param request     创建请求
     * @return 任务视图（此刻为「排队中」）
     */
    @Transactional(rollbackFor = Exception.class)
    public PackTaskVO create(Long ownerUserId, CreatePackRequest request) {
        List<Long> nodeIds = request.getNodeIds() == null ? List.of() : request.getNodeIds().stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (nodeIds.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "打包文件列表不能为空");
        }
        if (nodeIds.size() > properties.getPackMaxFileCount()) {
            throw new BusinessException(ErrorCode.PACK_LIMIT_EXCEEDED,
                    "单次打包文件数不能超过 " + properties.getPackMaxFileCount());
        }
        // 整批归属校验：任一越权即整批拒绝，绝不产出「少了几个文件却不吭声」的 zip
        List<FileNode> nodes = ownershipGuard.requireOwnedNodes(nodeIds, ownerUserId);

        long totalBytes = 0L;
        for (FileNode node : nodes) {
            if (node.inRecycle()) {
                // 回收站文件的物理内容随时会被到期清理回收，打进包里等于承诺一份留不住的东西
                throw new BusinessException(ErrorCode.FILE_IN_RECYCLE);
            }
            totalBytes += node.getSizeBytes() == null ? 0L : node.getSizeBytes();
            if (totalBytes > properties.getPackMaxTotalBytes()) {
                throw new BusinessException(ErrorCode.PACK_LIMIT_EXCEEDED,
                        "单次打包合计大小不能超过 " + properties.getPackMaxTotalBytes() + " 字节");
            }
        }
        if (packTaskMapper.countActive(ownerUserId) >= properties.getPackMaxConcurrentPerUser()) {
            // 在入口以 4103 拒绝：此刻传输尚未开始，可以干净地告诉用户「稍后再来」；
            // 一旦开始下发就只能背压等待，那时再谈限流已经晚了
            throw new BusinessException(ErrorCode.TRANSFER_LIMIT_EXCEEDED,
                    "同时进行的打包任务数不能超过 " + properties.getPackMaxConcurrentPerUser());
        }

        PackTask task = new PackTask();
        task.setTaskNo("PK" + LocalDateTime.now().format(TASK_NO_FORMAT));
        task.setUserId(ownerUserId);
        task.setStatus(PackTask.STATUS_QUEUED);
        task.setFileCount(nodes.size());
        task.setTotalBytes(totalBytes);
        task.setNodeIds(joinNodeIds(nodeIds));
        task.setSpeedLimit(resolveSpeedLimit(request.getSpeedLimit()));
        task.setProductName(resolveProductName(request.getProductName(), task.getTaskNo()));
        task.setCreateBy(ownerUserId);
        task.setUpdateBy(ownerUserId);
        packTaskMapper.insert(task);

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("taskNo", task.getTaskNo());
        extra.put("fileCount", nodes.size());
        extra.put("totalBytes", totalBytes);
        auditLogger.success(OperationLog.ACTION_PACK_CREATE, OperationLog.TARGET_PACK_TASK, task.getId(), extra);

        Long taskId = task.getId();
        // 必须在事务提交后再提交线程任务：否则工作线程可能先于提交启动，selectById 查不到这一行
        AfterCommitUtils.run(() -> submit(taskId));
        return PackTaskVO.of(task);
    }

    /**
     * 我的打包任务分页（新→旧）。
     *
     * @param ownerUserId 归属用户 ID
     * @param current     页码（从 1 起）
     * @param pageSize    每页条数
     * @return 分页结果
     */
    @Transactional(readOnly = true)
    public PageResult<PackTaskVO> page(Long ownerUserId, long current, long pageSize) {
        IPage<PackTask> page = packTaskMapper.selectPage(new Page<>(current, pageSize),
                Wrappers.<PackTask>lambdaQuery()
                        .eq(PackTask::getUserId, ownerUserId)
                        .orderByDesc(PackTask::getId));
        List<PackTaskVO> records = page.getRecords().stream().map(PackTaskVO::of).toList();
        return PageResult.of(records, page.getTotal(), current, pageSize);
    }

    /**
     * 任务详情。
     *
     * @param ownerUserId 归属用户 ID
     * @param taskId      任务 ID
     * @return 任务视图
     */
    @Transactional(readOnly = true)
    public PackTaskVO detail(Long ownerUserId, Long taskId) {
        return PackTaskVO.of(requireOwnedTask(ownerUserId, taskId));
    }

    /**
     * 下发打包产物（支持 Range 续传）。
     *
     * @param ownerUserId 归属用户 ID
     * @param taskId      任务 ID
     * @param rangeHeader {@code Range} 请求头（可空）
     * @param response    HTTP 响应
     */
    public void downloadProduct(Long ownerUserId, Long taskId, String rangeHeader, HttpServletResponse response) {
        PackTask task = requireOwnedTask(ownerUserId, taskId);
        if (!Objects.equals(task.getStatus(), PackTask.STATUS_DONE) || !StringUtils.hasText(task.getProductPath())) {
            // 「还没打包完」与「产物已过期」对用户都是「现在拿不到」，统一 4026 更利于前端引导重试
            throw new BusinessException(ErrorCode.PACK_PRODUCT_EXPIRED);
        }
        FileDownloadService.StreamOutcome outcome = fileDownloadService.streamProduct(
                task.getProductPath(), task.getProductName(), task.getSpeedLimit(), rangeHeader, response);

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("taskNo", task.getTaskNo());
        extra.put("sent", outcome.sent());
        extra.put("productSize", task.getProductSize());
        if (outcome.ok()) {
            auditLogger.success(OperationLog.ACTION_PACK_DOWNLOAD, OperationLog.TARGET_PACK_TASK, taskId, extra);
        } else {
            auditLogger.fail(OperationLog.ACTION_PACK_DOWNLOAD, OperationLog.TARGET_PACK_TASK, taskId,
                    outcome.failureReason());
        }
    }

    /**
     * 清理到期产物：置任务为「已过期」后删除磁盘上的 zip。
     *
     * <p>先 CAS 改状态、后删文件：两个并发的清理轮次只有一个能把状态从「已完成」推进到「已过期」，
     * 另一个拿到 0 行便会跳过删除，不会对同一份文件重复操作。</p>
     *
     * @return 实际清理的任务数
     */
    @Transactional(rollbackFor = Exception.class)
    public int cleanupExpiredProducts() {
        List<PackTask> expired = packTaskMapper.findExpiredProducts(properties.getPackCleanupBatchSize());
        int cleaned = 0;
        for (PackTask task : expired) {
            if (packTaskMapper.markExpired(task.getId()) == 0) {
                continue;
            }
            if (StringUtils.hasText(task.getProductPath())) {
                fileStorage.delete(task.getProductPath());
            }
            cleaned++;
        }
        return cleaned;
    }

    /**
     * 把长时间卡在「排队中 / 打包中」的僵尸任务判为失败。
     *
     * <p>打包依赖进程内线程池。线程池拒绝、进程在任务执行前重启，都会让任务行永远停在 {@code status=0}：
     * 它不会过期（过期清理只扫已完成态），却一直占着「每用户并发名额」，最终把该用户彻底堵死。
     * 这里以 {@code update_time} 为判据兜底收口——宁可把一个可能还在跑的任务判失败（用户可以重试），
     * 也不能让名额泄漏成永久性故障。</p>
     *
     * @return 判定失败的任务数
     */
    @Transactional(rollbackFor = Exception.class)
    public int failStaleTasks() {
        LocalDateTime cutoff = LocalDateTime.now().minus(properties.getPackStaleTimeout());
        List<PackTask> stale = packTaskMapper.findStaleActive(cutoff, properties.getPackCleanupBatchSize());
        int failed = 0;
        for (PackTask task : stale) {
            if (packTaskMapper.markFailed(task.getId(), "打包任务超时未完成，请重试") == 0) {
                continue;
            }
            failed++;
            log.warn("打包僵尸任务判失败：taskId={}, taskNo={}, status={}", task.getId(), task.getTaskNo(), task.getStatus());
        }
        return failed;
    }

    /* ============================ 内部实现 ============================ */

    /**
     * 提交到打包线程池；被拒绝时把任务直接判失败。
     *
     * <p>此刻事务已提交，回滚已不可能，因此必须显式落一个终态，否则任务行会一直停在排队态。</p>
     */
    private void submit(Long taskId) {
        try {
            packExecutor.execute(() -> runQuietly(taskId));
        } catch (RejectedExecutionException e) {
            log.warn("打包线程池已满，任务直接判失败：taskId={}", taskId, e);
            packTaskMapper.markFailed(taskId, "打包线程繁忙，请稍后重试");
        }
    }

    private void runQuietly(Long taskId) {
        try {
            run(taskId);
        } catch (Exception e) {
            // 线程池里的异常若逃逸出去会被静默吞掉，这里兜底记录，保证「任务失败一定有痕迹」
            log.error("打包任务执行异常：taskId={}", taskId, e);
        }
    }

    private void run(Long taskId) {
        if (packTaskMapper.casStatus(taskId, PackTask.STATUS_QUEUED, PackTask.STATUS_RUNNING) == 0) {
            // 已被清理 / 被判失败 / 已在别处执行：本次直接退出，绝不重复产出
            log.info("打包任务不在排队态，跳过执行：taskId={}", taskId);
            return;
        }
        PackTask task = packTaskMapper.selectById(taskId);
        if (task == null) {
            return;
        }

        Path tempPath = null;
        String relativePath = null;
        try {
            List<FileNode> nodes = loadTaskNodes(task);
            tempPath = fileStorage.createTemp(task.getProductName());
            long productSize = writeZip(tempPath, nodes);
            relativePath = fileStorage.toRelative(tempPath);

            LocalDateTime expireTime = LocalDateTime.now().plus(properties.getPackProductTtl());
            if (packTaskMapper.markDone(taskId, task.getProductName(), relativePath, productSize, expireTime) == 0) {
                // 打包期间任务被清理：产物不能留在磁盘上（它已无任何引用方）
                fileStorage.delete(relativePath);
                log.warn("打包完成但任务状态已改变，产物已丢弃：taskId={}", taskId);
                return;
            }
            log.info("打包任务完成：taskId={}, fileCount={}, productSize={}", taskId, nodes.size(), productSize);
        } catch (BusinessException e) {
            cleanTempFile(tempPath, relativePath);
            packTaskMapper.markFailed(taskId, e.getMessage());
            log.warn("打包任务失败：taskId={}, reason={}", taskId, e.getMessage());
        } catch (IOException | RuntimeException e) {
            cleanTempFile(tempPath, relativePath);
            packTaskMapper.markFailed(taskId, "打包失败：" + e.getClass().getSimpleName());
            log.error("打包任务异常：taskId={}", taskId, e);
        }
    }

    /**
     * 按任务落库的清单加载条目。
     *
     * <p>执行时刻与创建时刻之间，文件可能被移入回收站、彻底销毁或换版本；这里逐条复核，
     * 顺序保持与创建时一致（{@code requireOwnedNodes} 保证按入参顺序返回），
     * 使 zip 内条目顺序稳定可预期。</p>
     */
    private List<FileNode> loadTaskNodes(PackTask task) {
        List<Long> nodeIds = parseNodeIds(task.getNodeIds());
        if (nodeIds.isEmpty()) {
            throw new BusinessException(ErrorCode.PACK_TASK_NOT_FOUND, "打包任务缺少文件清单");
        }
        List<FileNode> nodes = ownershipGuard.requireOwnedNodes(nodeIds, task.getUserId());
        if (nodes.size() != nodeIds.size()) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND, "打包文件已不存在");
        }
        return nodes;
    }

    /**
     * 把条目内容写成一个 zip 文件。
     *
     * <p>逐条流式写入，<b>不在内存中拼完整份 zip</b>：打包上限是 20 GiB，
     * 任何形式的整体缓冲都会直接把堆打爆。</p>
     *
     * @return 产物字节数
     */
    private long writeZip(Path target, List<FileNode> nodes) throws IOException {
        Set<String> usedNames = new HashSet<>();
        try (ZipOutputStream zip = new ZipOutputStream(new BufferedOutputStream(Files.newOutputStream(target)))) {
            zip.setLevel(Deflater.DEFAULT_COMPRESSION);
            for (FileNode node : nodes) {
                if (!StringUtils.hasText(node.getSha256())) {
                    throw new BusinessException(ErrorCode.FILE_NOT_FOUND, "文件内容缺失：" + node.getName());
                }
                org.springframework.core.io.Resource content = fileStorage.contentResource(node.getSha256());
                if (!content.exists()) {
                    throw new BusinessException(ErrorCode.FILE_NOT_FOUND, "文件内容缺失：" + node.getName());
                }
                zip.putNextEntry(new ZipEntry(uniqueEntryName(node.getName(), usedNames)));
                try (InputStream in = content.getInputStream()) {
                    in.transferTo(zip);
                }
                zip.closeEntry();
            }
        }
        return Files.size(target);
    }

    private void cleanTempFile(Path tempPath, String relativePath) {
        if (StringUtils.hasText(relativePath)) {
            fileStorage.delete(relativePath);
            return;
        }
        if (tempPath != null) {
            fileStorage.delete(fileStorage.toRelative(tempPath));
        }
    }

    private PackTask requireOwnedTask(Long ownerUserId, Long taskId) {
        if (taskId == null) {
            throw new BusinessException(ErrorCode.PACK_TASK_NOT_FOUND);
        }
        PackTask task = packTaskMapper.selectById(taskId);
        if (task == null || !Objects.equals(task.getUserId(), ownerUserId)) {
            // 与文件条目同口径：别人的任务按「不存在」处理，不泄露 ID 空间
            throw new BusinessException(ErrorCode.PACK_TASK_NOT_FOUND);
        }
        return task;
    }

    private Long resolveSpeedLimit(Long requested) {
        if (requested != null && requested > 0) {
            return requested;
        }
        long fallback = properties.getDefaultSpeedLimit();
        return fallback > 0 ? fallback : null;
    }

    private static String resolveProductName(String raw, String taskNo) {
        String name = StringUtils.hasText(raw) ? raw.trim() : "pack-" + taskNo;
        if (name.toLowerCase(Locale.ROOT).endsWith(ZIP_SUFFIX)) {
            name = name.substring(0, name.length() - ZIP_SUFFIX.length());
        }
        name = name.replaceAll(ILLEGAL_NAME_CHARS, "_");
        if (name.isBlank()) {
            name = "pack-" + taskNo;
        }
        return name + ZIP_SUFFIX;
    }

    /**
     * 生成 zip 内唯一的条目名。
     *
     * <p>三件事缺一不可：① 剥离路径分隔符，防 zip-slip（条目名带 {@code ../} 可在解压时越界写文件）；
     * ② 截断超长名，避免部分解压工具直接拒绝该 zip；③ 同名去重——用户完全可能选了
     * {@code a/报告.pdf} 与 {@code b/报告.pdf}，直接写入会产生重复条目，多数解压器只保留最后一个，
     * 用户会以为「文件丢了」。</p>
     */
    private static String uniqueEntryName(String rawName, Set<String> usedNames) {
        String base = sanitizeEntryName(rawName);
        String candidate = base;
        int index = 1;
        while (!usedNames.add(candidate)) {
            int dot = base.lastIndexOf('.');
            String prefix = dot > 0 ? base.substring(0, dot) : base;
            String suffix = dot > 0 ? base.substring(dot) : "";
            candidate = prefix + "(" + index + ")" + suffix;
            index++;
        }
        return candidate;
    }

    private static String sanitizeEntryName(String rawName) {
        String name = rawName == null ? "" : rawName.trim().replace('\\', '/');
        int slash = name.lastIndexOf('/');
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        name = name.replaceAll(ILLEGAL_NAME_CHARS, "_");
        if (name.isBlank() || ".".equals(name) || "..".equals(name)) {
            return "file";
        }
        if (name.length() <= MAX_ENTRY_NAME_LENGTH) {
            return name;
        }
        int dot = name.lastIndexOf('.');
        String suffix = dot > 0 && name.length() - dot <= 10 ? name.substring(dot) : "";
        return name.substring(0, MAX_ENTRY_NAME_LENGTH - suffix.length()) + suffix;
    }

    private static String joinNodeIds(List<Long> nodeIds) {
        List<String> parts = new ArrayList<>(nodeIds.size());
        for (Long id : nodeIds) {
            parts.add(String.valueOf(id));
        }
        return String.join(",", parts);
    }

    private static List<Long> parseNodeIds(String raw) {
        if (!StringUtils.hasText(raw)) {
            return List.of();
        }
        List<Long> ids = new ArrayList<>();
        for (String part : raw.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            try {
                ids.add(Long.parseLong(trimmed));
            } catch (NumberFormatException e) {
                throw new BusinessException(ErrorCode.PACK_TASK_NOT_FOUND, "打包任务清单已损坏");
            }
        }
        return ids;
    }
}
