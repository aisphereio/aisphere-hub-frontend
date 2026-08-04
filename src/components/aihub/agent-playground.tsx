'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAgentRunPlan } from '@/hooks/use-agents';
import { useMe } from '@/hooks/use-auth';
import { agentRuntimeApi, createRuntimeSessionWithRetry, type RuntimeEvent } from '@/lib/api/runtime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

type ChatMessage = { role: 'user' | 'assistant' | 'tool'; text: string };

function eventText(event: RuntimeEvent): string {
  const parts = event.content?.parts || [];
  const text = parts.map((part) => part.text || '').filter(Boolean).join('\n');
  if (text) return text;
  const call = parts.find((part) => part.functionCall);
  if (call) return `Tool call: ${JSON.stringify(call.functionCall)}`;
  const result = parts.find((part) => part.functionResponse);
  if (result) return `Tool result: ${JSON.stringify(result.functionResponse)}`;
  return '';
}

export function AgentPlayground({ agentId, agentVersion, sessionId, onSessionReady }: { agentId: string; agentVersion?: string; sessionId: string; onSessionReady?: () => void }) {
  const { data: principal } = useMe();
  const planRun = useAgentRunPlan();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [pendingTools, setPendingTools] = useState<string[]>([]);
  const userId = String(principal?.subjectId || principal?.sub || 'admin');

  const execute = async (text: string, approvedTools: string[]) => {
    await createRuntimeSessionWithRetry(agentId, userId, sessionId, { agent_version: agentVersion || null, session_source: 'hub-ui' });
    onSessionReady?.();
    const events = await agentRuntimeApi.run({
      appName: agentId,
      userId,
      sessionId,
      text,
      version: agentVersion,
      approvalConfirmed: true,
      approvedTools,
    });
    const assistant = events.map(eventText).filter(Boolean).join('\n');
    setMessages((current) => [...current, { role: 'assistant', text: assistant || 'Agent completed without a text response.' }]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || pendingText) return;
    setBusy(true);
    setInput('');
    setMessages((current) => [...current, { role: 'user', text }]);
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
      setMessages((current) => [...current, { role: 'tool', text: message }]);
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
      setMessages((current) => [...current, { role: 'tool', text: message }]);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="agent-playground" className="border-violet-500/30">
      <CardHeader className="py-3"><CardTitle className="text-sm">Agent Playground</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p data-testid="playground-status" className="text-xs text-muted-foreground">Session: {sessionId} · Runtime 会按当前 Agent 版本创建沙箱并加载 Skill/Tool。</p>
        <div className="max-h-[420px] min-h-[220px] space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-3" data-testid="playground-messages">
          {messages.length === 0 ? <p className="text-xs text-muted-foreground">发送第一条消息，验证 Prompt、Skill、Tool 和 Runtime 的联动。</p> : messages.map((message, index) => (
            <div key={`${message.role}-${index}`} data-testid="playground-message" className={`rounded-md p-2 text-sm ${message.role === 'user' ? 'ml-8 bg-violet-500/10' : 'mr-8 bg-background'}`}>
              <div className="mb-1 text-[10px] uppercase text-muted-foreground">{message.role}</div>
              <div className="whitespace-pre-wrap">{message.text}</div>
            </div>
          ))}
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
