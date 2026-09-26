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
 * 修改群资料入参。
 *
 * <p><b>当前只有群名一个字段。</b>群描述（{@code sys_group.description}）虽有列，
 * 但没有消费方渲染它——开成可写字段等于让用户填一个存了却看不见的值。
 * 待会话头部展示群简介时再一并放开，届时本 DTO 加字段即可。</p>
 *
 * <p><b>为什么用 PATCH 语义而不是 PUT：</b>入参只含需变更的字段，
 * 未出现的字段保持原值。若用 PUT，前端「只改名字」就不得不先拉全量再回传，
 * 反而制造「回传途中别人改了别的字段被覆盖」的丢失更新面。</p>
 *
 * <p>长度上界取 {@code sys_group.name} 的列宽 64，与 {@code ChatGroupCreateDTO} 同口径：
 * 建群时能填的名字，改名时也一定填得进去，反之亦然。</p>
 *
 * @param name 新群名称
 * @author AntTransfer CE
 */
public record ChatGroupUpdateDTO(
        @NotBlank(message = "群聊名称不能为空")
        @Size(max = 64, message = "群聊名称过长") String name) {
}
