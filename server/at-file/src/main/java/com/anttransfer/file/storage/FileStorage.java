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
package com.anttransfer.file.storage;

import org.springframework.core.io.Resource;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;

/**
 * 文件存储后端抽象：区分「内容寻址区」与「临时产物区」两类存储。
 *
 * <p><b>内容寻址区</b>（{@code {root}/{sha256[0:2]}/{sha256[2:4]}/{sha256}}）：
 * 路径由内容哈希决定，因此写入天然幂等——同一份内容无论被谁、上传几次，都落在同一个路径，
 * 物理去重不需要任何分布式协调，也不需要「先查有没有再决定写哪」的竞态窗口。
 * 两级哈希前缀是为了避免单目录下文件数过多（ext4 单目录数十万文件时 readdir 会明显变慢）。</p>
 *
 * <p><b>临时产物区</b>（{@code {root}/_tmp}）：打包 zip 等由系统生成、生命周期短、
 * 不参与去重的文件。与内容寻址区隔离，是为了能整体按目录清理而不误伤物理文件。</p>
 *
 * <p><b>为什么不在这里做限速：</b>限速是「传输节奏」问题、与存储在哪儿无关，
 * 放在 {@code BandwidthLimiter} 里，未来换成对象存储也无需重写。</p>
 *
 * @author AntTransfer CE
 */
public interface FileStorage {

    /**
     * 按内容寻址写入（幂等）。若目标已存在，直接丢弃入参流并复用既有文件。
     *
     * @param in     数据流（由调用方关闭；本方法不接管其生命周期）
     * @param sha256 内容 SHA-256（小写 hex），决定落盘路径
     * @return 相对路径（相对存储根，用于持久化到 {@code sys_file.storage_path}）
     * @throws IOException 落盘失败
     */
    String storeContent(InputStream in, String sha256) throws IOException;

    /** 内容寻址路径是否已存在（秒传的物理层判定：文件已在磁盘，无需重传）。 */
    boolean contentExists(String sha256);

    /** 物理文件字节数（不存在返回 -1）。 */
    long contentSize(String sha256);

    /** 取内容寻址文件的可读资源（Range 下载时由框架按区间读取，不做整份载入）。 */
    Resource contentResource(String sha256);

    /**
     * 在临时产物区创建一个待写入文件（由调用方负责写入与关闭）。
     *
     * @param fileName 展示用文件名（会做路径穿越清洗）
     * @return 可写路径
     * @throws IOException 创建失败
     */
    Path createTemp(String fileName) throws IOException;

    /** 按相对路径取资源（临时产物下载用）。 */
    Resource resource(String relativePath);

    /**
     * 把绝对路径换算成相对存储根的形式（供临时产物路径持久化）。
     *
     * <p><b>为什么需要这个出口：</b>{@link #createTemp} 必须返回绝对路径才便于调用方直接写入，
     * 但落库的 {@code product_path} 与后续的 {@link #resource}/{@link #delete} 都按<b>相对路径</b>取件。
     * 若让调用方自己从绝对路径里截字符串，就等于把「存储根长什么样」这个实现细节泄露出去——
     * 一旦换成对象存储或改了根目录层级，截串逻辑会静默算错路径，表现为「产物明明生成了却下载 404」。
     * 换算能力属于存储层，故在此显式暴露，而不是让上层猜。</p>
     *
     * @param path 存储根内的绝对路径
     * @return 以 {@code /} 分隔的相对路径
     * @throws IllegalArgumentException 路径不在存储根内
     */
    String toRelative(Path path);

    /** 按相对路径取绝对路径。 */
    Path resolve(String relativePath);

    /** 删除相对路径对应的物理文件（已不存在视为成功——删除应当幂等）。 */
    boolean delete(String relativePath);

    /** 删除内容寻址文件（引用归零时调用，入参为 sha256）。 */
    boolean deleteContent(String sha256);
}
