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
package com.anttransfer.file.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

/**
 * 文件标签（映射 {@code sys_tag}，见 sql/V6__file_management.sql）。
 *
 * <p><b>标签按用户隔离</b>：同名标签在两个人名下是两条独立记录（{@code owner_user_id} 参与唯一性），
 * 不做「全局标签池」。理由是标签属强个人语义——「重要」「待整理」在每个人心里的含义不同，
 * 共享标签池只会让搜索被他人噪声污染，而 CE 场景并没有跨用户统一归档的诉求。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_tag")
public class Tag extends BaseEntity {

    /** 标签归属用户 ID（标签按人隔离，不跨用户共享） */
    @TableField("owner_user_id")
    private Long ownerUserId;

    /** 标签名（同一用户下由服务层保证不重名） */
    @TableField("name")
    private String name;

    /** 标签颜色（前端展示用） */
    @TableField("color")
    private String color;
}
