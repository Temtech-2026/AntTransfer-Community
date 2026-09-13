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

import com.anttransfer.collaboration.model.vo.TodoItemVO;
import com.anttransfer.collaboration.security.CurrentUserContext;
import com.anttransfer.collaboration.service.NotifyMessageService;
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.result.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 待办中心端点：待我审批 / 审批结果 / 传输完成提醒（use-case-flows §2.1、§2.4）。
 *
 * <p>待办是 {@code sys_notify_message} 的一个投影视图（见 {@link TodoItemVO}），
 * 因此本控制器只有「查询」与「计数」——没有「创建待办」接口：
 * 待办由对应业务动作（提交申请 / 审批 / 传输完成）产生，若允许前端直接建待办，
 * 就会出现「有待办但业务单据不存在」的幽灵条目。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/todos")
public class TodoController {

    private final NotifyMessageService notifyMessageService;

    public TodoController(NotifyMessageService notifyMessageService) {
        this.notifyMessageService = notifyMessageService;
    }

    /**
     * 待办分页。
     *
     * @param pending {@code true}（默认）=仅未办；{@code false}=仅已办历史；
     *                传 {@code all}=全部（不按已读过滤，供「全部待办」页使用）
     */
    @GetMapping
    public Result<PageResult<TodoItemVO>> page(
            @RequestParam(required = false) String pending,
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long pageSize) {
        // 三态映射放在 Controller 而不是用 Boolean 直接接收：Boolean 无法表达「全部」，
        // 缺省值又会与「显式传 false」混为一谈（false 是「看已办」，不是「默认」）。
        Boolean pendingOnly = parsePending(pending);
        return Result.ok(notifyMessageService.pageTodo(
                CurrentUserContext.currentUserId(), pendingOnly, current, pageSize));
    }

    /** 待办角标数（未办计数，单值接口——角标轮询不需要拉整个快照）。 */
    @GetMapping("/count")
    public Result<Map<String, Long>> count() {
        long todo = notifyMessageService.unreadCount(CurrentUserContext.currentUserId()).todo();
        return Result.ok(Map.of("todo", todo));
    }

    private static Boolean parsePending(String pending) {
        if (pending == null || pending.isBlank() || "all".equalsIgnoreCase(pending)) {
            return null;
        }
        return Boolean.parseBoolean(pending);
    }
}
