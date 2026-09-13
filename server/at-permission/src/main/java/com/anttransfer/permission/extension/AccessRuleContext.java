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
package com.anttransfer.permission.extension;

import java.time.LocalDateTime;

/**
 * ABAC（属性基访问控制）规则解析上下文——时间 / IP 等环境属性的只读快照。
 *
 * <p>在「已确认存在有效授权」之后构造并交给 {@link AccessRuleResolverChain} 判定，
 * 供 EE 实现「仅工作时间可访问」「仅办公网 IP 可下载」等规则（P1 扩展点）。</p>
 *
 * @param userId      访问者用户 ID
 * @param grantType   访问动作（ACCESS / DOWNLOAD / EDIT / SHARE）
 * @param resourceType 目标资源类型（FILE / SPACE / GROUP）
 * @param resourceId  目标资源 ID
 * @param clientIp    客户端 IP（可能为空；CE 不强制采集）
 * @param requestTime 访问发生时刻（为空表示以服务端当前时间为准）
 * @author AntTransfer CE
 */
public record AccessRuleContext(
        Long userId,
        String grantType,
        String resourceType,
        Long resourceId,
        String clientIp,
        LocalDateTime requestTime) {
}
