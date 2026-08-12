'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChevronDown, ChevronUp, Wrench } from 'lucide-react';

import type { RuntimeEvent } from '@/lib/api/runtime';

/** 前端会话消息的内容块：text / 工具调用 / 工具结果，独立渲染，不再把 JSON 混进正文。 */
export type UiContentPart =
  | { kind: 'text'; text: string }
  | { kind: 'toolCall'; name: string; args: unknown }
  | { kind: 'toolResult'; name: string; response: unknown };

export type UiChatMessage = {
  role: 'user' | 'assistant' | 'tool';
  parts: UiContentPart[];
  invocationId?: string;
};

function partText(part: { text?: string }): string | null {
  return part.text || null;
}

function callMeta(part: { name?: string; args?: unknown; id?: string }): { name: string; args: unknown } {
  const args = part.args ?? {};
  return {
    name: typeof part.name === 'string' && part.name ? part.name : 'tool',
    args: args && typeof args === 'object' ? args : { value: args },
  };
}

function responseMeta(part: { name?: string; response?: unknown; id?: string }): { name: string; response: unknown } {
  return {
    name: typeof part.name === 'string' && part.name ? part.name : 'tool',
    response: part.response ?? null,
  };
}

/** 把 runtime 事件转成 UI parts（不含 role）。 */
export function eventParts(event: RuntimeEvent): { parts: UiContentPart[]; role: UiChatMessage['role']; invocationId?: string } {
  const parts: UiContentPart[] = [];
  for (const source of event.content?.parts || []) {
    const text = partText(source);
    if (text) {
      parts.push({ kind: 'text', text });
      continue;
    }
    if (source.functionCall) {
      parts.push({ kind: 'toolCall', ...callMeta(source.functionCall as { name?: string; args?: unknown; id?: string }) });
      continue;
    }
    if (source.functionResponse) {
      parts.push({ kind: 'toolResult', ...responseMeta(source.functionResponse as { name?: string; response?: unknown; id?: string }) });
    }
  }
  return { parts, role: roleFromAuthor(String(event.author || event.content?.role || '')), invocationId: event.invocationId };
}

function roleFromAuthor(author: string): UiChatMessage['role'] {
  if (!author || author === 'model' || author === 'assistant' || author === 'bot') return 'assistant';
  if (author === 'tool' || author === 'function') return 'tool';
  return 'user';
}

/** 从历史 session.events 恢复消息列表：同一 invocation（一次运行回合）的事件合并为一条消息，避免 tool 事件撑爆气泡。 */
export function eventsToMessages(events: RuntimeEvent[] | undefined): UiChatMessage[] {
  const messages: UiChatMessage[] = [];
  for (const event of events || []) {
    const converted = eventParts(event);
    if (!converted.parts.length) continue;
    const last = messages[messages.length - 1];
    // 同一次运行时（同一 invocationId）的连续事件合并进上一条消息；tool 结果挂到同一回合。
    if (last && converted.invocationId && last.invocationId === converted.invocationId) {
      const nextParts = [...last.parts];
      for (const part of converted.parts) {
        if (part.kind === 'text') {
          const textIndex = nextParts.findIndex((item) => item.kind === 'text');
          if (textIndex === -1) nextParts.push(part);
          else nextParts[textIndex] = { kind: 'text', text: (nextParts[textIndex] as { text: string }).text + part.text };
        } else {
          nextParts.push(part);
        }
      }
      messages[messages.length - 1] = { ...last, parts: nextParts };
    } else {
      messages.push({ role: converted.role, parts: converted.parts, invocationId: converted.invocationId });
    }
  }
  return messages;
}

function findLastIndex<T>(list: T[], predicate: (item: T) => boolean): number {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (predicate(list[index])) return index;
  }
  return -1;
}

/**
 * 合并同 invocation 的流式事件到已有消息：
 * - 同一次运行（同 invocationId）的连续事件合并进同一条消息，tool/文本事件都挂同一回合，避免撑爆气泡；
 * - 增量事件（partial=true）的 text 追加到已累积文本，final 完整事件（partial=false）替换该段；
 * - 用户回显（author=user）在 UI 已乐观渲染，这里跳过。
 */
