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
package com.anttransfer.collaboration.notify;

import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.anttransfer.collaboration.repository.NotifyMessageMapper;
import org.springframework.stereotype.Component;

/**
 * 站内信渠道（P0，常开）——通知的<b>持久化权威写入方</b>。
 *
 * <p>INSERT 到 {@code sys_notify_message}，与调用方<b>同事务</b>：
 * 「审批通过 ↔ 申请人能查到结果通知」必须原子可见，否则会出现审批已改状态、
 * 通知却因回滚缺失的不一致（见 {@code NotificationPort} 的事务语义）。</p>
 *
 * <p>消息 ID 由 MyBatis-Plus 雪花算法在 INSERT 时回填，分发器据此把「提交后推送」
 * 与「已落库的这条消息」对应起来——这正是本渠道必须标记
 * {@link Notifier#persistent()} 的原因。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class InboxNotifier implements Notifier {

    /** 渠道标识 */
    public static final String CHANNEL = "INBOX";

    private final NotifyMessageMapper notifyMessageMapper;

    public InboxNotifier(NotifyMessageMapper notifyMessageMapper) {
        this.notifyMessageMapper = notifyMessageMapper;
    }

    @Override
    public String channel() {
        return CHANNEL;
    }

    @Override
    public boolean persistent() {
        return true;
    }

    @Override
    public void send(NotifyMessage message) {
        // 失败向上抛：站内信是权威存储，落库失败必须由调用方事务决策，不得静默吞掉
        notifyMessageMapper.insert(message);
    }
}
