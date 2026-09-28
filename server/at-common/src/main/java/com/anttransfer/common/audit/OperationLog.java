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
package com.anttransfer.common.audit;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 操作审计日志实体：映射 {@code sys_operation_log}（append-only，留存 ≥ 6 个月）。
 *
 * <p><b>为什么在 at-common</b>：V1 表注释已将该表归口「协作与审计族（at-collaboration 通知域 /
 * at-common 审计）」，且模块铁律规定 {@code at-permission} 仅依赖 {@code at-common}
 * （见 server/at-permission/pom.xml）。审计是<b>跨域横切能力</b>（FILE / PERMISSION / AUTH 都要写），
 * 实体与 Mapper 放在共享内核，各域只持有自己的 logger，避免「谁写审计就依赖谁」的模块环。</p>
 *
 * <p><b>只写不改</b>：全仓库不提供审计的修改 / 删除入口，与「审计记录不可被任何角色修改 / 删除，
 * 仅可归档导出」一致。查询入口见 {@code AuditLogController}。</p>
 *
 * <p><b>动作字典集中于此</b>：{@code action} 列在 DDL 中是 {@code varchar(64)} 无枚举约束，
 * 常量集中一处便于「查表即知全集」；按前缀即可看出归属域
 * （{@code FILE_*} / {@code FOLDER_*} / {@code SHARE_*} / {@code VERSION_*} / {@code PACK_*}
 * / {@code USER_*} / {@code ROLE_*} / {@code PASSWORD_CHANGE}）与动作语义
 * （{@code APPLY} / {@code APPROVE} / {@code REJECT} / {@code TRANSFER} /
 * {@code GRANT} / {@code REVOKE} …）。</p>
 *
 * <p><b>UA 落位说明</b>：{@code sys_operation_log} 无 {@code user_agent} 列（该列仅存在于
 * {@code sys_login_log}），故 UA 与业务上下文一并序列化进 {@code detail}（JSON，脱敏后落库），
 * 避免为本需求新增 Flyway 迁移（脚本只增不改，见 sql/README）。</p>
 *
 * @author AntTransfer CE
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_operation_log")
public class OperationLog extends BaseEntity {

    /* ============================== 外发分享域 ============================== */

    /** 审计动作：分享创建 */
    public static final String ACTION_SHARE_CREATE = "SHARE_CREATE";
    /** 审计动作：分享撤销 */
    public static final String ACTION_SHARE_REVOKE = "SHARE_REVOKE";
    /** 审计动作：访客下载（票据核销） */
    public static final String ACTION_SHARE_DOWNLOAD = "SHARE_DOWNLOAD";
    /** 审计动作：访客预览（票据核销） */
    public static final String ACTION_SHARE_PREVIEW = "SHARE_PREVIEW";
    /** 审计动作：外发拦截（后缀黑名单 / 敏感词） */
    public static final String ACTION_SHARE_BLOCKED = "SHARE_BLOCKED";
    /** 审计动作：提取码错误达阈值锁定 */
    public static final String ACTION_SHARE_CODE_LOCKED = "SHARE_CODE_LOCKED";

    /* ============================== 文件管理域 ============================== */

