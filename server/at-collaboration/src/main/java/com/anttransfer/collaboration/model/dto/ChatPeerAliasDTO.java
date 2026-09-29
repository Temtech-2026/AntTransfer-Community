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
package com.anttransfer.collaboration.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 设置会话对端备注的请求体。
 *
 * <p><b>为什么只有「设置」没有「传空即取消」：</b>让空串同时承担「清空备注」与
 * 「手滑提交了空输入框」两种含义，会逼服务端猜意图——而这两者的结果完全相反
 * （一个是删掉用户写过的名字，一个是应该被拦下来）。所以 {@code alias} 必须非空，
 * 取消备注走独立的 {@code DELETE}（见 {@code ChatController#clearPeerAlias}）。</p>
 *
 * @param alias 备注名（必填；上限 32 字，列宽 64 留余量）
 * @author AntTransfer CE
 */
public record ChatPeerAliasDTO(
        @NotBlank(message = "备注不能为空")
        @Size(max = 32, message = "备注最多 32 个字")
        String alias) {
}
