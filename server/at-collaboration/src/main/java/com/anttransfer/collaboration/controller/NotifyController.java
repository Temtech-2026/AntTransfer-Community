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

import com.anttransfer.collaboration.model.vo.NotifyMessageVO;
import com.anttransfer.collaboration.model.vo.UnreadCountVO;
import com.anttransfer.collaboration.security.CurrentUserContext;
import com.anttransfer.collaboration.service.NotifyMessageService;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.result.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 站内通知端点（US-08）。
 *
 * <p><b>所有接口的 userId 一律取自登录态</b>，不接受请求参数传入——否则
 * {@code ?userId=} 就是一个「读他人通知」的越权入口。这类漏洞不需要复杂的攻击链，
 * 只要有一个接口漏改就会长期潜伏，所以本模块统一用
 * {@link CurrentUserContext#currentUserId()}，不留任何以入参指定用户的口子。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/notifications")
public class NotifyController {

    private final NotifyMessageService notifyMessageService;

    public NotifyController(NotifyMessageService notifyMessageService) {
        this.notifyMessageService = notifyMessageService;
    }

    /** 未读三口径快照（导航栏红点 / 待办角标 / 会话角标）。 */
    @GetMapping("/unread")
    public Result<UnreadCountVO> unread() {
        return Result.ok(notifyMessageService.unreadCount(CurrentUserContext.currentUserId()));
    }

    /** 通知收件箱分页（含已读，按时间倒序）。 */
    @GetMapping
    public Result<PageResult<NotifyMessageVO>> page(
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long pageSize) {
        return Result.ok(notifyMessageService.pageInbox(
                CurrentUserContext.currentUserId(), current, pageSize));
    }

    /**
     * 离线补拉（重连后调用）：返回离线期间的未读提醒并置读，`count`/`chat` 口径不动。
     *
     * <p>只覆盖「纯提醒」类系统通知；待办三段的已读必须由处置动作驱动，
     * 不能被补拉顺带清掉（详见 {@link NotifyMessageService#pullOffline}）。</p>
     */
    @GetMapping("/offline")
    public Result<List<NotifyMessageVO>> pullOffline(
            @RequestParam(required = false) Integer limit) {
        return Result.ok(notifyMessageService.pullOffline(CurrentUserContext.currentUserId(), limit));
    }

    /** 单条已读（非本人消息抛 4040 资源不存在）。 */
    @PostMapping("/{id}/read")
    public Result<Boolean> markRead(@PathVariable Long id) {
        if (!notifyMessageService.markRead(CurrentUserContext.currentUserId(), id)) {
            // 抛异常而非返回 fail(...)：HTTP 状态由全局处理器统一映射（4040 → 404），
            // 直接返回 Result.fail 会得到「HTTP 200 + 业务码 4040」，与其余接口的错误语义不一致
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND);
        }
        return Result.ok(true);
    }

    /** 一键已读（清零系统通知红点，不影响会话消息）。 */
    @PostMapping("/read-all")
    public Result<Integer> markAllRead() {
        return Result.ok(notifyMessageService.markAllInboxRead(CurrentUserContext.currentUserId()));
    }
}
