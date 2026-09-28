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

import com.anttransfer.auth.model.vo.AuthVos.UserSummary;
import com.anttransfer.auth.service.SelfProfileService;
import com.anttransfer.common.result.Result;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 本人资料自助端点（{@code /v1/users/me}，契约 docs/api/README.md §1
 * 「at-auth 负责本人资料 / 个人中心自助」）。
 *
 * <p><b>为什么是 {@code /v1/users/me} 而不是 {@code /v1/users/{id}}：</b>目标用户<b>不接受</b>
 * 客户端指定。「改我自己」这件事的唯一真相源是令牌里的 subject，路径里再来一个 ID
 * 就等于把「改谁」变成一个可被篡改的入参，必须在服务层再断言一次
 * 「参数 == 当前用户」——而这类「多一个可能填错的入参」正是越权漏洞的常见形状。
 * {@code me} 让越权在结构上不可达。</p>
 *
 * <p><b>为什么与 {@link UserAvatarController} 分成两个类：</b>那个类的契约是
 * 「<b>免登录</b>、只回图片字节」，被 SecurityConfig 白名单显式放行；本类恰恰相反——
 * 须持合法 access token，且回的是 JSON 摘要。两者塞进一个类，白名单与「只回字节」
 * 的边界就会被注释和代码互相打脸（改动的人很容易照着邻居的样子把写接口也顺手放行）。
 * 分开后，{@code /v1/users/{id}/avatar}（读、匿名）与 {@code /v1/users/me/avatar}
 * （写、须登录）在文件层面就各自成立。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/users/me")
public class UserSelfController {

    private final SelfProfileService selfProfileService;

    public UserSelfController(SelfProfileService selfProfileService) {
        this.selfProfileService = selfProfileService;
    }

    /**
     * 本人更换自己的头像（multipart，字段名 {@code file}）。
     *
     * <p>响应体回<b>变更后的本人摘要</b>（含新的头像地址），使发起端可以就地换图而不必
     * 再拉一次 {@code /v1/auth/me}；其他在线端由 {@code PROFILE} 广播帧同步。</p>
     *
     * <p>无权限点要求（不需要 {@code system:user:update}）——这是「人人都能改自己的头像」
     * 这条产品口径的唯一入口；管理他人头像仍走 {@code POST /v1/system/users/{id}/avatar}。</p>
     */
    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<UserSummary> changeMyAvatar(@RequestPart("file") MultipartFile file) {
        return Result.ok(selfProfileService.changeMyAvatar(file));
    }
}
