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
package com.anttransfer.auth.service;

import com.anttransfer.auth.model.vo.AuthVos.UserSummary;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.auth.security.SecurityUtils;
import com.anttransfer.auth.util.AfterCommitUtils;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.common.event.UserProfileChangedEvent;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.file.AvatarStoragePort;
import com.anttransfer.common.file.ImageTypes;
import com.anttransfer.common.result.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 本人资料自助服务（当前仅头像）。
 *
 * <p><b>为什么这件事必须由 at-auth 自己承载，而不是复用 at-permission 的
 * {@code UserAdminService#uploadAvatar}：</b>那条路径要先过「系统管理」权限点与数据范围
 * （{@code system:user:update} + 可见性断言），它回答的是「管理员能不能改这个人的头像」；
 * 而本类回答的是「我能不能改我自己的头像」——<b>权限模型完全不同</b>：这里没有任何权限点，
 * 唯一的准入条件是「持有合法 access token」，且目标 ID 只能来自令牌，不能来自请求参数。
 * 若硬把两者合成一条路径，就得在服务层里写「若目标是自己则跳过权限校验」，
 * 那等于在权限校验器上开一个「只要参数填自己就放行」的口子，是典型的越权温床。</p>
 *
 * <p><b>为什么两个域各留一份「读图 + 校验 + 落盘 + 改库 + 删旧 + 发事件」的编排：</b>
 * 这段编排依赖 {@link MultipartFile} 与 Security 上下文，而 {@code at-common} 的依赖面被
 * 刻意压到「仅 mybatis-plus 注解 + slf4j + lombok」，承载不了 web 层能力；跨模块抽到某个
 * 业务模块又违反「各业务模块仅依赖 at-common」的模块铁律。属与 {@code AuthAuditLogger}
 * 同类的已知取舍。二者共享的是<b>契约与实现</b>——{@link AvatarStoragePort}（存储与 URL 拼接）、
 * {@link ImageTypes}（类型判定）、{@code UserMapper#updateAvatar}（落库列）、
 * {@link UserProfileChangedEvent}（变更通知），重复的只是十余行流程胶水。</p>
 *
 * <p>不做的事：<b>不吊销会话</b>（换头像不参与任何授权判定，把人踢下线是纯伤害）、
 * <b>不触发权限重评估</b>、<b>不改动头像以外的列</b>。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
public class SelfProfileService {

    private final UserMapper userMapper;
    private final AvatarStoragePort avatarStoragePort;
    private final AuthAuditLogger auditLogger;
    private final ApplicationEventPublisher eventPublisher;
    private final AuthService authService;

    public SelfProfileService(UserMapper userMapper,
                              AvatarStoragePort avatarStoragePort,
                              AuthAuditLogger auditLogger,
                              ApplicationEventPublisher eventPublisher,
                              AuthService authService) {
        this.userMapper = userMapper;
        this.avatarStoragePort = avatarStoragePort;
        this.auditLogger = auditLogger;
        this.eventPublisher = eventPublisher;
        this.authService = authService;
    }

    /**
     * 本人更换自己的头像（上传即生效）。
     *
     * <p><b>三步顺序都是刻意的：</b>① 校验并落盘新图 → ② 改库指向新 key
     * （成功即生效，且新图已经就位，不存在「库里有引用但文件还没写完」的窗口）
     * → ③ 提交成功后再删旧图。任一步失败都只留下「无害的孤儿文件」，
     * 而不会出现「库里指向一个不存在的文件」这种永久碎图。</p>
     *
     * @param file 上传的图片（必填；支持 PNG / JPG / GIF / WebP，上限 2 MiB）
     * @return 变更后的本人摘要（含<b>新的</b>头像地址，供前端就地换图）
     */
    @Transactional(rollbackFor = Exception.class)
    public UserSummary changeMyAvatar(MultipartFile file) {
        Long userId = SecurityUtils.getLoginUser().getId();
        byte[] content = readAvatar(file);

        String previousKey = userMapper.selectAvatarKey(userId);
        String newKey = avatarStoragePort.store(content);

        // 落盘已经发生且回滚不掉：事务失败时把新文件撤掉，否则磁盘上会留一份没人指向的文件
        AfterCommitUtils.runIfRolledBack(() -> avatarStoragePort.delete(newKey));

        userMapper.updateAvatar(userId, newKey, userId);

        if (previousKey != null && !previousKey.isBlank()) {
            // 旧图必须等提交成功后再删：提交前删，一旦事务回滚，库里的旧 key 就指向一个
            // 已经不存在的文件——用户看到的是「操作失败，同时头像也永久碎了」
            AfterCommitUtils.run(() -> avatarStoragePort.delete(previousKey));
        }

        // 全端同步：广播给所有在线端（本人在其他标签页 / 其他设备，以及会话对端、群成员、
        // 用户管理列表等一切渲染了这个头像的地方）。同样必须等提交后发——提交前发，
        // 事务一滚，各端就会去拉一个并不存在的 ?v=，必然碎图。
        // 新地址在这里现算而不留到 afterCommit 里查库：少一次往返，也不会被
        // 「同一提交内的后续变更」串味。
        String newAvatarUrl = AvatarStoragePort.urlOf(userId, newKey);
        AfterCommitUtils.run(() -> eventPublisher.publishEvent(
                new UserProfileChangedEvent(userId, newAvatarUrl)));

        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("username", SecurityUtils.getLoginUser().getUsername());
        // 刻意不记 avatar key：地址里含可直出访问的凭据，不该在审计表里长期留档
        auditLogger.success(OperationLog.ACTION_USER_AVATAR_SELF, OperationLog.TARGET_USER, userId, audit);
        log.info("[auth] 本人更换头像: userId={}", userId);

        // 在同一事务内回读，保证返回的 avatarUrl 与刚落库的 key 一致（含 ?v= 新版本号）
        return authService.profile();
    }

    /**
     * 头像准入：先按 size 拦掉超大文件，再按魔数确认是支持的光栅图。
     *
     * <p>两步都不能省：{@code POST} 的 multipart 上限是 64 MB（全局配置，为分片与附件服务），
     * 不先看 size 就会把一个 64 MB 的文件整份读进内存；只信客户端给的扩展名 / MIME
     * 则等于允许上传任意内容再以图片类型直出（存储型 XSS），故类型判定交给
     * {@link ImageTypes#detect} 看字节。</p>
     */
    private byte[] readAvatar(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "请选择要上传的头像图片");
        }
        if (file.getSize() > AvatarStoragePort.MAX_AVATAR_BYTES) {
            throw new BusinessException(ErrorCode.FILE_TOO_LARGE,
                    "头像不能超过 " + (AvatarStoragePort.MAX_AVATAR_BYTES / 1024 / 1024) + " MB");
        }
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            log.warn("读取上头像失败：size={}", file.getSize(), e);
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL);
        }
        if (ImageTypes.detect(content) == null) {
            throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED,
                    "头像仅支持 PNG / JPG / GIF / WebP 格式");
        }
        return content;
    }
}
