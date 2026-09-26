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

import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.PageResult;
import com.anttransfer.file.config.ChatAttachmentProperties;
import com.anttransfer.file.model.dto.CreateChatAttachmentRequest;
import com.anttransfer.file.model.entity.ChatAttachment;
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.file.model.entity.FileObject;
import com.anttransfer.file.model.vo.ChatAttachmentTicketVO;
import com.anttransfer.file.model.vo.ChatAttachmentVO;
import com.anttransfer.file.model.vo.UploadResultVO;
import com.anttransfer.file.repository.ChatAttachmentMapper;
import com.anttransfer.file.repository.FileObjectMapper;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 会话附件授权服务：发送方设定用途限制，接收方免申请取件。
 *
 * <h3>本类是什么、不是什么</h3>
 * <p><b>是</b>「一条授权」的完整生命周期：创建（服务端快照 + 归属校验）、撤销、查询、
 * 换票（判定 + 扣次 + 审计）、凭票复核取流、转存。</p>
 * <p><b>不是</b>会话消息服务——本类不认识「会话」「消息」「群」。会话侧把「这条消息要发给谁」
 * 翻译成一个 {@code receiverUserId} 交过来，这是模块边界的正确切法：at-file 无需反向依赖
 * at-collaboration，也就不需要引入新的跨模块 SPI 契约。</p>
 *
 * <h3>三轴用途限制的判定顺序（不可调换）</h3>
 * <ol>
 *     <li><b>归属</b>：取件人必须恰好是该行的接收方，否则一律按「不存在」处理（4024），
 *         不给「这条授权存在但不属于你」这种可探测信号。发送方本人走文件域取件，不从这里取。</li>
 *     <li><b>撤销</b>（4026）：发送方的绝对否决，优先级高于有效期与次数——「已撤销」必须被
 *         准确告知，否则接收方会以为是网络问题反复重试。</li>
 *     <li><b>有效期</b>（4025）：到点即失效，命中时顺手把状态收敛为终态。</li>
 *     <li><b>用途档位</b>（4027）：「仅预览」档位拒绝一切下载语义的请求。</li>
 *     <li><b>次数</b>（4025）：仅下载语义消耗额度，由 DB 原子 UPDATE 裁决（防超卖）。</li>
 * </ol>
 * <p>顺序依据是「越不可恢复的原因越先判」：撤销与过期是永久性的，档位与次数是当下的。
 * 若先判次数，一条已被撤销的授权会先被告知「次数用尽」，把发送方的否决伪装成用户自己的问题。</p>
 *
 * @author AntTransfer CE
 * @see ChatAttachmentMapper#consumeDownloadQuota(Long, LocalDateTime)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatAttachmentService {

    /** 幂等键长度上界（与 {@code sys_chat_attachment.client_msg_key} 列宽一致）。 */
    private static final int MAX_CLIENT_MSG_KEY_LENGTH = 64;

    private static final long DEFAULT_PAGE_SIZE = 20L;

    /** 列表页长上界（与 MyBatis-Plus 分页插件的收敛值一致）。 */
    private static final long MAX_PAGE_SIZE = 100L;

    /** {@code disposition=inline}：仅下载语义下才允许用户显式要求内联。 */
    private static final String DISPOSITION_INLINE = "inline";

    private final ChatAttachmentMapper chatAttachmentMapper;
    private final FileObjectMapper fileObjectMapper;
    private final FileNodeService fileNodeService;
    private final FileOwnershipGuard ownershipGuard;
    private final ChatAttachmentTicketService ticketService;
    private final FileTypePolicy typePolicy;
    private final ChatAttachmentProperties properties;
    private final FileAuditLogger auditLogger;

    /* ============================== 发送方：创建 / 撤销 / 查询 ============================== */

    /**
     * 创建会话附件授权（发送方在发出消息<b>之前</b>调用）。
     *
     * <p><b>为什么先建授权再发消息：</b>授权行需要两个前端无法提供的事实——「发送方确实持有
     * 该条目」（由 {@link FileOwnershipGuard} 校验）与「文件名 / 大小的服务端快照」。
     * 若把创建塞进发消息链路，就只能跨模块读文件域（违反模块铁律）或信任前端上报（归属校验形同虚设）。
     * 两步式让消息侧只转发一个已落地的授权 ID（正文尾注 {@code #att:{id}}）。</p>
     *
     * <p><b>幂等：</b>{@code clientMsgKey} 命中既有行时直接返回既有授权（连点 / 网络重试不重复建）；
     * 并发下由唯一键 {@code uk_sender_client_msg} 兜底，撞键后回读既有行。</p>
     *
     * @param senderUserId 发送方（接口层登录主体）
     * @param request      创建参数（条目 + 接收方 + 三轴用途限制）
     * @return 授权视图
     * @throws BusinessException 条目不存在 / 不属于发送方（4005）、参数越界（2002）
     */
    @Transactional(rollbackFor = Exception.class)
    public ChatAttachmentVO create(Long senderUserId, CreateChatAttachmentRequest request) {
        requireEnabled();

        String clientMsgKey = normalizeClientMsgKey(request.getClientMsgKey());
        ChatAttachment existing = findBySenderAndClientMsgKey(senderUserId, clientMsgKey);
        if (existing != null) {
            return toVO(existing);
        }

        Long receiverUserId = request.getReceiverUserId();
        if (Objects.equals(receiverUserId, senderUserId)) {
            // 自己发给自己会让「接收方」语义退化成「发送方」，而发送方本来就能直接取自己的文件
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "不能把附件作为会话附件发送给自己");
        }

        FileNode node = ownershipGuard.requireOwnedNode(request.getNodeId(), senderUserId);
        if (node.inRecycle()) {
            // 归属仍在，但「发送」语义要求一个当前可见的文件；否则接收方会取到发送方自己都看不见的东西
            throw new BusinessException(ErrorCode.FILE_IN_RECYCLE, "回收站中的文件不能作为会话附件发送");
        }
        // 物理文件必须当下可用：否则授权建了也取不到件，会把「发送成功」变成一个空承诺
        FileObject file = fileObjectMapper.selectById(node.getFileId());
        if (file == null || !Objects.equals(0, file.getStatus())) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }

        int usageMode = resolveUsageMode(request.getUsageMode());
        int downloadLimit = resolveDownloadLimit(request.getDownloadLimit());
        LocalDateTime expireAt = resolveExpireAt(request.getExpireHours(), Boolean.TRUE.equals(request.getNeverExpire()));

        ChatAttachment attachment = new ChatAttachment();
        attachment.setNodeId(node.getId());
        attachment.setFileId(file.getId());
        attachment.setSenderUserId(senderUserId);
        attachment.setReceiverUserId(receiverUserId);
        // 快照而非外键：源条目后续改名 / 删除都不影响已发出的卡片显示
        attachment.setFileName(node.getName());
        attachment.setSizeBytes(node.getSizeBytes());
        attachment.setUsageMode(usageMode);
        attachment.setExpireAt(expireAt);
        attachment.setDownloadLimit(downloadLimit);
        attachment.setDownloadCount(0);
        attachment.setStatus(ChatAttachment.STATUS_ACTIVE);
        attachment.setClientMsgKey(clientMsgKey);
        attachment.setCreateBy(senderUserId);
        attachment.setUpdateBy(senderUserId);
        try {
            chatAttachmentMapper.insert(attachment);
        } catch (DuplicateKeyException e) {
            // 并发重发：唯一键挡住第二次插入。回读既有行返回，保持幂等语义（而不是把 500 抛给用户）
            ChatAttachment raced = findBySenderAndClientMsgKey(senderUserId, clientMsgKey);
            if (raced != null) {
                return toVO(raced);
            }
            throw e;
        }

        Map<String, Object> extra = senderDetail(attachment);
        extra.put("downloadLimit", downloadLimit);
        extra.put("expireAt", expireAt == null ? "never" : expireAt.toString());
        auditLogger.success(OperationLog.ACTION_CHAT_ATTACH_CREATE,
                OperationLog.TARGET_CHAT_ATTACHMENT, attachment.getId(), extra);

        return toVO(attachment);
    }

    /**
     * 撤销授权（发送方的绝对否决）。
     *
     * <p><b>幂等：</b>已处于终态（已撤销 / 已失效）时直接返回成功，不产生第二条审计记录。
     * 重复撤销把它当成「已经是你想要的样子」，比回一句「已撤销，无法再次撤销」更贴合用户意图。</p>
     *
     * @param senderUserId 发送方（接口层登录主体）
     * @param attachmentId 授权 ID
     * @throws BusinessException 授权不存在或不属于该发送方（4024）
     */
    @Transactional(rollbackFor = Exception.class)
    public void revoke(Long senderUserId, Long attachmentId) {
        requireEnabled();

        ChatAttachment attachment = chatAttachmentMapper.selectById(attachmentId);
        // 非本人 / 不存在一律 4024：不给「这条授权存在但不属于你」这种可探测信号
        if (attachment == null || !Objects.equals(attachment.getSenderUserId(), senderUserId)) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_NOT_FOUND);
        }
        if (!attachment.active()) {
            return;
        }
        int rows = chatAttachmentMapper.revoke(attachmentId, senderUserId, LocalDateTime.now());
        if (rows != 1) {
            // CAS 失败：并发下接收方刚把额度用尽并收敛为失效，或另一次撤销已在途。二者都已达成目的
            return;
        }
        auditLogger.success(OperationLog.ACTION_CHAT_ATTACH_REVOKE,
                OperationLog.TARGET_CHAT_ATTACHMENT, attachmentId, senderDetail(attachment));
    }

    /**
     * 查询单条授权详情（发送方与接收方均可，其他人一律 4024）。
     *
     * @param viewerUserId 查看者
     * @param attachmentId 授权 ID
     * @return 授权视图
     */
    @Transactional(readOnly = true)
    public ChatAttachmentVO detail(Long viewerUserId, Long attachmentId) {
        ChatAttachment attachment = chatAttachmentMapper.selectById(attachmentId);
        if (attachment == null || !visibleTo(attachment, viewerUserId)) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_NOT_FOUND);
        }
        return toVO(attachment);
    }

    /**
     * 「我发出的」分页（按创建时间倒序）。
     *
     * <p>刻意<b>不过滤终态</b>：发送方需要看到「哪一条已被撤销 / 已失效」，
     * 这既是他的操作结果，也是「接收方为什么取不到件」的唯一解释来源。</p>
     *
     * @param senderUserId 发送方
     * @param current      页码（从 1 起）
     * @param pageSize     每页条数（上界 100）
     * @return 分页结果
     */
    @Transactional(readOnly = true)
    public PageResult<ChatAttachmentVO> pageMine(Long senderUserId, long current, long pageSize) {
        Page<ChatAttachment> page = new Page<>(normalizeCurrent(current), normalizePageSize(pageSize));
        chatAttachmentMapper.selectPage(page, Wrappers.<ChatAttachment>lambdaQuery()
                .eq(ChatAttachment::getSenderUserId, senderUserId)
                .orderByDesc(ChatAttachment::getCreateTime));
        return PageResult.of(toVOList(page), page.getTotal(), page.getCurrent(), page.getSize());
    }

    /**
     * 「我收到的」分页（按创建时间倒序）。
     *
     * @param receiverUserId 接收方
     * @param current        页码（从 1 起）
     * @param pageSize       每页条数（上界 100）
     * @return 分页结果
     */
    @Transactional(readOnly = true)
    public PageResult<ChatAttachmentVO> pageReceived(Long receiverUserId, long current, long pageSize) {
        Page<ChatAttachment> page = new Page<>(normalizeCurrent(current), normalizePageSize(pageSize));
        chatAttachmentMapper.selectPage(page, Wrappers.<ChatAttachment>lambdaQuery()
                .eq(ChatAttachment::getReceiverUserId, receiverUserId)
                .orderByDesc(ChatAttachment::getCreateTime));
        return PageResult.of(toVOList(page), page.getTotal(), page.getCurrent(), page.getSize());
    }

    /* ============================== 接收方：换票 / 取流复核 / 转存 ============================== */

    /**
     * 换取件票据（登录态；两步式取件的第一步）。
     *
     * <p>本端点是<b>全部判定的唯一裁决点</b>：用途档位、有效期、次数（原子扣减）、审计都在此完成，
     * 后续匿名取件端点只验票并复核当前状态。这样匿名端点即使「无脑转发」也不会漏判。</p>
     *
     * <p><b>下载次数在换票时扣减，而不是在取流时：</b>取流端点会被 {@code Range} 分段、刷新、重试
     * 重复命中（浏览器与下载工具的正常行为）。若在取流时扣次，一次下载会被扣成 N 次；
     * 若在取流时「只按第一次扣」，就要在无登录态的情况下做去重，成本远高于把口径前移一次。</p>
     *
     * <p><b>不加 {@code @Transactional}：</b>本方法只有单条 UPDATE 的写入（额度扣减 / 状态收敛），
     * 单语句天然原子，不需要事务包裹。反过来，若包了事务，「命中过期 → 收敛状态 → 抛业务异常」
     * 会因异常回滚把收敛一并撤销，让状态列永远停在「生效中」。</p>
     *
     * @param consumerUserId 取件人（必须是该附件的接收方）
     * @param attachmentId   授权 ID
     * @param accessType     {@code preview}（缺省）/ {@code download}
     * @return 票据视图（含免登录取件地址）
     * @throws BusinessException 不存在（4024）/ 已撤销（4026）/ 已过期或用尽（4025）/ 档位禁止（4027）
     */
    public ChatAttachmentTicketVO issueTicket(Long consumerUserId, Long attachmentId, String accessType) {
        requireEnabled();

        String type = normalizeAccessType(accessType);
        LocalDateTime now = LocalDateTime.now();

        ChatAttachment attachment = chatAttachmentMapper.selectById(attachmentId);
        if (attachment == null || !Objects.equals(attachment.getReceiverUserId(), consumerUserId)) {
            auditReject(attachmentId, "NOT_FOUND", attachment);
            throw new BusinessException(ErrorCode.CHAT_ATTACH_NOT_FOUND);
        }
        if (attachment.getStatus() != null && attachment.getStatus() == ChatAttachment.STATUS_REVOKED) {
            auditReject(attachmentId, "REVOKED", attachment);
            throw new BusinessException(ErrorCode.CHAT_ATTACH_REVOKED);
        }
        if (attachment.expiredAt(now)) {
            chatAttachmentMapper.markExpired(attachmentId, now);
            auditReject(attachmentId, "EXPIRED", attachment);
            throw new BusinessException(ErrorCode.CHAT_ATTACH_EXPIRED_OR_LIMIT);
        }
        if (!attachment.active()) {
            auditReject(attachmentId, "INVALIDATED", attachment);
            throw new BusinessException(ErrorCode.CHAT_ATTACH_EXPIRED_OR_LIMIT);
        }

        boolean downloading = ChatAttachmentTicketService.ACCESS_DOWNLOAD.equals(type);
        if (downloading && !attachment.downloadable()) {
            // 档位=仅预览：发送方明确不允许「拿走」，只允许「看一眼」
            auditReject(attachmentId, "USAGE_PREVIEW_ONLY", attachment);
            throw new BusinessException(ErrorCode.CHAT_ATTACH_USAGE_FORBIDDEN);
        }
        if (downloading && !attachment.unlimitedDownloads()) {
            int rows = chatAttachmentMapper.consumeDownloadQuota(attachmentId, now);
            if (rows != 1) {
                // 原子扣减失败：回源定性，给出准确的拒绝原因（而不是笼统的「次数用尽」）
                String reason = rejectReason(chatAttachmentMapper.selectById(attachmentId), now);
                auditReject(attachmentId, reason, attachment);
                throw new BusinessException(rejectCode(reason));
            }
        }

        FileObject file = fileObjectMapper.selectById(attachment.getFileId());
        if (file == null || !Objects.equals(0, file.getStatus())) {
            // 授权行还在，但物理文件已下线 / 销毁：接收方拿不到任何东西，按「附件已失效」告知
            auditReject(attachmentId, "SOURCE_MISSING", attachment);
            throw new BusinessException(ErrorCode.CHAT_ATTACH_NOT_FOUND);
        }

        String ticket = ticketService.mint(attachmentId, consumerUserId, file.getId(),
                attachment.getUsageMode(), type);

        Map<String, Object> extra = receiverDetail(attachment);
        extra.put("accessType", type);
        auditLogger.success(downloading
                        ? OperationLog.ACTION_CHAT_ATTACH_DOWNLOAD
                        : OperationLog.ACTION_CHAT_ATTACH_PREVIEW,
                OperationLog.TARGET_CHAT_ATTACHMENT, attachmentId, extra);

        String ext = FileTypePolicy.extOfName(file.getOriginalName());
        return ChatAttachmentTicketVO.builder()
                .ticket(ticket)
                .attachmentId(attachmentId)
                .nodeId(attachment.getNodeId())
                // 用物理文件的当前名（而非发送时快照）：下载响应的 Content-Disposition 用的就是它，
                // 前端「另存为」必须与实际落盘名一致，否则用户会拿到一个名字对不上的文件
                .fileName(file.getOriginalName())
                .sizeBytes(file.getSizeBytes())
                .usageMode(attachment.getUsageMode())
                .accessType(type)
                .contentUrl(downloading
                        ? ticketService.contentUrl(attachmentId, ticket)
                        : ticketService.inlineContentUrl(attachmentId, ticket))
                .expiresIn(properties.getTicketTtl().toSeconds())
                // 用 previewable 而非 inlineRenderable：后者是安全边界（能否交给浏览器按 MIME 渲染），
                // 拿它当「能不能看」会把文本误判成不可预览 —— 同一份 .txt 在自己文件域能看、
                // 发给别人却提示「无法在线预览」，用户只会认为是缺陷（见 FileTypePolicy#previewable）
                .previewSupported(typePolicy.previewable(ext))
                .build();
    }

    /**
     * 凭票复核取流（<b>匿名</b>端点调用）。
     *
     * <p><b>为什么换了票还要回源查库：</b>票据是「签发那一刻的结论」，而撤销 / 过期 / 文件下线
     * 都可能在票据 TTL 内发生。若只验票就发流，发送方的撤销会最多延迟 5 分钟才生效——
     * 「撤销」这个动作的全部价值就在即时性。故这里做第二次、也是最后一次状态复核。</p>
     *
     * <p><b>不在此处扣次数、不记审计：</b>两者都已在 {@link #issueTicket} 完成。
     * {@code Range} 分段会重复调用本方法，在此重复记账会把一次下载记成多次。</p>
     *
     * <p><b>熔断开关刻意不作用于本方法：</b>关闭总开关只应阻止「新建授权 / 换票」，
     * 不应让接收方正在进行的下载中断（同 {@code ShareProperties#enabled} 的口径）。</p>
     *
     * @param attachmentId 授权 ID
     * @param ticket       取件票据
     * @param disposition  用户显式要求（{@code inline} 或空）；仅下载票需要它
     * @return 取流所需信息（物理文件 + 是否内联）
     * @throws BusinessException 票据无效（4028）/ 状态已变（4024 / 4025 / 4026 / 4027）
     */
    @Transactional(readOnly = true)
    public AttachmentContent resolveContent(Long attachmentId, String ticket, String disposition) {
        ChatAttachmentTicketService.ChatAttachmentTicketPayload payload = ticketService.redeem(ticket, attachmentId);

        ChatAttachment attachment = chatAttachmentMapper.selectById(attachmentId);
        if (attachment == null) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_NOT_FOUND);
        }
        if (attachment.getStatus() != null && attachment.getStatus() == ChatAttachment.STATUS_REVOKED) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_REVOKED);
        }
        if (attachment.expiredAt(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_EXPIRED_OR_LIMIT);
        }
        if (!attachment.active()) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_EXPIRED_OR_LIMIT);
        }
        // 绑定复核：附件行被换绑（或票据载荷被改写）时旧票立即失效
        if (!Objects.equals(attachment.getId(), payload.attachmentId())
                || !Objects.equals(attachment.getFileId(), payload.fileId())) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_TICKET_INVALID);
        }

        boolean downloadRequested = ChatAttachmentTicketService.ACCESS_DOWNLOAD.equalsIgnoreCase(payload.accessType());
        if (downloadRequested && !attachment.downloadable()) {
            // 防御：档位为「仅预览」时不可能签出 download 票，此处兜住任何历史 / 脏数据
            throw new BusinessException(ErrorCode.CHAT_ATTACH_USAGE_FORBIDDEN);
        }

        FileObject file = fileObjectMapper.selectById(attachment.getFileId());
        if (file == null || !Objects.equals(0, file.getStatus())) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_NOT_FOUND);
        }

        boolean inline;
        if (!downloadRequested) {
            // 预览票：只发 inline。不可内联的类型由 FileDownloadService 以「不支持在线预览」拒绝，
            // 绝不降级为 attachment —— 那等于把预览票变成下载票，绕过「仅预览」档位
            inline = true;
        } else {
            inline = DISPOSITION_INLINE.equalsIgnoreCase(disposition)
                    && typePolicy.inlineRenderable(FileTypePolicy.extOfName(file.getOriginalName()));
        }
        return new AttachmentContent(file, inline, payload.accessType());
    }

    /**
     * 把附件转存为接收方自己的文件条目（仅用途档位为「可转发转存」时可达）。
     *
     * <p><b>为什么不算作一次下载：</b>档位 3 的语义就是「你可以拿走并归你所有」，
     * 此时再按次限制没有意义（接收方拿到条目后可自行下载任意次）。次数限制只约束
     * 档位 2 的「按次下载」。</p>
     *
     * <p><b>转存不复制物理字节：</b>走 {@link FileNodeService#registerStoredContent} 的
     * 内容寻址复用（同一 {@code sha256 + size} 命中同一条 {@code sys_file}，引用计数 +1），
     * 与上传秒传同一条路径。这既省空间，也保证「大小 / 哈希」的完整性事实来自服务端。</p>
     *
     * <p><b>两把锁是「与」关系：</b>本方法只解除「发送方是否允许」这一把；
     * 接收方在自己空间创建数据的能力另由接口层的 {@code file:upload} 权限点把关。</p>
     *
     * <p>不加 {@code @Transactional}：转存事务由 {@code registerStoredContent} 自己开启，
     * 本方法只需在其提交后记一条审计。</p>
     *
     * @param consumerUserId 接收方（转存后的条目归属人）
     * @param attachmentId   授权 ID
     * @return 转存结果（结构与上传一致，前端可复用同一套处理）
     * @throws BusinessException 不存在（4024）/ 已撤销（4026）/ 已过期或用尽（4025）/ 档位禁止（4027）
     */
    public UploadResultVO saveToMyFiles(Long consumerUserId, Long attachmentId) {
        requireEnabled();

        LocalDateTime now = LocalDateTime.now();
        ChatAttachment attachment = chatAttachmentMapper.selectById(attachmentId);
        if (attachment == null || !Objects.equals(attachment.getReceiverUserId(), consumerUserId)) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_NOT_FOUND);
        }
        if (attachment.getStatus() != null && attachment.getStatus() == ChatAttachment.STATUS_REVOKED) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_REVOKED);
        }
        if (attachment.expiredAt(now)) {
            chatAttachmentMapper.markExpired(attachmentId, now);
            throw new BusinessException(ErrorCode.CHAT_ATTACH_EXPIRED_OR_LIMIT);
        }
        if (!attachment.active()) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_EXPIRED_OR_LIMIT);
        }
        if (!attachment.resavable()) {
            // 与「仅预览禁止下载」共用错误码，但给一句更准确的文案：用户点的确实是「保存」
            throw new BusinessException(ErrorCode.CHAT_ATTACH_USAGE_FORBIDDEN,
                    "发送方未允许将该附件保存到你的文件");
        }

        FileObject file = fileObjectMapper.selectById(attachment.getFileId());
        if (file == null || !Objects.equals(0, file.getStatus())) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_NOT_FOUND);
        }

        // 落根目录、不继承源文件密级：转存是「接收方自己的一份」，
        // 密级应由接收方按自己的规则设定，而不是隐式沿用发送方的设定
        UploadResultVO result = fileNodeService.registerStoredContent(consumerUserId,
                file.getOriginalName(), null, null, file.getContentType(),
                file.getSha256(), file.getSizeBytes(), file.getStoragePath());

        Map<String, Object> extra = receiverDetail(attachment);
        extra.put("name", file.getOriginalName());
        extra.put("sizeBytes", file.getSizeBytes());
        auditLogger.success(OperationLog.ACTION_CHAT_ATTACH_SAVE,
                OperationLog.TARGET_CHAT_ATTACHMENT, attachmentId, extra);

        return result;
    }

    /* ================================== 私有助手 ================================== */

    private void requireEnabled() {
        if (!properties.isEnabled()) {
            // 与 ShareProperties#enabled 同口径：熔断以 1003 回应（前端策略 D：就地提示，不引导登录）
            throw new AuthException(ErrorCode.NO_AUTH, "会话附件功能当前不可用");
        }
    }

    private ChatAttachment findBySenderAndClientMsgKey(Long senderUserId, String clientMsgKey) {
        if (clientMsgKey == null) {
            return null;
        }
        return chatAttachmentMapper.selectOne(Wrappers.<ChatAttachment>lambdaQuery()
                .eq(ChatAttachment::getSenderUserId, senderUserId)
                .eq(ChatAttachment::getClientMsgKey, clientMsgKey)
                .last("limit 1"));
    }

    private static String normalizeClientMsgKey(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > MAX_CLIENT_MSG_KEY_LENGTH) {
            // 先于 DB 拒绝：列宽 64，超长在严格模式下会变成 500，这里应回 2002
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "幂等键长度不能超过 " + MAX_CLIENT_MSG_KEY_LENGTH);
        }
        return trimmed;
    }

    /**
     * 用途档位：缺省取配置值，越界即拒绝。
     *
     * <p>DTO 上的 {@code @Min/@Max} 只挡「请求里显式传了非法值」；<b>缺省值来自配置</b>，
     * 运维配错时 DTO 校验不会触发，故服务层必须再守一次。</p>
     */
    private int resolveUsageMode(Integer raw) {
        int mode = raw == null ? properties.getDefaultUsageMode() : raw;
        if (mode < ChatAttachment.USAGE_MODE_MIN || mode > ChatAttachment.USAGE_MODE_MAX) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "用途档位必须在 " + ChatAttachment.USAGE_MODE_MIN + "~" + ChatAttachment.USAGE_MODE_MAX + " 之间");
        }
        return mode;
    }

    /** 下载次数上限：{@code 0} 表示不限次，超过配置硬上限即拒绝（防「限 999999 次」等于不限次）。 */
    private int resolveDownloadLimit(Integer raw) {
        int limit = raw == null ? 0 : raw;
        if (limit < 0) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "下载次数上限不能为负数");
        }
        if (limit > properties.getMaxDownloadLimit()) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "下载次数上限不能超过 " + properties.getMaxDownloadLimit());
        }
        return limit;
    }

    /**
     * 有效期：{@code neverExpire} 优先；否则缺省取配置值，超过硬上限即拒绝。
     *
     * @return {@code null} 表示不限期
     */
    private LocalDateTime resolveExpireAt(Integer expireHours, boolean neverExpire) {
        if (neverExpire) {
            if (!properties.isAllowNeverExpire()) {
                throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "当前不允许设置不限期附件");
            }
            return null;
        }
        int hours = expireHours == null ? properties.getDefaultExpireHours() : expireHours;
        if (hours > properties.getMaxExpireHours()) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "有效期不能超过 " + properties.getMaxExpireHours() + " 小时");
        }
        return LocalDateTime.now().plusHours(hours);
    }

    private static String normalizeAccessType(String raw) {
        if (raw == null || raw.isBlank() || ChatAttachmentTicketService.ACCESS_PREVIEW.equalsIgnoreCase(raw)) {
            return ChatAttachmentTicketService.ACCESS_PREVIEW;
        }
        if (ChatAttachmentTicketService.ACCESS_DOWNLOAD.equalsIgnoreCase(raw)) {
            return ChatAttachmentTicketService.ACCESS_DOWNLOAD;
        }
        throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "accessType 只能是 preview 或 download");
    }

    /**
     * 回源定性：额度扣减 CAS 失败后，判断「此刻的真实原因」。
     *
     * <p>扣减失败可能因为过期、撤销、额度用尽三者之一。统一回「次数用尽」会把发送方的撤销
     * 误报成用户自己的额度问题，用户据此会去联系发送方「加次数」，而正确动作其实是「重新索要一份」。</p>
     */
    private static String rejectReason(ChatAttachment latest, LocalDateTime now) {
        if (latest == null) {
            return "NOT_FOUND";
        }
        if (latest.getStatus() != null && latest.getStatus() == ChatAttachment.STATUS_REVOKED) {
            return "REVOKED";
        }
        if (latest.expiredAt(now)) {
            return "EXPIRED";
        }
        if (latest.unlimitedDownloads()) {
            // 不限次的授权不该走到扣减分支；真走到这里说明这段时间内档位被改成了限次
            return "INVALIDATED";
        }
        return "LIMIT_EXHAUSTED";
    }

    private static ErrorCode rejectCode(String reason) {
        return switch (reason) {
            case "REVOKED" -> ErrorCode.CHAT_ATTACH_REVOKED;
            case "NOT_FOUND" -> ErrorCode.CHAT_ATTACH_NOT_FOUND;
            case "USAGE_PREVIEW_ONLY" -> ErrorCode.CHAT_ATTACH_USAGE_FORBIDDEN;
            case "SOURCE_MISSING" -> ErrorCode.CHAT_ATTACH_NOT_FOUND;
            default -> ErrorCode.CHAT_ATTACH_EXPIRED_OR_LIMIT;
        };
    }

    private void auditReject(Long attachmentId, String reason, ChatAttachment attachment) {
        Map<String, Object> extra = new LinkedHashMap<>();
        if (attachment != null) {
            extra.put(OperationLog.DETAIL_NODE_ID, attachment.getNodeId());
            extra.put(OperationLog.DETAIL_RECEIVER_USER_ID, attachment.getReceiverUserId());
            extra.put(OperationLog.DETAIL_USAGE_MODE, attachment.getUsageMode());
        }
        extra.put(OperationLog.DETAIL_REJECT_REASON, reason);
        // fail 记录走 REQUIRES_NEW 独立事务：外层随后的业务异常回滚不会把它一起撤销
        auditLogger.log(OperationLog.ACTION_CHAT_ATTACH_REJECT,
                OperationLog.TARGET_CHAT_ATTACHMENT, attachmentId, false, extra);
    }

    private static Map<String, Object> senderDetail(ChatAttachment attachment) {
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put(OperationLog.DETAIL_NODE_ID, attachment.getNodeId());
        extra.put(OperationLog.DETAIL_RECEIVER_USER_ID, attachment.getReceiverUserId());
        extra.put(OperationLog.DETAIL_USAGE_MODE, attachment.getUsageMode());
        extra.put("name", attachment.getFileName());
        extra.put("sizeBytes", attachment.getSizeBytes());
        return extra;
    }

    private static Map<String, Object> receiverDetail(ChatAttachment attachment) {
        Map<String, Object> extra = senderDetail(attachment);
        extra.put("senderUserId", attachment.getSenderUserId());
        return extra;
    }

    private static boolean visibleTo(ChatAttachment attachment, Long userId) {
        return Objects.equals(attachment.getSenderUserId(), userId)
                || Objects.equals(attachment.getReceiverUserId(), userId);
    }

    private ChatAttachmentVO toVO(ChatAttachment attachment) {
        // remaining 为派生值：null=不限次。刻意不落库——落库就要在每次扣减时同步维护，
        // 与 download_count 形成两个真相源；派生计算只有一个真相源
        Integer remaining = null;
        if (!attachment.unlimitedDownloads()) {
            int used = attachment.getDownloadCount() == null ? 0 : attachment.getDownloadCount();
            remaining = Math.max(0, attachment.getDownloadLimit() - used);
        }
        return ChatAttachmentVO.builder()
                .id(attachment.getId())
                .nodeId(attachment.getNodeId())
                .senderUserId(attachment.getSenderUserId())
                .receiverUserId(attachment.getReceiverUserId())
                .fileName(attachment.getFileName())
                .sizeBytes(attachment.getSizeBytes())
                .usageMode(attachment.getUsageMode())
                .expireAt(attachment.getExpireAt())
                .downloadLimit(attachment.getDownloadLimit())
                .downloadCount(attachment.getDownloadCount())
                .remaining(remaining)
                .status(attachment.getStatus())
                .createTime(attachment.getCreateTime())
                .build();
    }

    private List<ChatAttachmentVO> toVOList(Page<ChatAttachment> page) {
        return page.getRecords().stream().map(this::toVO).toList();
    }

    private static long normalizeCurrent(long current) {
        return current < 1L ? 1L : current;
    }

    private static long normalizePageSize(long pageSize) {
        if (pageSize < 1L) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    /**
     * 取流所需信息（{@code resolveContent} 的返回值）。
     *
     * @param file       物理文件（已复核存在且可用）
     * @param inline     {@code true}=内联渲染，{@code false}={@code attachment} 下载语义
     * @param accessType 票据上的取件类型（仅用于日志 / 排查）
     */
    public record AttachmentContent(FileObject file, boolean inline, String accessType) {
    }
}
