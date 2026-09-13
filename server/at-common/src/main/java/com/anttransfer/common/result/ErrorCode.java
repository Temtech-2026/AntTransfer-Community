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
package com.anttransfer.common.result;

import lombok.Getter;

import java.util.Optional;

/**
 * 业务错误码枚举。
 *
 * <p>编码规约（分段的十进制错误码，便于按段快速定位问题域）：</p>
 * <pre>
 *   0    —— 成功
 *   1xxx —— 认证授权（未登录 / Token 过期或无效 / 无权限 / 账号锁定与禁用 / 权限申请冲突与转审）
 *   2xxx —— 参数校验（参数缺失 / 格式错误 / 类型错误 / 超范围）
 *   4xxx —— 文件 / 传输（秒传与分片 / 完整性校验 / 外发分享 / 传输任务）
 *   5xxx —— 系统异常（未知异常 / 数据库 / 远程调用）
 * </pre>
 *
 * <p>每个错误码同时携带三层信息：</p>
 * <ul>
 *     <li>{@link #getCode()}：业务状态码，写入响应体 {@code Result.code}，前端以此为业务主判据；</li>
 *     <li>{@link #getMessage()}：默认中文提示，写入 {@code Result.message}；</li>
 *     <li>{@link #getHttpStatus()}：HTTP 语义状态码，由 at-gateway 的 {@code GlobalExceptionHandler}
 *         映射到 HTTP 响应状态（400 / 401 / 403 / 404 / 409 / 413 / 415 / 429 / 500 …）。</li>
 * </ul>
 *
 * <h3>处理策略分类（按「前端该做什么」而非数字分段，详见 docs/api/error-codes.md §二）</h3>
 * <pre>
 *   A 成功        code=0，读取 data
 *   B 流程分支    code≠0 但 HTTP 200，不提示错误，按 data 走业务分支
 *   C 凭证失效    401，静默 refresh 重放一次（仅 1002）或跳登录
 *   D 拒绝不跳登录 403，就地提示，禁止引导登录
 *   E 请求需修正  400 / 404 / 413 / 415，定位字段或资源后由用户重新发起
 *   F 状态失效冲突 409 / 410，刷新状态后重试
 *   G 限流锁定    429，退避后重试
 *   H 系统兜底    500 / 502，提示稍后重试并展示 traceId
 * </pre>
 * 每个枚举常量的注释末均以 {@code 【策略 X】} 标注其归类，新增错误码必须同时补该标注。
 *
 * <p>特殊说明：4001 秒传未命中、4002 分片缺失、1008 已授权、1009 重复申请属于<b>流程分支码</b>
 * （策略 B）——HTTP 仍为 200，前端据 {@code code} 走分支，其余非 0 码均为失败。</p>
 *
 * <p>新增错误码规范：① 分段不允许交叉复用；② 同一语义只保留一个 code；
 * ③ 修改 message 不影响已发布接口兼容性，如需彻底废弃请标注 {@code @Deprecated}；
 * ④ 调整已发布 code 属于破坏性变更，须同步更新 {@code docs/api/error-codes.md} 并在 CHANGELOG 声明；
 * ⑤ 分段内未占用的新号为非破坏性，可直接发布（见 API 契约 §9）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
public enum ErrorCode {

    /* ============================ 0：成功 ============================ */
    /** 成功【策略 A】 */
    SUCCESS(0, "成功", 200),

    /* ======================== 1xxx：认证授权 ======================== */
    /** 未登录或登录态已失效（需携带或重新获取 access token）【策略 C】 */
    NOT_LOGIN(1001, "未登录或登录已过期", 401),
    /** Access Token 已过期：客户端应静默用 refresh token 换新后重放原请求（仅一次）【策略 C】 */
    TOKEN_EXPIRED(1002, "登录态已过期，请重新登录", 401),
    /** 已登录但对该资源/操作无权限（RBAC 权限点或数据范围不足），不引导登录【策略 D】 */
    NO_AUTH(1003, "无操作权限", 403),
    /** 账号被锁定（如多次输错密码被临时锁定）；服务端副作用：失败计数累加【策略 D】 */
    ACCOUNT_LOCKED(1004, "账号已锁定，请联系管理员", 403),
    /** 账号被禁用 / 冻结 / 受限；服务端副作用：令牌立即吊销（≤2 min 生效）【策略 D】 */
    ACCOUNT_DISABLED(1005, "账号已被禁用，请联系管理员", 403),
    /** Token 非法（伪造 / 签名错误 / 已被吊销）；refresh 失败亦归此码【策略 C】 */
    TOKEN_INVALID(1006, "登录态无效，请重新登录", 401),
    /** 账号或密码错误（登录鉴权失败，不区分账号不存在与密码错误）【策略 C】 */
    BAD_CREDENTIALS(1007, "账号或密码错误", 401),

    /* ---------- 权限申请与授权（1008~1011） ---------- */
    /** 冲突校验命中：同资源已有生效授权，无需重复申请（流程分支码，HTTP 200，data 附授权信息）【策略 B】 */
    GRANT_ALREADY_ACTIVE(1008, "你已拥有该资源的有效授权", 200),
    /** 冲突校验命中：同资源已有进行中的申请，无需重复提交（流程分支码，HTTP 200，data 附在审申请单 ID）【策略 B】 */
    APPLICATION_DUPLICATE(1009, "您已有进行中的申请，请勿重复提交", 200),
    /** 审批转审目标无效：目标审批人不存在或无权限审批该资源【策略 E】 */
    REASSIGN_INVALID(1010, "转审目标审批人无效或无权审批该资源", 400),
    /** 申请单状态不允许该流转（如已通过再次驳回 / 非当前审批人操作）；须刷新申请单最新状态【策略 F】 */
    APPROVAL_STATE_ERROR(1011, "当前审批状态不允许该操作", 409),

    /* ---------- 协作会话 / 通知（1012~1014） ---------- */
    /** 群聊发送/拉取校验失败：当前用户不在该群组成员表内，拒绝投递【策略 D】 */
    CHAT_NOT_GROUP_MEMBER(1012, "你不是该群组成员，无法参与该群聊", 403),
    /** 会话目标无效（单聊不可发给自己、目标用户不存在或已注销）【策略 E】 */
    CHAT_TARGET_INVALID(1013, "会话目标无效", 400),
    /** 消息体类型不允许用于会话（会话只承载文本 / 文件传输 / 审批结果三类）【策略 E】 */
    CHAT_MESSAGE_TYPE_INVALID(1014, "消息类型不允许用于会话", 400),

    /* ---------- 系统管理面：用户 / 角色（1015~1028） ---------- */
    /** 用户不存在 / 已被逻辑删除（被管理的账号维度，区别于 1001 的登录态维度）【策略 E】 */
    USER_NOT_FOUND(1015, "用户不存在或已被删除", 404),
    /** 登录账号已被占用（唯一键口径，含已被删除的历史账号名）【策略 F】 */
    USERNAME_CONFLICT(1016, "登录账号已存在", 409),
    /** 邮箱已被其他用户使用（非空值去重口径）【策略 F】 */
    EMAIL_CONFLICT(1017, "邮箱已被使用", 409),
    /** 角色不存在 / 已被删除【策略 E】 */
    ROLE_NOT_FOUND(1018, "角色不存在", 404),
    /** 角色编码已被占用（角色编码是授权判定的稳定标识，不可重名）【策略 F】 */
    ROLE_CODE_CONFLICT(1019, "角色编码已存在", 409),
    /** 内置角色受保护，不可删除（SUPER_ADMIN / AUDITOR / DEPT_ADMIN / USER）【策略 D】 */
    BUILT_IN_ROLE_PROTECTED(1020, "内置角色不可删除", 403),
    /** 审计员角色权限锁定只读：对 AUDITOR 的权限集做任何变更均被拒绝（三权分立的锚点）【策略 D】 */
    AUDITOR_PERM_LOCKED(1021, "审计员角色权限锁定只读，不可变更", 403),
    /** 角色仍被用户占用，删除前须先解除分配；刷新角色列表后重试【策略 F】 */
    ROLE_IN_USE(1022, "该角色已分配给用户，请先解除分配", 409),
    /** 不能对当前登录账号执行该操作（停用 / 删除 / 改角色 / 重置自己的口令）【策略 D】 */
    SELF_OPERATION_FORBIDDEN(1023, "不能对当前登录账号执行该操作", 403),
    /** 内置管理员账号（admin）受保护，不可停用 / 删除 / 改名【策略 D】 */
    PROTECTED_ACCOUNT(1024, "内置管理员账号受保护，不可停用或删除", 403),
    /** 部门不存在（调岗目标无效）【策略 E】 */
    DEPT_NOT_FOUND(1025, "部门不存在", 404),
    /** 权限点不存在（角色授权入参越界）【策略 E】 */
    PERMISSION_NOT_FOUND(1026, "权限点不存在", 400),
    /** 防提权：不能把「你自己不具备的角色 / 权限点」授予他人（数据范围非全部时生效）【策略 D】 */
    PRIVILEGE_ESCALATION(1027, "不能授予你自身不具备的角色或权限", 403),
    /** 防自锁：该变更会让内置超级管理员失去角色 / 权限点管理能力，已拒绝【策略 F】 */
    ADMIN_SELF_LOCKOUT(1028, "该变更会使超级管理员失去管理能力，已拒绝", 409),

    /* ======================== 2xxx：参数校验 ======================== */
    /**
     * 通用参数错误（含 {@code @Valid} 请求体验证失败的兜底）【策略 E】
     */
    PARAM_ERROR(2001, "参数错误", 400),
    /** 缺少必填参数（Query / Form / 请求头 / 路径变量）【策略 E】 */
    PARAM_MISSING(2002, "缺少必要参数", 400),
    /** 参数格式不正确（如邮箱 / 手机号 / 日期格式）【策略 E】 */
    PARAM_FORMAT_ERROR(2003, "参数格式不正确", 400),
    /** 参数类型不匹配（路径参数类型错误 / 请求体 JSON 无法解析）【策略 E】 */
    PARAM_TYPE_ERROR(2004, "参数类型不匹配", 400),
    /** 参数取值超出允许范围（枚举值、数值边界、长度上限等）【策略 E】 */
    PARAM_OUT_OF_RANGE(2005, "参数超出允许范围", 400),

    /* ====================== 4xxx：文件 / 传输 ====================== */

    /* ---------- 上传链路：秒传 / 分片 / 完整性（4001~4003） ---------- */
    /** 秒传未命中：服务端不存在相同 SHA-256 的文件，需按分片上传（流程分支码，HTTP 200）【策略 B】 */
    INSTANT_UPLOAD_MISS(4001, "秒传未命中，请按分片上传", 200),
    /** 分片缺失：续传/校验发现服务端缺少指定分片，响应体附缺失分片清单（流程分支码，HTTP 200）【策略 B】 */
    CHUNK_MISSING(4002, "分片缺失，请按服务端清单续传", 200),
    /** 合并后完整性校验失败：重组文件 SHA-256 与客户端上报不一致；必须重新上传，不可续传【策略 F】 */
    FILE_INTEGRITY_ERROR(4003, "文件完整性校验失败，请重新上传", 409),

    /* ---------- 文件通用（4005~4009） ---------- */
    /** 文件不存在 / 已被删除 / 逻辑删除；提示后刷新列表【策略 E】 */
    FILE_NOT_FOUND(4005, "文件不存在或已被删除", 404),
    /** 文件大小超出限制（默认 10 GiB）；不可重试，须换文件或放弃【策略 E】 */
    FILE_TOO_LARGE(4006, "文件大小超出限制", 413),
    /** 文件类型不允许（扩展名 / MIME 黑名单）；不可重试【策略 E】 */
    FILE_TYPE_NOT_ALLOWED(4007, "文件类型不允许", 415),
    /** 文件上传失败（分片落盘 / 存储介质异常等）；可安全重试，已传分片保留可续传【策略 E】 */
    FILE_UPLOAD_FAIL(4008, "文件上传失败，请稍后重试", 400),
    /** 文件下载失败（读取 / 流式输出异常）；可安全重试（下载幂等，支持 Range）【策略 E】 */
    FILE_DOWNLOAD_FAIL(4009, "文件下载失败，请稍后重试", 400),

    /* ---------- 通用资源（4040） ---------- */
    /**
     * 资源不存在：未知请求路径 / 非文件类资源未找到（HTTP 404 的统一承载，
     * 区别于 4005 的文件维度，保证 404 也返回统一 Result 而非容器默认错误页）【策略 E】
     */
    RESOURCE_NOT_FOUND(4040, "资源不存在", 404),

    /* ---------- 外发分享（4004 / 4010~4012） ---------- */
    /** 外发链接已过期或下载次数用尽；服务端副作用：通知创建者【策略 F】 */
    SHARE_EXPIRED_OR_LIMIT(4004, "外发链接已过期或下载次数用尽", 410),
    /** 外发链接已被创建者撤销；不可恢复【策略 F】 */
    SHARE_REVOKED(4012, "外发链接已被撤销", 410),
    /** 提取码错误；服务端副作用：错误计数 +1，连续达阈值转 4011【策略 D】 */
    SHARE_CODE_ERROR(4010, "提取码错误", 403),
    /** 提取码连续错误次数过多，链接已临时锁定（默认 5 次锁 30 min）；服务端副作用：通知创建者【策略 G】 */
    SHARE_LOCKED(4011, "提取码错误次数过多，链接已临时锁定", 429),

    /* ---------- 文件管理：目录 / 回收站 / 票据 / 打包 / 标签 / 版本（4013~4023） ---------- */
    /** 目录不存在或已删除；提示后刷新目录树【策略 E】 */
    FOLDER_NOT_FOUND(4013, "目录不存在或已被删除", 404),
    /** 同一父目录下已存在同名目录或文件；改名后重试【策略 F】 */
    FOLDER_NAME_CONFLICT(4014, "同一目录下已存在同名项目", 409),
    /** 目录移动非法：不能移动到自身或其子孙目录下（会形成环）【策略 E】 */
    FOLDER_MOVE_INVALID(4015, "不能移动到自身或其子目录下", 400),
    /** 文件在回收站中，需先还原才能执行该操作；提示可跳转回收站【策略 F】 */
    FILE_IN_RECYCLE(4016, "文件已移入回收站，请先还原", 409),
    /** 彻底销毁条件不满足：非超级管理员，或未关联「已通过」的高敏感审批单【策略 D】 */
    FILE_DESTROY_FORBIDDEN(4017, "彻底销毁需超级管理员权限并关联已通过的高敏感审批单", 403),
    /** 下载票据无效：已过期 / 非本人票据 / 票据与所请求文件不匹配（换绑即失效）【策略 D】 */
    FILE_TICKET_INVALID(4018, "下载凭证无效或已过期", 403),
    /** 打包超限：文件数或合计大小超上限，创建入口即拒绝，不接任务【策略 E】 */
    PACK_LIMIT_EXCEEDED(4019, "超出打包限制（文件数或总大小）", 400),
    /** 打包任务不存在或非本人任务；刷新打包任务列表【策略 E】 */
    PACK_TASK_NOT_FOUND(4020, "打包任务不存在", 404),
    /** 打包产物已过期（默认保留 24h）或被清理；需重新发起打包【策略 F】 */
    PACK_PRODUCT_EXPIRED(4021, "打包产物已过期，请重新发起打包", 410),
    /** 标签名在同一用户下已存在；沿用已有标签或改名【策略 F】 */
    TAG_NAME_CONFLICT(4022, "标签名已存在", 409),
    /** 文件历史版本不存在（版本号越界或该版本已被清理）【策略 E】 */
    FILE_VERSION_NOT_FOUND(4023, "文件历史版本不存在", 404),

    /* ---------- 通用限流（4290，@RateLimit 骨架落地） ---------- */
    /**
     * 接口级限流超限：固定窗口内请求数超阈值；前端按策略 G 退避重试（HTTP 429）【策略 G】
     */
    RATE_LIMITED(4290, "请求过于频繁，请稍后重试", 429),

    /* ---------- 传输任务（410x） ---------- */
    /** 传输任务不存在（被清理 / ID 错误）；刷新任务列表【策略 E】 */
    TRANSFER_TASK_NOT_FOUND(4101, "传输任务不存在", 404),
    /** 当前传输状态不允许该操作（如已完成的任务不可再次开始）；须先拉最新状态【策略 F】 */
    TRANSFER_STATE_ERROR(4102, "当前传输状态不允许该操作", 409),
    /** 传输速率 / 并发超过限制；可安全重试，按指数退避并降低并发【策略 G】 */
    TRANSFER_LIMIT_EXCEEDED(4103, "超出传输并发或流量限制", 429),

    /* ======================== 5xxx：系统异常 ======================== */
    /**
     * 通用系统错误（全局异常兜底）；对外只回本码 + traceId，堆栈仅落服务端日志【策略 H】
     */
    SYSTEM_ERROR(5001, "系统繁忙，请稍后重试", 500),
    /** 数据库访问异常【策略 H】 */
    DB_ERROR(5002, "数据库访问异常", 500),
    /** 远程服务调用异常（对象存储 / 第三方 API 等）【策略 H】 */
    REMOTE_CALL_ERROR(5003, "远程服务调用异常", 502),
    /** 未知异常兜底【策略 H】 */
    UNKNOWN_ERROR(5999, "未知异常", 500);

    /** 业务状态码（写入 Result.code，前端业务主判据） */
    private final int code;

    /** 默认提示信息（写入 Result.message） */
    private final String message;

    /** HTTP 语义状态码（由网关 GlobalExceptionHandler 映射到 HTTP 响应状态） */
    private final int httpStatus;

    ErrorCode(int code, String message, int httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }

    /**
     * 按业务状态码反查枚举（<b>无异常</b>版本）。
     *
     * <p>面向<b>不可信输入</b>：过滤器写入的请求属性、上游回传码、配置项等。
     * 未登记时返回 {@link Optional#empty()}，由调用方自行降级，
     * 避免在异常处理路径上抛异常、反而被兜底处理器吞成 5001。</p>
     */
    public static Optional<ErrorCode> find(int code) {
        for (ErrorCode errorCode : values()) {
            if (errorCode.code == code) {
                return Optional.of(errorCode);
            }
        }
        return Optional.empty();
    }

    /**
     * 按业务状态码反查枚举（<b>fail-fast</b> 版本）。
     *
     * <p>面向<b>内部已知码</b>：未登记即属契约违规，直接抛异常提示补表。
     * 若输入来自外部 / 不可信来源，请改用 {@link #find(int)} 并显式降级。</p>
     *
     * @throws IllegalArgumentException 未知错误码（未登记即上线属契约违规，fail-fast 提示补表）
     */
    public static ErrorCode fromCode(int code) {
        return find(code).orElseThrow(() -> new IllegalArgumentException(
                "未知错误码: " + code + "（请先登记到 error-codes.md 与本文档）"));
    }
}
