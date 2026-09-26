/**
 * 引用块 · 纯展示组件的两条口径。
 *
 * <ol>
 *   <li><b>不回查、不截断</b>：摘要与发送人都由调用方给（服务端写入时抄下的快照，
 *       或本地那份「正在引用」草稿）。被引用消息可能随后被撤回，届时原消息正文已清空——
 *       任何「按 id 回查原文」的渲染都会让引用块在几秒后集体变空白；截断也归调用方
 *       （发送前的预览 60 字、落库快照 200 字，两处长度不同）；</li>
 *   <li><b>空摘要也要有容器</b>：正文可能为空（文件 / 审批类消息的展示文案可为空），
 *       此时引用块必须仍然画出「引用了谁」，而不是塌成一片空白让人以为渲染失败。</li>
 * </ol>
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ChatMessageQuote from './index';

describe('ChatMessageQuote', () => {
  it('顶行是「谁说的」、第二行是正文摘要', () => {
    render(<ChatMessageQuote senderName="张三" summary="方案已发" />);

    const quote = screen.getByTestId('chat-quote');
    expect(quote).toHaveTextContent('张三');
    expect(quote).toHaveTextContent('方案已发');
    // 两行而不是拼成一句：拼接后读屏念出来分不清哪部分是发送人
    expect(quote.querySelectorAll('span')).toHaveLength(2);
  });

  it('摘要原样渲染：截断与省略号的样式责任不在本组件', () => {
    const long = '这段话很长'.repeat(20);
    render(<ChatMessageQuote senderName="张三" summary={long} />);

    expect(screen.getByTestId('chat-quote')).toHaveTextContent(long);
  });

  it('空摘要仍保留容器与发送人：引用块不塌成空白', () => {
    render(<ChatMessageQuote senderName="张三" summary="" />);

    const quote = screen.getByTestId('chat-quote');
    expect(quote).toBeInTheDocument();
    expect(quote).toHaveTextContent('张三');
    expect(quote.querySelectorAll('span')).toHaveLength(2);
  });
});
