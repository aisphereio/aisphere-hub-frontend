'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * Markdown + GFM + 代码高亮渲染。
 *
 * 独立成客户端-only 组件并通过 next/dynamic ssr:false 加载：
 * react-markdown / react-syntax-highlighter 在服务器混水渲染时会输出与
 * 客户端不一致的 HTML（React 418 hydration 错误），流式消息出现 markdown
 * 时会让整个 Playground 崩溃。
 */
function CodeBlock(props: { className?: string; children?: React.ReactNode }) {
  const match = /language-(\w+)/.exec(props.className || '');
  const language = match ? match[1] : '';
  const raw = String(props.children || '').replace(/\n$/, '');
  if (language || raw.includes('\n')) {
    return (
      <SyntaxHighlighter language={language || undefined} style={oneDark} PreTag="div" customStyle={{ borderRadius: '0.5rem', margin: '0.5rem 0', fontSize: '0.8125rem' }}>
        {raw}
      </SyntaxHighlighter>
    );
  }
  return <code className={`${props.className || ''} rounded bg-muted px-1 py-0.5 font-mono text-[0.8125em]`}>{props.children}</code>;
}

export function MarkdownContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: CodeBlock,
        a: (props) => (
          <a href={props.href} className="text-violet-500 underline underline-offset-2" target="_blank" rel="noreferrer">
            {props.children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export default MarkdownContent;