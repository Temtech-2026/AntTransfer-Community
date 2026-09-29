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
package com.anttransfer.common.spi.scan;

import java.io.InputStream;

/**
 * 文件内容惰性访问器——让 SPI 实现能按需读取字节，而不把存储抽象泄漏进 {@code at-common}。
 *
 * <p><b>为什么是「惰性 + 由调用方提供」</b>：CE 默认实现（如 {@code NoopVirusScanner}）恒定放行，
 * 若上下文直接携带 {@link InputStream}，一次「空扫描」也会强制打开文件句柄、并把流的位置语义
 * 变成实现的隐含契约。改为函数式访问器后，只有真正需要读字节的实现才付出代价，
 * 且调用方（{@code at-file}）独自负责流的生命周期与关闭。</p>
 *
 * <p><b>实现约束</b>：调用方负责关闭返回流；不得把内容写入日志、不得跨请求缓存。</p>
 *
 * @author AntTransfer CE
 */
@FunctionalInterface
public interface ContentAccess {

    /**
     * 打开一份新的只读流。
     *
     * @return 可读流（每次调用返回独立流，允许重复扫描）
     */
    InputStream open();
}
