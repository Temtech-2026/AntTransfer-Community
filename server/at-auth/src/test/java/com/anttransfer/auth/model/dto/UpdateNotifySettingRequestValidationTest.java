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
package com.anttransfer.auth.model.dto;

import com.anttransfer.auth.model.dto.AuthDtos.UpdateNotifySettingRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 提示音设置请求体的<b>入参校验</b>契约单测。
 *
 * <p>这一层单独测的理由：{@code @Pattern} 是 Spring 在 Controller 之前执行的，
 * {@code SelfNotifySettingService} 的单测根本走不到它——「服务端逻辑对、请求却在门口被 400」这类缺陷
 * 只有在真正跑一个 Validator 时才会暴露。本文件的第一个用例正是这样一个缺陷的回归证据：
 * 存量自定义音色用户「只关掉提示音」时，前端必须原样回传 {@code custom}
 * （本接口是整体覆盖语义），而此前的正则把 {@code custom} 挡在门外，
 * 使得这个最普通的操作必然 400；同时用户也无法改传内置音色绕过，
 * 那会把他的铃声悄悄换掉。</p>
 *
 * @author AntTransfer CE
 */
class UpdateNotifySettingRequestValidationTest {

    private static final Validator VALIDATOR =
            Validation.buildDefaultValidatorFactory().getValidator();

    private static Set<ConstraintViolation<UpdateNotifySettingRequest>> violations(
            Boolean soundEnabled, String soundPreset) {
        return VALIDATOR.validate(new UpdateNotifySettingRequest(soundEnabled, soundPreset));
    }

    @Test
    @DisplayName("custom 是可提交值：前端提交当前音色（含自定义）必须通过，否则「只关提示音」无从完成")
    void acceptsCustomPreset() {
        assertThat(violations(false, "custom")).isEmpty();
    }

    @Test
    @DisplayName("内置三选一照常通过")
    void acceptsBuiltinPresets() {
        assertThat(violations(true, "default")).isEmpty();
        assertThat(violations(true, "chime")).isEmpty();
        assertThat(violations(true, "bubble")).isEmpty();
    }

    @Test
    @DisplayName("未知音色仍被拒：放宽的是 custom 一项，不是把校验取消")
    void rejectsUnknownPreset() {
        assertThat(violations(true, "tones")).isNotEmpty();
        assertThat(violations(true, "Custom")).isNotEmpty();
    }

    @Test
    @DisplayName("开关漏传仍被拒：不能被静默解释成「关闭」")
    void rejectsMissingSwitch() {
        assertThat(violations(null, "default")).isNotEmpty();
    }
}
