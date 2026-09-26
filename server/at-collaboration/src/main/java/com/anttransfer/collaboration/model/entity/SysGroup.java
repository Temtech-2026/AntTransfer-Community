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
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

/**
 * 项目 / 群组实体（表 {@code sys_group}，V1 建表）。
 *
 * <p><b>本实体在 IM 域的两个用途：</b>
 * <ol>
 *   <li><b>建群</b>：{@code ChatGroupService#create} 落一行 {@code group_type=2} 的群聊；</li>
 *   <li><b>查名</b>：会话列表按 {@code sys_group.id} 批量反查群名——
 *       此前该字段口径为「群聊恒返回 {@code null}」，理由是表族收口挂在
 *       architecture.md D-11；群组管理面（本实体）落地后，该限制随之解除。</li>
 * </ol></p>
 *
 * <p><b>{@code group_type} 的两个取值语义不同，不要混用：</b>{@code 1-项目} 是协作空间
 * （CE 未开放创建入口），{@code 2-群组} 是 IM 会话载体。会话发送侧只校验「是不是成员」
 * 而不校验类型——因为二者都靠 {@code sys_group_member} 定义可见范围，多一个类型判断
 * 只会制造「同一条群聊消息，在项目里能发、在群里不能发」这种无意义的分裂。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_group")
public class SysGroup extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /** 群组类型：项目（协作空间） */
    public static final int TYPE_PROJECT = 1;

    /** 群组类型：群组（IM 会话载体） */
    public static final int TYPE_CHAT = 2;

    /** 状态：停用 / 已解散 */
    public static final int STATUS_DISABLED = 0;

    /** 状态：生效 */
    public static final int STATUS_ACTIVE = 1;

    /**
     * CE 群成员硬上限（含群主）。
     *
     * <p><b>为什么必须与发送侧同源：</b>群聊投递是「按成员逐个写扩散」，
     * {@code ChatService} 对接收人规模有防御性上限；若建群允许超出该上限，
     * 就能建出一个「进得去、发不出」的群——故障发生在发送而非建群时，
     * 用户与排查者都会先怀疑消息服务。故建群时即卡住。
     * 二者的关系由 {@code ChatGroupMemberLimitTest} 断言，避免后续只改一侧。</p>
     */
    public static final int MAX_MEMBERS = 500;

    /** 项目 / 群组名称（列宽 64） */
    private String name;

    /** 类型：1-项目 2-群组 */
    private Integer groupType;

    /** 负责人 / 群主用户 ID（逻辑关联 sys_user） */
    private Long ownerUserId;

    /** 描述 */
    private String description;

    /** 状态：0-停用 / 已解散 1-生效 */
    private Integer status;
}