    /** 审计动作：文件上传入库（新内容或秒传命中均记一条，以 refCount 区分） */
    public static final String ACTION_FILE_UPLOAD = "FILE_UPLOAD";
    /** 审计动作：文件下载（含 Range 续传） */
    public static final String ACTION_FILE_DOWNLOAD = "FILE_DOWNLOAD";
    /** 审计动作：文件预览 / 缩略图 */
    public static final String ACTION_FILE_PREVIEW = "FILE_PREVIEW";
    /** 审计动作：重命名文件 */
    public static final String ACTION_FILE_RENAME = "FILE_RENAME";
    /** 审计动作：移动文件 */
    public static final String ACTION_FILE_MOVE = "FILE_MOVE";
    /** 审计动作：复制文件 */
    public static final String ACTION_FILE_COPY = "FILE_COPY";
    /** 审计动作：移入回收站（普通删除） */
    public static final String ACTION_FILE_DELETE = "FILE_DELETE";
    /** 审计动作：从回收站还原 */
    public static final String ACTION_FILE_RESTORE = "FILE_RESTORE";
    /** 审计动作：彻底销毁（绕过回收站，不可逆） */
    public static final String ACTION_FILE_DESTROY = "FILE_DESTROY";
    /** 审计动作：回收站到期系统清理（无操作人，userId 为空） */
    public static final String ACTION_RECYCLE_PURGE = "RECYCLE_PURGE";
    /** 审计动作：下载票据签发 */
    public static final String ACTION_FILE_TICKET_ISSUE = "FILE_TICKET_ISSUE";
    /** 审计动作：创建目录 */
    public static final String ACTION_FOLDER_CREATE = "FOLDER_CREATE";
    /** 审计动作：重命名目录 */
    public static final String ACTION_FOLDER_RENAME = "FOLDER_RENAME";
    /** 审计动作：移动目录 */
    public static final String ACTION_FOLDER_MOVE = "FOLDER_MOVE";
    /** 审计动作：删除目录 */
    public static final String ACTION_FOLDER_DELETE = "FOLDER_DELETE";
    /** 审计动作：打标签 / 取消标签 */
    public static final String ACTION_FILE_TAG = "FILE_TAG";
    /** 审计动作：回滚历史版本 */
    public static final String ACTION_VERSION_ROLLBACK = "VERSION_ROLLBACK";
    /** 审计动作：上传新版本（生成一条历史版本记录） */
    public static final String ACTION_VERSION_CREATE = "VERSION_CREATE";
    /** 审计动作：超出保留版数被裁剪（系统动作，无操作人） */
    public static final String ACTION_VERSION_PRUNE = "VERSION_PRUNE";
    /** 审计动作：发起批量打包 */
    public static final String ACTION_PACK_CREATE = "PACK_CREATE";
    /** 审计动作：下载打包产物 */
    public static final String ACTION_PACK_DOWNLOAD = "PACK_DOWNLOAD";

    /* ====================== 会话文件附件域（聊天消息携带附件） ====================== */

    /**
     * 审计动作：会话附件授权创建（发送方设定用途档位 / 有效期 / 次数）。
     *
     * <p>与外发分享的 {@link #ACTION_SHARE_CREATE} 分开编码的原因：两者的访问主体不同
     * （分享面向<b>站外匿名访客</b>，附件面向<b>某一确定的登录同事</b>），
     * 审计查询必须能一眼分清「东西被发到站外了」与「东西被交给了某个同事」。</p>
     */
    public static final String ACTION_CHAT_ATTACH_CREATE = "CHAT_ATTACH_CREATE";
    /** 审计动作：会话附件授权撤销（发送方的绝对否决，接收方卡片随即失效） */
    public static final String ACTION_CHAT_ATTACH_REVOKE = "CHAT_ATTACH_REVOKE";
    /** 审计动作：接收方预览附件（只发内联流，不消耗下载次数） */
    public static final String ACTION_CHAT_ATTACH_PREVIEW = "CHAT_ATTACH_PREVIEW";
    /** 审计动作：接收方下载附件（消耗一次下载额度，与 {@link #ACTION_CHAT_ATTACH_PREVIEW} 分开计数） */
    public static final String ACTION_CHAT_ATTACH_DOWNLOAD = "CHAT_ATTACH_DOWNLOAD";
    /** 审计动作：接收方把附件转存为自己的文件（仅用途档位为「可转发转存」时可达） */
    public static final String ACTION_CHAT_ATTACH_SAVE = "CHAT_ATTACH_SAVE";
    /** 审计动作：会话附件取件被拒（用途档位禁止下载 / 已过期 / 已撤销 / 超过次数） */
    public static final String ACTION_CHAT_ATTACH_REJECT = "CHAT_ATTACH_REJECT";

