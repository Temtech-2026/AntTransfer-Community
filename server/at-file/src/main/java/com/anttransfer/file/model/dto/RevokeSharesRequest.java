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
package com.anttransfer.file.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 批量失效外发链接请求（分享管理页「失效所选」）。
 *
 * <p><b>为什么用令牌而不是主键</b>：{@code token} 是链接对外唯一的标识（列表页也以它为 rowKey），
 * 前端拿到的本来就是令牌；更重要的是服务端仍在 SQL 里用 {@code owner_user_id} 收口，
 * 把别人的令牌传进来只会匹配不到任何行——既不报错，也不泄露「该令牌是否存在」，
 * 与 {@code ShareLinkService#requireOwnedLink} 的「不可区分」口径一致。</p>
 *
 * <p>上限 200 与文件域「批量移入回收站」同口径（见 `docs/api/README.md` §3 上界约定）：
 * 既是防御性限制，也保证 {@code IN (...)} 语句不会因超长而退化成全表扫描。</p>
 *
 * @author AntTransfer CE
 */
@Data
public class RevokeSharesRequest {

    /** 待失效的链接令牌；允许含重复 / 首尾空白，服务端统一去重规整 */
    @NotEmpty(message = "分享令牌列表不能为空")
    @Size(max = 200, message = "单次最多失效 200 条分享链接")
    private List<@NotBlank(message = "分享令牌不能为空白") String> tokens;
}
