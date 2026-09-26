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
package com.anttransfer.common.security;

import com.anttransfer.common.result.PageResult;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 用户主数据<b>写侧</b>端口（SPI）：系统管理面（at-permission）据以创建、维护账号。
 *
 * <p><b>为什么需要它：</b>{@code sys_user} 是 at-auth 的表族（architecture.md §1.2.2 表族归属）。
 * at-permission 承接「系统管理面」后要建号、改密、启停、调岗，但<b>不能</b>直接依赖 at-auth
 * 的实体与 Mapper——模块依赖铁律是「业务模块只依赖 at-common」。故在此声明写侧契约，
 * 由表主 at-auth 提供实现。这是本项目 {@link UserLookupPort}（读侧）的写侧对偶，
 * 与 {@code SensitiveDestroyApprovalPort} / {@code NotificationPort} 同一范式。</p>
 *
 * <p><b>为什么口径是「原子动作」而不是「返回实体让调用方随便改」：</b>
 * 账号安全策略（密码散列算法、token_epoch 会话吊销、username 唯一性口径、
 * 逻辑删除与唯一键的相互作用）全部属于表主 at-auth 的领域知识。端口若暴露
 * 「读出实体 → 改字段 → 存回」，这些不变量会泄漏到调用方，任何一处漏做就是安全缺陷
 * （典型：改了密码忘了 bump token_epoch，旧会话继续有效直到自然过期）。
 * 因此本端口只提供带明确语义的动作，每个动作内部由 at-auth 保证其全部不变式。</p>
 *
 * <p><b>凭据不经手调用方：</b>{@link #create} / {@link #resetPassword} 收的是<b>明文口令</b>，
 * 散列在 at-auth 内完成。明文本身已存在于 HTTP 请求体内，跨进程内接口传递不新增暴露面；
 * 反过来若让调用方传散列值，则「用什么算法、加不加盐」就被固化进了调用方，密码策略再也无法
 * 在 at-auth 内演进。</p>
 *
 * <p><b>数据范围不在此层：</b>端口收 {@link UserQuery} 里的 deptId / restrictUserId 等过滤条件，
 * 由调用方（at-permission）依据当前操作者的 platform 数据范围计算后传入。
 * 端口不做授权判断——授权口径只有一处（AtPermission 的 AccessControlService），
 * 分散到表主会让「谁能看谁」出现两个真相源。</p>
 *
 * @author AntTransfer CE
 */
public interface UserAdminPort {

    /** 账号状态：正常。 */
    int STATUS_ACTIVE = 0;
    /** 账号状态：禁用。 */
    int STATUS_DISABLED = 1;

    /**
     * 用户主数据行（仅 {@code sys_user} 列，不含角色等跨表聚合信息）。
     *
     * @param id            用户 ID
     * @param username      登录账号（已按应用口径规范化）
     * @param nickname      昵称 / 姓名
     * @param avatarUrl     头像<b>存储 key</b>（可空；非 URL。对外地址由
     *                      {@link com.anttransfer.common.file.AvatarStoragePort#urlOf} 拼出）
     * @param email         邮箱（可空）
     * @param mobile        手机号（可空）
     * @param deptId        所属部门 ID（null=未分配）
     * @param status        账号状态：0-正常 1-禁用 2-锁定
     * @param lastLoginTime 最近登录时间（可空）
     * @param createTime    创建时间
     */
    record UserRow(Long id, String username, String nickname, String avatarUrl, String email, String mobile,
                   Long deptId, Integer status, LocalDateTime lastLoginTime, LocalDateTime createTime) {
    }

    /**
     * 部门选项行（供「调岗」目标下拉与目标部门合法性校验）。
     *
     * @param id       部门 ID
     * @param parentId 父部门 ID（0=根）
     * @param name     部门名称
     * @param status   状态：0-停用 1-启用
     */
    record DeptRow(Long id, Long parentId, String name, Integer status) {
    }

    /**
     * 用户分页查询条件。
     *
     * @param keyword        模糊关键字（登录账号 / 昵称 / 邮箱 / 手机号任一命中；空=不限）
     * @param status         账号状态过滤（null=不限）
     * @param deptId         部门过滤（null=不限）
     * @param includeSubtree {@code true}=含 {@code deptId} 子树（数据范围「本部门及以下」），
     *                       {@code false}=仅该部门直属
     * @param restrictUserId 限定单个用户（数据范围「本人」时传当前操作者 ID；null=不限）
     * @param current        页码（从 1 起，调用方已做上界收敛）
     * @param size           每页条数（调用方已做上界收敛）
     */
    record UserQuery(String keyword, Integer status, Long deptId, boolean includeSubtree,
                     Long restrictUserId, long current, long size) {
    }

    /**
     * 建号入参。
     *
     * @param username    登录账号（调用方已 trim 并做大小写规范化口径校验）
     * @param rawPassword 明文初始口令（散列由 at-auth 完成）
     * @param nickname    昵称
     * @param email       邮箱（可空）
     * @param mobile      手机号（可空）
     * @param deptId      所属部门（可空）
     * @param remark      备注（可空）
     * @param operatorId  操作者用户 ID（写入 create_by）
     */
    record NewUser(String username, String rawPassword, String nickname, String email,
                   String mobile, Long deptId, String remark, Long operatorId) {
    }

    /**
     * 资料变更入参（不含账号名、不含口令、不含状态、不含部门——各自有独立动作与独立权限点）。
     *
     * @param nickname   昵称
     * @param email      邮箱（可空）
     * @param mobile     手机号（可空）
     * @param remark     备注（可空）
     * @param operatorId 操作者用户 ID（写入 update_by）
     */
    record ProfilePatch(String nickname, String email, String mobile, String remark, Long operatorId) {
    }

    /** 按 ID 查用户（已逻辑删除的返回 {@link Optional#empty()}）。 */
    Optional<UserRow> findById(Long userId);

    /** 按 ID 查部门（不存在返回 {@link Optional#empty()}），供调岗目标校验。 */
    Optional<DeptRow> findDept(Long deptId);

    /** 登录账号是否已被占用（含已逻辑删除的行——唯一键不留白，见实现说明）。 */
    boolean existsUsername(String username);

    /** 邮箱是否已被占用（{@code excludeUserId} 用于更新场景排除自身；email 为空时恒为 false）。 */
    boolean existsEmail(String email, Long excludeUserId);

    /**
     * 建号。
     *
     * @return 新用户 ID
     */
    Long create(NewUser newUser);

    /** 更新资料（昵称 / 邮箱 / 手机号 / 备注）。 */
    void updateProfile(Long userId, ProfilePatch patch);

    /**
     * 换头像：把 {@code sys_user.avatar_url} 置为新的存储 key。
     *
     * <p><b>为什么独立成一个动作而不是并进 {@link ProfilePatch}：</b>头像的字节由
     * {@link com.anttransfer.common.file.AvatarStoragePort} 先落盘、再把 key 写库，
     * 是「先有文件后有引用」的两步；并进资料编辑会让「改了昵称却没换图」这种
     * 常见提交也带一个 avatar 字段，不得不在表主侧判断「这次到底换没换」。
     * 独立动作让「换头像」只有一个入口、一次审计、一次旧文件清理。</p>
     *
     * <p><b>旧文件不在这里删：</b>本方法只负责改库（与调用方同一事务）。
     * 删除上一张图片由调用方在<b>事务提交后</b>执行——提交前删，一旦事务回滚，
     * 库里指向的仍是旧 key 而文件已被删掉，头像就成了永久碎图。</p>
     *
     * @param userId     目标用户 ID
     * @param avatarKey  新的头像存储 key（非 null）
     * @param operatorId 操作者用户 ID（写入 {@code update_by}）
     */
    void updateAvatar(Long userId, String avatarKey, Long operatorId);

    /**
     * 重置口令：散列写入，并<b>吊销该用户全部在途会话</b>
     * （token_epoch 递增；否则旧 refresh 令牌仍可换出新 access 令牌，重置形同虚设）。
     */
    void resetPassword(Long userId, String rawPassword, Long operatorId);

    /**
     * 改账号状态。
     *
     * @param status {@link #STATUS_ACTIVE} 或 {@link #STATUS_DISABLED}；
     *               禁用时同步吊销在途会话
     */
    void changeStatus(Long userId, int status, Long operatorId);

    /** 调岗：改所属部门（{@code deptId} 为 null 表示解除部门分配）。 */
    void changeDept(Long userId, Long deptId, Long operatorId);

    /** 逻辑删除账号（唯一键不留白：实现须同时处理 username 占位，见实现说明）。 */
    void softDelete(Long userId, Long operatorId);

    /** 按数据范围过滤后的用户分页。 */
    PageResult<UserRow> page(UserQuery query);

    /** 全部启用部门（升序），供调岗目标下拉。 */
    List<DeptRow> listDeptOptions();
}