    /* ====================== 权限 / 系统管理域（管理与审批） ====================== */

    /** 审计动作：创建用户 */
    public static final String ACTION_USER_CREATE = "USER_CREATE";
    /** 审计动作：修改用户基本信息（含调岗） */
    public static final String ACTION_USER_UPDATE = "USER_UPDATE";
    /** 审计动作：逻辑删除用户 */
    public static final String ACTION_USER_DELETE = "USER_DELETE";
    /** 审计动作：启用 / 停用用户（detail 记 from → to） */
    public static final String ACTION_USER_STATUS = "USER_STATUS";
    /**
     * 审计动作：管理员更换他人头像（{@code POST /api/v1/system/users/{id}/avatar}）。
     *
     * <p>与 {@link #ACTION_USER_UPDATE} 分开编码，理由同「管理员重置口令」与「本人自助改密」
     * 的分法：换头像是独立端点、独立入口，若并进 USER_UPDATE，审计查询就无法回答
     * 「这次到底是改了资料还是换了头像」，只能靠翻 detail 里的字段名去猜。</p>
     *
     * <p>{@code detail} 只记「换成功了」，<b>不记头像存储 key / 路径</b>——
     * 头像地址里含可直出访问的 key，写进审计表等于把一份可访问凭据长期留档。</p>
     */
    public static final String ACTION_USER_AVATAR = "USER_AVATAR";
    /** 审计动作：管理员重置他人口令（<b>绝不记录口令明文 / 哈希</b>） */
    public static final String ACTION_USER_PASSWORD_RESET = "USER_PASSWORD_RESET";
    /** 审计动作：变更用户角色（detail 记变更前后角色 ID 集） */
    public static final String ACTION_USER_ROLE_ASSIGN = "USER_ROLE_ASSIGN";
    /** 审计动作：创建角色 */
    public static final String ACTION_ROLE_CREATE = "ROLE_CREATE";
    /** 审计动作：修改角色（名称 / 描述 / 数据范围） */
    public static final String ACTION_ROLE_UPDATE = "ROLE_UPDATE";
    /** 审计动作：删除角色 */
    public static final String ACTION_ROLE_DELETE = "ROLE_DELETE";
    /** 审计动作：替换角色授权点（detail 记变更前后权限点集与增删差量） */
    public static final String ACTION_ROLE_PERM_ASSIGN = "ROLE_PERM_ASSIGN";
    /** 审计动作：提交权限申请单 */
    public static final String ACTION_APPLY = "APPLY";
    /** 审计动作：审批通过（detail 记最终授权动作与有效期，审批不得放大范围） */
    public static final String ACTION_APPROVE = "APPROVE";
    /** 审计动作：审批驳回（detail 记驳回理由） */
    public static final String ACTION_REJECT = "REJECT";
    /** 审计动作：审批转审（detail 记 from → to 审批人） */
    public static final String ACTION_TRANSFER = "TRANSFER";
    /** 审计动作：授权落地（写 sys_user_file_permission） */
    public static final String ACTION_GRANT = "GRANT";
    /** 审计动作：授权回收（主动回收 / 重评估回收 / 调岗连带回收） */
    public static final String ACTION_REVOKE = "REVOKE";
    /** 审计动作：授权到期系统回收（无操作人，userId 为空） */
    public static final String ACTION_GRANT_EXPIRE = "GRANT_EXPIRE";

    /* ============================== 认证域（本人操作） ============================== */

