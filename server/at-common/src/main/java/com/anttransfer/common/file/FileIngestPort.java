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
package com.anttransfer.common.file;

import java.io.InputStream;
import java.util.Optional;

/**
 * 文件内容落库端口（SPI）：由 <b>at-file</b> 实现，供 at-transfer 在「分片合并完成」后
 * 把整件内容登记为物理文件 + 引用条目。
 *
 * <p><b>为什么必须走端口而不是直连文件模块</b>：模块依赖铁律要求 at-transfer 只能依赖
 * at-common，业务模块之间不得编译期互依；而合并后的字节与 {@code sys_file} /
 * {@code sys_file_node} 元数据都归 at-file 所有。若让 at-transfer 自己操作文件表，
 * 「内容寻址、引用计数、密级继承、上传审计」这套规则就会被复制出第二份实现，
 * 两份实现迟早漂移。故把「登记一份已就绪的内容」抽象为端口：规则留在 at-file，
 * at-transfer 只负责编排传输过程。</p>
 *
 * <p><b>事务与 IO 边界</b>（与 {@code FileContentService} 的既有约定一致）：
 * 端口实现内部先做不可回滚的落盘 IO，再进入短事务写元数据。
 * 因此调用方必须在<b>自身数据库事务之外</b>调用本端口，避免把大文件 IO
 * 拽进事务、长时间占住数据库连接。</p>
 *
 * <p><b>sha256 的可信来源</b>：入参 {@code sha256} 必须是<b>服务端自己算出来的</b>值
 * （分片合并后对整件重算），不得直接透传客户端上报值——客户端上报值仅用于比对校验。</p>
 *
 * @author AntTransfer CE
 */
public interface FileIngestPort {

    /**
     * 尝试秒传：内容已在服务端（磁盘与元数据双侧命中）时，为指定用户建一条引用并返回结果。
     *
     * <p>未命中（磁盘无此内容，或元数据缺失）返回 {@link Optional#empty()}，
     * 由调用方转入分片上传分支。</p>
     *
     * @param command 落库指令（归属人 / 文件名 / 目录 / 密级 / 指纹 / 字节数）
     * @return 命中的落库结果；未命中为空
     */
    Optional<FileIngestResult> tryInstant(FileIngestCommand command);

    /**
     * 登记一份「字节已在调用方暂存区」的内容：按内容寻址落盘 + 建引用条目。
     *
     * <p>内容寻址写入天然幂等——同一哈希重复登记会复用既有副本，
     * 因此「同内容重传」在字节层不会产生第二份文件。</p>
     *
     * @param command 落库指令
     * @param content 内容流（由调用方负责关闭）
     * @return 落库结果（{@code instant=false}，但可能因元数据已存在而复用物理文件）
     */
    FileIngestResult ingest(FileIngestCommand command, InputStream content);
}
