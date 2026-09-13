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
package com.anttransfer.permission.extension;

import com.anttransfer.common.approval.SensitiveDestroyApprovalPort;
import com.anttransfer.permission.repository.ApprovalRequestMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * {@link SensitiveDestroyApprovalPort} 的 at-permission 侧实现——把「审批单表归我所有」
 * 这件事封闭在本模块内，at-file 只见接口不见表。
 *
 * <p>刻意保持极薄：不做级别判定、不做状态判定（这些都是审批域知识，写在 SQL 里由本模块维护），
 * 也不做「是否已消费」的判定（那是调用方的生命周期问题，见 at-file 的一次性消费门禁）。</p>
 *
 * @author AntTransfer CE
 */
@Component
@RequiredArgsConstructor
public class SensitiveDestroyApprovalAdapter implements SensitiveDestroyApprovalPort {

    private final ApprovalRequestMapper approvalRequestMapper;

    @Override
    public String findApprovedHighSensitiveDestroy(Long applicantId, Long fileId) {
        if (applicantId == null || fileId == null) {
            return null;
        }
        return approvalRequestMapper.findApprovedHighSensitiveDestroy(applicantId, fileId);
    }
}
