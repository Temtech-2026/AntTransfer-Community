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

/**
 * 「<b>我</b>在这个群里能做什么」——由服务端算好的一组布尔，供前端决定按钮显隐。
 *
 * <p><b>为什么不让前端自己算：</b>前端登录态只有展示信息，<b>没有可信的用户主键</b>
 * （项目铁律：ID 一律字符串过线，且前端不得据本地状态做鉴权决策）。
 * 前端既拿不到自己的 ID，也就无法把 {@code ownerUserId} 与自己比对；
 * 即便拿到了，那也是一份可伪造的本地判定。能力布尔必须由服务端在已知
 * {@code AuthenticatedUser} 的前提下算出来。</p>
 *
 * <p><b>与权限点的关系（两者取「与」）：</b>本对象只表达<b>群内身份</b>维度
 * （群主 / 管理员 / 普通成员）。是否具备「群管理」这项功能，仍由权限点
 * （{@code chat:group:update} 等）在前端经 {@code useAccess} 判定，并由
 * {@code @RequiresPerm} 在服务端强制。二者缺一不可：身份不够会被 1038 拒，
 * 功能未授权会被 1003 拒——刻意分成两个码，前端提示与自救动作不同。</p>
 *
 * <p><b>为什么 {@code canRemoveMember} / {@code canDissolve} 不给管理员：</b>
 * 移除成员与解散群是<b>不可逆</b>的成员关系破坏（解散后全员被清退、历史不再可读），
 * CE 只把这两项交给群主；改群名与邀请成员可逆且高频，放给管理员。
 * {@code canQuit} 对群主恒为 false——群主退群会造出无主群（见 1039）。</p>
 *
 * @param canRename       能否修改群名（群主 / 管理员）
 * @param canInvite       能否邀请新成员（群主 / 管理员）
 * @param canRemoveMember 能否移除群成员（仅群主）
 * @param canDissolve     能否解散该群（仅群主）
 * @param canQuit         能否退出该群（除群主外的成员）
 * @author AntTransfer CE
 */
public record ChatGroupAbilityVO(
        boolean canRename,
        boolean canInvite,
        boolean canRemoveMember,
        boolean canDissolve,
        boolean canQuit) {
}