    /**
     * 审计动作：本人自助改密（{@code PUT /api/v1/auth/password}）。
     *
     * <p>与 {@link #ACTION_USER_PASSWORD_RESET} 的区别：那条是「管理员重置<b>他人</b>口令」，
     * 操作人是管理员、目标是他号；本条是「账号主本人改自己的口令」，操作人与目标同一个。
     * 分开编码是为了让审计查询能一眼区分「本人自救」与「管理干预」。</p>
     *
     * <p>{@code detail} 只记发起者与吊销结果，<b>绝不记录口令明文 / 哈希</b>。</p>
     */
    public static final String ACTION_PASSWORD_CHANGE = "PASSWORD_CHANGE";

    /**
     * 审计动作：本人自助更换头像（{@code POST /api/v1/users/me/avatar}）。
     *
     * <p>与 {@link #ACTION_USER_AVATAR} 的区别，同「本人自助改密」与「管理员重置他人口令」的分法：
     * 那条是<b>管理员更换他人</b>头像（操作人与目标不同，且受数据范围约束）；
     * 本条是<b>账号主本人更换自己的</b>头像（操作人与目标同一，不需要任何管理权限点）。
     * 合并编码会让审计查询无法回答「这张头像到底是本人换的，还是管理员替他换的」——
     * 而这正是账号被接管后最先被利用的一类动作。</p>
     *
     * <p>{@code detail} 同样<b>只记「换成功了」</b>，不记头像存储 key / 路径。</p>
     */
    public static final String ACTION_USER_AVATAR_SELF = "USER_AVATAR_SELF";

    /* ============================== 域标识 ============================== */

    /** 所属域：文件（与 V1 约定一致：AUTH/PERMISSION/TRANSFER/FILE/COLLABORATION/COMMON） */
    public static final String MODULE_FILE = "FILE";
    /** 所属域：权限与系统管理（用户 / 角色 / 审批 / 授权） */
    public static final String MODULE_PERMISSION = "PERMISSION";
    /** 所属域：认证（登录 / 登出 / 令牌） */
    public static final String MODULE_AUTH = "AUTH";

    /* ============================== 操作对象类型 ============================== */

    /** 操作对象类型：外发链接 */
    public static final String TARGET_SHARE = "SHARE";
    /** 操作对象类型：文件条目（sys_file_node） */
    public static final String TARGET_FILE = "FILE";
    /** 操作对象类型：目录（sys_folder） */
    public static final String TARGET_FOLDER = "FOLDER";
    /** 操作对象类型：标签（sys_tag） */
    public static final String TARGET_TAG = "TAG";
    /** 操作对象类型：打包任务（sys_pack_task） */
    public static final String TARGET_PACK_TASK = "PACK_TASK";
    /** 操作对象类型：被管理的用户账号（sys_user） */
    public static final String TARGET_USER = "USER";
    /** 操作对象类型：角色（sys_role） */
    public static final String TARGET_ROLE = "ROLE";
    /** 操作对象类型：权限点（sys_permission） */
    public static final String TARGET_PERMISSION = "PERMISSION";
    /** 操作对象类型：权限申请单（sys_approval_request） */
    public static final String TARGET_APPLICATION = "APPLICATION";
    /** 操作对象类型：授权记录（sys_user_file_permission） */
    public static final String TARGET_GRANT = "GRANT";
    /** 操作对象类型：系统任务 / 非特定对象（如到期回收、队列清理） */
    public static final String TARGET_SYSTEM = "SYSTEM";
    /**
     * 操作对象类型：会话文件附件授权（sys_chat_attachment）。
     *
     * <p>刻意不复用 {@link #TARGET_FILE}：{@code target_id} 在本域是<b>授权 ID</b>而非条目 ID，
     * 若共用 FILE 会让「查某个条目被外发/授权的全部记录」与「查某条授权本身」两种查询
     * 在同一 {@code (target_type, target_id)} 索引上互相污染。条目 ID 通过
     * {@link #DETAIL_NODE_ID} 记录在 detail 中。</p>
     */
    public static final String TARGET_CHAT_ATTACHMENT = "CHAT_ATTACHMENT";

    /* ============================== 结果 ============================== */

