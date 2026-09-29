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
package com.anttransfer.collaboration.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

/**
 * 会话对端备注（{@code sys_chat_peer_alias}）——「我给这个人起的名字」。
 *
 * <p><b>它是私有覆盖名，不是账号昵称：</b>一行只属于 {@code ownerUserId} 一个人，
 * 只影响他自己看到的会话名与消息发送人名。所以本表<b>没有</b>「谁备注了我」的读法，
 * 也永远不该被下发到 {@code peerUserId} 那一侧。</p>
 *
 * <p><b>唯一性由 {@code uk_owner_peer} 兜底</b>：{@code (ownerUserId, peerUserId)} 只允许一行，
 * 且该唯一键<b>不含 {@code deleted}</b>——取消备注是置 {@code deleted=1}，再次设置是
 * <b>复活同一行</b>（见 {@code ChatPeerAliasMapper#revive}），故不存在「两行已删除记录撞键」
 * 的问题（与 V6/V12 文件域不建唯一索引的理由不同，详见 V19 迁移注释）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_chat_peer_alias")
public class ChatPeerAlias extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /** 备注归属者用户 ID（备注只对他自己可见），映射列 owner_user_id */
    @TableField("owner_user_id")
    private Long ownerUserId;

    /** 被备注的用户 ID（单聊对端），映射列 peer_user_id */
    @TableField("peer_user_id")
    private Long peerUserId;

    /** 备注名（非空；展示优先级：备注 > 昵称 > 账号），映射列 alias */
    @TableField("alias")
    private String alias;
}
