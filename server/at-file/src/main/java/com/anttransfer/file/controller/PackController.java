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
import com.anttransfer.file.model.dto.CreatePackRequest;
import com.anttransfer.file.model.vo.PackTaskVO;
import com.anttransfer.file.security.CurrentUserContext;
import com.anttransfer.file.service.PackService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 批量打包下载接口（P1）。
 *
 * <p>权限统一用 {@code file:download}：打包下载只是「一次拿走多个文件」，
 * 不该因为多选就抬高或降低门槛——能下载就能打包，不能下载就一个也拿不走。</p>
 *
 * <p><b>产物下发与本模块其它下载端点的差异：</b>{@code /content} 需要登录态携带 Authorization，
 * 因此适合前端用 {@code fetch}（可写入磁盘 / File System Access API）或下载工具带 Token 调用；
 * 它没有走「票据 + 匿名端点」那套，是因为产物只有本人能取、且带明显的时间窗（过期即 4026），
 * 额外票据的收益有限。若后续要支持「交给浏览器原生下载」，再补一张产物专用的一次性票据即可。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/packs")
@RequiredArgsConstructor
public class PackController {

    private final PackService packService;

    /**
     * 创建打包任务（入口即校验文件数 / 合计大小 / 每用户并发）。
     *
     * @param request 创建请求
     * @return 任务视图（排队中）
     */
    @PostMapping
    @RequiresPerm("file:download")
    public Result<PackTaskVO> create(@Valid @RequestBody CreatePackRequest request) {
        return Result.ok(packService.create(CurrentUserContext.currentUserId(), request));
    }

    /**
     * 我的打包任务分页。
     *
     * @param current  页码（从 1 起）
     * @param pageSize 每页条数
     * @return 分页结果
     */
    @GetMapping
    @RequiresPerm("file:download")
    public Result<PageResult<PackTaskVO>> page(@RequestParam(value = "current", defaultValue = "1") long current,
                                               @RequestParam(value = "pageSize", defaultValue = "20") long pageSize) {
        return Result.ok(packService.page(CurrentUserContext.currentUserId(), current, pageSize));
    }

    /**
     * 打包任务详情（前端轮询终态用）。
     *
     * @param taskId 任务 ID
     * @return 任务视图
     */
    @GetMapping("/{taskId}")
    @RequiresPerm("file:download")
    public Result<PackTaskVO> detail(@PathVariable Long taskId) {
        return Result.ok(packService.detail(CurrentUserContext.currentUserId(), taskId));
    }

    /**
     * 下发打包产物（支持 {@code Range} 续传）。
     *
     * @param taskId   任务 ID
     * @param request  HTTP 请求（取 {@code Range} 头）
     * @param response HTTP 响应
     */
    @GetMapping("/{taskId}/content")
    @RequiresPerm("file:download")
    @RateLimit(windowSeconds = 60, max = 60, key = "pack-content", message = "产物下载请求过于频繁，请稍后再试")
    public void content(@PathVariable Long taskId,
                        HttpServletRequest request,
                        HttpServletResponse response) {
        packService.downloadProduct(CurrentUserContext.currentUserId(), taskId,
                request.getHeader(HttpHeaders.RANGE), response);
    }
}
