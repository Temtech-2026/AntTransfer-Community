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
package com.anttransfer.collaboration.service;

import com.anttransfer.collaboration.config.NotifyProperties;
import com.anttransfer.collaboration.model.dto.ChatSendDTO;
import com.anttransfer.collaboration.model.entity.ChatPeerAlias;
import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.anttransfer.collaboration.model.entity.SysGroup;
import com.anttransfer.collaboration.model.vo.ChatPeerVO;
import com.anttransfer.collaboration.model.vo.ChatPresenceVO;
import com.anttransfer.collaboration.model.vo.ChatReaderVO;
import com.anttransfer.collaboration.model.vo.ChatRecallVO;
import com.anttransfer.collaboration.model.vo.ChatTargetVO;
import com.anttransfer.collaboration.model.vo.ChatTypingVO;
import com.anttransfer.collaboration.model.vo.ConversationVO;
import com.anttransfer.collaboration.model.vo.NotifyMessageVO;
import com.anttransfer.collaboration.repository.ChatPeerAliasMapper;
import com.anttransfer.collaboration.repository.ChatReadRow;
import com.anttransfer.collaboration.repository.ConversationSummary;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.repository.SysGroupMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.support.ChatFileCardText;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsFrame;
import com.anttransfer.collaboration.ws.WsPresenceService;
import com.anttransfer.collaboration.ws.WsProtocol;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.notify.ChatScope;
import com.anttransfer.common.notify.MessageType;
import com.anttransfer.common.notify.NotifyType;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.UserLookupPort;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 单聊 / 群聊服务：路由、成员校验、写扩散落库、提交后推送。
 *
 * <p><b>写扩散（fan-out on write）：</b>一条消息按参与人各落一行——单聊落 2 行
 * （双方各一行、{@code chat_target_id} 互指对端），群聊落 N 行（每成员一行、target 均为 groupId）。
 * 于是「会话历史 / 未读 / 已读」全部退化为「按 {@code recipient_user_id} 单表查询」，
 * 不需要额外的会话表与回执表（权衡与规模上界见 {@code NotifyMessage} 类注）。</p>
 *
 * <p><b>发送人自己也落一行</b>，且该行直接置为<b>已读</b>：否则自己发的消息会给自己的
 * 会话角标 +1，且多端同步时会看到「自己发的未读」。置读后，发送人的其他标签页仍会通过
 * WebSocket 收到该帧（推送按「用户」广播到其全部连接），既同步了消息、又不制造假未读。</p>
 *
 * <p><b>已读回执同样是「派生态」，不新增存储：</b>「谁读过我发的这条」= 同一消息<b>其他人的镜像行</b>
 * 里 {@code read_status = 1} 的那些行。换言之 V5 的写扩散已经把回执所需的事实全记下来了，
 * 只是查询方向与「我的会话历史」相反（历史按 recipient 查，回执按 sender + 镜像 target 查），
 * 故这里只补查询与派生，不引入回执表、也不加冗余计数（见 {@code V13__chat_read_receipt.sql}）。</p>
 *
 * <p><b>先落库再推送：</b>推送注册在 {@code afterCommit}，因此不存在「收到帧但库里查不到」
 * 的幻影消息；推送失败只会让在线端退化为「下次拉取才看到」，不丢消息。</p>
 *
 * <p><b>幂等：</b>{@code clientMsgId} 是重试去重键。发送前先按
 * {@code (sender, scope, target, clientMsgId)} 查一次，命中即原样返回上次结果且<b>不重复推送</b>；
 * 并发重试则由 DB 唯一索引兜底，命中 {@link DuplicateKeyException} 后回查并返回既有消息。</p>
 *
 * @author AntTransfer CE
 */
