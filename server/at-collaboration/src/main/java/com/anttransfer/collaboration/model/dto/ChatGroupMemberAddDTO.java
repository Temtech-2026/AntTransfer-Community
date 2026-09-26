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

import com.anttransfer.collaboration.model.entity.SysGroup;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 邀请成员入参（一次可邀请多人）。
 *
 * <p><b>幂等口径：</b>已在群里的 ID 视为<b>成功</b>（跳过，不报错），而不是「重复邀请」错误。
 * 多人邀请里只要有一个人已在群，报错会让其余人的邀请一并回滚——调用方要么逐个重试、
 * 要么放弃，两种都糟。同理，被移除过又重新邀请的 ID 走「复活」路径（见
 * {@code GroupMemberMapper} 的唯一键取舍），对外同样是成功。</p>
 *
 * <p><b>为什么单次上限也是 500：</b>与 {@code ChatGroupCreateDTO} 同口径。
 * 这里限的是「一次请求的入参规模」（防止构造超长请求体），
 * 而「邀请后总人数是否超过群上限」是另一件事，由服务层按
 * {@code 现有人数 + 新增人数} 判定，两个判定的错误提示不同。</p>
 *
 * @param memberIds 受邀成员用户 ID 列表（服务端去重、剔除已在群者；不得含无效 / 不可用账号）
 * @author AntTransfer CE
 */
public record ChatGroupMemberAddDTO(
        @NotEmpty(message = "请至少邀请一位成员")
        @Size(max = SysGroup.MAX_MEMBERS, message = "单次邀请人数超出上限")
        List<@NotNull(message = "成员 ID 不能为空") Long> memberIds) {
}
