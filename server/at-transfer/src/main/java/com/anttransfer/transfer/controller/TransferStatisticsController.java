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
package com.anttransfer.transfer.controller;

import com.anttransfer.common.result.Result;
import com.anttransfer.transfer.model.vo.TransferStatisticsVO;
import com.anttransfer.transfer.security.CurrentUserContext;
import com.anttransfer.transfer.service.TransferStatisticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 传输统计端点（工作台 P0 数据总览）。
 *
 * <p><b>为什么不需要权限点</b>：只返回调用者自己的聚合数字（SQL 按 {@code user_id} 限定），
 * 不含他人或全局数据，属「登录即可用」的自助视图——与前端工作台路由不挂权限点的口径一致
 * （见 {@code web/src/services/access/route-perm.ts}）。要加权限点就得先给所有角色授一个
 * 「只能看自己」的权限，那是把「登录」又表达了一遍。</p>
 *
 * <p><b>为什么没有请求参数</b>：用户 ID 只从登录态取（{@link CurrentUserContext}）。
 * 一旦开放成 {@code ?userId=}，越权查看他人传输量只需改一个数字。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/transfers")
public class TransferStatisticsController {

    private final TransferStatisticsService transferStatisticsService;

    public TransferStatisticsController(TransferStatisticsService transferStatisticsService) {
        this.transferStatisticsService = transferStatisticsService;
    }

    /**
     * 我的传输统计总览（口径见 {@link TransferStatisticsVO}）。
     */
    @GetMapping("/statistics")
    public Result<TransferStatisticsVO> statistics() {
        return Result.ok(transferStatisticsService.statistics(CurrentUserContext.currentUserId()));
    }
}