@Service
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    /**
     * 单聊 / 群聊「会话双方各一行」的最大接收人规模（群聊为成员数；仅用于日志与防御性判断）。
     *
     * <p><b>为 {@code public}：</b>建群时的成员上限（{@code SysGroup#MAX_MEMBERS}）必须不高于
     * 本值，否则能建出「进得去、发不出」的群——而故障发生在发送而非建群时，
     * 排查会先怀疑消息服务。两者关系由 {@code ChatGroupMemberLimitTest} 断言，
     * 暴露常量只是为了让那条断言能写出来。</p>
     */
    public static final int MAX_FANOUT_RECIPIENTS = 500;

    /**
     * 撤回时间窗：消息发出后多久内允许发送人撤回。
     *
     * <p><b>为什么是常量而不是配置项：</b>窗口是产品口径（给「手滑发错」留改正时间，
     * 不是给「翻旧账」留通道），改它必须同时改前端入口的显隐逻辑与错误码 1034 的文案——
     * 做成配置只会让三处在不同环境漂移。前端不再自己算窗口，撤回入口是否可用由本值决定
     * （前端按 {@code createTime + 窗口} 判定，只影响体验，强制校验在这里）。</p>
     *
     * <p>判定始终以<b>服务端时钟</b>为准：客户端时间可被随意修改，
     * 若信任客户端传来的「是否超时」，撤回窗口就形同虚设。</p>
     */
    public static final Duration RECALL_WINDOW = Duration.ofMinutes(2);

    /** 引用快照正文的最大长度（与 {@code quote_content varchar(200)} 列宽对齐）。 */
    private static final int QUOTE_SNAPSHOT_MAX = 200;

    private final NotifyMessageMapper notifyMessageMapper;
    private final GroupMemberMapper groupMemberMapper;
    private final SysGroupMapper sysGroupMapper;
    /** 会话对端备注（{@code sys_chat_peer_alias}）：只影响「我看到的对方名字」，不碰账号昵称。 */
    private final ChatPeerAliasMapper chatPeerAliasMapper;
    private final UserLookupPort userLookupPort;
    private final WsBroadcaster wsBroadcaster;
    private final WsPresenceService wsPresenceService;
    private final AfterCommitExecutor afterCommitExecutor;
    private final NotifyProperties properties;
    private final NotifyMessageService notifyMessageService;

    public ChatService(NotifyMessageMapper notifyMessageMapper,
                       GroupMemberMapper groupMemberMapper,
                       SysGroupMapper sysGroupMapper,
                       ChatPeerAliasMapper chatPeerAliasMapper,
                       UserLookupPort userLookupPort,
                       WsBroadcaster wsBroadcaster,
                       WsPresenceService wsPresenceService,
                       AfterCommitExecutor afterCommitExecutor,
                       NotifyProperties properties,
                       NotifyMessageService notifyMessageService) {
        this.notifyMessageMapper = notifyMessageMapper;
        this.groupMemberMapper = groupMemberMapper;
        this.sysGroupMapper = sysGroupMapper;
        this.chatPeerAliasMapper = chatPeerAliasMapper;
        this.userLookupPort = userLookupPort;
        this.wsBroadcaster = wsBroadcaster;
        this.wsPresenceService = wsPresenceService;
        this.afterCommitExecutor = afterCommitExecutor;
        this.properties = properties;
        this.notifyMessageService = notifyMessageService;
    }

    /**
     * 发送一条会话消息（文本 / 文件传输通知 / 审批结果通知），可选带引用。
     *
     * <p><b>引用（{@code quoteClientMsgId} 非空）在写入前完成校验与快照</b>：
     * 被引用消息必须<b>在本会话内</b>且<b>未被撤回</b>，随后把「谁说的 + 正文」抄进
     * 本次发送的每一行（见 {@link #resolveQuote}）。抄快照而不是存外键，
     * 是为了让引用块在原消息被撤回后仍然是可读的。</p>
     *
     * <p>引用的校验发生在<b>幂等回查之后</b>：重放同一条已落库的消息不该因为
     * 原消息后来被撤回而失败，幂等语义优先。</p>
     *
     * <p><b>{@code @} 提及（{@code mentionUserIds} 非空）不改变落库形态</b>：仍是 N 行写扩散，
     * 只是把「被点名者那一行」的 {@code mentioned} 置 1。于是「有人 @ 我」在库里就是一个
     * 可索引的等值条件，会话列表的提及未读计数与气泡高亮都从它派生，
     * 而<b>不需要解析正文里的昵称</b>（口径与取舍见 {@link #resolveMentionTargets}）。</p>
     *
     * @param senderId 发送人（取自登录态，不从入参取——否则可伪造他人发消息）
     * @param dto      发送参数
     * @return 发送人视角的消息视图（其自身那一行，{@code chatTargetId} 为对端 / 群组）
     */
    @Transactional
    public NotifyMessageVO send(Long senderId, ChatSendDTO dto) {
        int scope = dto.scope();
        int messageType = dto.messageType();
        validateShape(scope, messageType, dto.content());

        List<Long> recipients = resolveRecipients(senderId, scope, dto.targetId());
        // 提及目标必须在接收人清单内收敛（见 resolveMentionTargets）：
        // 非成员、自己、单聊场景一律静默剔除，不报错也不落标记
        Set<Long> mentionTargets = resolveMentionTargets(senderId, scope, recipients, dto.mentionUserIds());

        NotifyMessage existed = findExisting(senderId, scope, dto.targetId(), dto.clientMsgId());
        if (existed != null) {
            // 幂等重放：上次已落库（且已推送），本次不重复落库、不重复推送
            log.debug("会话消息重复发送，返回既有消息：sender={}, clientMsgId={}, id={}",
                    senderId, dto.clientMsgId(), existed.getId());
            return NotifyMessageVO.from(existed);
        }

        // 引用快照：非引用消息返回 null；引用不合法时在此抛 1036（不落任何行）
        NotifyMessage quoted = resolveQuote(senderId, scope, dto.targetId(), dto.quoteClientMsgId());

        List<NotifyMessage> rows = buildRows(senderId, scope, dto, recipients, quoted, mentionTargets);
        try {
            for (NotifyMessage row : rows) {
                notifyMessageMapper.insert(row);
            }
        } catch (DuplicateKeyException e) {
            // 并发重试：唯一索引 (sender, recipient, client_msg_id) 拦下第二条。
            // MySQL 下单语句失败不中止事务——但**回查必须走当前读**：上面那次幂等前置查询已把
            // 本事务的快照钉在「对手提交之前」，沿用同一快照回查会稳定读到「没有这一行」，
            // 兜底因此形同虚设，重复键被原样抛给用户（弱网重发 / 双端同发正是它存在的唯一理由）。
            NotifyMessage replay = findExistingForShare(senderId, scope, dto.targetId(), dto.clientMsgId());
            if (replay != null) {
                log.info("会话消息并发重复发送，已按幂等返回既有消息：sender={}, clientMsgId={}",
                        senderId, dto.clientMsgId());
                return NotifyMessageVO.from(replay);
            }
            throw e;
        }

        afterCommitExecutor.run(() -> pushAll(rows));
        return NotifyMessageVO.from(rows.get(0));
    }

    /**
     * 撤回一条会话消息（仅发送人本人、仅 {@link #RECALL_WINDOW} 之内）。
     *
     * <p><b>为什么按 {@code clientMsgId} 而不是消息 id 撤回：</b>写扩散下一条消息在每个参与人
     * 那里是不同的行，客户端手里能跨端唯一指认一条消息的只有幂等键（见 {@code ChatRecallVO}）。
     * 服务端由此一次定位<b>全部行</b>并一起翻转——只撤自己那一行等于「我撤了、对方还看得到」。</p>
     *
     * <p><b>时间窗以服务端时钟与库里的 {@code create_time} 比对</b>：入参里没有任何时间字段，
     * 客户端改本地时间不影响判定。</p>
     *
     * <p><b>幂等：</b>已经是撤回态时直接返回（不报错、不重复推送）——多端同时点撤回、
     * 或弱网重试都会走到这条分支；报「消息不存在」会让用户以为操作失败，
     * 而实际上目标状态已经达成。</p>
     *
     * @param userId      当前登录人（撤回人）
     * @param clientMsgId 被撤回消息的幂等键
     * @throws BusinessException 入参为空（PARAM_MISSING）/ 消息不存在或非本人发送（{@code 1035}）
     *                           / 超出时间窗（{@code 1034}）
     */
    @Transactional
    public void recall(Long userId, String clientMsgId) {
        String key = clientMsgId == null ? "" : clientMsgId.trim();
        if (key.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "客户端消息 ID 不能为空");
        }

        List<NotifyMessage> rows = notifyMessageMapper.selectOwnMessageRows(userId, key);
        if (rows.isEmpty()) {
            // 不存在 / 不是会话消息 / 不是本人发的，三者同一个码：分开报会给出一份「哪些消息存在」的探测面
            throw new BusinessException(ErrorCode.CHAT_RECALL_NOT_FOUND);
        }

        LocalDateTime now = LocalDateTime.now();
        if (rows.stream().allMatch(NotifyMessage::isRecalled)) {
            // 已经是撤回态：目标状态已达成，按幂等成功返回。
            // 这一步必须排在时间窗校验**之前**——否则「多端并发撤回」时，
            // 后到的那一端会因为时间窗已过而收到 1034，用户看到的是「撤回失败」，
            // 而实际上消息早已撤回。
            log.debug("会话消息已是撤回态，跳过重复操作：sender={}, clientMsgId={}", userId, key);
            return;
        }
        if (isRecallExpired(rows.get(0).getCreateTime(), now)) {
            throw new BusinessException(ErrorCode.CHAT_RECALL_EXPIRED);
        }

        int affected = notifyMessageMapper.recallOwnMessageRows(userId, key, now);
        if (affected <= 0) {
            // 并发下已被另一端撤回：目标状态已达成，同样按幂等处理
            log.debug("会话消息已被撤回，跳过重复操作：sender={}, clientMsgId={}", userId, key);
            return;
        }

        log.info("会话消息已撤回：sender={}, clientMsgId={}, rows={}", userId, key, affected);
        afterCommitExecutor.run(() -> pushRecall(rows, now));
    }

    /**
     * 解析单聊目标：把「登录账号」翻译成可发起会话的对端用户。
     *
     * <p><b>为什么这件事必须在服务端做：</b>会话的落库形态是 19 位雪花 ID，而普通用户
     * 拿不到别人的 ID（用户目录端点挂 {@code system:user:list}，属管理面）。前端若自行
     * 「按账号找人」，就必须先拥有用户目录——那正是本缺陷的成因。把解析收在这一步，
     * 发起会话就不再依赖管理面权限。</p>
     *
     * <p><b>两步解析，账号优先：</b>
     * <ol>
     *   <li>先按登录账号精确匹配（人记得住的标识，见 {@code UserLookupPort#findActiveByUsername}）；</li>
     *   <li>再退化为用户 ID——管理面、待办 / 消息中心等渠道手里可能只有雪花 ID，
     *       保留这条路径可避免「以前能用的填法现在不能用」。</li>
     * </ol>
     * 两步都不命中即 {@code 1013}：与发送时的目标校验同一错误码，前端不必区分
     * 「解析失败」与「发送失败」两种提示。</p>
     *
     * <p><b>不返回、也不校验「是不是自己」：</b>登录态里没有可信的用户主键可比
     * （见 {@code isSelfSent} 类注），自聊由 {@link #resolveRecipients} 在发送时拒绝。</p>
     *
     * @param query 登录账号，或用户 ID（调用方不区分，服务端按上述顺序解析）
     * @return 可发起会话的对端（目标 ID + 展示名）
     * @throws BusinessException 入参为空（PARAM_MISSING）或解析不到可用用户（CHAT_TARGET_INVALID）
     */
    public ChatTargetVO resolvePrivateTarget(String query) {
        String keyword = query == null ? "" : query.trim();
        if (keyword.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "账号不能为空");
        }

        Optional<UserLookupPort.UserContact> byUsername = userLookupPort.findActiveByUsername(keyword);
        if (byUsername.isPresent()) {
            return toTarget(byUsername.get());
        }

        Long asUserId = parseUserId(keyword);
        if (asUserId != null && userLookupPort.existsActiveUser(asUserId)) {
            UserLookupPort.UserContact contact = userLookupPort.findContacts(List.of(asUserId)).get(asUserId);
            if (contact != null) {
                return toTarget(contact);
            }
        }
        // 账号不存在、账号不可用、ID 查无此人统一一个码：解析不出「能收消息的人」是同一件事，
        // 分开报只会给出一份「哪些账号存在」的探测清单
        throw new BusinessException(ErrorCode.CHAT_TARGET_INVALID, "账号不存在或该账号不可用");
    }

    /**
     * 会话历史（倒序，向上翻页）。
     *
     * <p>查询维度是 {@code (recipientUserId, chatScope, chatTargetId)}：这就是写扩散换来的
     * 「会话查询 = 单表等值查询」，不需要 JOIN 会话表。{@code beforeId} 为游标翻页
     * （比 offset 翻页稳定——新消息到达不会让旧页内容错位）。</p>
     *
     * <p>群聊拉取同样校验成员关系：非成员不仅不能发，也不能读
     * （{@code 1012}），否则「退群后仍能读历史」会成为越权读通道。</p>
     *
     * <p><b>已读人（{@code readers}）随历史一起回</b>：写完扩散后，「谁读过我发的这条」只能从
     * <b>同一消息其他人的镜像行</b>派生（那一行的 {@code read_status} 就是这位读者的阅读事实），
     * 故本方法在取完本页消息后再补一次批量查询（见 {@link #loadReaders}）。
     * 只对「我发的」消息查询与填充，别人发的消息不查——那种情况下我的 {@code read_status}
     * 只代表我自己读没读，与「谁读了我的消息」无关。</p>
     */
    public List<NotifyMessageVO> history(Long userId, Integer scope, Long targetId,
                                         Long beforeId, Integer limit) {
        int effectiveScope = validateScope(scope);
        if (targetId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "会话目标不能为空");
        }
        if (ChatScope.isGroup(effectiveScope) && groupMemberMapper.countMember(targetId, userId) <= 0) {
            throw new BusinessException(ErrorCode.CHAT_NOT_GROUP_MEMBER);
        }

        LambdaQueryWrapper<NotifyMessage> wrapper = Wrappers.lambdaQuery(NotifyMessage.class)
                .eq(NotifyMessage::getRecipientUserId, userId)
                .eq(NotifyMessage::getChatScope, effectiveScope)
                .eq(NotifyMessage::getChatTargetId, targetId);
        if (beforeId != null && beforeId > 0) {
            wrapper.lt(NotifyMessage::getId, beforeId);
        }
        wrapper.orderByDesc(NotifyMessage::getId).last("limit " + normalizeHistoryLimit(limit));

        List<NotifyMessage> rows = notifyMessageMapper.selectList(wrapper);
        Map<String, List<ChatReaderVO>> readers = loadReaders(userId, effectiveScope, targetId, rows);
        Map<Long, UserLookupPort.UserContact> senders = loadSenders(rows);
        return rows.stream()
                .map(row -> toIncomingVO(row, readers.get(row.getClientMsgId()), senders))
                .toList();
    }

    /**
     * 会话已读（进入会话即清该会话角标）。
     *
     * <p>直接委托 {@code NotifyMessageService.markSessionRead}：已读翻转 + 提交后推送未读快照
     * 是通知域的统一语义，会话域只是它的一个调用方。若在此重复实现，两条路径迟早会在
     * 「置读条件 / 是否推送」上产生分歧（例如一边推快照一边不推，多端角标就不一致）。</p>
     *
     * @return 本次置读条数（0 表示本来就没有未读，不产生推送）
     */
    public int markRead(Long userId, Integer scope, Long targetId) {
        int effectiveScope = validateScope(scope);
        if (targetId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "会话目标不能为空");
        }
        return notifyMessageService.markSessionRead(userId, effectiveScope, targetId);
    }

    /**
     * 会话列表（聊天页左侧栏）。
     *
     * <p><b>为什么必须由服务端聚合：</b>写扩散让「某会话的历史」退化为单表等值查询，
     * 却让「我有哪些会话」成了单点推不出的信息——收件箱分页按产品口径排除了会话消息
     * （{@code notify_type not in (6,7)}），离线补拉只覆盖纯提醒类。
     * 若不在这里聚合，前端只能记住「用户点过谁」，刷新即残缺，
     * 且永远列不出「别人发过但我没回过」的会话。</p>
     *
     * <p><b>四次查询，全程无 N+1</b>：
     * <ol>
     *   <li>聚合：按 {@code (scope, target)} 分组取最后一条 ID 与未读数（走 {@code idx_session}）；</li>
     *   <li>明细：按上一步的 ID 集合批量取最后一条消息（走主键）；</li>
     *   <li>昵称：只对<b>单聊</b>的 targetId 批量反查 {@code UserLookupPort}；</li>
     *   <li>群名：只对<b>群聊</b>的 targetId 批量反查 {@code sys_group}（走主键）。</li>
     * </ol></p>
     *
     * <p><b>群聊现在会解析群名</b>：此前该字段恒为 {@code null}（群名属 {@code sys_group}，
     * 而接管该表族的收口动作挂在 architecture.md D-11），前端只能回落成「群聊 #id」。
     * 建群闭环落地后本模块已持有 {@code SysGroupMapper}，遂按原注释预告的方式
     * 补一次批量查名——<b>对外契约与前端都无需改动</b>：前端本就优先取 {@code targetName}、
     * 取不到才回落，因此这次改动只是让回落分支少走几次。</p>
     *
     * <p><b>两次反查按 scope 分流，不合并成一次「按 ID 查名字」</b>：单聊 ID 与群组 ID
     * 属不同值域（用户表 / 群组表），合并查询无法共用一条 SQL；分流还能保证
     * 「某个群 ID 恰好等于某个用户 ID」时不会取错名字。</p>
     *
     * @param userId 会话归属者（取自登录态，不从入参取）
     * @param limit  条数（按 {@code notify.chat-conversation-limit} 收敛上限）
     * @return 按最后活跃倒序的会话列表；没有会话时返回空列表
     */
    public List<ConversationVO> conversations(Long userId, Integer limit) {
        int size = normalizeConversationLimit(limit);
        List<ConversationSummary> summaries = notifyMessageMapper.selectConversationSummaries(userId, size);
        if (summaries.isEmpty()) {
            return List.of();
        }

        List<Long> lastIds = summaries.stream().map(ConversationSummary::getLastMessageId).toList();
        Map<Long, NotifyMessage> lastById = notifyMessageMapper.selectByIds(lastIds).stream()
                .collect(Collectors.toMap(NotifyMessage::getId, message -> message));

        Set<Long> peerIds = summaries.stream()
                .filter(summary -> isPrivateChat(summary.getChatScope()))
                .map(ConversationSummary::getChatTargetId)
                .collect(Collectors.toSet());
        Map<Long, UserLookupPort.UserContact> contacts = peerIds.isEmpty()
                ? Map.of()
                : userLookupPort.findContacts(peerIds);

        // 「我给对端起的名字」与 contacts 共用同一批 peerIds、一次批量取回：逐条查会变成 N+1。
        // 只有单聊入这趟查询——群聊的 target 是群 ID，不进「人对人」的备注语义。
        // 逻辑删除由 Wrapper 自动带上（deleted=0），所以取消过备注的对端不会命中。
        Map<Long, String> peerAliases = peerIds.isEmpty()
                ? Map.of()
                : chatPeerAliasMapper.selectList(Wrappers.lambdaQuery(ChatPeerAlias.class)
                        .eq(ChatPeerAlias::getOwnerUserId, userId)
                        .in(ChatPeerAlias::getPeerUserId, peerIds))
                .stream()
                .filter(row -> row.getAlias() != null && !row.getAlias().isBlank())
                .collect(Collectors.toMap(ChatPeerAlias::getPeerUserId,
                        ChatPeerAlias::getAlias, (first, ignored) -> first));

        Set<Long> groupIds = summaries.stream()
                .filter(summary -> !isPrivateChat(summary.getChatScope()))
                .map(ConversationSummary::getChatTargetId)
                .collect(Collectors.toSet());
        // 群名可能查不到（群被解散 / 已逻辑删除）：只把查到的放进 Map，缺失即回落「群聊 #id」。
        // 这里不因查不到而跳过整条会话——消息还在，会话就该在列表里。
        Map<Long, String> groupNames = groupIds.isEmpty()
                ? Map.of()
                : sysGroupMapper.selectByIds(groupIds).stream()
                        .filter(group -> group.getName() != null)
                        .collect(Collectors.toMap(SysGroup::getId, SysGroup::getName));

        List<ConversationVO> conversations = new ArrayList<>(summaries.size());
        for (ConversationSummary summary : summaries) {
            NotifyMessage last = lastById.get(summary.getLastMessageId());
            if (last == null) {
                // 聚合结果与明细不一致（该行刚被逻辑删除 / 清理任务收走）：跳过这条会话即可，
                // 不该因为一条脏数据让整个聊天页打不开
                log.debug("会话最后一条消息已不可见，跳过该会话：user={}, scope={}, target={}",
                        userId, summary.getChatScope(), summary.getChatTargetId());
                continue;
            }
            conversations.add(new ConversationVO(
                    summary.getChatScope(),
                    summary.getChatTargetId(),
                    resolveTargetName(summary, contacts, groupNames),
                    resolveTargetAvatar(summary, contacts),
                    peerAliases.get(summary.getChatTargetId()),
                    summary.getLastMessageId(),
                    last.getContent(),
                    last.getMessageType(),
                    last.getSenderUserId(),
                    isSelfSent(last),
                    last.getCreateTime(),
                    summary.getUnreadCount() == null ? 0L : summary.getUnreadCount(),
                    summary.getMentionUnreadCount() == null ? 0L : summary.getMentionUnreadCount()));
        }
        return conversations;
    }

    /**
     * 设置 / 修改「我给某个对端起的名字」（会话对端备注）。
     *
     * <p><b>为什么不落在账号上：</b>备注是 {@code (我, 他)} 这条关系的属性，不是账号属性。
     * 写进 {@code sys_user} 就成了「我改备注 → 所有人都看到新名字」，那是在改别人的数据；
     * 而一人对多人的备注本就塞不进账号表的一个列。所以本表只存 owner 视角的行，
     * 对端既看不到、也无从查询。</p>
     *
     * <p><b>为什么不校验「必须已有会话」：</b>系统里没有好友关系，私聊是「按账号搜索 → 直接发起」
     * （见 {@link #resolvePrivateTarget}）。要求先聊过才能备注，会让「先加个备注再去聊」失败，
     * 而备注本身并不依赖任何会话状态。对端校验只回答一个问题：这个账号现在可用吗。</p>
     *
     * <p><b>并发与幂等：</b>唯一键 {@code uk_owner_peer} 拦下重复行，于是「先查 → 复活 / 新建」
     * 在并发首次设置时可能撞键；撞了就按 {@code (我, 他)} 直接 UPDATE 收敛，一次即定，
     * 对外仍表现为「设成这个值」。此处刻意不复用上面那次查询的结果：REPEATABLE READ 下
     * 回查读的是同一个旧快照，看不到对手刚提交的行（见
     * {@code ChatPeerAliasMapper#reviveByOwnerPeer}）。重复提交同一个备注名幂等，不产生新行
     * （取消过的行走复活路径，见 {@code ChatPeerAliasMapper#revive}）。</p>
     *
     * @param userId 当前登录人（备注归属者，取自登录态，不从入参取）
     * @param peerId 被备注的用户 ID
     * @param alias  备注名（请求体已校验非空；此处再 trim，首尾空格不该被存进展示名）
     * @return 本次操作后的状态
     */
    // 刻意不套 @Transactional：本方法只有单条写语句，而并发「insert 撞键 → 改走更新」若共处一个
    // 显式事务，多个请求会同时持有重复键放出的共享锁再抢写锁，MySQL 直接判死锁牺牲其中一个
    // （真 MySQL 并发用例曾复现 DeadlockLoserDataAccessException）。每条语句各自成事务后，
    // 共享锁随语句结束即释放，剩余冲突退化成同一行的写锁排队。终态的正确性由唯一键 +
    // 条件更新保证，不依赖跨语句事务。
    public ChatPeerVO setPeerAlias(Long userId, Long peerId, String alias) {
        String trimmed = alias == null ? "" : alias.trim();
        if (trimmed.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "备注不能为空");
        }
        requireAliasTarget(userId, peerId);

        ChatPeerAlias existing = chatPeerAliasMapper.selectAny(userId, peerId);
        if (existing != null) {
            // 可能是一行「取消过」（deleted=1）的旧记录：复活它而不是插新行，否则必撞唯一键
            chatPeerAliasMapper.revive(existing.getId(), trimmed, userId);
            return new ChatPeerVO(peerId, trimmed);
        }

        ChatPeerAlias row = new ChatPeerAlias();
        row.setOwnerUserId(userId);
        row.setPeerUserId(peerId);
        row.setAlias(trimmed);
        row.setCreateBy(userId);
        row.setUpdateBy(userId);
        try {
            chatPeerAliasMapper.insert(row);
        } catch (DuplicateKeyException e) {
            // 并发首次设置（连点保存 / 弱网重发）：唯一键拦下了第二行，改走同一条更新路径收敛。
            // 这里只能按 (owner, peer) 直接 UPDATE，不能「回查 id 再 revive」：MySQL 默认隔离级别
            // 是 REPEATABLE READ，本事务的快照建立于上面那次 selectAny（当时对手还没提交），
            // 撞键后用同一个快照回查，读到的仍是「没有这一行」——重复键就原样抛给用户了
            // （真 MySQL 并发用例 ChatPeerAliasE2eIntegrationTest 曾复现）。UPDATE 是当前读，
            // 能看到对手已提交的那一行。详见 ChatPeerAliasMapper#reviveByOwnerPeer。
            if (chatPeerAliasMapper.reviveByOwnerPeer(userId, peerId, trimmed, userId) == 0) {
                // 影响 0 行：对手最终回滚了，冲突另有原因——如实上抛，不假装成功
                throw e;
            }
        }
        return new ChatPeerVO(peerId, trimmed);
    }

    /**
     * 取消备注——回到「看到对方的真实昵称」。
     *
     * <p><b>为什么是逻辑删除而不是真删：</b>与公共字段口径一致；且该行随后会被
     * {@link #setPeerAlias} 复活（唯一键不含 {@code deleted}，理由见 V19 迁移注释）。
     * <b>幂等</b>：本来就没设备注时同样返回成功——重试、多端并发取消都不该报错，
     * 因为「取消」的期望终态已经达成。</p>
     *
     * @param userId 当前登录人
     * @param peerId 被备注的用户 ID
     * @return 本次操作后的状态（{@code alias} 恒为 null）
     */
    @Transactional
    public ChatPeerVO clearPeerAlias(Long userId, Long peerId) {
        if (peerId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "缺少对端用户 ID");
        }
        chatPeerAliasMapper.delete(Wrappers.lambdaQuery(ChatPeerAlias.class)
                .eq(ChatPeerAlias::getOwnerUserId, userId)
                .eq(ChatPeerAlias::getPeerUserId, peerId));
        return new ChatPeerVO(peerId, null);
    }

    /**
     * 校验「被备注的人」是一个合法对端。
     *
     * <p>与发消息的目标校验<b>同码</b>（{@code 1013}）：给自己设备注没有意义（自己不会出现在
     * 自己的会话列表里），给不存在 / 已注销 / 已停用的账号设备注，则会在会话列表里留下一条
     * 永远点不开的名字。两者都属于「会话目标无效」，合用一个码可免掉前端为同一类问题写两套分支。</p>
     */
    private void requireAliasTarget(Long userId, Long peerId) {
        if (peerId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "缺少对端用户 ID");
        }
        if (peerId.equals(userId)) {
            throw new BusinessException(ErrorCode.CHAT_TARGET_INVALID, "不能给自己设备注");
        }
        if (!userLookupPort.existsActiveUser(peerId)) {
            throw new BusinessException(ErrorCode.CHAT_TARGET_INVALID, "被备注的账号不存在或不可用");
        }
    }

    /* ------------------------------------------------------------------ 内部实现 */

    /**
     * 取本页「我发的消息」各自的已读人（客户端消息 ID → 读者列表）。
     *
     * <p><b>只查本页的 clientMsgId</b>：命中量与「本页条数 × 参与人数」同阶，
     * 与「该会话历史总量」无关（取舍见 {@code NotifyMessageMapper#selectReadReceipts}）。</p>
     *
     * <p><b>读者姓名一次批量反查</b>：读者展示名不在消息表里（那张表只有用户 ID），
     * 而群聊里读者是任意群成员、前端又没有用户目录可查，故按读者 ID 去重后只调一次
     * {@link UserLookupPort#findContacts}，不给前端留下 N+1。</p>
     *
     * <p><b>反查不到展示名的读者直接丢弃</b>：账号已注销 / 已删除时反查为空，
     * 而气泡下那枚小头像只能由展示名首字符画出来——留一个查不到名的条目，
     * 前端只能渲染问号或为「无名读者」补一套分支，都不如不画。
     * 已读事实本身仍在库里（镜像行的 {@code read_status}），不因这一处渲染取舍而失真。</p>
     *
     * @param userId   当前登录人（发送人视角）
     * @param scope    会话范围
     * @param targetId 会话目标（发送人视角：单聊=对端，群聊=群 ID）
     * @param rows     本页消息（发送人视角的行）
     * @return 客户端消息 ID → 读者；无回执的消息不出现在 Map 中
     */
    private Map<String, List<ChatReaderVO>> loadReaders(Long userId, int scope, Long targetId,
                                                        List<NotifyMessage> rows) {
        List<String> clientMsgIds = rows.stream()
                .filter(row -> userId.equals(row.getSenderUserId()))
                .map(NotifyMessage::getClientMsgId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (clientMsgIds.isEmpty()) {
            return Map.of();
        }
        // 镜像行侧的 target：单聊指向发送人自己（V5 注释 c：两侧 target 互指对端），群聊就是群 ID
        Long mirrorTargetId = ChatScope.isGroup(scope) ? targetId : userId;
        List<ChatReadRow> readRows =
                notifyMessageMapper.selectReadReceipts(userId, scope, mirrorTargetId, clientMsgIds);
        if (readRows.isEmpty()) {
            return Map.of();
        }
        Set<Long> readerIds = readRows.stream()
                .map(ChatReadRow::getReaderUserId)
                .collect(Collectors.toSet());
        Map<Long, UserLookupPort.UserContact> contacts = userLookupPort.findContacts(readerIds);

        Map<String, List<ChatReaderVO>> readersByClientMsgId = new HashMap<>();
        for (ChatReadRow readRow : readRows) {
            UserLookupPort.UserContact contact = contacts.get(readRow.getReaderUserId());
            if (contact == null) {
                log.debug("读者已不在用户目录，跳过该条回执：reader={}, clientMsgId={}",
                        readRow.getReaderUserId(), readRow.getClientMsgId());
                continue;
            }
            readersByClientMsgId
                    .computeIfAbsent(readRow.getClientMsgId(), key -> new ArrayList<>())
                    .add(new ChatReaderVO(contact.userId(), contact.displayName(),
                            contact.avatarUrl()));
        }
        return readersByClientMsgId;
    }

    /**
     * 一次批量反查本页消息的<b>发送人</b>（展示名 + 头像），供下发给别人的气泡渲染。
     *
     * <p>与 {@link #loadReaders} 同一取舍：按 ID 去重后只调一次
     * {@link UserLookupPort#findContacts}——群聊一页最多几十个不同发送人，查询次数恒为 1。</p>
     *
     * <p><b>不排除「我发的那些行」：</b>前端对它们是 mine 分支、用不上这两个字段，
     * 但同一次批量查询带上它们不增加任何往返，反而省掉「先分拣再决定查谁」这道绕路。
     * 反查不到的发送人（账号已注销）不进 Map，由 {@link #toIncomingVO} 回落 {@code null}。</p>
     *
     * @param rows 本页消息（发送人视角的行）
     * @return 发送人用户 ID → 联系信息；无发送人（系统通知）时为空 Map
     */
    private Map<Long, UserLookupPort.UserContact> loadSenders(List<NotifyMessage> rows) {
        Set<Long> senderIds = rows.stream()
                .map(NotifyMessage::getSenderUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        return senderIds.isEmpty() ? Map.of() : userLookupPort.findContacts(senderIds);
    }

    /**
     * 组装<b>下发给别人</b>的消息视图：补上发送人展示名与头像。
     *
     * <p>收口在这里而不是散落在两个调用点，是为了让「历史查询」与「实时下行」两条路径
     * <b>必然</b>给出同一份字段——但凡有一处忘了补，对方看到的就是一条头像退化成兜底首字符的
     * 消息，而这类「只在群聊、只在某些入端出现」的不一致极难被人工发现。</p>
     *
     * @param row     消息行
     * @param readers 已读人（可为 {@code null}，由 {@code NotifyMessageVO} 归一成空列表）
     * @param senders {@link #loadSenders} 的结果
     */
    private static NotifyMessageVO toIncomingVO(NotifyMessage row, List<ChatReaderVO> readers,
                                                Map<Long, UserLookupPort.UserContact> senders) {
        UserLookupPort.UserContact sender = senders.get(row.getSenderUserId());
        return NotifyMessageVO.from(row, readers,
                sender == null ? null : sender.displayName(),
                sender == null ? null : sender.avatarUrl());
    }

    /**
     * 订阅某会话对端的在线状态，并返回其当前值（一次往返完成「拉取 + 订阅」）。
     *
     * <p><b>只支持单聊：</b>在线状态是「一个人」的属性，群聊没有单一对端（「群里有几人在线」
     * 是另一个产品命题，需要成员聚合与展示口径，属独立设计）。群聊请求以参数错误明确拒绝，
     * 而不是返回一个含糊的空状态——含糊的返回值会让前端误以为「拿到了，只是对方离线」。</p>
     *
     * <p><b>不校验目标是否存在 / 可用：</b>与 {@link #send} 不同，本方法不产生任何持久事实，
     * 也不向目标投递任何东西（只读 Redis 里的活跃记录）。已注销、已禁用、从未登录的用户
     * 自然没有活跃记录，返回 {@code OFFLINE} 恰好就是事实本身。反过来若在这里做一次
     * {@link UserLookupPort#existsActiveUser} 查询，就等于把「会话打开期间每 30s 一次」的
     * 热路径压到 DB 上——而这条路径本来完全不碰 DB（见 P-8：Redis 是加速面）。</p>
     *
     * @param userId   订阅者（当前登录用户，取登录态）
     * @param scope    会话范围：仅 1-单聊
     * @param targetId 被观察的用户 ID（不能是自己）
     * @return 对端当前三态（{@code lastActiveAt} 为最近活跃时刻，离线为 null）
     */
    public ChatPresenceVO watchPresence(Long userId, Integer scope, Long targetId) {
        int effectiveScope = validateScope(scope);
        if (targetId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "会话目标不能为空");
        }
        if (ChatScope.isGroup(effectiveScope)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "群聊暂不支持在线状态");
        }
        if (targetId.equals(userId)) {
            // 自聊在单聊入口即被拒（见 resolveRecipients），状态订阅同样不该存在这种会话
            throw new BusinessException(ErrorCode.CHAT_TARGET_INVALID, "不能订阅自己的在线状态");
        }
        return wsPresenceService.watch(userId, targetId);
    }

    /**
     * 把「我正在输入」这一瞬时信号转发给对端（单聊）。
     *
     * <p><b>为什么走 HTTP 而不是新增一个上行 WebSocket 帧：</b>本项目的通道分工是刻意的不对称
     * ——<b>上行一律 HTTP（幂等键、业务错误码、限流、重试语义都在 HTTP 上），下行一律 WebSocket</b>。
     * 输入状态虽然不落库，但它同样是「客户端发起的一次业务请求」（需要限流、需要明确的参数错误、
     * 需要与消息投递同一把目标校验尺子），放进上行帧反而要在 WS 里重建一套错误回执，
     * 因此这里沿用它：上行 HTTP、下行帧（{@code TYPING}）。</p>
     *
     * <p><b>不做「是否已有会话关系」的校验：</b>那需要查消息表，而这是每 3s 一次的按键热路径
     * （客户端节流后仍是最频繁的请求）。代价是理论上可以给任意<b>存在的</b>用户发提示——
     * 接收端只在「正看着与该用户的会话」时才会渲染，且这条信号不产生任何持久痕迹；
     * 与之相对，给不存在 / 已禁用账号发信号毫无意义，故只保留「目标可用」这一道校验
     * （与 {@link #resolveRecipients} 同一把尺子）。</p>
     *
     * @param userId   输入者（当前登录用户，取登录态）
     * @param scope    会话范围：仅 1-单聊
     * @param targetId 对端用户 ID（消息接收人视角）
     * @param typing   {@code true} 开始 / 继续输入；{@code false} 停止输入
     */
    public void notifyTyping(Long userId, Integer scope, Long targetId, boolean typing) {
        int effectiveScope = validateScope(scope);
        if (targetId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "会话目标不能为空");
        }
        if (ChatScope.isGroup(effectiveScope)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "群聊暂不支持输入状态");
        }
        if (targetId.equals(userId)) {
            throw new BusinessException(ErrorCode.CHAT_TARGET_INVALID, "不能给自己发送单聊消息");
        }
        if (!userLookupPort.existsActiveUser(targetId)) {
            throw new BusinessException(ErrorCode.CHAT_TARGET_INVALID, "目标用户不存在或不可用");
        }
        // 载荷的 chatTargetId 是「接收人视角」的会话目标（＝输入者本人），
        // 与已读回执同一口径：对端拿它与自己当前打开的会话比对（见 ChatTypingVO 类注）。
        // 只推给对端、不推给输入者自己的其他连接——否则同账号的其他标签页会把
        // 「我自己在输入」渲染成「对方正在输入」
        wsBroadcaster.push(targetId,
                WsFrame.of(WsProtocol.TYPE_TYPING, new ChatTypingVO(effectiveScope, userId, typing)));
        log.debug("输入状态已转发：from={}, to={}, typing={}", userId, targetId, typing);
    }

    /** 入参形状校验：范围 / 消息体类型 / 正文字数（对齐列宽与配置上限）。 */
    private void validateShape(int scope, int messageType, String content) {
        validateScope(scope);
        if (!MessageType.isChatBody(messageType)) {
            // 会话不得承载 SYSTEM(0)：那是系统通知的渲染方式，混进来会让前端会话列表渲染出系统卡片
            throw new BusinessException(ErrorCode.CHAT_MESSAGE_TYPE_INVALID);
        }
        int max = properties.getContentMaxLength();
        if (content != null && content.length() > max) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "消息内容超长（上限 " + max + " 字符）");
        }
    }

    private int validateScope(Integer scope) {
        if (scope == null || !ChatScope.isValid(scope)) {
            throw new BusinessException(ErrorCode.CHAT_TARGET_INVALID, "会话范围非法：" + scope);
        }
        return scope;
    }

    /** 联系信息 → 会话目标视图（只见目标 ID、展示名与头像，见 {@code ChatTargetVO} 类注）。 */
    private static ChatTargetVO toTarget(UserLookupPort.UserContact contact) {
        return new ChatTargetVO(contact.userId(), contact.displayName(), contact.avatarUrl());
    }

    /**
     * 解析「看起来像用户 ID」的入参：纯数字且在 {@code Long} 范围内才认，其余返回 {@code null}。
     *
     * <p>这一步只在账号匹配落空后兜底，因此不需要区分「数字账号」与「用户 ID」的歧义——
     * 数字账号会先在账号那一步命中；而真实雪花 ID 有 19 位，
     * 与一个恰好纯数字的账号撞号的概率可忽略。</p>
     */
    private static Long parseUserId(String keyword) {
        if (!keyword.chars().allMatch(Character::isDigit)) {
            return null;
        }
        try {
            long value = Long.parseLong(keyword);
            return value > 0 ? value : null;
        } catch (NumberFormatException e) {
            // 超出 Long 上限的数字串：不是合法用户 ID，按「查无此人」处理
            return null;
        }
    }

    /**
     * 解析接收人清单（含校验）：单聊=双方；群聊=全部成员。
     *
     * <p>这是「非成员拒收」的唯一落点——所有发送路径都必须经过它，
     * 因此不存在「绕过校验的旁路」（如直接调 Mapper）导致越权投递。</p>
     */
    private List<Long> resolveRecipients(Long senderId, int scope, Long targetId) {
        if (scope == ChatScope.PRIVATE) {
            if (targetId.equals(senderId)) {
                throw new BusinessException(ErrorCode.CHAT_TARGET_INVALID, "不能给自己发送单聊消息");
            }
            if (!userLookupPort.existsActiveUser(targetId)) {
                // 含「已禁用 / 已注销」：投递给无法登录的账号只会沉淀成无人认领的未读
                throw new BusinessException(ErrorCode.CHAT_TARGET_INVALID, "目标用户不存在或不可用");
            }
            return List.of(senderId, targetId);
        }

        if (groupMemberMapper.countMember(targetId, senderId) <= 0) {
            throw new BusinessException(ErrorCode.CHAT_NOT_GROUP_MEMBER);
        }
        List<Long> members = groupMemberMapper.selectMemberUserIds(targetId);
        if (members.isEmpty()) {
            throw new BusinessException(ErrorCode.CHAT_TARGET_INVALID, "群组不存在或已解散");
        }
        // 去重但保序：同一用户理论上不会重复入组，防御历史脏数据造成重复落行
        LinkedHashSet<Long> unique = new LinkedHashSet<>(members);
        unique.add(senderId);
        if (unique.size() > MAX_FANOUT_RECIPIENTS) {
            // 写扩散的成本随成员数线性增长；CE 群规模有硬上限，超出即视为异常数据
            throw new BusinessException(ErrorCode.CHAT_TARGET_INVALID, "群成员数超出上限，无法投递");
        }
        return new ArrayList<>(unique);
    }

    /**
     * 为每个接收人生成一行。
     *
     * <p>{@code chatTargetId} 的语义按接收人视角写：单聊时<b>互指对方</b>
     * （A 那行记 B、B 那行记 A），这样各自按 {@code (scope, target)} 查会话历史时
     * 都能得到完整双向记录；群聊时所有人统一记 groupId。</p>
     *
     * <p>{@code mentioned} 只对 {@code mentionTargets} 里的接收人置 1：发送人自己那一行
     * 必然不在其中（{@link #resolveMentionTargets} 已剔除自己），
     * 因此「自己 @ 自己」不会给发送人制造一个假角标。</p>
     */
    private List<NotifyMessage> buildRows(Long senderId, int scope, ChatSendDTO dto,
                                          List<Long> recipients, NotifyMessage quoted,
                                          Set<Long> mentionTargets) {
        boolean group = ChatScope.isGroup(scope);
        List<NotifyMessage> rows = new ArrayList<>(recipients.size());
        for (Long recipient : recipients) {
            NotifyMessage row = new NotifyMessage();
            row.setRecipientUserId(recipient);
            row.setSenderUserId(senderId);
            row.setNotifyType(group ? NotifyType.IM_GROUP : NotifyType.IM_PRIVATE);
            row.setMessageType(dto.messageType());
            row.setChatScope(scope);
            row.setChatTargetId(group ? dto.targetId() : otherSide(senderId, recipient, dto.targetId()));
            row.setClientMsgId(dto.clientMsgId());
            row.setContent(dto.content());
            // 提及标记只落在被点名者那一行：这是「行级属性」，同一条消息在不同接收人那里取值不同
            row.setMentioned(mentionTargets.contains(recipient)
                    ? NotifyMessage.MENTION_YES : NotifyMessage.MENTION_NONE);
            // 引用快照抄进每一行：接收人各自的视角里都要能渲染出「这是回复谁的哪句话」，
            // 而他们的那一行与发送人那一行是彼此独立的记录，无法事后互相回查
            applyQuote(row, quoted);
            // 自己那一行直接置读：不给发送人制造「自己发的消息未读」
            boolean self = recipient.equals(senderId);
            row.setReadStatus(self ? NotifyMessage.READ_READ : NotifyMessage.READ_UNREAD);
            if (self) {
                row.setReadTime(LocalDateTime.now());
            }
            rows.add(row);
        }
        return rows;
    }

    /**
     * 解析 {@code @} 提及目标：与接收人清单取交集，<b>非法项静默剔除而不报错</b>。
     *
     * <p><b>为什么剔除而不报错：</b>本字段的唯一作用是「给被点名者的那一行打个标记」，
     * 它<b>不改变投递范围</b>——接收人只由 {@link #resolveRecipients} 决定，而那里已经做过
     * 完整的成员校验。因此「@ 了一个不在本会话的人」不会造成越权投递、不会泄露任何信息，
     * 最坏结果只是没人被高亮。而报错的代价是实打实的：前端的成员列表可能因
     * 「刚有人退群 / 缓存过期」而携带一个已失效的 ID，此时若整条消息发送失败，
     * 用户看到的是「消息发不出去」——为一个装饰性标记牺牲主功能，方向是反的。</p>
     *
     * <p>剔除的三类：<b>非本会话成员</b>（不在 {@code recipients} 内）、
     * <b>发送人自己</b>（自己 @ 自己只会给自己制造假角标）、<b>重复项</b>（同一人传了多次）。</p>
     *
     * <p><b>单聊恒返回空集</b>：单聊的对方本来就是唯一读者，「点名」不产生任何额外语义；
     * 若在此放行，单聊界面就会出现「对方 @ 了我」这种本不存在的概念。</p>
     *
     * @param senderId       发送人（自己 @ 自己会被剔除）
     * @param scope          会话范围（单聊恒为空集）
     * @param recipients     已经过成员校验的接收人清单（交集边界）
     * @param mentionUserIds 客户端提交的提及对象；可为 {@code null}
     *                       ——引用类消息与未升级的客户端都不带这个字段
     * @return 实际生效的提及目标（可能为空集，不可变）
     */
    private Set<Long> resolveMentionTargets(Long senderId, int scope,
                                            List<Long> recipients, List<Long> mentionUserIds) {
        if (mentionUserIds == null || mentionUserIds.isEmpty() || !ChatScope.isGroup(scope)) {
            return Set.of();
        }
        // 用集合而不是遍历 recipients 做包含判定：本方法在群聊发送热路径上，
        // 成员上限 500，集合的 O(1) 判定比线性查找更稳妥（也让下面这段保持线性一趟）
        Set<Long> allowed = new HashSet<>(recipients);
        Set<Long> targets = new LinkedHashSet<>();
        int dropped = 0;
        for (Long userId : mentionUserIds) {
            if (userId == null || userId.equals(senderId) || !allowed.contains(userId)) {
                dropped++;
                continue;
            }
            targets.add(userId);
        }
        if (dropped > 0) {
            // 不打断发送：这是装饰性标记，剔除了哪些只对排查有意义
            log.debug("会话消息提及对象已剔除非法项：sender={}, requested={}, applied={}, dropped={}",
                    senderId, mentionUserIds.size(), targets.size(), dropped);
        }
        return targets;
    }

    /** 单聊视角下的对端：接收人是发送人时看 targetId，否则看发送人。 */
    private static Long otherSide(Long senderId, Long recipient, Long targetId) {
        return recipient.equals(senderId) ? targetId : senderId;
    }

    /** 提交后推送：逐行推给各自的接收人（跨实例由 Redis 扇出）。 */
    private void pushAll(List<NotifyMessage> rows) {
        // 发送人身份（展示名 + 头像）先一次批量查好再逐行推：实时帧与历史查询必须给出同一份字段，
        // 否则会出现「刚收到的消息头像是首字符、重拉一次历史才变成图片」这种只在时序上暴露的不一致
        Map<Long, UserLookupPort.UserContact> senders = loadSenders(rows);
        for (NotifyMessage row : rows) {
            try {
                wsBroadcaster.push(row.getRecipientUserId(),
                        WsFrame.of(WsProtocol.TYPE_CHAT, toIncomingVO(row, List.of(), senders)));
            } catch (Exception e) {
                // 单行推送失败不应影响同一条消息的其他接收人（群聊下尤其重要）
                log.warn("会话消息推送失败（消息已落库，接收端将退化为补拉）：recipient={}, id={}, cause={}",
                        row.getRecipientUserId(), row.getId(), e.getMessage());
            }
        }
    }

    /**
     * 提交后推送撤回：逐行推给「该行视角下的接收人」（含撤回者自己的其他端）。
     *
     * <p>载荷里的 {@code chatTargetId} 取<b>该行</b>的值而不是入参：单聊下发送人那行的
     * {@code chatTargetId} 是对端、对端那行才是发送人，逐行下发才能让每一端都直接与
     * 当前打开的会话比对。</p>
     *
     * <p>与消息推送同样的容错口径：单行失败只记日志。撤回已是库里的既成事实，
     * 接收端最坏表现为「重拉历史后才看到已撤回」。</p>
     */
    private void pushRecall(List<NotifyMessage> rows, LocalDateTime recallTime) {
        for (NotifyMessage row : rows) {
            try {
                wsBroadcaster.push(row.getRecipientUserId(),
                        WsFrame.of(WsProtocol.TYPE_CHAT_RECALL, new ChatRecallVO(
                                row.getClientMsgId(), row.getSenderUserId(),
                                row.getChatScope(), row.getChatTargetId(), recallTime)));
            } catch (Exception e) {
                log.warn("会话消息撤回推送失败（撤回已落库，接收端将退化为补拉）：recipient={}, clientMsgId={}, cause={}",
                        row.getRecipientUserId(), row.getClientMsgId(), e.getMessage());
            }
        }
    }

    /**
     * 引用校验并取快照来源（非引用发送返回 {@code null}）。
     *
     * <p>三重校验，任一不成立即拒绝（{@code 1036}）：</p>
     * <ol>
     *   <li><b>在本会话内</b>——否则引用块里会出现一句与本会话无关的话，
     *       读者既不知道上下文、也无法在原会话里找到它（跨会话引用在群聊里还等于
     *       把另一个会话的内容搬了过来，是一条隐性的越权读取路径）；</li>
     *   <li><b>未被撤回</b>——撤回时正文已清空，引用它只会渲染出一个空白引用块；</li>
     *   <li><b>我能看到</b>——查询按 {@code recipient_user_id = 我} 取，天然只命中我视角下的消息，
     *       别人会话里的消息在这里查不到。</li>
     * </ol>
     *
     * @return 被引用消息（仅用到 {@code clientMsgId / senderUserId / content} 三项）
     */
    private NotifyMessage resolveQuote(Long senderId, int scope, Long targetId, String quoteClientMsgId) {
        if (quoteClientMsgId == null || quoteClientMsgId.isBlank()) {
            return null;
        }
        NotifyMessage quoted = notifyMessageMapper.selectQuotableMessage(senderId, quoteClientMsgId.trim());
        if (quoted == null || quoted.isRecalled()
                || !Objects.equals(quoted.getChatScope(), scope)
                || !Objects.equals(quoted.getChatTargetId(), targetId)) {
            throw new BusinessException(ErrorCode.CHAT_QUOTE_TARGET_INVALID);
        }
        return quoted;
    }

    /** 把引用快照写入待落库的行（{@code quoted} 为空时是普通消息，原样不变）。 */
    private static void applyQuote(NotifyMessage row, NotifyMessage quoted) {
        if (quoted == null) {
            return;
        }
        row.setQuoteClientMsgId(quoted.getClientMsgId());
        row.setQuoteSenderUserId(quoted.getSenderUserId());
        row.setQuoteContent(snapshot(quoted.getMessageType(), quoted.getContent()));
    }

    /**
     * 截取引用正文快照。
     *
     * <p><b>先剥尾注、再截断：</b>文件消息的正文末尾挂着 {@code #file:} / {@code #att:} 尾注
     * （口径见 {@link ChatFileCardText}），那是给卡片点击用的机器可读信息。快照是要直接
     * 画进引用块的文本，剥晚了不只是把这串雪花 ID 露给用户，还会白吃掉 200 码点的配额，
     * 把真正的正文挤出快照。</p>
     *
     * <p>截断按<b>码点</b>而不是 {@code char}：直接 {@code substring(0, 200)} 会把 emoji 之类的
     * 代理对从中间切开，留下一个孤立代理——存入 utf8mb4 列时可能变成乱码或直接写入失败；
     * 本系统消息正文允许表情，故按码点截。</p>
     */
    private static String snapshot(Integer messageType, String content) {
        String display = ChatFileCardText.displayText(messageType, content);
        if (display == null) {
            return "";
        }
        if (display.codePointCount(0, display.length()) <= QUOTE_SNAPSHOT_MAX) {
            return display;
        }
        return display.substring(0, display.offsetByCodePoints(0, QUOTE_SNAPSHOT_MAX));
    }

    /**
     * 是否已超出撤回时间窗（{@link #RECALL_WINDOW}）。
     *
     * <p>{@code createTime} 为空（异常数据）时<b>放行</b>：撤回只能作用于本人消息，
     * 误放行的最坏结果是「用户撤掉了一条自己的老消息」，而误拦截会让用户
     * 对着一条刚发出的消息反复点撤回却无从理解。</p>
     */
    private static boolean isRecallExpired(LocalDateTime createTime, LocalDateTime now) {
        return createTime != null && createTime.plus(RECALL_WINDOW).isBefore(now);
    }

    /**
     * 幂等回查：同一发送人 + 会话 + 客户端消息 ID 即同一条逻辑消息。
     *
     * <p>不加 {@code recipient} 条件是有意的——发送人自身的行与对端的行共享同一组
     * {@code (sender, scope, target, clientMsgId)}，任取一行都能代表这条消息。</p>
     */
    private NotifyMessage findExisting(Long senderId, int scope, Long targetId, String clientMsgId) {
        LambdaQueryWrapper<NotifyMessage> wrapper = Wrappers.lambdaQuery(NotifyMessage.class)
                .eq(NotifyMessage::getSenderUserId, senderId)
                .eq(NotifyMessage::getChatScope, scope)
                .eq(NotifyMessage::getChatTargetId, targetId)
                .eq(NotifyMessage::getClientMsgId, clientMsgId)
                .last("limit 1");
        return notifyMessageMapper.selectOne(wrapper);
    }

    /**
     * 幂等回查的<b>当前读</b>版本——仅供并发撞键分支使用。
     *
     * <p><b>为什么不能复用 {@link #findExisting}：</b>普通 {@code select} 是一致性读，其快照在
     * {@code insert} 之前那次前置幂等查询时就已建立，而对手的事务是在那之后才提交的。撞键后再用
     * 同一快照回查，读到的仍然是「没有这一行」，兜底分支于是永远走不通。
     * {@code for share} 是当前读，不受旧快照约束（真库佐证见
     * {@code ChatSendIdempotencyE2eIntegrationTest} 的隔离级别机理探针）。</p>
     *
     * <p><b>为什么是 {@code for share} 而不是 {@code for update}：</b>撞键的 {@code insert} 本身
     * 已在冲突行上留下共享锁，{@code for update} 会把它升级为排他锁；多个并发重发方同时升级
     * 就会互相等待，把「重发」问题变成死锁问题。共享锁之间相容，且本查询只读不写。</p>
     *
     * <p>查询维度与 {@link #findExisting} 保持一致（不含 {@code recipient}）：一条逻辑消息的多行
     * 共享同一组 {@code (sender, scope, target, clientMsgId)}，任取一行都代表它。</p>
     */
    private NotifyMessage findExistingForShare(Long senderId, int scope, Long targetId, String clientMsgId) {
        LambdaQueryWrapper<NotifyMessage> wrapper = Wrappers.lambdaQuery(NotifyMessage.class)
                .eq(NotifyMessage::getSenderUserId, senderId)
                .eq(NotifyMessage::getChatScope, scope)
                .eq(NotifyMessage::getChatTargetId, targetId)
                .eq(NotifyMessage::getClientMsgId, clientMsgId)
                // 「单行 + 当前读」必须写在同一个 last 里：拆成两段会生成非法 SQL
                .last("limit 1 for share");
        return notifyMessageMapper.selectOne(wrapper);
    }

    private int normalizeHistoryLimit(Integer limit) {
        int max = properties.getChatHistoryLimit();
        if (limit == null || limit <= 0) {
            return max;
        }
        return Math.min(limit, max);
    }

    /** 会话列表条数收敛：与历史翻页同一套「缺省取上限、超出即截断」口径。 */
    private int normalizeConversationLimit(Integer limit) {
        int max = properties.getChatConversationLimit();
        if (limit == null || limit <= 0) {
            return max;
        }
        return Math.min(limit, max);
    }

    /** 是否单聊——决定「反查用户展示名还是群名」（见 conversations 注释）。 */
    private static boolean isPrivateChat(Integer scope) {
        return scope != null && !ChatScope.isGroup(scope);
    }

    /**
     * 会话名解析：单聊取对端展示名、群聊取群名；两者都可能在批量查询里缺失
     * （用户已注销 / 群已解散或已逻辑删除），此时返回 {@code null}，
     * 由前端回落为「用户 #id」「群聊 #id」。
     *
     * <p><b>不因为名字查不到就丢掉这条会话</b>：名字只是展示层信息，
     * 消息本身仍可见。为展示信息牺牲可用性不划算。</p>
     *
     * <p><b>{@code scope} 为 {@code null} 时走群聊分支</b>：{@link #isPrivateChat} 对
     * {@code null} 返回 {@code false}，即「不是单聊就按群聊处理」。这与发送侧的
     * scope 校验（{@code null} 直接拒绝）不同——这里是读历史数据，
     * 遇到脏 scope 应尽量显示而不是整条报错。</p>
     */
    private static String resolveTargetName(ConversationSummary summary,
                                            Map<Long, UserLookupPort.UserContact> contacts,
                                            Map<Long, String> groupNames) {
        if (!isPrivateChat(summary.getChatScope())) {
            return groupNames.get(summary.getChatTargetId());
        }
        UserLookupPort.UserContact contact = contacts.get(summary.getChatTargetId());
        return contact == null ? null : contact.displayName();
    }

    /**
     * 会话头像：单聊=对端头像对外地址，群聊恒 {@code null}。
     *
     * <p>与 {@link #resolveTargetName} <b>逐字同口径</b>，连「查不到就回落 {@code null}」都一样。
     * 之所以拆成两个方法而不是合成一个「取名字与头像」的方法：两者只依赖各自需要的入参——
     * 群头像将来若要落库（群有了头像概念），只改这一处即可，而群名的回落链
     * （{@code sys_group} 查不到就回落「群聊 #id」）不受牵连。</p>
     *
     * <p><b>复用同一份 {@code contacts}，不额外查询：</b>{@link #conversations} 已为单聊对端
     * 批量反查过一次，这里只是取字段。</p>
     *
     * @param summary  会话聚合行
     * @param contacts 单聊对端联系信息
     * @return 头像对外地址；群聊、对端没设过头像、对端已不在用户目录时均为 {@code null}
     */
    private static String resolveTargetAvatar(ConversationSummary summary,
                                              Map<Long, UserLookupPort.UserContact> contacts) {
        if (!isPrivateChat(summary.getChatScope())) {
            return null;
        }
        UserLookupPort.UserContact contact = contacts.get(summary.getChatTargetId());
        return contact == null ? null : contact.avatarUrl();
    }

    /**
     * 这条消息是不是「我本人发出的」——会话列表据此决定摘要前缀与未读口径。
     *
     * <p><b>为什么只比 {@code sender} 与 {@code recipient}，不比对「当前用户 ID」：</b>
     * 写扩散下「我发出的每一行」都是 {@code recipient = sender = 我}（单聊落两行、群聊落 N 行，
     * 我的那一行只发给我自己），这个等式在单聊与群聊里同样成立；而登录态里并没有可信的
     * 用户主键可拿来比较。把判定收敛到这一行数据自身，也顺带避免了「拿错 userId」这类
     * 只会表现为「自己的消息显示在左边」的隐蔽错位。</p>
     */
    private static boolean isSelfSent(NotifyMessage message) {
        Long sender = message.getSenderUserId();
        return sender != null && sender.equals(message.getRecipientUserId());
    }
}
