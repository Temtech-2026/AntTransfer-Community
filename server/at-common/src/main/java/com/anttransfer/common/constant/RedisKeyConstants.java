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
package com.anttransfer.common.constant;

/**
 * Redis Key 统一规划（唯一来源：各模块禁止手拼 Redis Key，一律经本类工厂方法生成）。
 *
 * <p>规约：</p>
 * <ul>
 *     <li>所有业务键统一前缀 {@code at:}（{@link #PREFIX}），同 Redis 实例内按应用/环境隔离，
 *         禁止出现无前缀或他前缀键；</li>
 *     <li>固定档 TTL（30min / 15min / 24h / 7d）以本类秒常量 + 注释为准；
 *         「随链接有效期」「常驻（Pub/Sub）」两类不设固定默认值，由调用方在写入时显式控制；</li>
 *     <li>计数/锁定类（登录失败、分享提取码）须走 Redis 原子指令（INCR + EXPIRE），
 *         禁止读-改-写（P-6）；</li>
 *     <li>本类仅承载「短期可丢失、可自愈」的会话加速/缓存/计数态（P-8：DB 为主、Redis 为加速），
 *         不存在只有 Redis 的关键判定——吊销、下载次数等正确性裁决一律以 DB 为权威。</li>
 * </ul>
 *
 * <p>Key 全景（镜像 system-design §7.1，新增/变更须两处同步）：</p>
 * <pre>
 *   at:token:access:{userId}   会话吊销纪元缓存（sys_user.token_epoch 镜像），TTL 30min，全端吊销主动失效
 *   at:token:refresh:{userId}  refresh 白名单指纹，TTL 7d，原子轮换 + 复用检测
 *   at:login:fail:{username}   登录失败计数，TTL 15min，阈值触发账号临时锁定
 *   at:upload:{uploadId}       分片上传任务状态镜像，TTL 24h（分片索引以 DB 为准）
 *   at:share:count:{token}     分享下载次数前置配额闸（DB 原子 UPDATE 裁决），TTL 随链接剩余有效期
 *   at:share:lock:{token}      分享提取码错误锁定，TTL 30min（错 5 次锁 30min，PRD US-03 / D-8）
 *   at:share:ticket:{ticket}   访客一次性下载/预览票据，TTL 5min，GETDEL 原子取用（一次即焚）
 *   at:file:ticket:{ticket}    登录用户下载票据，TTL 5min，绑定 userId+nodeId+fileId，可重试至过期
 *   at:perm:{userId}           用户权限标识缓存，TTL 30min，授权变更主动失效
 *   at:perm:escalate:{appId}   超时未审批升级提醒幂等键，默认 TTL 24h
 *   at:perm:emergency:{appId}  紧急通道强提醒幂等键（P1 开关），默认 TTL 30min
 *   at:rl:{类}#{方法}[:biz]:{维度}  固定窗口限流计数，TTL = 注解 windowSeconds（Lua INCR+EXPIRE）
 *   at:ws:channel              集群 WebSocket 广播频道（Pub/Sub），常驻
 * </pre>
 *
 * @author AntTransfer CE
 */
public final class RedisKeyConstants {

    private RedisKeyConstants() {
    }

    /** Redis Key 统一前缀（所有业务键必须以它开头） */
    public static final String PREFIX = "at:";

    /* ======================= 登录态：双 Token 会话 ======================= */

    /** 会话吊销纪元缓存键前缀：at:token:access:{userId}（缓存 sys_user.token_epoch，access 鉴权比对） */
    public static final String ACCESS_TOKEN_PREFIX = PREFIX + "token:access:";
    /**
     * 吊销纪元缓存 TTL：30min。
     * 本键仅是 {@code sys_user.token_epoch} 的读加速镜像，权威在 DB：鉴权 miss 回源 DB 自愈（P-8），
     * 全端吊销（epoch+1）/ 主动失效场景一律 DEL，不存在“缓存过期导致吊销失效”。
     */
    public static final long ACCESS_TOKEN_TTL_SECONDS = 30 * 60L;

