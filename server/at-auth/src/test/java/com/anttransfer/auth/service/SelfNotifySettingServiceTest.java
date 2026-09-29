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

import com.anttransfer.auth.model.LoginUser;
import com.anttransfer.auth.model.dto.AuthDtos.UpdateNotifySettingRequest;
import com.anttransfer.auth.model.entity.UserNotifySetting;
import com.anttransfer.auth.model.vo.AuthVos.NotifySettingVO;
import com.anttransfer.auth.repository.UserNotifySettingMapper;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.file.NotificationSoundStoragePort;
import com.anttransfer.common.result.ErrorCode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 本人提示音设置服务单测：默认值回显 / 准入边界 / 落盘与改库的顺序 / 越权面。
 *
 * <p>这里刻意不复用 {@code AudioTypes} 的构造细节，只给出「一个时长可算的 MP3」与
 * 「一个能触发某条拒绝的字节串」——容器解析本身已由 {@code AudioTypesTest} 覆盖，
 * 本测试关心的是<b>编排</b>：什么时候该拒、拒绝时有没有留下垃圾、成功时删旧文件的时机。</p>
 *
 * @author AntTransfer CE
 */
class SelfNotifySettingServiceTest {

    private static final Long USER_ID = 7L;

    /** 4 字节 MPEG1 Layer III 帧头（128 kbps / 44100 Hz 单声道）+ 填充 → 16000 字节 = 1000 ms。 */
    private static byte[] mp3OfOneSecond() {
        byte[] content = new byte[16000];
        content[0] = (byte) 0xFF;
        content[1] = (byte) 0xFB;
        content[2] = (byte) 0x90;
        content[3] = (byte) 0xC0;
        return content;
    }

    /** 4 字节帧头 + 指定总长度：用于构造超过 10 秒的 CBR 音频。 */
    private static byte[] mp3OfBytes(int totalBytes) {
        byte[] content = new byte[totalBytes];
        content[0] = (byte) 0xFF;
        content[1] = (byte) 0xFB;
        content[2] = (byte) 0x90;
        content[3] = (byte) 0xC0;
        return content;
    }

    private UserNotifySettingMapper settingMapper;
    private NotificationSoundStoragePort soundStoragePort;
    private AuthAuditLogger auditLogger;
    private SelfNotifySettingService service;

