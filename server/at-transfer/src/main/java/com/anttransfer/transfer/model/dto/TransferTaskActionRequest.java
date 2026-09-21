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
package com.anttransfer.transfer.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 任务状态迁移请求（PATCH {@code /v1/transfers/{uploadId}}）。
 *
 * <p>暂停与恢复共用一个部分更新端点、以 {@code action} 区分：两者作用对象是同一个资源的同一个字段
 * （{@code sys_upload_task.status}），拆成 {@code /pause}、{@code /resume} 两个动作端点会
 * 与 REST 语义（PATCH = 部分更新）重复，也让前端多两处错误处理。</p>
 *
 * @param action 迁移动作：{@code pause} 暂停 / {@code resume} 恢复
 * @author AntTransfer CE
 */
public record TransferTaskActionRequest(
        @NotBlank(message = "迁移动作不能为空")
        @Pattern(regexp = "pause|resume", message = "迁移动作仅支持 pause 或 resume")
        String action) {
}
