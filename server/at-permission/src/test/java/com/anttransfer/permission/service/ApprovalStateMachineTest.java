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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * {@link ApprovalStateMachine} 全分支单元测试：迁移合法性、活动态 / 终态判定、非法流转抛错。
 *
 * @author AntTransfer CE
 */
@DisplayName("申请单状态机 · 全分支")
class ApprovalStateMachineTest {

    @ParameterizedTest(name = "[{index}] 合法迁移 {0} → {1}")
    @CsvSource({
            // 待审：通过 / 驳回 / 转审 / 撤销
            "0, 1",
            "0, 2",
            "0, 3",
            "0, 4",
            // 转审途中：回归待审 / 通过 / 驳回 / 撤销
            "3, 0",
            "3, 1",
            "3, 2",
            "3, 4"
    })
    @DisplayName("合法迁移：canTransit=true 且 assertTransit 不抛错")
    void shouldAllowLegalTransitions(int from, int to) {
        assertThat(ApprovalStateMachine.canTransit(from, to)).isTrue();
        assertThatCode(() -> ApprovalStateMachine.assertTransit(from, to)).doesNotThrowAnyException();
    }

    @ParameterizedTest(name = "[{index}] 非法迁移 {0} → {1}")
    @CsvSource({
            // 终态无出边
            "1, 0", "1, 1", "1, 2", "1, 3", "1, 4",
            "2, 0", "2, 1", "2, 2", "2, 3", "2, 4",
            "4, 0", "4, 1", "4, 2", "4, 3", "4, 4",
            // 自环（待审 / 转审不可原地打转）
            "0, 0",
            "3, 3",
            // 未知源状态
            "99, 0"
    })
    @DisplayName("非法迁移：canTransit=false 且 assertTransit 抛 1011")
    void shouldRejectIllegalTransitions(int from, int to) {
        assertThat(ApprovalStateMachine.canTransit(from, to)).isFalse();
        BusinessException ex = assertThrows(BusinessException.class,
                () -> ApprovalStateMachine.assertTransit(from, to));
        assertThat(ex.getCode()).isEqualTo(ErrorCode.APPROVAL_STATE_ERROR.getCode());
    }

    @Test
    @DisplayName("空值：canTransit 恒 false，assertTransit 抛 1011")
    void shouldRejectNullTransitions() {
        assertThat(ApprovalStateMachine.canTransit(null, ApprovalRequest.STATUS_APPROVED)).isFalse();
        assertThat(ApprovalStateMachine.canTransit(ApprovalRequest.STATUS_PENDING, null)).isFalse();
        assertThat(ApprovalStateMachine.canTransit(null, null)).isFalse();
        assertThrows(BusinessException.class,
                () -> ApprovalStateMachine.assertTransit(null, ApprovalRequest.STATUS_APPROVED));
    }

    @ParameterizedTest
    @ValueSource(ints = {ApprovalRequest.STATUS_PENDING, ApprovalRequest.STATUS_TRANSFERRED})
    @DisplayName("活动态：待审(0) / 转审(3) → isActive=true, isFinal=false")
    void shouldTreatPendingAndTransferredAsActive(int status) {
        assertThat(ApprovalStateMachine.isActive(status)).isTrue();
        assertThat(ApprovalStateMachine.isFinal(status)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(ints = {ApprovalRequest.STATUS_APPROVED, ApprovalRequest.STATUS_REJECTED,
            ApprovalRequest.STATUS_CANCELLED})
    @DisplayName("终态：通过(1) / 驳回(2) / 撤销(4) → isActive=false, isFinal=true")
    void shouldTreatTerminalStatesAsFinal(int status) {
        assertThat(ApprovalStateMachine.isActive(status)).isFalse();
        assertThat(ApprovalStateMachine.isFinal(status)).isTrue();
    }

    @Test
    @DisplayName("null / 未知状态：isActive=false；未知状态按终态处理（保持活动态不可被处置）")
    void shouldHandleNullAndUnknownStatus() {
        assertThat(ApprovalStateMachine.isActive(null)).isFalse();
        assertThat(ApprovalStateMachine.isFinal(null)).isFalse();
        assertThat(ApprovalStateMachine.isActive(99)).isFalse();
        assertThat(ApprovalStateMachine.isFinal(99)).isTrue();
    }
}