    /** refresh token 白名单键：at:token:refresh:{userId}（值=最新 refresh 指纹，原子轮换 + 复用检测） */
    public static final String REFRESH_TOKEN_PREFIX = PREFIX + "token:refresh:";
    /** refresh 白名单 TTL：7d（每用户单活跃白名单，后登顶替刷新权） */
    public static final long REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60L;

    /* ========================== 认证安全防护 ========================== */

    /** 登录失败计数键前缀：at:login:fail:{username}（INCR + EXPIRE，达阈值账号临时锁定，[D-03]） */
    public static final String LOGIN_FAIL_PREFIX = PREFIX + "login:fail:";
    /** 登录失败计数 TTL：15min */
    public static final long LOGIN_FAIL_TTL_SECONDS = 15 * 60L;

    /* ========================== 文件 / 传输 ========================== */

    /** 分片上传任务状态键前缀：at:upload:{uploadId}（任务进度/状态镜像；分片索引持久于 DB） */
    public static final String UPLOAD_TASK_PREFIX = PREFIX + "upload:";
    /** 分片上传任务状态 TTL：24h（与分片暂存保留期一致，超时自动回收；DB 状态机为准） */
    public static final long UPLOAD_TASK_TTL_SECONDS = 24 * 60 * 60L;

    /* ============================ 外发分享 ============================ */

    /**
     * 分享下载次数前置配额键前缀：at:share:count:{token}。
     * Redis 仅作前置配额闸（DECR 快速拒绝已用尽链接，减少 DB 命中）与计数镜像；
     * 放行唯一裁决是 DB 原子 UPDATE（downloaded_count < download_limit，防超卖），
     * 键丢失时跳过前置闸回源 DB 并重建镜像（P-8）；TTL 随链接剩余有效期动态设置。
     */
    public static final String SHARE_COUNT_PREFIX = PREFIX + "share:count:";

    /** 分享提取码错误锁定键前缀：at:share:lock:{token}（INCR + EXPIRE） */
    public static final String SHARE_LOCK_PREFIX = PREFIX + "share:lock:";
    /**
     * 提取码错误锁定 TTL：30min（连续错 5 次临时锁 30min）。
     *
     * <p>需求权威源 = PRD US-03；与 system-design §5.3 / §7.1、红队 [C-08] 及 CHANGELOG D-8 裁定一致
     * （D-8 已裁定「15 min 系与 at:login:fail 串行误抄」）。运行期可由
     * {@code anttransfer.file.share.code-lock-duration} 覆盖，默认取本常量。</p>
     */
    public static final long SHARE_LOCK_TTL_SECONDS = 30 * 60L;

    /**
     * 访客一次性下载/预览票据键前缀：at:share:ticket:{ticket}。
     *
     * <p>值为票据载荷 JSON（关联 shareToken / fileId / 访问类型），<b>GETDEL</b> 原子取用保证「一次即焚」；
     * 属短期可丢失态：丢失仅表现为访客需重新过校验链换票，不影响下载次数正确性（次数裁决以 DB 为准，P-8）。</p>
     */
    public static final String SHARE_TICKET_PREFIX = PREFIX + "share:ticket:";
    /** 票据默认 TTL：5min（可由 {@code anttransfer.file.share.ticket-ttl} 覆盖；仅需覆盖「校验→取件」间隔） */
    public static final long SHARE_TICKET_TTL_SECONDS = 5 * 60L;
    /**
     * 访客核销后取件票据键前缀：at:share:pick:{ticket}。
     *
     * <p>核销（{@code POST /v1/shares/redeem}）时由一次性票据换发，绑定
     * {@code shareId + fileId + accessType}，值为同一份 {@code TicketPayload} JSON。
     * <b>与 {@link #SHARE_TICKET_PREFIX} 的关键差别是「可重复读」</b>：一次性票回答「谁有权取件」
     * （GETDEL 一次即焚，红队 [V-05]），本票只回答「把这一次取件读完」——浏览器重试、
     * {@code Range} 断点续传、多线程分段拉取都会重复请求同一取件地址，若按一次即焚实现，
     * 这些正常行为会被判成 4004。次数闸门不受影响：下载次数已在核销瞬间由 DB 原子扣减，
     * TTL 内重复读不会凭空多出下载额度。</p>
     */
    public static final String SHARE_PICK_PREFIX = PREFIX + "share:pick:";

