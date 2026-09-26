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
package com.anttransfer.auth.controller;

import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.file.AvatarStoragePort;
import com.anttransfer.common.ratelimit.RateLimit;
import com.anttransfer.common.result.ErrorCode;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Optional;

/**
 * 用户头像直出（<b>免登录</b>，路径已登记进 {@code SecurityConfig.BUILT_IN_PERMIT_ALL}）。
 *
 * <p><b>为什么在 at-auth 而不是 at-file：</b>本端点读的是 {@code sys_user.avatar_url}
 * （表主是 at-auth），字节则来自 {@link AvatarStoragePort}（实现在 at-file）。
 * 放在 at-file 会把 {@code SysUser} 拉进文件模块，放在 at-permission 会让「看头像」
 * 依赖一个只管系统管理的模块——两者都是让展示路径背上本不该有的依赖。</p>
 *
 * <p><b>鉴权口径（务必与 SecurityConfig 里的说明一致）：</b>这是一条按设计公开的
 * 读取路径——<b>没有</b>服务层凭证复核。放行依据是「内容低敏感（只有图片字节）
 * + 用户 ID 不可枚举 + 本端点 {@link RateLimit} 限流」。因此本端点<b>只能</b>
 * 返回图片字节：一旦需要返回昵称 / 部门 / 工号等信息，必须改为「登录态换票 + 凭票取字节」
 * （照文件取件端点 {@code /v1/files/{id}/content}），否则等于把账号信息匿名开放。</p>
 *
 * <p><b>为什么 ?v= 参数不参与取图：</b>它只是缓存版本号（见
 * {@link AvatarStoragePort#urlOf}）。服务端始终返回该用户的<b>当前</b>头像，
 * 所以带过期 v 的老页面只会命中缓存里的旧图，不会 404；反之若拿 v 去校验，
 * 换头像后所有在途页面都会立刻变成碎图。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class UserAvatarController {

    /**
     * 限流：按「源 IP + 路径」计数。
     *
     * <p>取值偏宽松（60 秒 300 次）：一个正常页面会同时请求顶栏 + 列表里几十个头像，
     * 阈值定太低会把正常加载打成 429（前端策略 G 会退避重试，表现为头像批量加载缓慢）。
     * 它的作用是抬高「拿已知 ID 批量遍历」的成本，而不是精确配额。</p>
     */
    private static final long RATE_LIMIT_WINDOW_SECONDS = 60;
    private static final long RATE_LIMIT_MAX = 300;

    private final UserMapper userMapper;
    private final AvatarStoragePort avatarStoragePort;

    /**
     * 读某个用户的当前头像。
     *
     * @param userId   用户 ID（雪花 ID）
     * @param version  缓存版本号，服务端不解析（见类注）
     * @param response 直接写字节流
     */
    @GetMapping("/v1/users/{userId}/avatar")
    @RateLimit(windowSeconds = RATE_LIMIT_WINDOW_SECONDS, max = RATE_LIMIT_MAX, key = "user-avatar",
            message = "头像请求过于频繁")
    public void avatar(@PathVariable Long userId,
                       @RequestParam(name = "v", required = false) String version,
                       HttpServletResponse response) throws IOException {
        String key = userMapper.selectAvatarKey(userId);
        if (key == null || key.isBlank()) {
            // 「有账号但没头像」与「没有这个账号」回同一个码：既省一次存在性查询，
            // 也避免把「这个 ID 是不是有效账号」当作可探测信息泄漏出去。
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND);
        }

        Optional<AvatarStoragePort.StoredAvatar> stored = avatarStoragePort.load(key);
        if (stored.isEmpty()) {
            // key 在库里但文件不见了（手工清理 / 迁移漏拷）：报资源不存在而不是 500，
            // 前端按「没有头像」回落到首字母兜底图，不会出现错误提示。
            log.warn("头像 key 存在于库中但读不到文件：userId={}, key={}", userId, key);
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND);
        }

        AvatarStoragePort.StoredAvatar avatar = stored.get();
        // key 每次上传都变，故 ETag 用 key 即可做强校验；配合 v 参数可放心长缓存。
        response.setHeader("ETag", "\"" + avatar.etag() + "\"");
        response.setHeader("Cache-Control", "public, max-age=600");
        // 不靠「扩展名白名单」兜底 XSS：显式禁止浏览器按内容嗅探改判类型。
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setContentType(avatar.contentType());
        response.setContentLength(avatar.content().length);
        response.getOutputStream().write(avatar.content());
        response.flushBuffer();
    }
}
