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
package com.anttransfer.permission.model.vo;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 用户列表 / 详情视图。
 *
 * <p>跨模块投影：用户主数据来自表主 at-auth（经 {@code UserAdminPort.UserRow}），
 * 角色来自本模块 RBAC 表族，部门名来自表主下发的部门选项表。
 * 视图里不含任何口令 / 盐 / token 信息——管理面列表连散列都不该外泄。</p>
 *
 * @param id            用户 ID
 * @param username      登录账号
 * @param nickname      昵称
 * @param email         邮箱
 * @param mobile        手机号
 * @param deptId        部门 ID（可空）
 * @param deptName      部门名称（可空；由部门选项表回填）
 * @param status        状态：0-正常 1-禁用 2-锁定
 * @param protectedUser 是否受保护账号（禁止停用/删除）
 * @param lastLoginTime 最近登录时间
 * @param createTime    创建时间
 * @param roleIds       角色 ID 列表
 * @param roleCodes     角色编码列表
 * @author AntTransfer CE
 * @implNote ID 字段一律以字符串过线：19 位雪花 ID 超出 JS {@code Number.MAX_SAFE_INTEGER}，
 * 以 JSON number 下发会在前端解析时丢末位，表现为「列表能看到、点操作却报对象不存在」
 * （如发起会话传回被舍入的 targetId，后端查无此人）。漏标注由 {@code PlatformIdJsonContractTest} 拦截。
 */
public record UserVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long id,
        String username,
        String nickname,
        String email,
        String mobile,
        @JsonSerialize(using = ToStringSerializer.class)
        Long deptId,
        String deptName,
        Integer status,
        boolean protectedUser,
        LocalDateTime lastLoginTime,
        LocalDateTime createTime,
        @JsonSerialize(contentUsing = ToStringSerializer.class)
        List<Long> roleIds,
        List<String> roleCodes) {
}