    /* ======================== 文件管理：下载票据 ======================== */

    /**
     * 登录用户下载票据键前缀：at:file:ticket:{ticket}。
     *
     * <p>用途：把「鉴权 + 归属校验」与「真正取件」解耦——下载链接（含票据）可交给浏览器原生下载、
     * 播放器或下载工具，这些场景无法携带 Authorization 头，故用短时票据替代长 Token 暴露在 URL 上。</p>
     *
     * <p>载荷 JSON 固定绑定 {@code userId + nodeId + fileId + expireAt}：
     * 取件时必须逐项比对，<b>任一不匹配即 4018</b>——防止 A 用自己的票据下载 B 的文件
     * （票据是承载权限的凭证，不能只验真伪、不验绑定对象）。</p>
     *
     * <p>与 {@link #SHARE_TICKET_PREFIX} 的区别：分享票据是<b>访客</b>的（绑定 shareToken + 一次即焚），
     * 本票据是<b>登录用户</b>的（绑定 userId + 可重复使用至过期，因为同一用户重试下载属正常行为）。</p>
     */
    public static final String FILE_TICKET_PREFIX = PREFIX + "file:ticket:";
    /** 下载票据默认 TTL：5min（可由 {@code anttransfer.file.download-ticket-ttl} 覆盖） */
    public static final long FILE_TICKET_TTL_SECONDS = 5 * 60L;

    /* ============================ 权限缓存 ============================ */

    /** 用户权限标识缓存键前缀：at:perm:{userId}（该用户可达权限点聚合，授权变更后主动删除） */
    public static final String PERM_PREFIX = PREFIX + "perm:";
    /** 权限缓存 TTL：30min（兜底过期；授权变更走主动失效，RBAC 判定可重算，P-8） */
    public static final long PERM_TTL_SECONDS = 30 * 60L;

    /* ====================== 权限审批：提醒幂等抑制 ====================== */

    /**
     * 超时未审批「升级提醒」幂等键前缀：at:perm:escalate:{applicationId}。
     *
     * <p>纯抑制重复提醒的防御态键：丢失最多导致同一申请单多提醒一次，不影响审批状态正确性
     * （申请单状态与 SLA 判定始终以 DB 为准，P-8）。TTL 默认
     * {@link #PERM_ESCALATION_TTL_SECONDS}，可由 {@code anttransfer.permission.approval.escalation-idempotent-window} 覆盖。</p>
     */
    public static final String PERM_ESCALATION_PREFIX = PREFIX + "perm:escalate:";
    /** 升级提醒幂等默认 TTL：24h（同一申请单每日最多升级提醒一次） */
    public static final long PERM_ESCALATION_TTL_SECONDS = 24 * 60 * 60L;

    /**
     * 紧急通道「强提醒」幂等键前缀：at:perm:emergency:{applicationId}（P1 开关，默认关闭）。
     *
     * <p>语义同上：仅抑制重复强提醒，丢失不影响正确性；TTL 默认
     * {@link #PERM_EMERGENCY_TTL_SECONDS}，可由 {@code ...approval.emergency.idempotent-window} 覆盖。</p>
     */
    public static final String PERM_EMERGENCY_PREFIX = PREFIX + "perm:emergency:";
    /** 紧急强提醒幂等默认 TTL：30min */
    public static final long PERM_EMERGENCY_TTL_SECONDS = 30 * 60L;

