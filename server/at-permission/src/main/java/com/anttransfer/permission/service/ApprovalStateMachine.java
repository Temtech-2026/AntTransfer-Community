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
package com.anttransfer.permission.service;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.permission.model.entity.ApprovalRequest;

import java.util.Map;
import java.util.Set;

/**
 * 申请单状态机（唯一权威迁移表）。
 *
 * <pre>
 *   0 待审 ──▶ 1 通过（终态）
 *        ├──▶ 2 驳回（终态）
 *        ├──▶ 3 转审 ──▶ 0 待审（改指审批人后回归待审，可继续流转）
 *        └──▶ 4 撤销（终态）
 * </pre>
 *
 * <p>本类只做<b>合法性判定</b>；真正的状态迁移一律由调用方以 CAS
 * （{@code UPDATE ... WHERE id=? AND status=?}）+ 影响行数校验落地（红线 P-1 / [C-06]），
 * 二者配合才能既保证「非法流转被拒」又保证「并发下只有一个赢家」。</p>
 *
 * @author AntTransfer CE
 */
public final class ApprovalStateMachine {

    /** 迁移表：源状态 → 允许到达的下一状态集合（终态无出边） */
    private static final Map<Integer, Set<Integer>> TRANSITIONS = Map.of(
            ApprovalRequest.STATUS_PENDING, Set.of(
                    ApprovalRequest.STATUS_APPROVED,
                    ApprovalRequest.STATUS_REJECTED,
                    ApprovalRequest.STATUS_TRANSFERRED,
                    ApprovalRequest.STATUS_CANCELLED),
            ApprovalRequest.STATUS_TRANSFERRED, Set.of(
                    ApprovalRequest.STATUS_PENDING,
                    ApprovalRequest.STATUS_APPROVED,
                    ApprovalRequest.STATUS_REJECTED,
                    ApprovalRequest.STATUS_CANCELLED),
            ApprovalRequest.STATUS_APPROVED, Set.of(),
            ApprovalRequest.STATUS_REJECTED, Set.of(),
            ApprovalRequest.STATUS_CANCELLED, Set.of());

    private ApprovalStateMachine() {
    }

    /** 是否为活动态（尚可被处置：待审 / 转审途中） */
    public static boolean isActive(Integer status) {
        return status != null
                && (status == ApprovalRequest.STATUS_PENDING
                || status == ApprovalRequest.STATUS_TRANSFERRED);
    }

    /** 是否为终态（通过 / 驳回 / 撤销） */
    public static boolean isFinal(Integer status) {
        return status != null && !isActive(status);
    }

    /** 迁移是否合法 */
    public static boolean canTransit(Integer from, Integer to) {
        if (from == null || to == null) {
            return false;
        }
        return TRANSITIONS.getOrDefault(from, Set.of()).contains(to);
    }

    /**
     * 断言迁移合法，否则抛 {@code 1011}（HTTP 409，前端刷新状态后重试）。
     */
    public static void assertTransit(Integer from, Integer to) {
        if (!canTransit(from, to)) {
            throw new BusinessException(ErrorCode.APPROVAL_STATE_ERROR,
                    "申请单状态不允许该操作：" + from + " → " + to);
        }
    }
}
