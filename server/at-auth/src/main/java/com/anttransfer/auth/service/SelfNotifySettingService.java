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

import com.anttransfer.auth.model.dto.AuthDtos.UpdateNotifySettingRequest;
import com.anttransfer.auth.model.entity.UserNotifySetting;
import com.anttransfer.auth.model.vo.AuthVos.NotifySettingVO;
import com.anttransfer.auth.repository.UserNotifySettingMapper;
import com.anttransfer.auth.security.SecurityUtils;
import com.anttransfer.auth.util.AfterCommitUtils;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.file.AudioTypes;
import com.anttransfer.common.file.NotificationSoundStoragePort;
import com.anttransfer.common.result.ErrorCode;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.OptionalLong;

/**
 * 本人消息提示音自助服务（读写设置 + 自定义音频上传 / 清空 / 直出）。
 *
 * <p><b>为什么这件事归 at-auth 且没有任何权限点：</b>与 {@link SelfProfileService} 同口径——
 * 目标用户只能来自令牌（{@code /v1/users/me/...}），不存在「替别人设提示音」的入参面，
 * 因此不需要也不应挂 {@code system:*} 权限点。权限点在这里反而有害：
 * 它会把「我改我自己的播放偏好」变成一件需要被授权的事。</p>
 *
 * <p><b>为什么落盘实现在 at-file、编排在这里：</b>存储介质与目录布局属文件域
 * （{@link NotificationSoundStoragePort} 定义在共享内核、实现落在 at-file），
 * 而「这份设置属于谁、什么时候算数」属账号域。与头像
 * （{@code SelfProfileService#changeMyAvatar}）同一分工。</p>
 *
 * <p><b>上限为什么由服务端算：</b>见 {@link AudioTypes} 类注——「不超过 10 秒 / 1 MiB」
 * 是要落库的事实，事实不能由被约束方在请求体里自己申报。前端那边的校验只买「即时反馈」。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
public class SelfNotifySettingService {

    /** 自定义音频文件名回显上限（与 {@code sys_user_notify_setting.custom_sound_name} 列宽一致）。 */
    private static final int MAX_NAME_LENGTH = 128;

    /** 文件名缺失时的回显兜底（列可空，但给出一个可读值比空白更利于用户识别） */
    private static final String FALLBACK_NAME = "自定义提示音";

    private final UserNotifySettingMapper settingMapper;
    private final NotificationSoundStoragePort soundStoragePort;
    private final AuthAuditLogger auditLogger;

    public SelfNotifySettingService(UserNotifySettingMapper settingMapper,
                                    NotificationSoundStoragePort soundStoragePort,
                                    AuthAuditLogger auditLogger) {
        this.settingMapper = settingMapper;
        this.soundStoragePort = soundStoragePort;
        this.auditLogger = auditLogger;
    }

    /* ============================ 读 ============================ */

    /**
     * 读本人提示音设置。
     *
     * <p>从未设置过时<b>不建行</b>：返回内置默认（开关开、默认音色、无自定义音频）即可，
     * 读取路径不该产生写。</p>
     */
    public NotifySettingVO getMine() {
        return toVo(settingMapper.selectByUserId(SecurityUtils.getLoginUser().getId()));
    }

    /* ============================ 写：开关与内置音色 ============================ */

    /** 更新开关与音色（不触碰自定义音频列）。 */
    @Transactional(rollbackFor = Exception.class)
    public NotifySettingVO updateMine(UpdateNotifySettingRequest request) {
        Long userId = SecurityUtils.getLoginUser().getId();
        // 先确保行存在：首次保存的用户此时才有自己的设置行
        settingMapper.ensureRow(IdWorker.getId(), userId);
        String preset = resolvePreset(userId, request.soundPreset());
        settingMapper.updatePreference(userId,
                Boolean.TRUE.equals(request.soundEnabled())
                        ? UserNotifySetting.SOUND_ENABLED : UserNotifySetting.SOUND_DISABLED,
                preset);

        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("soundEnabled", request.soundEnabled());
        // 记的是**落库的那个音色**而不是请求里的字符串：两者在「请求 custom 但无音频」时不同，
        // 审计要能解释「为什么用户提交的是 custom、库里却是 default」，否则事后无从复现
        audit.put("soundPreset", preset);
        auditLogger.success(OperationLog.ACTION_USER_NOTIFY_SOUND_SELF,
                OperationLog.TARGET_USER, userId, audit);
        log.info("[auth] 本人更新提示音设置: userId={}, enabled={}, preset={}",
                userId, request.soundEnabled(), preset);

        // 同一事务内回读，保证返回的设置与刚落库的一致（含默认值兜底）
        return toVo(settingMapper.selectByUserId(userId));
    }

    /**
     * 裁决要落库的音色，挡住「音色是 {@code custom} 但没有音频」的悬空状态。
     *
     * <p><b>为什么请求里允许出现 {@code custom}：</b>本接口是整体覆盖语义，前端每次提交
     * 都必须带上用户当前音色，而存量用户的当前音色可能就是 {@code custom}——
     * 否则「只想关掉提示音」会被入参校验 400（详见 {@code UpdateNotifySettingRequest} 类注）。</p>
     *
     * <p><b>为什么在这里挡而不是在入参校验里挡：</b>是否悬空取决于「该用户库里到底有没有音频列」，
     * 只有服务端拿着用户数据才判得了；入参校验只能看到字符串本身。</p>
     *
     * <p><b>为什么回落到 {@code default} 而不是报错：</b>用户提交 {@code custom} 的真实意图是
     * 「保持我现在的音色别动」。他若确实有自定义音频，这里原样保留；他若没有（音频被清空过等），
     * 报错会让他无法完成「关掉提示音」这件小事，而回落成内置默认音与「没有自定义音频时的实际听感」
     * 完全一致——无损失、无歧义。音频列本身在此路径上不被触碰。</p>
     */
    private String resolvePreset(Long userId, String requested) {
        if (!UserNotifySetting.PRESET_CUSTOM.equals(requested)) {
            return requested;
        }
        String key = settingMapper.selectCustomSoundKey(userId);
        if (key == null || key.isBlank()) {
            log.info("[auth] 请求音色为 custom 但无自定义音频，回落内置默认音: userId={}", userId);
            return UserNotifySetting.PRESET_DEFAULT;
        }
        return UserNotifySetting.PRESET_CUSTOM;
    }

    /* ============================ 写：自定义音频 ============================ */

    /**
     * 上传 / 替换自定义提示音（上传即生效，音色自动切到 {@code custom}）。
     *
     * <p><b>三步顺序与头像一致：</b>① 校验并落盘新音频 → ② 改库指向新 key
     * （新文件已就位，不存在「库里有引用但文件还没写完」的窗口）→ ③ 提交成功后再删旧音频。
     * 任一步失败只留下「无害的孤儿文件」，而不会出现「库里指向一个不存在的文件」——
     * 那会让用户的自定义提示音永久失效且无从自解。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public NotifySettingVO uploadCustomSound(MultipartFile file) {
        Long userId = SecurityUtils.getLoginUser().getId();
        byte[] content = readSound(file);
        AudioTypes.AudioType type = AudioTypes.detect(content);
        long durationMs = resolveDuration(content, type);

        String previousKey = settingMapper.selectCustomSoundKey(userId);
        String newKey = soundStoragePort.store(content);
        // 落盘已发生且回滚不掉：事务失败时把新文件撤掉，否则磁盘上留一份没人指向的文件
        AfterCommitUtils.runIfRolledBack(() -> soundStoragePort.delete(newKey));

        settingMapper.ensureRow(IdWorker.getId(), userId);
        settingMapper.updateCustomSound(userId, safeSoundName(file), newKey,
                content.length, (int) durationMs);

        if (previousKey != null && !previousKey.isBlank() && !previousKey.equals(newKey)) {
            // 旧音频必须等提交成功后再删：提交前删，一旦回滚，库里的旧 key 就指向一个
            // 已经不存在的文件——用户看到的是「操作失败，同时原来的提示音也没了」
            AfterCommitUtils.run(() -> soundStoragePort.delete(previousKey));
        }

        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("soundPreset", UserNotifySetting.PRESET_CUSTOM);
        audit.put("sizeBytes", content.length);
        audit.put("durationMs", durationMs);
        // 刻意不记存储 key / 直出地址：那是取音频的凭据，不该在审计表里长期留档
        auditLogger.success(OperationLog.ACTION_USER_NOTIFY_SOUND_SELF,
                OperationLog.TARGET_USER, userId, audit);
        log.info("[auth] 本人上传自定义提示音: userId={}, size={}, durationMs={}",
                userId, content.length, durationMs);

        return toVo(settingMapper.selectByUserId(userId));
    }

    /**
     * 清空自定义提示音并把音色回退到内置默认值（幂等：没设过也成功）。
     *
     * <p>清空是「把四列置 NULL」而不是删设置行——{@code sound_enabled} 仍是有效状态，
     * 删行还会撞 {@code uk_user}（见 sql/V21 口径）。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public NotifySettingVO clearCustomSound() {
        Long userId = SecurityUtils.getLoginUser().getId();
        String previousKey = settingMapper.selectCustomSoundKey(userId);

        settingMapper.ensureRow(IdWorker.getId(), userId);
        settingMapper.clearCustomSound(userId);

        if (previousKey != null && !previousKey.isBlank()) {
            AfterCommitUtils.run(() -> soundStoragePort.delete(previousKey));
        }

        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("soundPreset", UserNotifySetting.PRESET_DEFAULT);
        audit.put("cleared", previousKey != null && !previousKey.isBlank());
        auditLogger.success(OperationLog.ACTION_USER_NOTIFY_SOUND_SELF,
                OperationLog.TARGET_USER, userId, audit);
        log.info("[auth] 本人清空自定义提示音: userId={}", userId);

        return toVo(settingMapper.selectByUserId(userId));
    }

    /* ============================ 读：音频内容直出 ============================ */

    /**
     * 读本人自定义提示音的字节（供内容直出端点）。
     *
     * <p>只按令牌取 key，<b>不接受任何用户 ID 入参</b>：这条路径只有「我的」一种语义，
     * 越权读他人音频在结构上不可达（见 {@link NotificationSoundStoragePort} 类注）。</p>
     *
     * @return 音频字节与响应类型
     * @throws BusinessException 未设置自定义提示音（4033），或库里 key 对应的文件已不存在（同样 4033：
     *                           对调用方而言都是「没有可播的自定义音」，无需区分）
     */
    public NotificationSoundStoragePort.StoredSound loadMyCustomSound() {
        Long userId = SecurityUtils.getLoginUser().getId();
        String key = settingMapper.selectCustomSoundKey(userId);
        if (key == null || key.isBlank()) {
            throw new BusinessException(ErrorCode.NOTIFY_SOUND_NOT_FOUND);
        }
        return soundStoragePort.load(key).orElseThrow(() -> {
            // 库里有 key 但磁盘上没有（手工清理 / 迁移漏拷）：报「未设置」而不是 500，
            // 前端据此回落到内置音，不会弹出一个用户无法理解的错误
            log.warn("提示音 key 存在于库中但读不到文件：userId={}", userId);
            return new BusinessException(ErrorCode.NOTIFY_SOUND_NOT_FOUND);
        });
    }

    /* ============================ 内部工具 ============================ */

    /**
     * 提示音准入：先按 size 拦掉超大文件，再按魔数确认是支持的音频容器。
     *
     * <p>两步都不能省：multipart 上限是 64 MB（全局配置，为分片与附件服务），
     * 不先看 size 就会把一个 64 MB 的文件整份读进内存再判超限。</p>
     */
    private byte[] readSound(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "请选择要上传的提示音文件");
        }
        if (file.getSize() > NotificationSoundStoragePort.MAX_SOUND_BYTES) {
            throw new BusinessException(ErrorCode.NOTIFY_SOUND_TOO_LARGE,
                    "提示音不能超过 " + (NotificationSoundStoragePort.MAX_SOUND_BYTES / 1024) + " KB");
        }
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            log.warn("读取上传提示音失败：size={}", file.getSize(), e);
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL);
        }
        // size 与 getBytes 之间理论上有 TOCTOU 缝隙，落地后再量一次真实长度，以实收字节为准
        if (content.length > NotificationSoundStoragePort.MAX_SOUND_BYTES) {
            throw new BusinessException(ErrorCode.NOTIFY_SOUND_TOO_LARGE,
                    "提示音不能超过 " + (NotificationSoundStoragePort.MAX_SOUND_BYTES / 1024) + " KB");
        }
        if (AudioTypes.detect(content) == null) {
            throw new BusinessException(ErrorCode.NOTIFY_SOUND_TYPE_NOT_ALLOWED);
        }
        return content;
    }

    /**
     * 解析时长并做上限判定。
     *
     * <p>解析不出来时以 4032 拒绝而<b>不放行</b>：「无法验证」不等于「满足上限」。</p>
     */
    private long resolveDuration(byte[] content, AudioTypes.AudioType type) {
        OptionalLong duration = AudioTypes.durationMillis(content, type);
        if (duration.isEmpty()) {
            throw new BusinessException(ErrorCode.NOTIFY_SOUND_UNREADABLE);
        }
        long durationMs = duration.getAsLong();
        if (durationMs > NotificationSoundStoragePort.MAX_SOUND_DURATION_MILLIS) {
            throw new BusinessException(ErrorCode.NOTIFY_SOUND_TOO_LONG);
        }
        return durationMs;
    }

    /**
     * 取一个可安全落库 / 回显的原始文件名。
     *
     * <p>客户端给的文件名是<b>不可信输入</b>：它可能带路径（{@code C:\a\b.mp3} / {@code ../../x}）、
     * 可能超长、可能为空。这里只取最后一段并截断——它仅用于回显，
     * 绝不参与落盘路径（落盘路径由服务端随机 key 决定，见 at-file 实现）。</p>
     */
    private String safeSoundName(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name == null || name.isBlank()) {
            return FALLBACK_NAME;
        }
        String normalized = name.replace('\\', '/');
        int slash = normalized.lastIndexOf('/');
        if (slash >= 0) {
            normalized = normalized.substring(slash + 1);
        }
        normalized = normalized.strip();
        if (normalized.isEmpty()) {
            return FALLBACK_NAME;
        }
        return normalized.length() > MAX_NAME_LENGTH ? normalized.substring(0, MAX_NAME_LENGTH) : normalized;
    }

    /** 实体 → 出参；行为空时给内置默认，使「没设置过」与「设置过」在前端是同一形状。 */
    private NotifySettingVO toVo(UserNotifySetting row) {
        if (row == null) {
            return new NotifySettingVO(true, UserNotifySetting.PRESET_DEFAULT,
                    null, null, null, null,
                    NotificationSoundStoragePort.MAX_SOUND_BYTES,
                    NotificationSoundStoragePort.MAX_SOUND_DURATION_MILLIS);
        }
        return new NotifySettingVO(
                row.getSoundEnabled() == null || row.getSoundEnabled() == UserNotifySetting.SOUND_ENABLED,
                row.getSoundPreset() == null ? UserNotifySetting.PRESET_DEFAULT : row.getSoundPreset(),
                row.getCustomSoundName(),
                row.getCustomSoundSize(),
                row.getCustomSoundDurationMs(),
                NotificationSoundStoragePort.urlOf(row.getCustomSoundKey()),
                NotificationSoundStoragePort.MAX_SOUND_BYTES,
                NotificationSoundStoragePort.MAX_SOUND_DURATION_MILLIS);
    }
}
