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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 创建群聊入参。
 *
 * <p><b>只有「群名 + 成员」两个字段：</b>群组类型恒为群聊、群主恒为创建者、状态恒为生效、
 * 描述留空。这些若都开成入参，调用方就能建出一个「我不是群主的群」或「类型是项目却当群聊用」
 * 的脏数据，而建群这一动作并不需要这些自由度。</p>
 *
 * <p><b>成员列表不含创建者：</b>创建者由服务端自动入群并担任群主，
 * 前端传不传、传不把自己都无所谓（服务端按 {@code userId} 去重并剔除创建者）。
 * 这样「我建的群我居然不在里面」在数据层就不可能发生。</p>
 *
 * <p>长度上限此处取 {@code sys_group.name} 的列宽 64：这是<b>物理上界</b>，
 * 与配置无关；服务层只做兜底，不再允许配置放宽。</p>
 *
 * @param name      群聊名称
 * @param memberIds 受邀成员用户 ID 列表（不含创建者；服务端去重、剔除创建者后逐个校验可用性）
 * @author AntTransfer CE
 */
public record ChatGroupCreateDTO(
        @NotBlank(message = "群聊名称不能为空")
        @Size(max = 64, message = "群聊名称过长") String name,
        @NotEmpty(message = "请至少邀请一位成员")
        @Size(max = SysGroup.MAX_MEMBERS, message = "群成员数超出上限")
        List<@NotNull(message = "成员 ID 不能为空") Long> memberIds) {
}
