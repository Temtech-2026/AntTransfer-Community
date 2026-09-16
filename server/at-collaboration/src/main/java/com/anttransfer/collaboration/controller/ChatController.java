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
package com.anttransfer.collaboration.controller;

import com.anttransfer.collaboration.model.dto.ChatSendDTO;
import com.anttransfer.collaboration.model.vo.ConversationVO;
import com.anttransfer.collaboration.model.vo.NotifyMessageVO;
import com.anttransfer.collaboration.security.CurrentUserContext;
import com.anttransfer.collaboration.service.ChatService;
import com.anttransfer.common.result.Result;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 单聊 / 群聊端点：发送、历史、已读。
 *
 * <p><b>为什么发送走 HTTP 而不是 WebSocket：</b>发送是「必须可靠」的写操作——
 * 需要落库、需要幂等键、需要在失败时把明确错误码（1012 非群成员 / 1013 目标无效）返回给调用方。
 * WebSocket 帧没有响应与重试语义，用它发送就必须在应用层重新发明 ACK、超时与去重；
 * 而 HTTP 天然具备这三样。实时性由「发送后服务端反向推送」保证：
 * <b>HTTP 上行、WebSocket 下行</b>，各用其长。</p>
 *
 * <p>因此 {@code POST /messages} 成功后，接收方（含发送方其他端）会通过 WebSocket
 * 收到 {@code CHAT} 帧；调用方无需再轮询。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    /** 发送会话消息（文本 / 文件传输通知 / 审批结果通知）。 */
    @PostMapping("/messages")
    public Result<NotifyMessageVO> send(@Valid @RequestBody ChatSendDTO dto) {
        return Result.ok(chatService.send(CurrentUserContext.currentUserId(), dto));
    }

    /**
     * 会话历史（倒序，向上翻页）。
     *
     * @param scope    1-单聊（targetId=对端用户 ID）；2-群聊（targetId=群组 ID）
     * @param targetId 会话目标
     * @param beforeId 游标：只返回 id 小于它的消息（首页不传）
     * @param limit    条数（服务端按 {@code notify.chat-history-limit} 收敛上限）
     */
    @GetMapping("/messages")
    public Result<List<NotifyMessageVO>> history(
            @RequestParam Integer scope,
            @RequestParam Long targetId,
            @RequestParam(required = false) Long beforeId,
            @RequestParam(required = false) Integer limit) {
        return Result.ok(chatService.history(
                CurrentUserContext.currentUserId(), scope, targetId, beforeId, limit));
    }

    /**
     * 会话已读（进入会话即调用，清该会话角标）。
     *
     * @return 本次置读条数
     */
    @PostMapping("/read")
    public Result<Integer> markRead(@RequestParam Integer scope, @RequestParam Long targetId) {
        return Result.ok(chatService.markRead(CurrentUserContext.currentUserId(), scope, targetId));
    }

    /**
     * 会话列表（聊天页左侧栏）。
     *
     * <p><b>为什么需要这个端点：</b>「发送 / 历史 / 已读」都以「已知 scope + targetId」为前提，
     * 而前端最初的困境恰恰是<b>不知道有哪些会话</b>——收件箱分页按产品口径排除了会话消息，
     * 离线补拉只给纯提醒类。本端点补上这一环，聊天页才可能落地。</p>
     *
     * <p><b>不挂权限点、登录即用</b>：查询维度写死为登录人本人（{@code CurrentUserContext}），
     * 调用方无法指定别人的收件人 ID，因此不存在「越权读他人会话」的入参面；
     * 这与 {@code /notifications}、{@code /messages} 的「只看得到自己的」口径一致。</p>
     *
     * @param limit 条数（服务端按 {@code notify.chat-conversation-limit} 收敛上限）
     */
    @GetMapping("/conversations")
    public Result<List<ConversationVO>> conversations(@RequestParam(required = false) Integer limit) {
        return Result.ok(chatService.conversations(CurrentUserContext.currentUserId(), limit));
    }
}
