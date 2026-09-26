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

import java.util.Optional;

/**
 * 用户头像字节的存储端口（SPI）：写入方 at-permission、读出方 at-auth，
 * 实现在 at-file（存储介质与落盘布局属于文件域）。
 *
 * <p><b>为什么不复用文件域（{@code sys_file} / {@code sys_file_node}）：</b>
 * 头像是「账号的一部分」，不是「用户的一个文件」——复用文件域会带来三个实际后果：
 * ① 头像会出现在用户的文件列表 / 回收站 / 容量统计里，用户删掉它头像就消失了；
 * ② 写入需要 {@code file:upload} 权限，等于「要改头像先要有传文件权限」；
 * ③ 展示要走「换票 → {@code ?ticket=} 取件」，票据会过期，而
 * {@code <img src>} 无法在过期后自行重签，表现为头像随机变成碎图。
 * 故头像走独立目录 + 独立直出路径，与文件域互不影响。</p>
 *
 * <p><b>key 的形态与语义：</b>{@link #store} 返回的 key 是<b>不透明</b>的
 * （实现为 {@code <32 位十六进制随机>.<扩展名>}），落库进 {@code sys_user.avatar_url}。
 * 调用方不得解析它、不得假设它等于路径、<b>更不得把客户端传来的字符串当作 key 回传</b>
 * ——实现会按固定模式校验 key 的形态，路径穿越与任意文件读取在结构上即不可达。</p>
 *
 * <p><b>为什么扩展名由内容决定而不是由调用方传：</b>见 {@link ImageTypes}——
 * 客户端给的文件名与 MIME 都不可信，落盘扩展名与响应 {@code Content-Type} 一律由魔数识别结果决定。</p>
 *
 * <p><b>缓存口径：</b>每次存储生成全新 key，故「key 变了」等价于「头像变了」，
 * {@link #urlOf} 把 key 编进查询串做版本号，浏览器与中间层可以放心长缓存；
 * 无需（也不应）依赖 {@code Last-Modified} 这类会被批量拷贝打乱的时间戳。</p>
 *
 * @author AntTransfer CE
 */
public interface AvatarStoragePort {

    /**
     * 单张头像字节上限：2 MiB。
     *
     * <p>取值依据：一张 512×512 的 PNG 头像通常在 100~300 KiB，2 MiB 已足够覆盖
     * 「未压缩的高清照片」；上限的作用是让「上传一个 64 MB 的图当头像」
     * 在读入内存前就被拒掉（{@code spring.servlet.multipart.max-file-size} 是 64 MB，
     * 不能靠它兜底）。</p>
     */
    long MAX_AVATAR_BYTES = 2L * 1024 * 1024;

    /** 头像直出路径前缀（不含 host；{@code /api} 来自 {@code server.servlet.context-path}）。 */
    String AVATAR_PATH_PREFIX = "/api/v1/users/";

    /**
     * 读出的头像字节。
     *
     * @param content     图片字节
     * @param contentType 响应 {@code Content-Type}（由落盘扩展名反查，见 {@link ImageTypes#byExtension}）
     * @param etag        内容标识（即存储 key）：同一 key 的内容永不变，可直接用作强 ETag
     */
    record StoredAvatar(byte[] content, String contentType, String etag) {
    }

    /**
     * 存头像，返回新的存储 key。
     *
     * <p>实现须保证：① 内容不是支持的光栅图时抛 {@code IllegalArgumentException}
     * （调用方应在此之前用 {@link ImageTypes#detect} 预先校验并回 4007，这里是纵深防御）；
     * ② 落盘是「先写临时文件再原子改名」，避免半截文件被直出成碎图；
     * ③ 同样的字节两次调用返回<b>不同</b>的 key（不做内容寻址去重）——
     * 去重会让「换一张图再换回来」复用旧 key，版本号不变则浏览器不刷新。</p>
     *
     * @param content 图片字节（长度由调用方按 {@link #MAX_AVATAR_BYTES} 预检）
     * @return 存储 key（不透明，落库进 {@code sys_user.avatar_url}）
     */
    String store(byte[] content);

    /**
     * 读头像。
     *
     * @param key 存储 key（形态非法、文件不存在、或文件大小异常时返回 {@link Optional#empty()}）
     * @return 头像字节；无可直出内容时为空
     */
    Optional<StoredAvatar> load(String key);

    /**
     * 删头像（幂等）。
     *
     * <p>调用时机是「换头像的事务<b>提交后</b>」：提交前删会让回滚后的记录指向一个已消失的文件。</p>
     *
     * @param key 存储 key；为 {@code null} / 空 / 形态非法时不做任何事
     * @return 是否真的删掉了一个文件（用于日志，调用方无需据此决策）
     */
    boolean delete(String key);

    /**
     * 由「用户 ID + 存储 key」拼出可直出的头像地址。
     *
     * <p><b>为什么这个拼接放在端口上而不是各调用方各写一遍：</b>它是「{@code avatar_url} 存 key、
     * 对外表现为 URL」这一层映射的<b>唯一真相源</b>。at-auth（{@code /auth/me}）与
     * at-permission（用户列表 / 详情）都要产出这个字段，两处若各拼一次，
     * 路径或版本参数一旦改动就会出现「一边能显示一边是碎图」。</p>
     *
     * <p>{@code v} 参数只做缓存击穿，服务端不据此查文件（实际取哪张仍以库里的 key 为准），
     * 因此老页面继续用旧 {@code v} 只会拿到缓存里的旧图，不会 404。</p>
     *
     * @param userId 用户 ID（雪花 ID，不可枚举）
     * @param key    存储 key；为 {@code null} / 空时返回 {@code null}（表示「没有头像」，不是「空串头像」）
     * @return 形如 {@code /api/v1/users/123/avatar?v=ab12....png} 的相对地址
     */
    static String urlOf(Long userId, String key) {
        if (userId == null || key == null || key.isBlank()) {
            return null;
        }
        return AVATAR_PATH_PREFIX + userId + "/avatar?v=" + key;
    }
}