export function appendStreamEvent(messages: UiChatMessage[], event: RuntimeEvent): UiChatMessage[] {
  const converted = eventParts(event);
  if (!converted.parts.length) return messages;
  const { role, invocationId } = converted;
  if (role === 'user') return messages;

  const merge = (base: UiChatMessage): UiChatMessage => {
    const nextParts = [...base.parts];
    for (const part of converted.parts) {
      if (part.kind === 'text') {
        const textIndex = nextParts.findIndex((item) => item.kind === 'text');
        if (textIndex === -1) {
          nextParts.push(part);
        } else {
          const current = nextParts[textIndex] as { kind: 'text'; text: string };
          nextParts[textIndex] = event.partial
            ? { kind: 'text', text: current.text + part.text }
            : { kind: 'text', text: part.text };
        }
        continue;
      }
      nextParts.push(part);
    }
    return { ...base, parts: nextParts, invocationId: invocationId || base.invocationId };
  };

  // 优先合并进同 invocation 的最后一条非 user 消息；无 invocation 时合并进最后一条非 user 消息（历史恢复/降级 run 的兜底）。
  const targetIndex = findLastIndex(messages, (message) =>
    (invocationId ? message.invocationId === invocationId : !message.invocationId) && message.role !== 'user',
  );
  if (targetIndex === -1) {
    return [...messages, { role, parts: converted.parts, invocationId }];
  }
  const target = messages[targetIndex];
  const effectiveRole = target.role === 'tool' && converted.parts.some((part) => part.kind === 'text') ? 'assistant' : target.role;
  return [...messages.slice(0, targetIndex), merge({ ...target, role: effectiveRole }), ...messages.slice(targetIndex + 1)];
}

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

/** 渲染 markdown + GFM（表格/链接/列表）+ 代码高亮。 */
function RenderMarkdown({ text }: { text: string }) {
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

function ToolCall(props: { part: { name: string; args: unknown } }) {
  const [open, setOpen] = useState(false);
  const { name, args } = props.part;
  return (
    <div className="mt-1 overflow-hidden rounded-md border border-blue-500/30 bg-blue-500/5 text-xs">
      <button type="button" className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left font-medium text-blue-600 hover:bg-blue-500/10" onClick={() => setOpen((value) => !value)}>
        <Wrench className="h-3 w-3" />
        <span className="flex-1 truncate font-mono">{name}</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <pre className="max-h-64 overflow-auto border-t border-blue-500/20 bg-background/60 p-2 font-mono text-[11px] leading-relaxed">
          {JSON.stringify(args, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ToolResult(props: { name: string; response: unknown }) {
  const [open, setOpen] = useState(false);
  const raw = JSON.stringify(props.response, null, 2);
  const summary = raw.length > 240 ? `${raw.slice(0, 240)}…` : raw;
  return (
    <div className="mt-1 overflow-hidden rounded-md border border-emerald-500/30 bg-emerald-500/5 text-xs">
      <button type="button" className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left font-medium text-emerald-700 hover:bg-emerald-500/10" onClick={() => setOpen((value) => !value)}>
        <span className="flex-1 truncate font-mono">{props.name}</span>
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px]">result</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      <pre className="max-h-64 overflow-auto px-2 py-1.5 font-mono text-[11px] leading-relaxed text-foreground/80">{open ? raw : summary}</pre>
    </div>
  );
}

/** 单条会话消息：text 走 markdown，工具调用/结果独立卡片展示。 */
export function ChatMessage(props: { message: UiChatMessage }) {
  const { message } = props;
  const bubbleClass = message.role === 'user' ? 'ml-8 bg-violet-500/10' : 'mr-8 bg-background';
  if (!message.parts.length) {
    return (
      <div data-testid="playground-message" className={`rounded-md p-2 text-sm ${bubbleClass}`}>
        <div className="mb-1 text-[10px] uppercase text-muted-foreground">{message.role}</div>
        <div className="whitespace-pre-wrap">…</div>
      </div>
    );
  }
  return (
    <div data-testid="playground-message" className={`space-y-1 rounded-md p-2 text-sm ${bubbleClass}`}>
      <div className="mb-1 text-[10px] uppercase text-muted-foreground">{message.role}</div>
      {message.parts.map((part, index) => {
        if (part.kind === 'text') {
          return (
            <div key={index} className="whitespace-pre-wrap">
              <RenderMarkdown text={part.text} />
            </div>
          );
        }
        if (part.kind === 'toolCall') {
          return <ToolCall key={`call-${index}`} part={{ name: part.name, args: part.args }} />;
        }
        return <ToolResult key={`result-${index}`} name={part.name} response={part.response} />;
      })}
    </div>
  );
}