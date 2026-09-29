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

import com.anttransfer.auth.model.dto.AuthDtos.UpdateNotifySettingRequest;
import com.anttransfer.auth.model.vo.AuthVos.NotifySettingVO;
import com.anttransfer.auth.model.vo.AuthVos.UserSummary;
import com.anttransfer.auth.service.SelfNotifySettingService;
import com.anttransfer.auth.service.SelfProfileService;
import com.anttransfer.common.file.NotificationSoundStoragePort;
import com.anttransfer.common.result.Result;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

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
 * <p><b>提示音内容端点为什么留在这里而不是像头像那样单独成类：</b>头像那条是<b>匿名</b>直出
 * （要出现在他人名单里），提示音这条是<b>本人的、须登录的</b>读取——它与本类其余端点
 * 同属「我的」语义，放一起不会产生鉴权口径冲突；这也是
 * {@link NotificationSoundStoragePort} 路径里没有 userId 的原因。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/users/me")
public class UserSelfController {

    private final SelfProfileService selfProfileService;
    private final SelfNotifySettingService selfNotifySettingService;

    public UserSelfController(SelfProfileService selfProfileService,
                              SelfNotifySettingService selfNotifySettingService) {
        this.selfProfileService = selfProfileService;
        this.selfNotifySettingService = selfNotifySettingService;
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

    /**
     * 读本人消息提示音设置（开关 / 音色 / 自定义音频信息与地址）。
     *
     * <p>从未设置过的用户也能直接调用：返回内置默认值，不报 404——
     * 「没设置过」是默认状态，不是错误。</p>
     */
    @GetMapping("/notify-setting")
    public Result<NotifySettingVO> myNotifySetting() {
        return Result.ok(selfNotifySettingService.getMine());
    }

    /**
     * 更新本人提示音开关与内置音色（{@code custom} 音色由上传接口落定，不在这里声明）。
     *
     * <p>请求体必须显式给出 {@code soundEnabled}：漏传会被 400 拦下，
     * 而不是被静默当成「关闭提示音」（见 {@code UpdateNotifySettingRequest} 类注）。</p>
     */
    @PutMapping("/notify-setting")
    public Result<NotifySettingVO> updateMyNotifySetting(
            @Valid @RequestBody UpdateNotifySettingRequest request) {
        return Result.ok(selfNotifySettingService.updateMine(request));
    }

    /**
     * 上传 / 替换本人自定义提示音（multipart，字段名 {@code file}）。
     *
     * <p>准入由服务端负责：容器按魔数识别（仅 MP3 / WAV / OGG，否则 4031）、
     * 大小上限 1 MiB（4029）、时长上限 10 秒（4030）、时长解析不出时 4032。
     * 上传成功即生效并把音色切到 {@code custom}。</p>
     */
    @PostMapping(value = "/notify-setting/sound", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<NotifySettingVO> uploadMyNotifySound(@RequestPart("file") MultipartFile file) {
        return Result.ok(selfNotifySettingService.uploadCustomSound(file));
    }

    /** 清空本人自定义提示音并把音色回退到内置默认值（幂等）。 */
    @DeleteMapping("/notify-setting/sound")
    public Result<NotifySettingVO> clearMyNotifySound() {
        return Result.ok(selfNotifySettingService.clearCustomSound());
    }

    /**
     * 直出本人自定义提示音字节（<b>须登录</b>，只回本人音频）。
     *
     * <p>与头像直出的关键差别：这里<b>不做匿名放行</b>、也<b>不做长缓存</b>——
     * 提示音只在本人已登录的会话里播放，少一个匿名入口就少一处越权面；
     * {@code ETag} 仍用存储 key（同一 key 内容永不变），前端据此判断是否要重新拉取。</p>
     */
    @GetMapping("/notify-setting/sound/content")
    public void myNotifySoundContent(HttpServletResponse response) throws IOException {
        NotificationSoundStoragePort.StoredSound sound = selfNotifySettingService.loadMyCustomSound();

        response.setHeader("ETag", "\"" + sound.etag() + "\"");
        // 自定义音频只有本人能取，且可能随时被替换：不加 public 缓存，交给浏览器按 ETag 协商
        response.setHeader("Cache-Control", "private, no-cache");
        // 不靠扩展名兜底防嗅探：显式禁止浏览器按内容改判类型
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setContentType(sound.contentType());
        response.setContentLength(sound.content().length);
        response.getOutputStream().write(sound.content());
        response.flushBuffer();
    }
}

