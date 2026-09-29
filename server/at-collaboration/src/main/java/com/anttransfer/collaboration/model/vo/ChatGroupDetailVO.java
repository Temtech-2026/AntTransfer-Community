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
package com.anttransfer.collaboration.model.vo;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

import java.util.List;

/**
 * 群详情（群配置面板的<b>唯一</b>数据来源）。
 *
 * <p>六个写端点（改群名 / 邀请 / 移除 / 退群 / 解散）里，除退群与解散外都回本对象——
 * 写成功后前端无需再发一次 {@code GET} 就能刷新面板，也避免「写完读到的还是旧值」的
 * 中间态（服务端在同一事务提交后组装，读到的必是本次写入的结果）。</p>
 *
 * <p><b>为什么带全量成员名单而不是分页：</b>{@code sys_group.member_limit} 上界是 500
 * （{@code SysGroup.MAX_MEMBERS}），单次响应最坏 500 条「ID + 展示名 + 角色 + 时间」，
 * 约数十 KB；而面板的核心用途是「看清谁在群里」，分页只会让「找某个人再移除」变成多次翻页。
 * 若将来上限数量级放大，应连同分页一起重设计，而不是先埋一个恒为 1 页的分页参数。</p>
 *
 * @param id          群 ID（字符串过线）
 * @param name        群名称
 * @param ownerUserId 群主用户 ID（字符串过线）——前端据此在成员列表给群主打标
 * @param memberCount 当前成员数
 * @param memberLimit 成员数上限（服务端配置，前端用于「邀请后会不会超」的即时提示）
 * @param ability     我在该群内可执行的操作（服务端算好，前端不自行推导）
 * @param members     成员名单（按成员行 ID 升序，群主恒为第一行）
 * @param notifyPreference 我在该群的消息提醒偏好（免打扰 + 两类提及开关）。
 *                        查看者必是该群成员（非成员走不到这里——{@code requireMember} 先拦），
 *                        所以永远有值；群设置面板的三个开关直接绑定它，
 *                        无需为「读我自己的偏好」再单独发一次请求
 * @author AntTransfer CE
 */
public record ChatGroupDetailVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long id,
        String name,
        @JsonSerialize(using = ToStringSerializer.class)
        Long ownerUserId,
        int memberCount,
        int memberLimit,
        ChatGroupAbilityVO ability,
        List<ChatGroupMemberVO> members,
        ChatGroupNotifyPreferenceVO notifyPreference) {
}