    /** 结果：成功 */
    public static final int RESULT_SUCCESS = 0;
    /** 结果：失败 */
    public static final int RESULT_FAIL = 1;

    /* ==================== detail JSON 键（跨模块读取契约） ==================== */

    /**
     * {@code detail} 键：条目总字节数（{@link #ACTION_FILE_UPLOAD}）。
     *
     * <p>用于审计可读性（这条上传落地的文件多大）；<b>不是</b>传输量口径——秒传命中同样记一条
     * {@code FILE_UPLOAD}，但它没有字节过网，传输量取 {@link #DETAIL_TRANSFERRED_BYTES}。</p>
     */
    public static final String DETAIL_SIZE_BYTES = "sizeBytes";

    /**
     * {@code detail} 键：<b>本次请求实际过网</b>的字节数——上传侧（{@code FILE_UPLOAD}）。
     *
     * <p>秒传命中为 {@code 0}（内容已在库中，本次没有字节上行）。与下载侧的
     * {@link #DETAIL_SENT_BYTES} 同义，二者共同构成「传输量」口径。</p>
     */
    public static final String DETAIL_TRANSFERRED_BYTES = "transferredBytes";

    /**
     * {@code detail} 键：<b>本次请求实际下发</b>的字节数——下载侧（{@code FILE_DOWNLOAD}）。
     *
     * <p>Range 续传时一次只下发一段，故与 {@link #DETAIL_SIZE_BYTES}（文件总大小）不同：
     * 传输量取「实际下发」，否则分段下载会被重复计成整份文件。</p>
     */
    public static final String DETAIL_SENT_BYTES = "sentBytes";

    /** {@code detail} 键：会话附件所引用的文件条目 ID（{@code CHAT_ATTACH_*} 系列） */
    public static final String DETAIL_NODE_ID = "nodeId";

    /** {@code detail} 键：会话附件的接收方用户 ID（单聊对端） */
    public static final String DETAIL_RECEIVER_USER_ID = "receiverUserId";

    /** {@code detail} 键：会话附件的用途档位（1-仅预览 2-可下载 3-可转发转存） */
    public static final String DETAIL_USAGE_MODE = "usageMode";

    /**
     * {@code detail} 键：会话附件授权拒绝原因。
     *
     * <p>取值形如 {@code REVOKED} / {@code EXPIRED} / {@code LIMIT_EXHAUSTED} /
     * {@code USAGE_PREVIEW_ONLY}，用于在「被拒」审计里留下可聚合的判据——
     * 只记「失败了」而不记「因为什么失败」，事后无法区分用户误操作与权限被收紧。</p>
     */
    public static final String DETAIL_REJECT_REASON = "rejectReason";

    /** 操作人用户 ID（访客 / 系统任务为 null） */
    @TableField("user_id")
    private Long userId;

    /** 动作编码（LOGIN/APPLY/APPROVE/GRANT/REVOKE/SHARE_CREATE/FILE_UPLOAD/...） */
    @TableField("action")
    private String action;

    /** 所属域：AUTH/PERMISSION/TRANSFER/FILE/COLLABORATION/COMMON */
    @TableField("module")
    private String module;

    /** 操作对象类型：USER/ROLE/SPACE/FILE/SHARE/APPLICATION/GRANT/SYSTEM */
    @TableField("target_type")
    private String targetType;

    /** 操作对象 ID */
    @TableField("target_id")
    private Long targetId;

    /** 链路追踪 ID（一次请求内唯一，排障凭证） */
    @TableField("trace_id")
    private String traceId;

    /** 来源 IP */
    @TableField("ip")
    private String ip;

    /** 结果：0-成功 1-失败 */
    @TableField("result")
    private Integer result;

    /** 审计详情（JSON / 可读上下文，脱敏后落库；含 UA） */
    @TableField("detail")
    private String detail;

    /** 审计事件时间（业务时间，非落库时间） */
    @TableField("log_time")
    private LocalDateTime logTime;
}
