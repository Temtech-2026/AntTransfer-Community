/**
 * 文件条目的「拖到聊天」拖拽源。
 *
 * <p>列表与网格共用这一份实现，理由与 {@link buildNodeActions} 相同：同一件事只该有一份
 * 定义，否则「列表能拖、网格不能拖」这种差异会随着改动静默出现。</p>
 *
 * <p><b>为什么拖拽一起手就把抽屉叫出来：</b>投放区长在通讯抽屉里，抽屉收起时页面上
 * 根本没有可投放的目标。而 HTML5 拖拽过程中无法再触发抽屉展开动画（拖拽期间浏览器
 * 不给页面跑过渡），等用户拖到屏幕边缘才展开就已经晚了。所以让「拖起」和「抽屉滑出」
 * 同时发生，「拖」与「放」在空间上始终可达。</p>
 */

import type { DragEvent } from 'react';

import type { FileNode } from '@/services/file';
import { setChatOpen } from '@/services/ui/panelHub';
import { writeDragPayload } from '@/utils/dragFile';

/** 展开到 `<tr>` / 网格卡片上的拖拽属性。 */
export interface NodeDragProps {
  draggable: true;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
}

/** 把一条文件条目变成可拖到聊天的拖拽源。 */
export function nodeDragProps(node: FileNode): NodeDragProps {
  return {
    draggable: true,
    onDragStart: (event) => {
      setChatOpen(true);
      writeDragPayload(event.dataTransfer, {
        nodeId: node.id,
        fileName: node.name,
        sizeBytes: node.sizeBytes ?? 0,
        level: node.level,
      });
    },
  };
}
