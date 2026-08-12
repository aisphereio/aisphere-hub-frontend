'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAgentRunPlan } from '@/hooks/use-agents';
import { useMe } from '@/hooks/use-auth';
import { agentRuntimeApi, createRuntimeSessionWithRetry, runAgentStream, type RuntimeEvent } from '@/lib/api/runtime';
import { appendStreamEvent, ChatMessage, eventsToMessages, type UiChatMessage } from '@/components/aihub/chat-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

/** 会话历史 + 流式追加共用一份状态；切换会话时不重挂载，历史由 getSession 恢复。 */
type SessionState = {
  sessionId: string;
  loaded: boolean;
  messages: UiChatMessage[];
};

export function AgentPlayground({ agentId, agentVersion, sessionId, onSessionReady }: { agentId: string; agentVersion?: string; sessionId: string; onSessionReady?: () => void }) {
  const { data: principal } = useMe();
  const planRun = useAgentRunPlan();
  const [input, setInput] = useState('');
  const [session, setSession] = useState<SessionState>({ sessionId: '', loaded: false, messages: [] });
  const [busy, setBusy] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [pendingTools, setPendingTools] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userId = String(principal?.subjectId || principal?.sub || 'admin');

  // 挂载/切换会话时从 runtime 恢复历史；刷新页面或换会话不再清空。
  useEffect(() => {
    let cancelled = false;
    agentRuntimeApi
      .getSession(agentId, userId, sessionId)
      .then((history) => {
        if (cancelled) return;
        setSession({ sessionId, loaded: true, messages: eventsToMessages(history.events) });
      })
      .catch(() => {
        // 会话刚创建尚未有 events 时忽略，保持空对话。
        if (cancelled) return;
        setSession({ sessionId, loaded: true, messages: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, userId, sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [session.messages]);

  const appendMessages = (updater: (current: UiChatMessage[]) => UiChatMessage[]) => {
    setSession((current) => ({ ...current, messages: updater(current.messages) }));
  };

  const streamEvents = (events: RuntimeEvent[]) => {
    for (const event of events) {
      appendMessages((current) => appendStreamEvent(current, event));
    }
  };

  const execute = async (text: string, approvedTools: string[]) => {
    try {
      await createRuntimeSessionWithRetry(agentId, userId, sessionId, { agent_version: agentVersion || null, session_source: 'hub-ui' });
    } catch (error) {
      // Runtime 会话已存在是幂等复用，不是错误：直接继续 run（后端 run 自带 EnsureSession）。
      const message = error instanceof Error ? error.message : String(error);
      if (!/already exists/i.test(message)) {
        appendMessages((current) => [...current, { role: 'tool', parts: [{ kind: 'text', text: message }] }]);
        toast.error(message);
        return;
      }
    }
    onSessionReady?.();
    try {
      await runAgentStream(
        {
          appName: agentId,
          userId,
          sessionId,
          text,
          version: agentVersion,
          approvalConfirmed: true,
          approvedTools,
        },
        {
          onEvent: (event) => appendMessages((current) => appendStreamEvent(current, event)),
          onMetadata: () => undefined,
          onDone: () => undefined,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent run failed';
      // SSE 失败降级：回退非流式 /run，复用同一套 parts 合并逻辑。
      try {
        const events = await agentRuntimeApi.run({
          appName: agentId,
          userId,
          sessionId,
          text,
          version: agentVersion,
          approvalConfirmed: true,
          approvedTools,
        });
        streamEvents(events);
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Agent run failed';
        appendMessages((current) => [...current, { role: 'tool', parts: [{ kind: 'text', text: fallbackMessage }] }]);
        toast.error(fallbackMessage);
      }
      if (message) toast.error(message);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || pendingText) return;
    setBusy(true);
    setInput('');
    appendMessages((current) => [...current, { role: 'user', parts: [{ kind: 'text', text }] }]);
    try {
      const plan = await planRun.mutateAsync({
        agentId,
        request: { runtimeId: 'agentkit-console', sessionId, version: agentVersion },
      });
      const perRunTools = plan.tools.filter((tool) => tool.approvalMode === 'per_run').map((tool) => tool.tool);
      if (perRunTools.length > 0) {
        setPendingText(text);
        setPendingTools(perRunTools);
        return;
      }
      await execute(text, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent run failed';
      appendMessages((current) => [...current, { role: 'tool', parts: [{ kind: 'text', text: message }] }]);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const approveAndRun = async () => {
    if (!pendingText || busy) return;
    setBusy(true);
    try {
      const text = pendingText;
      const tools = pendingTools;
      setPendingText('');
      setPendingTools([]);
      await execute(text, tools);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent run failed';
      appendMessages((current) => [...current, { role: 'tool', parts: [{ kind: 'text', text: message }] }]);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const messages = session.sessionId === sessionId ? session.messages : [];

  return (
    <Card data-testid="agent-playground" className="border-violet-500/30">
      <CardHeader className="py-3"><CardTitle className="text-sm">Agent Playground</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p data-testid="playground-status" className="text-xs text-muted-foreground">Session: {sessionId} · Runtime 会按当前 Agent 版本创建沙箱并加载 Skill/Tool。</p>
        <div ref={scrollRef} className="max-h-[420px] min-h-[220px] space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-3" data-testid="playground-messages">
          {!session.loaded || session.sessionId !== sessionId ? (
            <p className="text-xs text-muted-foreground">加载会话历史…</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">发送第一条消息，验证 Prompt、Skill、Tool 和 Runtime 的联动。</p>
          ) : (
            messages.map((message, index) => <ChatMessage key={index} message={message} />)
          )}
          {busy && !pendingText && (
            <div data-testid="playground-typing" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> 正在生成…
            </div>
          )}
        </div>
        {pendingText && pendingTools.length > 0 && (
          <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" data-testid="playground-approval">
            <div className="font-medium">This run requests tool approval</div>
            <div className="text-xs text-muted-foreground">{pendingTools.join(', ')}</div>
            <Button onClick={() => void approveAndRun()} disabled={busy} data-testid="playground-approve">允许工具并运行</Button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea data-testid="playground-input" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="给 Agent 发一条消息……" className="min-h-[80px]" />
          <Button data-testid="playground-send" onClick={() => void send()} disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} 发送
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}