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

import com.anttransfer.common.ratelimit.RateLimit;
import com.anttransfer.common.result.Result;
import com.anttransfer.file.model.dto.RedeemTicketRequest;
import com.anttransfer.file.model.dto.VerifyShareRequest;
import com.anttransfer.file.model.vo.SharePayloadVO;
import com.anttransfer.file.model.vo.ShareTicketVO;
import com.anttransfer.file.service.FileDownloadService;
import com.anttransfer.file.service.ShareAccessService;
import com.anttransfer.file.util.WebRequestInfo;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 外发分享访客侧端点（<b>免登录</b>，需配置进 {@code anttransfer.auth.permit-all} 白名单）。
 *
 * <p><b>鉴权口径</b>：访客侧<b>不</b>经过 {@code file:share} 功能权限与登录态，凭「高熵令牌 + 提取码」
 * 自证身份。因此本类端点必须：① 进白名单；② 加 {@link RateLimit} 抗爆破 / 刷量；
 * ③ 服务层对令牌、有效期、提取码、次数逐项校验（见 {@code ShareAccessService}）。</p>
 *
 * <p><b>三步式取件</b>：① {@code /{token}/verify} 换一次性票据（GETDEL，TTL 5 min）；
 * ② {@code /redeem} 凭票据核销并取回元信息 + 取件票；③ {@code /{token}/content} 凭取件票流式取字节。
 * 一次性票回答「谁有权取件」（不可重放），取件票回答「把这一次取件读完」（可重复读，撑 Range 续传）——
 * 两票分工的原因见 {@code ShareTicketService} 类注释。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/shares")
public class ShareAccessController {

    private final ShareAccessService shareAccessService;
    private final FileDownloadService fileDownloadService;

    public ShareAccessController(ShareAccessService shareAccessService, FileDownloadService fileDownloadService) {
        this.shareAccessService = shareAccessService;
        this.fileDownloadService = fileDownloadService;
    }

    /**
     * 换票：校验令牌 / 有效期 / 提取码 / 次数后签发一次性下载或预览票据。
     *
     * <p>限流按 IP 维度 10 次 / 分钟；提取码连错 5 次另有 30 min 锁定（业务态，与限流互补）。</p>
     */
    @PostMapping("/{token}/verify")
    @RateLimit(windowSeconds = 60, max = 10, key = "share-verify", message = "验证过于频繁，请稍后再试")
    public Result<ShareTicketVO> verify(@PathVariable String token,
                                        @Valid @RequestBody VerifyShareRequest request) {
        return Result.ok(shareAccessService.verify(token, request,
                WebRequestInfo.clientIp(), WebRequestInfo.userAgent()));
    }

    /**
     * 核销取件：票据取用即焚 → 二次校验链接状态 → 原子扣减次数 → 写审计并返回载荷 + 取件票。
     */
    @PostMapping("/redeem")
    @RateLimit(windowSeconds = 60, max = 30, key = "share-redeem", message = "取件过于频繁，请稍后再试")
    public Result<SharePayloadVO> redeem(@Valid @RequestBody RedeemTicketRequest request) {
        return Result.ok(shareAccessService.redeem(request,
                WebRequestInfo.clientIp(), WebRequestInfo.userAgent()));
    }

    /**
     * 取件：凭核销时换发的取件票流式下发字节，支持 {@code Range} 断点续传。
     *
     * <p><b>为什么额度比核销宽</b>：一次取件在传输层会被拆成多次请求（浏览器重试、{@code Range}
     * 分段、多线程下载器），限流过紧会把正常下载打成 429。此处 120 次 / 分钟是按「单文件
     * 64 线程 + 重试」估的上界，且取件票本身已绑定链接、下载次数也已在核销时扣减，
     * 刷本端点只能重复读同一份已付费内容，拿不到新额度。</p>
     *
     * <p><b>响应语义</b>：{@code accessType=download} 走 {@code attachment}（回显存储 MIME）；
     * {@code accessType=preview} 走 {@code inline}，且仅限可安全内联的类型（PDF / 光栅图），
     * 其余类型显式失败而不会静默降级为下载。</p>
     */
    @GetMapping("/{token}/content")
    @RateLimit(windowSeconds = 60, max = 120, key = "share-content", message = "取件过于频繁，请稍后再试")
    public void content(@PathVariable String token,
                        @RequestParam String ticket,
                        @RequestParam(required = false) Long speedLimit,
                        @RequestHeader(value = HttpHeaders.RANGE, required = false) String range,
                        HttpServletResponse response) {
        ShareAccessService.SharedContent content = shareAccessService.resolveContent(token, ticket);
        boolean inline = ShareAccessService.ACCESS_PREVIEW.equals(content.accessType());
        fileDownloadService.streamSharedFile(content.file(), inline, speedLimit, range, response);
    }
}
