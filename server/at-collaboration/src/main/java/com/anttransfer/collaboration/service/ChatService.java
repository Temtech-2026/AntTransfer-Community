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
import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.anttransfer.collaboration.model.vo.NotifyMessageVO;
import com.anttransfer.collaboration.repository.GroupMemberMapper;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import com.anttransfer.collaboration.support.AfterCommitExecutor;
import com.anttransfer.collaboration.ws.WsBroadcaster;
import com.anttransfer.collaboration.ws.WsFrame;
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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

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

    /** 单聊 / 群聊「会话双方各一行」的最大接收人规模（群聊为成员数；仅用于日志与防御性判断） */
    private static final int MAX_FANOUT_RECIPIENTS = 500;

    private final NotifyMessageMapper notifyMessageMapper;
    private final GroupMemberMapper groupMemberMapper;
    private final UserLookupPort userLookupPort;
    private final WsBroadcaster wsBroadcaster;
    private final AfterCommitExecutor afterCommitExecutor;
    private final NotifyProperties properties;
    private final NotifyMessageService notifyMessageService;

    public ChatService(NotifyMessageMapper notifyMessageMapper,
                       GroupMemberMapper groupMemberMapper,
                       UserLookupPort userLookupPort,
                       WsBroadcaster wsBroadcaster,
                       AfterCommitExecutor afterCommitExecutor,
                       NotifyProperties properties,
                       NotifyMessageService notifyMessageService) {
        this.notifyMessageMapper = notifyMessageMapper;
        this.groupMemberMapper = groupMemberMapper;
        this.userLookupPort = userLookupPort;
        this.wsBroadcaster = wsBroadcaster;
        this.afterCommitExecutor = afterCommitExecutor;
        this.properties = properties;
        this.notifyMessageService = notifyMessageService;
    }

    /**
     * 发送一条会话消息。
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

        NotifyMessage existed = findExisting(senderId, scope, dto.targetId(), dto.clientMsgId());
        if (existed != null) {
            // 幂等重放：上次已落库（且已推送），本次不重复落库、不重复推送
            log.debug("会话消息重复发送，返回既有消息：sender={}, clientMsgId={}, id={}",
                    senderId, dto.clientMsgId(), existed.getId());
            return NotifyMessageVO.from(existed);
        }

        List<NotifyMessage> rows = buildRows(senderId, scope, dto, recipients);
        try {
            for (NotifyMessage row : rows) {
                notifyMessageMapper.insert(row);
            }
        } catch (DuplicateKeyException e) {
            // 并发重试：唯一索引 (sender, recipient, client_msg_id) 拦下第二条。
            // MySQL 下单语句失败不中止事务，可安全回查既有消息并返回。
            NotifyMessage replay = findExisting(senderId, scope, dto.targetId(), dto.clientMsgId());
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
     * 会话历史（倒序，向上翻页）。
     *
     * <p>查询维度是 {@code (recipientUserId, chatScope, chatTargetId)}：这就是写扩散换来的
     * 「会话查询 = 单表等值查询」，不需要 JOIN 会话表。{@code beforeId} 为游标翻页
     * （比 offset 翻页稳定——新消息到达不会让旧页内容错位）。</p>
     *
     * <p>群聊拉取同样校验成员关系：非成员不仅不能发，也不能读
     * （{@code 1012}），否则「退群后仍能读历史」会成为越权读通道。</p>
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

        return notifyMessageMapper.selectList(wrapper).stream().map(NotifyMessageVO::from).toList();
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

    /* ------------------------------------------------------------------ 内部实现 */

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
     */
    private List<NotifyMessage> buildRows(Long senderId, int scope, ChatSendDTO dto, List<Long> recipients) {
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

    /** 单聊视角下的对端：接收人是发送人时看 targetId，否则看发送人。 */
    private static Long otherSide(Long senderId, Long recipient, Long targetId) {
        return recipient.equals(senderId) ? targetId : senderId;
    }

    /** 提交后推送：逐行推给各自的接收人（跨实例由 Redis 扇出）。 */
    private void pushAll(List<NotifyMessage> rows) {
        for (NotifyMessage row : rows) {
            try {
                wsBroadcaster.push(row.getRecipientUserId(),
                        WsFrame.of(WsProtocol.TYPE_CHAT, NotifyMessageVO.from(row)));
            } catch (Exception e) {
                // 单行推送失败不应影响同一条消息的其他接收人（群聊下尤其重要）
                log.warn("会话消息推送失败（消息已落库，接收端将退化为补拉）：recipient={}, id={}, cause={}",
                        row.getRecipientUserId(), row.getId(), e.getMessage());
            }
        }
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

    private int normalizeHistoryLimit(Integer limit) {
        int max = properties.getChatHistoryLimit();
        if (limit == null || limit <= 0) {
            return max;
        }
        return Math.min(limit, max);
    }
}
