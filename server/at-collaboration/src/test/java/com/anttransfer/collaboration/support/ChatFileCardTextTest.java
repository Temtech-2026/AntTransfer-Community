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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code ChatFileCardText} 的展示口径回归证据。
 *
 * <p><b>这一层最容易错的是「剥得太狠」：</b>尾注只在整段确实形如文件卡片时才存在，
 * 一旦认不出来就必须原样放行——用户正文里真的写过 {@code #file:1} 时，
 * 误删比不删更糟（引用块会静悄悄少一句话，且无从追查）。
 * 故用例把三条线都钉住：该剥的剥干净、认不出的不动、非文件消息一律不动。</p>
 *
 * @author AntTransfer CE
 */
class ChatFileCardTextTest {

    /** 一张典型的文件卡片正文（两种尾注俱全）。 */
    private static final String CARD =
            "季度报告.pdf（2.4 MB）\n#file:2102453724332388354\n#att:2104826682342342657";

    @Test
    @DisplayName("文件消息：剥掉 #file: 与 #att: 两条尾注，只留「名字（尺寸）」")
    void displayText_shouldStripBothMarkers() {
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER, CARD))
                .isEqualTo("季度报告.pdf（2.4 MB）");
    }

    @Test
    @DisplayName("文件消息：只有 #file: 的历史消息也剥")
    void displayText_shouldStripNodeMarkerOnly() {
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER,
                "季度报告.pdf（2.4 MB）\n#file:101"))
                .isEqualTo("季度报告.pdf（2.4 MB）");
    }

    @Test
    @DisplayName("文件消息：本就没有尾注（更早的历史消息）时原样返回")
    void displayText_shouldKeepContentWithoutMarkers() {
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER, "季度报告.pdf（2.4 MB）"))
                .isEqualTo("季度报告.pdf（2.4 MB）");
    }

    @Test
    @DisplayName("文件消息：文件名自带全角括号时，只认最外层最后一对括号作尺寸")
    void displayText_shouldTreatOnlyLastBracketPairAsSize() {
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER,
                "方案（终版）.pdf（2.4 MB）\n#file:101"))
                .isEqualTo("方案（终版）.pdf（2.4 MB）");
    }

    @Test
    @DisplayName("文件消息：CRLF 换行的快照同样剥得掉，且尾注间的空行不影响")
    void displayText_shouldTolerateCrlfAndBlankLines() {
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER,
                "  季度报告.pdf（2.4 MB）\r\n\r\n#file:101\r\n#att:202  "))
                .isEqualTo("季度报告.pdf（2.4 MB）");
    }

    @Test
    @DisplayName("尾注 ID 不是纯数字（半截标记 / 用户写的伪标记）时整段按普通文本处理，不猜着删")
    void displayText_shouldKeepContentWhenMarkerIdIsNotNumeric() {
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER,
                "季度报告.pdf（2.4 MB）\n#file:abc"))
                .isEqualTo("季度报告.pdf（2.4 MB）\n#file:abc");
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER,
                "季度报告.pdf（2.4 MB）\n#att:"))
                .isEqualTo("季度报告.pdf（2.4 MB）\n#att:");
    }

    @Test
    @DisplayName("有认不出的尾注行时整段按普通文本处理（用户正文里写过 #file: 也不误删）")
    void displayText_shouldKeepContentWhenAnyLineIsUnrecognized() {
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER,
                "季度报告.pdf（2.4 MB）\n#foo:1"))
                .isEqualTo("季度报告.pdf（2.4 MB）\n#foo:1");
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER,
                "季度报告.pdf（2.4 MB）\n#file:101\n补充一句"))
                .isEqualTo("季度报告.pdf（2.4 MB）\n#file:101\n补充一句");
    }

    @Test
    @DisplayName("首行不是「名字（尺寸）」形态时不动——多行纯文本不会被当成卡片")
    void displayText_shouldKeepContentWhenHeadDoesNotMatch() {
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER,
                "文本消息不做任何加工\n#file:1"))
                .isEqualTo("文本消息不做任何加工\n#file:1");
    }

    @Test
    @DisplayName("非文件消息一律不动：文本消息里的 #file: 是用户正文，不能当尾注剥")
    void displayText_shouldNotTouchTextMessage() {
        assertThat(ChatFileCardText.displayText(MessageType.CHAT_TEXT, CARD)).isEqualTo(CARD);
        assertThat(ChatFileCardText.displayText(MessageType.SYSTEM, CARD)).isEqualTo(CARD);
    }

    @Test
    @DisplayName("类型缺失（历史数据 / 非常规路径）时按不动处理，宁可脏也不误删")
    void displayText_shouldNotTouchWhenMessageTypeMissing() {
        assertThat(ChatFileCardText.displayText(null, CARD)).isEqualTo(CARD);
    }

    @Test
    @DisplayName("正文为空或全空白时原样返回，不产出空卡片")
    void displayText_shouldKeepBlankContent() {
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER, null)).isNull();
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER, "   ")).isEqualTo("   ");
        assertThat(ChatFileCardText.displayText(MessageType.FILE_TRANSFER,
                "季度报告.pdf（）\n#file:101"))
                .isEqualTo("季度报告.pdf（）\n#file:101");
    }
}
