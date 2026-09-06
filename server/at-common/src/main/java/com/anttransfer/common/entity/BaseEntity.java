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
package com.anttransfer.common.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 实体公共基类（MyBatis-Plus）。
 *
 * <p>职责：将每个业务表“标配”的公共字段下沉到基类，避免各模块实体重复声明：
 * 主键 id、创建人 createBy、创建时间 createTime、更新人 updateBy、更新时间 updateTime、
 * 逻辑删除标记 deleted（映射列 deleted，对应 V1 sys_ 表族公共字段约定）。</p>
 *
 * <ul>
 *     <li>主键：{@code ASSIGN_ID}（雪花算法）由 MyBatis-Plus 自动分配；</li>
 *     <li>{@code createTime / updateTime} 采用 {@link FieldFill} 声明自动填充策略，
 *         需各模块自行提供 {@code MetaObjectHandler}（at-bootstrap 可统一注册）才会真正写入；
 *         {@code createBy / updateBy} 需在应用层按当前登录人赋值（未来接入
 *         MetaObjectHandler 后亦可自动填充）；</li>
 *     <li>{@code deleted} 使用 {@link TableLogic} 注解开启逻辑删除，
 *         同时建议在全局配置中声明 logic-delete-field（见 at-bootstrap/application.yml）。</li>
 * </ul>
 *
 * <p>约定：业务实体类需继承本基类并使用 {@code @TableName} 标注真实表名，例如：</p>
 * <pre>{@code
 *   @TableName("sys_upload_task")
 *   public class UploadTask extends BaseEntity { ... }
 * }</pre>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class BaseEntity implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 主键：雪花算法（全局唯一、趋势递增），映射列 id */
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;

    /** 创建人用户 ID（逻辑关联 sys_user），映射列 create_by */
    @TableField("create_by")
    private Long createBy;

    /** 创建时间（插入时自动填充），映射列 create_time */
    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新人用户 ID（逻辑关联 sys_user），映射列 update_by */
    @TableField("update_by")
    private Long updateBy;

    /** 更新时间（插入与更新时自动填充），映射列 update_time */
    @TableField(value = "update_time", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /** 逻辑删除标记：0-未删除 1-已删除（查询自动追加 deleted=0） */
    @TableLogic
    @TableField(value = "deleted")
    private Integer deleted;
}
