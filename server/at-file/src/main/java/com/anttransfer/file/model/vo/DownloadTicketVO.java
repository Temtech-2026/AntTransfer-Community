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
package com.anttransfer.file.model.vo;

import lombok.Getter;
import lombok.Setter;

/**
 * 下载票据视图对象。
 *
 * <p>「票据 + 换票」模式的意义：下载 URL 会被写进 {@code <a href>} / 播放器地址栏 / 浏览器历史，
 * 属于<b>易泄露</b>的载体。若直接放长期凭证（如 access token），一次分享即等于交出账号；
 * 换成短时、单文件、绑定用户的一次性票据，泄露窗口被压到分钟级且不可横向使用。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class DownloadTicketVO {

    /** 一次性下载票据（消费即失效）。 */
    private String ticket;

    /** 绑定的文件条目 ID。 */
    private Long nodeId;

    /** 票据有效期（秒）。 */
    private long expiresInSeconds;

    /** 取件地址（相对路径，由前端 / 网关补全 host）。 */
    private String downloadUrl;
}
