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
 *   at:share:lock:{token}      分享提取码错误锁定，TTL 30min（错 5 次锁 30min，PRD US-03）
 *   at:perm:{userId}           用户权限标识缓存，TTL 30min，授权变更主动失效
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
    /** 提取码错误锁定 TTL：30min（连续错 5 次临时锁 30min，PRD US-03 / 红队 [C-08]） */
    public static final long SHARE_LOCK_TTL_SECONDS = 30 * 60L;

    /* ============================ 权限缓存 ============================ */

    /** 用户权限标识缓存键前缀：at:perm:{userId}（该用户可达权限点聚合，授权变更后主动删除） */
    public static final String PERM_PREFIX = PREFIX + "perm:";
    /** 权限缓存 TTL：30min（兜底过期；授权变更走主动失效，RBAC 判定可重算，P-8） */
    public static final long PERM_TTL_SECONDS = 30 * 60L;

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

    /** 生成用户权限缓存键：at:perm:{userId} */
    public static String permKey(long userId) {
        return PERM_PREFIX + userId;
    }
}