    /* ============================ 接口限流 ============================ */

    /**
     * 固定窗口限流计数键前缀：at:rl:{类}#{方法}[:业务key]:{维度}（键值 = 窗口内计数）。
     * TTL 由 {@code @RateLimit(windowSeconds)} 逐端点指定（窗口即 TTL，数值动态，故不设固定常量）。
     * 属防御态加速数据：Redis 丢失 / 异常仅放宽限流窗口，无正确性风险（P-8 降级放行）。
     */
    public static final String RATE_LIMIT_PREFIX = PREFIX + "rl:";

    /* ========================== WebSocket 集群 ========================== */

    /** 集群 WebSocket 广播频道（Redis Pub/Sub 频道名，常驻，无 TTL） */
    public static final String WS_CHANNEL = PREFIX + "ws:channel";

    /* ============================ 键生成方法 ============================ */

    /** 生成会话吊销纪元缓存键：at:token:access:{userId} */
    public static String accessTokenKey(long userId) {
        return ACCESS_TOKEN_PREFIX + userId;
    }

    /** 生成 refresh 白名单键：at:token:refresh:{userId} */
    public static String refreshTokenKey(long userId) {
        return REFRESH_TOKEN_PREFIX + userId;
    }

    /** 生成登录失败计数键：at:login:fail:{username} */
    public static String loginFailKey(String username) {
        return LOGIN_FAIL_PREFIX + username;
    }

    /** 生成分片上传任务状态键：at:upload:{uploadId} */
    public static String uploadTaskKey(long uploadId) {
        return UPLOAD_TASK_PREFIX + uploadId;
    }

    /** 生成分享下载次数前置配额键：at:share:count:{token} */
    public static String shareCountKey(String token) {
        return SHARE_COUNT_PREFIX + token;
    }

    /** 生成分享提取码锁定键：at:share:lock:{token} */
    public static String shareLockKey(String token) {
        return SHARE_LOCK_PREFIX + token;
    }

    /** 生成访客一次性下载/预览票据键：at:share:ticket:{ticket} */
    public static String shareTicketKey(String ticket) {
        return SHARE_TICKET_PREFIX + ticket;
    }

    /** 生成访客核销后取件票据键：at:share:pick:{ticket} */
    public static String sharePickKey(String ticket) {
        return SHARE_PICK_PREFIX + ticket;
    }

    /** 生成登录用户下载票据键：at:file:ticket:{ticket} */
    public static String fileTicketKey(String ticket) {
        return FILE_TICKET_PREFIX + ticket;
    }

    /** 生成用户权限缓存键：at:perm:{userId} */
    public static String permKey(long userId) {
        return PERM_PREFIX + userId;
    }

    /** 生成超时升级提醒幂等键：at:perm:escalate:{applicationId} */
    public static String permEscalationKey(long applicationId) {
        return PERM_ESCALATION_PREFIX + applicationId;
    }

    /** 生成紧急强提醒幂等键：at:perm:emergency:{applicationId} */
    public static String permEmergencyKey(long applicationId) {
        return PERM_EMERGENCY_PREFIX + applicationId;
    }

    /**
     * 生成固定窗口限流计数键：at:rl:{target}[:{bizKey}]:{dimension}。
     *
     * @param target    限流目标标识，约定「类简名#方法名」
     * @param bizKey    业务隔离键（null / 空白则省略该段，如按 token、userId 分窗）
     * @param dimension 限流维度（默认客户端 IP；携带凭证端点可叠加业务维度）
     */
    public static String rateLimitKey(String target, String bizKey, String dimension) {
        StringBuilder key = new StringBuilder(RATE_LIMIT_PREFIX).append(target);
        if (bizKey != null && !bizKey.isBlank()) {
            key.append(':').append(bizKey.trim());
        }
        return key.append(':').append(dimension).toString();
    }
}
