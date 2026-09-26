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
package com.anttransfer.collaboration.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.anttransfer.collaboration.model.entity.SysGroup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 建群上限与发送侧写扩散上限的一致性断言。
 *
 * <p><b>为什么需要一条只比大小的测试：</b>这两个上限分别写在
 * {@code SysGroup#MAX_MEMBERS}（建群）与 {@code ChatService#MAX_FANOUT_RECIPIENTS}
 * （发送）里，属于两个不同的关注点，谁都不知道对方改了值。</p>
 *
 * <p>一旦建群上限被调高到超过写扩散上限，后果不是「发送变慢」而是<b>建出一个发不出消息的群</b>：
 * 建群成功、成员齐全、进群正常，唯独群主发出第一条消息时被拒。此时故障现象指向消息服务，
 * 而根因在建群侧——这类「故障现场与根因分离」的问题最难排查，值得用一条红灯挡住。</p>
 *
 * @author AntTransfer CE
 */
class ChatGroupMemberLimitTest {

    @Test
    @DisplayName("建群成员上限不得高于写扩散上限：否则能建出「进得去、发不出」的群")
    void groupMemberLimit_shouldNotExceedFanoutLimit() {
        assertThat(SysGroup.MAX_MEMBERS)
                .isPositive()
                .isLessThanOrEqualTo(ChatService.MAX_FANOUT_RECIPIENTS);
    }
}
