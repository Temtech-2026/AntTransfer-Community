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
package com.anttransfer.auth.repository;

import com.anttransfer.auth.model.entity.UserNotifySetting;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 用户提示音设置数据访问（表主 at-auth，见 {@code sql/V21}）。
 *
 * <p><b>为什么用显式 SQL 而不是 {@code updateById}：</b>本表有两处「写 null 是有意义的值」——
 * 清空自定义音频要把 4 个列置 NULL，而实体更新对 {@code null} 字段默认「不写」，
 * 靠注解开关又会影响全表其他更新。显式列清单让「清空」的语义在 SQL 里一眼可读，
 * 也避免了「以为置了 null 其实没写」这类静默错误。</p>
 *
 * <p><b>为什么每次写都先 {@link #ensureRow}：</b>设置行不存在时要能自动建，
 * 但同时点两次 / 并发首次保存不能撞唯一键。{@code insert ... on duplicate key update}
 * 让「建行」与「已存在」两种情况由数据库原子处理，无需在应用层先查后插（那有竞态）。</p>
 *
 * @author AntTransfer CE
 */
@Mapper
public interface UserNotifySettingMapper extends BaseMapper<UserNotifySetting> {

    /**
     * 读本人设置行（不存在返回 {@code null}）。
     *
     * <p>读路径<b>不建行</b>：没设置过就是「默认状态」，为此产生一次写既无必要，
     * 也会让「从未打开过设置页」的用户凭空多出一行。</p>
     */
    @Select("select * from sys_user_notify_setting where user_id = #{userId} and deleted = 0")
    UserNotifySetting selectByUserId(@Param("userId") Long userId);

    /** 只读自定义音频存储 key（供内容直出端点，不取整行）。 */
    @Select("select custom_sound_key from sys_user_notify_setting where user_id = #{userId} and deleted = 0")
    String selectCustomSoundKey(@Param("userId") Long userId);

    /**
     * 确保本人设置行存在（幂等）。
     *
     * <p>已存在时命中 {@code uk_user}，走 {@code on duplicate key update} 的空更新——
     * 只为了把语句变成合法的 upsert，<b>不覆盖任何既有值</b>（沿用默认音色与开关的存量状态）。</p>
     *
     * @return 受影响行数（1=新建，0=已存在且无变化）
     */
    @Insert("""
            insert into sys_user_notify_setting
                (id, user_id, sound_enabled, sound_preset, tenant_id, create_by, update_by, deleted)
            values
                (#{id}, #{userId}, 1, 'default', 0, #{userId}, #{userId}, 0)
            on duplicate key update update_by = values(update_by)
            """)
    int ensureRow(@Param("id") Long id, @Param("userId") Long userId);

    /** 更新开关与音色档位（调用方须先 {@link #ensureRow}）。 */
    @Update("""
            update sys_user_notify_setting
            set sound_enabled = #{soundEnabled}, sound_preset = #{soundPreset}, update_by = #{userId}
            where user_id = #{userId} and deleted = 0
            """)
    int updatePreference(@Param("userId") Long userId,
                         @Param("soundEnabled") int soundEnabled,
                         @Param("soundPreset") String soundPreset);

    /**
     * 换上新的自定义音频（同时把音色切成 {@code custom}）。
     *
     * <p>四个自定义列在<b>同一条语句</b>里一起换：分开写会出现「key 已经是新的、
     * 但 size/duration 还是上一个音的」的中间态，而这个中间态正好会被回显接口读到。</p>
     */
    @Update("""
            update sys_user_notify_setting
            set sound_preset = 'custom',
                custom_sound_name = #{name},
                custom_sound_key = #{key},
                custom_sound_size = #{size},
                custom_sound_duration_ms = #{durationMs},
                update_by = #{userId}
            where user_id = #{userId} and deleted = 0
            """)
    int updateCustomSound(@Param("userId") Long userId,
                          @Param("name") String name,
                          @Param("key") String key,
                          @Param("size") long size,
                          @Param("durationMs") int durationMs);

    /**
     * 清空自定义音频并把音色回退到内置默认值。
     *
     * <p>四个列显式置 NULL（不是删行）：设置行本身始终存在，{@code sound_enabled}
     * 仍是有效状态；删行再建会撞 {@code uk_user}（见 sql/V21 口径）。</p>
     */
    @Update("""
            update sys_user_notify_setting
            set sound_preset = 'default',
                custom_sound_name = null,
                custom_sound_key = null,
                custom_sound_size = null,
                custom_sound_duration_ms = null,
                update_by = #{userId}
            where user_id = #{userId} and deleted = 0
            """)
    int clearCustomSound(@Param("userId") Long userId);
}
