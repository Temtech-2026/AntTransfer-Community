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
import com.anttransfer.common.ratelimit.RateLimit;
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.result.Result;
import com.anttransfer.file.model.dto.CreateChatAttachmentRequest;
import com.anttransfer.file.model.vo.ChatAttachmentTicketVO;
import com.anttransfer.file.model.vo.ChatAttachmentVO;
import com.anttransfer.file.model.vo.UploadResultVO;
import com.anttransfer.file.security.CurrentUserContext;
import com.anttransfer.file.service.ChatAttachmentService;
import com.anttransfer.file.service.FileDownloadService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 会话附件接口（L1 层：参数绑定 + 权限声明 + 响应包装）。
 *
 * <h3>权限口径：为什么这个 Controller 几乎没有 {@code @RequiresPerm}</h3>
 * <p>「把文件发给同事」是<b>会话能力</b>，不是文件管理能力。文件域在这里只提供取件通道
 * （取流 / 转存）。若给创建端点挂上 {@code file:share}（站外外发分享的权限点），
 * 就会把一个聊天功能错误地耦合到外发能力上——用户「能聊天但无权外发」时，
 * 发一条带附件的消息会被拒绝，而他做的并不是分享到站外。</p>
 *
 * <p>那么「能不能把这份文件发给这个人」由谁把关？由<b>归属</b>把关：
 * 发送方必须持有该条目（{@code FileOwnershipGuard} 在服务层校验），
 * 接收方则完全不需要对文件有任何权限——这正是本功能存在的意义（免申请取件）。
 * 因此本 Controller 的权限点只有一处真正需要：{@link #save} 会在<b>接收方自己的</b>
 * 文件空间里创建条目，这属于文件管理能力，故要求 {@code file:upload}。</p>
 *
 * <h3>两个免登录取件端点的权限归属</h3>
 * <p>{@code /content} 必须放行匿名请求——{@code <a href>} 原生下载、{@code <img src>}、
 * 播放器、下载工具都无法携带 Authorization 头。安全性由票据承担：
 * {@code /ticket} 在登录态下完成全部裁决（归属 / 撤销 / 有效期 / 用途档位 / 次数扣减 / 审计）
 * 并签发票据，取件时服务层再逐项复核「票据绑定 + 当前状态」。</p>
 *
 * <p>因此 {@code /ticket} 挂的是 {@code file:download} 吗？<b>不挂。</b> 换票人通常是
 * 「对发送方的文件没有任何权限点、但被发送方点名授权」的同事——若要求 {@code file:download}，
 * 权限点会在附件行判定之前先把他拦下，返回 1003 而非「附件已过期」这类真正有用的原因，
 * 且这个功能对普通员工会直接失效。判定权完全在附件行上（谁能取、取什么、取几次），
 * 与取件人在文件域的 RBAC 无关。</p>
 *
 * @author AntTransfer CE
 * @see ChatAttachmentService
 */
@RestController
@RequestMapping("/v1/chat-attachments")
@RequiredArgsConstructor
public class ChatAttachmentController {

    private final ChatAttachmentService chatAttachmentService;
    private final FileDownloadService fileDownloadService;

    /**
     * 创建会话附件授权（发送方在发出消息<b>之前</b>调用）。
     *
     * <p>返回的授权 ID 由会话侧写入消息正文尾注 {@code #att:{id}}——消息只携带 ID，
     * 用途限制与快照都留在这里，因为那些事实无法由前端上报。</p>
     *
     * @param request 创建参数（条目 + 接收方 + 三轴用途限制）
     * @return 授权视图
     */
    @PostMapping
    @RateLimit(windowSeconds = 60, max = 60, key = "chat-attach-create", message = "创建附件授权过于频繁，请稍后再试")
    public Result<ChatAttachmentVO> create(@Valid @RequestBody CreateChatAttachmentRequest request) {
        return Result.ok(chatAttachmentService.create(CurrentUserContext.currentUserId(), request));
    }

    /**
     * 撤销授权（发送方）。
     *
     * <p>撤销是发送方的绝对否决，立即生效（取件端点会回源复核状态，
     * 不会因为票据还在 TTL 内而继续放行）。幂等：重复撤销返回成功。</p>
     *
     * @param attachmentId 授权 ID
     * @return 空响应
     */
    @DeleteMapping("/{attachmentId}")
    public Result<Void> revoke(@PathVariable Long attachmentId) {
        chatAttachmentService.revoke(CurrentUserContext.currentUserId(), attachmentId);
        return Result.ok();
    }

    /**
     * 「我发出的」授权列表（分页，含已撤销 / 已失效）。
     *
     * <p>不过滤终态：发送方需要看到「哪一条已被撤销 / 已失效」——这既是他的操作结果，
     * 也是「接收方为什么取不到件」的唯一解释来源。</p>
     *
     * @param current  页码（从 1 起，缺省 1）
     * @param pageSize 每页条数（缺省 20，上界 100）
     * @return 分页结果
     */
    @GetMapping("/mine")
    public Result<PageResult<ChatAttachmentVO>> mine(
            @RequestParam(value = "current", defaultValue = "1") long current,
            @RequestParam(value = "pageSize", defaultValue = "20") long pageSize) {
        return Result.ok(chatAttachmentService.pageMine(CurrentUserContext.currentUserId(), current, pageSize));
    }

    /**
     * 「我收到的」授权列表（分页，含已撤销 / 已失效）。
     *
     * @param current  页码（从 1 起，缺省 1）
     * @param pageSize 每页条数（缺省 20，上界 100）
     * @return 分页结果
     */
    @GetMapping("/received")
    public Result<PageResult<ChatAttachmentVO>> received(
            @RequestParam(value = "current", defaultValue = "1") long current,
            @RequestParam(value = "pageSize", defaultValue = "20") long pageSize) {
        return Result.ok(chatAttachmentService.pageReceived(CurrentUserContext.currentUserId(), current, pageSize));
    }

    /**
     * 授权详情（发送方与接收方均可）。
     *
     * <p>路径变量放在 {@code /mine}、{@code /received} 之后声明，但 Spring 的路径模式匹配
     * 按「字面量优先于变量」排序，与声明顺序无关，故 {@code /mine} 不会被本方法吞掉。</p>
     *
     * @param attachmentId 授权 ID
     * @return 授权视图
     */
    @GetMapping("/{attachmentId}")
    public Result<ChatAttachmentVO> detail(@PathVariable Long attachmentId) {
        return Result.ok(chatAttachmentService.detail(CurrentUserContext.currentUserId(), attachmentId));
    }

    /**
     * 换取件票据（登录态；两步式取件的第一步）。
     *
     * <p>本端点是全部判定的裁决点：归属 → 撤销 → 有效期 → 用途档位 → 次数（原子扣减）→ 审计。
     * 取件类型 {@code accessType}：{@code preview}（缺省，只允许内联预览，不消耗下载次数）
     * 或 {@code download}（消耗一次额度）。</p>
     *
     * <p><b>限流口径：</b>换票是「判定 + 扣次」的唯一入口，被高频调用既可能是前端异常循环，
     * 也可能是有人在试探额度。给一个较宽的窗口（60s / 60 次）——正常的一次取件只换一次票，
     * 偶发的预览失败重试也远达不到上限。</p>
     *
     * @param attachmentId 授权 ID
     * @param accessType   {@code preview}（缺省）/ {@code download}
     * @return 票据视图（含免登录取件地址）
     */
    @PostMapping("/{attachmentId}/ticket")
    @RateLimit(windowSeconds = 60, max = 60, key = "chat-attach-ticket", message = "获取取件凭证过于频繁，请稍后再试")
    public Result<ChatAttachmentTicketVO> ticket(
            @PathVariable Long attachmentId,
            @RequestParam(value = "accessType", required = false) String accessType) {
        return Result.ok(chatAttachmentService.issueTicket(
                CurrentUserContext.currentUserId(), attachmentId, accessType));
    }

    /**
     * 取件：Range 流式下发（<b>免登录</b>，凭票据鉴权）。
     *
     * <p><b>为什么必须放行匿名：</b>{@code <a href>} 原生下载、{@code <img src>}、
     * 播放器与下载工具都无法携带 Authorization 头。安全性由票据承担（见类注释）。</p>
     *
     * <p>支持 {@code Range} 断点续传与全局限速。{@code disposition=inline} 仅对 PDF /
     * 光栅图生效（防内联 XSS）；预览票强制内联，不可内联的类型会以「不支持在线预览」拒绝，
     * <b>不会</b>降级为下载。</p>
     *
     * @param attachmentId 授权 ID
     * @param ticket       取件票据
     * @param disposition  {@code inline} / {@code attachment}（可空）
     */
    @GetMapping("/{attachmentId}/content")
    @RateLimit(windowSeconds = 60, max = 300, key = "chat-attach-content", message = "取件请求过于频繁，请稍后再试")
    public void content(@PathVariable Long attachmentId,
                        @RequestParam("ticket") String ticket,
                        @RequestParam(value = "disposition", required = false) String disposition,
                        HttpServletRequest request,
                        HttpServletResponse response) {
        ChatAttachmentService.AttachmentContent content =
                chatAttachmentService.resolveContent(attachmentId, ticket, disposition);
        // 复用外发分享的取流实现：Range / 限速 / 响应头 / 缺失字节流的失败口径完全一致，
        // 避免出现第二份会各自漂移的取流协议实现
        fileDownloadService.streamSharedFile(content.file(), content.inline(), null,
                request.getHeader(HttpHeaders.RANGE), response);
    }

    /**
     * 转存为接收方自己的文件条目（仅用途档位为「可转发转存」时可达）。
     *
     * <p>转存会在<b>接收方自己的</b>文件空间创建条目，属文件管理能力，故要求
     * {@code file:upload}；发送方的授权只解除「是否允许拿走」这一把锁，两把锁是与关系。</p>
     *
     * @param attachmentId 授权 ID
     * @return 转存结果（结构与上传一致）
     */
    @PostMapping("/{attachmentId}/save")
    @RequiresPerm("file:upload")
    @RateLimit(windowSeconds = 60, max = 30, key = "chat-attach-save", message = "转存过于频繁，请稍后再试")
    public Result<UploadResultVO> save(@PathVariable Long attachmentId) {
        return Result.ok(chatAttachmentService.saveToMyFiles(CurrentUserContext.currentUserId(), attachmentId));
    }
}
