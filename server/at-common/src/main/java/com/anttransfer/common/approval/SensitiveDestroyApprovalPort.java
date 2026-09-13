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
package com.anttransfer.common.approval;

/**
 * 高敏感销毁审批端口（SPI）——审批单表 {@code sys_approval_request} 归属 at-permission，
 * at-file 的 {@code file:destroy} 需要回答「这次销毁有没有一张已通过的高敏感审批单背书」时，
 * <b>不得</b>直连该表，只能经本端口反查。
 *
 * <p>这是架构铁律「表族归属」在跨模块读取上的落法：<b>读走 SPI、写走单事务</b>
 * （system-design §1.2 / D-1）。参照 {@code UserLookupPort} 的既有形态。</p>
 *
 * <p><b>为什么 file:destroy 非要绑定审批单：</b>销毁绕过回收站、不可恢复，是文件域唯一
 * 「不可逆」的操作。仅靠 RBAC 权限点只能保证「是管理员」，无法保证「这次删除经过了针对性
 * 的复核」——管理员误删、账号被盗后的批量销毁都拦不住。绑定一张 level=3 且已通过的审批单，
 * 等于把「不可逆动作」按回到「有人在单据上签过字」这个人工闸门上。</p>
 *
 * <p><b>只读承诺：</b>本端口只暴露查询语义，实现方不得在此做写操作；也不得代替 RBAC 鉴权
 * ——权限点判定仍由 {@code @RequiresPerm("file:destroy")} 独立完成，两者是「与」关系。</p>
 *
 * @author AntTransfer CE
 */
public interface SensitiveDestroyApprovalPort {

    /**
     * 查询可用于销毁指定物理文件的「已通过」高敏感审批单号。
     *
     * <p>四个条件缺一不可：{@code applicant_id} = 当前操作人（<b>防借用他人审批单</b>）、
     * {@code resource_type = 'FILE'}、{@code resource_id} = 目标 {@code sys_file.id}、
     * {@code level = 3} 且 {@code status = 1}（已通过）。</p>
     *
     * <p>注意 {@code resource_id} 的口径是<b>物理文件 ID（sys_file.id）</b>，不是引用条目 ID
     * （sys_file_node.id）——与 at-permission 既有的 {@code RESOURCE_FILE} 语义保持一致，
     * 因为「同一份内容」才是敏感级别的物理载体。</p>
     *
     * @param applicantId 执行销毁的用户 ID（须为审批单申请人本人）
     * @param fileId      目标物理文件 ID（sys_file.id）
     * @return 审批单号（如 AP20260906001）；无可用审批单时返回 {@code null}
     */
    String findApprovedHighSensitiveDestroy(Long applicantId, Long fileId);
}
