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
package com.anttransfer.file.controller;

import com.anttransfer.common.permission.RequiresPerm;
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.result.Result;
import com.anttransfer.file.model.dto.CreateShareRequest;
import com.anttransfer.file.model.vo.ShareLinkVO;
import com.anttransfer.file.security.CurrentUserContext;
import com.anttransfer.file.service.ShareLinkService;
import com.anttransfer.file.util.WebRequestInfo;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 外发分享创建者侧端点（需登录 + {@code file:share} 功能权限）。
 *
 * <p>创建 / 撤销属写操作，均要求 {@code file:share}；查询（详情、我的分享）同样收口在该权限下，
 * 避免无权限用户借道枚举他人外发链接元数据。响应体一律 {@link ShareLinkVO}——<b>不含提取码</b>。</p>
 *
 * <p>访客侧免登录端点见 {@link ShareAccessController}（{@code /v1/shares/{token}/verify}、
 * {@code /v1/shares/redeem}），二者共用 {@code /v1/shares} 前缀但方法 / 路径不重叠。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/shares")
public class ShareController {

    /** 分页硬上限，防止一次拉全量（契约要求分页上界，AT-DIFF-03） */
    private static final long MAX_PAGE_SIZE = 100L;

    private final ShareLinkService shareLinkService;

    public ShareController(ShareLinkService shareLinkService) {
        this.shareLinkService = shareLinkService;
    }

    /**
     * 创建外发链接（PRD US-03）：文件 + 提取码 + 有效期 / 次数，命中后缀黑名单直接 4007 拦截。
     */
    @PostMapping
    @RequiresPerm("file:share")
    public Result<ShareLinkVO> create(@Valid @RequestBody CreateShareRequest request) {
        return Result.ok(shareLinkService.create(CurrentUserContext.currentUserId(), request,
                WebRequestInfo.clientIp(), WebRequestInfo.userAgent()));
    }

    /**
     * 撤销外发链接：已签发票据通过核销时的二次校验即时失效。
     */
    @DeleteMapping("/{token}")
    @RequiresPerm("file:share")
    public Result<Void> revoke(@PathVariable String token) {
        shareLinkService.revoke(CurrentUserContext.currentUserId(), token,
                WebRequestInfo.clientIp(), WebRequestInfo.userAgent());
        return Result.ok();
    }

    /**
     * 我的外发链接分页（仅本人，按创建时间倒序）。
     */
    @GetMapping("/mine")
    @RequiresPerm("file:share")
    public Result<PageResult<ShareLinkVO>> mine(@RequestParam(defaultValue = "1") long page,
                                                @RequestParam(defaultValue = "20") long size) {
        long safePage = Math.max(page, 1L);
        long safeSize = Math.min(Math.max(size, 1L), MAX_PAGE_SIZE);
        return Result.ok(shareLinkService.pageMine(CurrentUserContext.currentUserId(), safePage, safeSize));
    }

    /**
     * 外发链接详情（仅创建者本人可见）。
     */
    @GetMapping("/{token}")
    @RequiresPerm("file:share")
    public Result<ShareLinkVO> detail(@PathVariable String token) {
        return Result.ok(shareLinkService.detail(CurrentUserContext.currentUserId(), token));
    }
}