    @BeforeEach
    void setUp() {
        settingMapper = mock(UserNotifySettingMapper.class);
        soundStoragePort = mock(NotificationSoundStoragePort.class);
        auditLogger = mock(AuthAuditLogger.class);
        service = new SelfNotifySettingService(settingMapper, soundStoragePort, auditLogger);

        LoginUser principal = new LoginUser();
        principal.setId(USER_ID);
        principal.setUsername("alice");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private UserNotifySetting row(Integer enabled, String preset) {
        UserNotifySetting row = new UserNotifySetting();
        row.setUserId(USER_ID);
        row.setSoundEnabled(enabled);
        row.setSoundPreset(preset);
        return row;
    }

    /* ==================== 读 ==================== */

    @Test
    @DisplayName("从未设置过：返回内置默认值（开 / default / 无自定义音）并带上限，且不产生任何写入")
    void getMine_withoutRow_returnsDefaultsWithoutWriting() {
        when(settingMapper.selectByUserId(USER_ID)).thenReturn(null);

        NotifySettingVO vo = service.getMine();

        assertThat(vo.soundEnabled()).isTrue();
        assertThat(vo.soundPreset()).isEqualTo(UserNotifySetting.PRESET_DEFAULT);
        assertThat(vo.customSoundUrl()).isNull();
        assertThat(vo.maxSoundBytes()).isEqualTo(NotificationSoundStoragePort.MAX_SOUND_BYTES);
        assertThat(vo.maxSoundDurationMillis())
                .isEqualTo(NotificationSoundStoragePort.MAX_SOUND_DURATION_MILLIS);
        // 「读」不能建行：否则只是打开一次设置页就会给用户凭空造一行数据
        verify(settingMapper, never()).ensureRow(anyLong(), anyLong());
    }

    @Test
    @DisplayName("已设置过：回显开关 / 音色 / 文件名与由 key 现拼的地址")
    void getMine_withRow_mapsStoredFields() {
        UserNotifySetting row = row(UserNotifySetting.SOUND_DISABLED, UserNotifySetting.PRESET_CUSTOM);
        row.setCustomSoundName("我的铃声.mp3");
        row.setCustomSoundKey("0123456789abcdef0123456789abcdef.mp3");
        row.setCustomSoundSize(16000L);
        row.setCustomSoundDurationMs(1000);
        when(settingMapper.selectByUserId(USER_ID)).thenReturn(row);

        NotifySettingVO vo = service.getMine();

        assertThat(vo.soundEnabled()).isFalse();
        assertThat(vo.soundPreset()).isEqualTo(UserNotifySetting.PRESET_CUSTOM);
        assertThat(vo.customSoundName()).isEqualTo("我的铃声.mp3");
        assertThat(vo.customSoundSize()).isEqualTo(16000L);
        assertThat(vo.customSoundDurationMs()).isEqualTo(1000);
        assertThat(vo.customSoundUrl())
                .isEqualTo(NotificationSoundStoragePort.urlOf("0123456789abcdef0123456789abcdef.mp3"));
    }

    @Test
    @DisplayName("开关与音色更新：先建行再改，且不触碰自定义音频列")
    void updateMine_ensuresRowThenUpdatesPreference() {
        when(settingMapper.selectByUserId(USER_ID))
                .thenReturn(row(UserNotifySetting.SOUND_DISABLED, UserNotifySetting.PRESET_CHIME));

        NotifySettingVO vo = service.updateMine(new UpdateNotifySettingRequest(false, UserNotifySetting.PRESET_CHIME));

        assertThat(vo.soundEnabled()).isFalse();
        assertThat(vo.soundPreset()).isEqualTo(UserNotifySetting.PRESET_CHIME);
        verify(settingMapper).ensureRow(anyLong(), eq(USER_ID));
        verify(settingMapper).updatePreference(USER_ID, UserNotifySetting.SOUND_DISABLED, UserNotifySetting.PRESET_CHIME);
        // 只切开关不该顺手把用户上传的音频清掉（换音色与删音频是两件事）
        verify(settingMapper, never()).clearCustomSound(anyLong());
        verify(settingMapper, never()).updateCustomSound(anyLong(), anyString(), anyString(), anyLong(), anyInt());
    }

    @Test
    @DisplayName("音色传 custom 且确有自定义音频：原样保留——只关掉声音不能把用户的铃声换掉")
    void updateMine_keepsCustomWhenAudioExists() {
        when(settingMapper.selectCustomSoundKey(USER_ID))
                .thenReturn("0123456789abcdef0123456789abcdef.mp3");
        when(settingMapper.selectByUserId(USER_ID))
                .thenReturn(row(UserNotifySetting.SOUND_DISABLED, UserNotifySetting.PRESET_CUSTOM));

        NotifySettingVO vo = service.updateMine(
                new UpdateNotifySettingRequest(false, UserNotifySetting.PRESET_CUSTOM));

        assertThat(vo.soundPreset()).isEqualTo(UserNotifySetting.PRESET_CUSTOM);
        verify(settingMapper).updatePreference(
                USER_ID, UserNotifySetting.SOUND_DISABLED, UserNotifySetting.PRESET_CUSTOM);
        // 音频列不动：这里是「保持现状」，不是「重新选了一遍自定义音」
        verify(settingMapper, never()).clearCustomSound(anyLong());
    }

    @Test
    @DisplayName("音色传 custom 但库里没有音频：回落内置默认音，不落出「音色自定义却没有音」的悬空状态")
    void updateMine_fallsBackToDefaultWhenCustomAudioMissing() {
        when(settingMapper.selectCustomSoundKey(USER_ID)).thenReturn(null);
        when(settingMapper.selectByUserId(USER_ID))
                .thenReturn(row(UserNotifySetting.SOUND_ENABLED, UserNotifySetting.PRESET_DEFAULT));

        NotifySettingVO vo = service.updateMine(
                new UpdateNotifySettingRequest(true, UserNotifySetting.PRESET_CUSTOM));

        assertThat(vo.soundPreset()).isEqualTo(UserNotifySetting.PRESET_DEFAULT);
        // 落库的是回落后的 default，而不是请求里的 custom——否则前端下次 GET 会拿到
        // 「音色 custom、customSoundUrl 为空」这份自己都解释不了的设置
        verify(settingMapper).updatePreference(
                USER_ID, UserNotifySetting.SOUND_ENABLED, UserNotifySetting.PRESET_DEFAULT);
        verify(settingMapper, never()).clearCustomSound(anyLong());
        verify(settingMapper, never()).updateCustomSound(anyLong(), anyString(), anyString(), anyLong(), anyInt());
    }

    /* ==================== 写：自定义音频 ==================== */

    @Test
    @DisplayName("上传成功：落盘 → 改库（实测字节数与解析出的时长）→ 删旧音频；审计只记档位与事实，不记 key")
    void uploadCustomSound_storesThenPersistsThenDeletesPrevious() {
        byte[] content = mp3OfOneSecond();
        String oldKey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp3";
        when(settingMapper.selectCustomSoundKey(USER_ID)).thenReturn(oldKey);
        when(soundStoragePort.store(any())).thenReturn("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.mp3");
        when(settingMapper.selectByUserId(USER_ID))
                .thenReturn(row(UserNotifySetting.SOUND_ENABLED, UserNotifySetting.PRESET_CUSTOM));

        service.uploadCustomSound(new MockMultipartFile(
                "file", "C:\\Users\\me\\我的铃声.mp3", "audio/mpeg", content));

        verify(settingMapper).ensureRow(anyLong(), eq(USER_ID));
        verify(settingMapper).updateCustomSound(eq(USER_ID), eq("我的铃声.mp3"),
                eq("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.mp3"), eq(16000L), eq(1000));
        // 删旧文件必须在改库之后：顺序反了，一旦事务回滚用户就会丢掉原有提示音
        var ordered = inOrder(settingMapper, soundStoragePort);
        ordered.verify(settingMapper).updateCustomSound(anyLong(), anyString(), anyString(), anyLong(), anyInt());
        ordered.verify(soundStoragePort).delete(oldKey);
    }

    @Test
    @DisplayName("首次上传（原先没有自定义音）：不产生多余的删除调用")
    void uploadCustomSound_firstTime_doesNotDeleteAnything() {
        when(settingMapper.selectCustomSoundKey(USER_ID)).thenReturn(null);
        when(soundStoragePort.store(any())).thenReturn("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.mp3");
        when(settingMapper.selectByUserId(USER_ID))
                .thenReturn(row(UserNotifySetting.SOUND_ENABLED, UserNotifySetting.PRESET_CUSTOM));

        service.uploadCustomSound(new MockMultipartFile("file", "a.mp3", "audio/mpeg", mp3OfOneSecond()));

        verify(soundStoragePort, never()).delete(anyString());
    }

    @Test
    @DisplayName("超过大小上限：以 4029 拒绝，且不落盘（先按 size 拦，不整份读进内存再判）")
    void uploadCustomSound_oversized_isRejectedBeforeStoring() {
        byte[] tooBig = new byte[(int) NotificationSoundStoragePort.MAX_SOUND_BYTES + 1];
        System.arraycopy(mp3OfOneSecond(), 0, tooBig, 0, 4);

        assertThatThrownBy(() -> service.uploadCustomSound(
                new MockMultipartFile("file", "big.mp3", "audio/mpeg", tooBig)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOTIFY_SOUND_TOO_LARGE);

        verifyNoInteractions(soundStoragePort);
        verify(settingMapper, never()).updateCustomSound(anyLong(), anyString(), anyString(), anyLong(), anyInt());
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"not-audio.txt", "page.html", "song.m4a"})
    @DisplayName("容器不支持（含伪造扩展名的 M4A / 文本 / HTML）：以 4031 拒绝，不落盘")
    void uploadCustomSound_unsupportedType_isRejected(String filename) {
        byte[] content = "this is definitely not audio content".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> service.uploadCustomSound(
                new MockMultipartFile("file", filename, "application/octet-stream", content)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOTIFY_SOUND_TYPE_NOT_ALLOWED);

        verifyNoInteractions(soundStoragePort);
    }

    @Test
    @DisplayName("空文件：以参数缺失拒绝，不落盘")
    void uploadCustomSound_empty_isRejected() {
        assertThatThrownBy(() -> service.uploadCustomSound(
                new MockMultipartFile("file", "empty.mp3", "audio/mpeg", new byte[0])))
                .isInstanceOf(BusinessException.class);

        verifyNoInteractions(soundStoragePort);
    }

    @Test
    @DisplayName("时长超过 10 秒：以 4030 拒绝，不落盘（大小合规也拦，两个上限缺一不可）")
    void uploadCustomSound_tooLong_isRejected() {
        // 16000 字节/秒 → 176000 字节 = 11 秒；仍在 1 MiB 之内，只有时长这一关能拦住
        byte[] elevenSeconds = mp3OfBytes(176_000);

        assertThatThrownBy(() -> service.uploadCustomSound(
                new MockMultipartFile("file", "long.mp3", "audio/mpeg", elevenSeconds)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOTIFY_SOUND_TOO_LONG);

        verifyNoInteractions(soundStoragePort);
    }

    @Test
    @DisplayName("时长解析不出来（缺少可解析的音频数据）：以 4032 拒绝而不是放行——无法验证 ≠ 满足上限")
    void uploadCustomSound_unparsableDuration_isRejected() {
        // 只有 ID3v2 标签、没有任何音频帧：魔数能认成 mp3，但时长算不出来
        byte[] tagOnly = new byte[64];
        tagOnly[0] = 'I';
        tagOnly[1] = 'D';
        tagOnly[2] = '3';

        assertThatThrownBy(() -> service.uploadCustomSound(
                new MockMultipartFile("file", "broken.mp3", "audio/mpeg", tagOnly)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOTIFY_SOUND_UNREADABLE);

        verifyNoInteractions(soundStoragePort);
    }

    @Test
    @DisplayName("客户端文件名含路径时只保留末段：文件名不可信，绝不带目录进库")
    void uploadCustomSound_sanitisesClientFileName() {
        when(settingMapper.selectCustomSoundKey(USER_ID)).thenReturn(null);
        when(soundStoragePort.store(any())).thenReturn("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.mp3");
        when(settingMapper.selectByUserId(USER_ID))
                .thenReturn(row(UserNotifySetting.SOUND_ENABLED, UserNotifySetting.PRESET_CUSTOM));

        service.uploadCustomSound(new MockMultipartFile(
                "file", "../../../etc/passwd.mp3", "audio/mpeg", mp3OfOneSecond()));

        verify(settingMapper).updateCustomSound(eq(USER_ID), eq("passwd.mp3"), anyString(), anyLong(), anyInt());
    }

    /* ==================== 写：清空 ==================== */

    @Test
    @DisplayName("清空自定义音：置 NULL 并回退 default 音色，旧文件在改库之后删除")
    void clearCustomSound_nullifiesAndDeletesAfterPersist() {
        String oldKey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp3";
        when(settingMapper.selectCustomSoundKey(USER_ID)).thenReturn(oldKey);
        when(settingMapper.selectByUserId(USER_ID))
                .thenReturn(row(UserNotifySetting.SOUND_ENABLED, UserNotifySetting.PRESET_DEFAULT));

        NotifySettingVO vo = service.clearCustomSound();

        assertThat(vo.soundPreset()).isEqualTo(UserNotifySetting.PRESET_DEFAULT);
        assertThat(vo.customSoundUrl()).isNull();
        var ordered = inOrder(settingMapper, soundStoragePort);
        ordered.verify(settingMapper).clearCustomSound(USER_ID);
        ordered.verify(soundStoragePort).delete(oldKey);
    }

    @Test
    @DisplayName("清空是幂等的：本来就没有自定义音时也成功，且不产生删除调用")
    void clearCustomSound_withoutCustomSound_isIdempotent() {
        when(settingMapper.selectCustomSoundKey(USER_ID)).thenReturn(null);
        when(settingMapper.selectByUserId(USER_ID))
                .thenReturn(row(UserNotifySetting.SOUND_ENABLED, UserNotifySetting.PRESET_DEFAULT));

        service.clearCustomSound();

        verify(soundStoragePort, never()).delete(anyString());
        verify(settingMapper).clearCustomSound(USER_ID);
    }

    /* ==================== 读：内容直出 ==================== */

    @Test
    @DisplayName("内容直出：按令牌取 key 后交给存储读，不回显 key 之外的信息")
    void loadMyCustomSound_readsByTokenScopedKey() {
        String key = "0123456789abcdef0123456789abcdef.mp3";
        byte[] content = mp3OfOneSecond();
        when(settingMapper.selectCustomSoundKey(USER_ID)).thenReturn(key);
        when(soundStoragePort.load(key))
                .thenReturn(Optional.of(new NotificationSoundStoragePort.StoredSound(content, "audio/mpeg", key)));

        NotificationSoundStoragePort.StoredSound sound = service.loadMyCustomSound();

        assertThat(sound.content()).isEqualTo(content);
        assertThat(sound.contentType()).isEqualTo("audio/mpeg");
    }

    @Test
    @DisplayName("没有自定义音（库里无 key）时以 4033 拒绝，而不是 500 / 空响应")
    void loadMyCustomSound_withoutKey_isNotFound() {
        when(settingMapper.selectCustomSoundKey(USER_ID)).thenReturn(null);

        assertThatThrownBy(() -> service.loadMyCustomSound())
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOTIFY_SOUND_NOT_FOUND);

        verifyNoInteractions(soundStoragePort);
    }

    @Test
    @DisplayName("库里有 key 但文件已不在：同样以 4033 回「没有自定义音」，让前端回落到内置音而不是弹错")
    void loadMyCustomSound_missingFile_fallsBackToNotFound() {
        when(settingMapper.selectCustomSoundKey(USER_ID)).thenReturn("0123456789abcdef0123456789abcdef.mp3");
        when(soundStoragePort.load(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.loadMyCustomSound())
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOTIFY_SOUND_NOT_FOUND);
    }

    @Test
    @DisplayName("未登录：任何操作都以 NOT_LOGIN 拒绝（服务不自造 userId，只认令牌）")
    void withoutLogin_isRejected() {
        SecurityContextHolder.clearContext();

        assertThatThrownBy(() -> service.getMine()).isInstanceOf(RuntimeException.class);
        verifyNoInteractions(soundStoragePort);
    }
}
