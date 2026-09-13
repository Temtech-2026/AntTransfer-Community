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
package com.anttransfer.file.extension;

/**
 * 外发内容扫描扩展点（CE/EE 边界接口）。
 *
 * <p><b>定位</b>：外发分享是数据出网的最后一道闸门。CE 只做「后缀黑名单 + 文件名敏感词」这类
 * 零依赖的简单规则；企业版在此接入 AI DLP（文档内容识别、敏感信息检测、水印强制等），
 * 无需改动分享主链路。</p>
 *
 * <p><b>扩展方式</b>：EE 只需声明自己的 {@code ContentScanInterceptor} Bean
 * （可用 {@code @Order} 控制顺序），{@link ContentScanChain} 会自动发现并串行执行全部实现，
 * 采取 <b>Deny 优先</b>（任一实现拒绝即拦截，与 RBAC 的「Deny 优先」同一语义）。</p>
 *
 * <p><b>实现约束</b>：</p>
 * <ul>
 *     <li>必须<b>无副作用、幂等、快速返回</b>：本方法在「创建分享」的事务前置同步调用，
 *         不得发起长耗时 IO；确需远端 DLP 时应在 EE 侧做超时与降级（超时按配置放行或拒绝）；</li>
 *     <li>不得抛业务异常表达「拒绝」，请返回 {@link ScanResult#deny(String)}，
 *         以便主链路统一落审计日志（动作 {@code SHARE_BLOCKED}）后抛 4007；</li>
 *     <li>不得记录文件内容明文到日志。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
public interface ContentScanInterceptor {

    /**
     * 扫描一个待外发文件。
     *
     * @param context 扫描上下文（文件名、后缀、大小、归属）
     * @return 扫描结论；{@link ScanResult#deny(String)} 表示拦截并给出可审计的简短原因
     */
    ScanResult scan(ScanContext context);

    /**
     * 扫描上下文：仅暴露判定所需的最小信息（不含文件内容，避免 CE/EE 越权读取）。
     *
     * @param fileId       文件 ID
     * @param originalName 原始文件名（含扩展名）
     * @param extension    归一化扩展名（小写、不含点；无扩展名为空串）
     * @param sizeBytes    文件字节数
     * @param ownerUserId  文件归属用户 ID（空表示系统文件）
     */
    record ScanContext(Long fileId, String originalName, String extension, long sizeBytes, Long ownerUserId) {
    }

    /**
     * 扫描结论。
     *
     * @param denied 是否拦截
     * @param reason 拦截原因（简短、可审计；放行时为 {@code null}）
     */
    record ScanResult(boolean denied, String reason) {

        /** 放行 */
        public static ScanResult allow() {
            return new ScanResult(false, null);
        }

        /** 拦截并给出原因（会写入审计日志 detail） */
        public static ScanResult deny(String reason) {
            return new ScanResult(true, reason);
        }
    }
}
