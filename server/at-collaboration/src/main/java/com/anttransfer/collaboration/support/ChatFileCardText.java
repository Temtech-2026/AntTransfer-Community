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
package com.anttransfer.collaboration.support;

import com.anttransfer.common.notify.MessageType;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 会话「文件卡片」正文的展示口径（纯函数，可单测）。
 *
 * <p><b>为什么服务端也要有一份：</b>文件消息的正文并非纯文本，末尾还挂着给卡片点击用的
 * 机器可读尾注（{@code #file:{nodeId}} 与 {@code #att:{attachmentId}}）。聊天页与通讯抽屉
 * 拿到正文后都会先解析、再画成卡片，标记因此不会露给用户；<b>但引用快照不是这样</b>——
 * 它是把被引用消息的正文抄成另一行的文本（{@code sys_notify_message.quote_content}），
 * 那一行既不带被引用消息的类型、也不带它的卡片结构，渲染端只能当普通文本画，
 * 于是引用块里就甩出一串 {@code #file:2102… #att:2104…} 的雪花 ID。</p>
 *
 * <p>所以剥尾注要发生在<b>写快照的那一刻</b>：那时被引用消息的 {@code messageType}
 * 就在手上，判得准；快照本身也就成了「给人看的文本」，任何端拿去都能直接渲染。</p>
 *
 * <p><b>口径与前端的 {@code parseFileCardContent} 逐条对齐</b>（两处必须同进同退）：
 * 首行形如 {@code 名字（尺寸）}，其余非空行只能是合法尾注；只要有一行认不出来，
 * 整段就判为「不是文件卡片」而<b>原样保留</b>——宁可把用户正文当文本，
 * 也不猜着删（正文里真的讨论过 {@code #file:1} 这种写法时，误删比不删更糟）。</p>
 *
 * @author AntTransfer CE
 */
public final class ChatFileCardText {

    /** 条目引用尾注的前缀。 */
    private static final String NODE_MARKER = "#file:";

    /** 附件授权引用尾注的前缀。 */
    private static final String ATTACHMENT_MARKER = "#att:";

    /**
     * 首行形态：{@code 名字（尺寸）}。
     *
     * <p>前半段用贪婪匹配：文件名自身含全角括号时（如 {@code 方案（终版）.pdf（2.4 MB）}），
     * 只有最外层最后一对括号才是尺寸，否则会把文件名切坏。</p>
     */
    private static final Pattern HEAD_PATTERN = Pattern.compile("^(.+)（([^（）]+)）$");

    /** 尾注里的 ID 必须是纯数字，避免把 {@code #file:abc} 这类半截正文当成卡片。 */
    private static final Pattern ID_PATTERN = Pattern.compile("\\d+");

    private ChatFileCardText() {
    }

    /**
     * 取「给人看的正文」。
     *
     * @param messageType 消息体类型（见 {@link MessageType}）；只有文件消息才谈得上剥尾注
     * @param content     原始正文
     * @return 非文件消息、认不出卡片形态、或正文为空时<b>原样返回</b>（含 {@code null}）
     */
    public static String displayText(Integer messageType, String content) {
        if (content == null || messageType == null || messageType != MessageType.FILE_TRANSFER) {
            return content;
        }
        String stripped = stripMarkers(content);
        return stripped != null ? stripped : content;
    }

    /**
     * 剥掉卡片尾注，只留 {@code 名字（尺寸）}。
     *
     * <p>逐行读取而不是一条大正则：尾注的可选组合会随功能增加而变多，
     * 大正则一旦要支持「有 {@code #att:} 没 {@code #file:}」就会写成指数级分支。</p>
     *
     * @return 不是卡片形态时返回 {@code null}（调用方据此原样保留正文）
     */
    private static String stripMarkers(String content) {
        // 按 \R 而不是 \n 切：快照可能来自换行被规范化成 \r\n 的环境
        String[] lines = content.trim().split("\\R");
        Matcher head = HEAD_PATTERN.matcher(lines[0].trim());
        if (!head.matches()) {
            return null;
        }
        String name = head.group(1).trim();
        String sizeText = head.group(2).trim();
        if (name.isEmpty() || sizeText.isEmpty()) {
            return null;
        }
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty()) {
                // 正文里被补过的空行不该把卡片打回纯文本，跳过即可
                continue;
            }
            if (line.startsWith(NODE_MARKER)) {
                if (!isId(line.substring(NODE_MARKER.length()))) {
                    return null;
                }
                continue;
            }
            if (line.startsWith(ATTACHMENT_MARKER)) {
                if (!isId(line.substring(ATTACHMENT_MARKER.length()))) {
                    return null;
                }
                continue;
            }
            // 有无法识别的尾注行：宁可当普通文本，也不猜
            return null;
        }
        return name + "（" + sizeText + "）";
    }

    private static boolean isId(String rawValue) {
        return ID_PATTERN.matcher(rawValue.trim()).matches();
    }
}
