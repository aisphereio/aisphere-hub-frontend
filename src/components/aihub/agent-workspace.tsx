'use client';

import { useMemo, useState } from 'react';
import { Clock3, Loader2, MessageSquarePlus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAgentSessions } from '@/hooks/use-agent-sessions';
import { useMe } from '@/hooks/use-auth';
import { agentRuntimeApi, createRuntimeSessionWithRetry, type RuntimeSession } from '@/lib/api/runtime';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AgentPlayground } from '@/components/aihub/agent-playground';

type AgentWorkspaceProps = {
  agentId: string;
  agentVersion?: string;
};

function sessionTime(session: RuntimeSession) {
  if (!session.lastUpdateTime) return '刚刚创建';
  return new Date(session.lastUpdateTime * 1000).toLocaleString();
}

function nativePhase(session: RuntimeSession) {
  const native = session.state?.__agent_native_sandbox__;
  if (!native || typeof native !== 'object') return '待启动';
  const phase = (native as Record<string, unknown>).phase;
  return typeof phase === 'string' ? phase : '已创建';
}

export function AgentWorkspace({ agentId, agentVersion }: AgentWorkspaceProps) {
  const { data: principal } = useMe();
  const userId = String(principal?.subjectId || principal?.sub || 'admin');
  const sessionsQuery = useAgentSessions(agentId, userId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sessions = useMemo(
    () => [...(sessionsQuery.data || [])].sort((left, right) => (right.lastUpdateTime || 0) - (left.lastUpdateTime || 0)),
    [sessionsQuery.data],
  );

  const activeSessionId = selectedSessionId && sessions.some((session) => session.id === selectedSessionId)
    ? selectedSessionId
    : sessions[0]?.id || null;

  const createSession = async () => {
    const sessionId = `ui-${agentId}-${Date.now()}`;
    setBusy(true);
    try {
      await createRuntimeSessionWithRetry(agentId, userId, sessionId, {
        agent_version: agentVersion || null,
        session_source: 'hub-ui',
      });
      await sessionsQuery.refetch();
      setSelectedSessionId(sessionId);
      toast.success('已创建新的 Agent 会话');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建会话失败');
    } finally {
      setBusy(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!window.confirm(`删除会话 ${sessionId}？此操作会清除该会话的 Runtime 上下文。`)) return;
    setBusy(true);
    try {
      await agentRuntimeApi.deleteSession(agentId, userId, sessionId);
      await sessionsQuery.refetch();
      if (selectedSessionId === sessionId) setSelectedSessionId(null);
      toast.success('会话已删除');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除会话失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="agent-workspace" className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_240px]">
      <Card className="min-w-0">
        <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
          <CardTitle className="text-sm">Sessions</CardTitle>
          <Button data-testid="new-agent-session" size="icon" variant="outline" className="h-7 w-7" onClick={() => void createSession()} disabled={busy} title="新建会话">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}
          </Button>
        </CardHeader>
        <CardContent className="p-2 pt-0">
          {sessionsQuery.isLoading ? (
            <p className="p-2 text-xs text-muted-foreground">加载会话中…</p>
          ) : sessions.length === 0 ? (
            <button type="button" className="w-full rounded-md border border-dashed p-3 text-left text-xs text-muted-foreground hover:bg-muted/40" onClick={() => void createSession()}>
              还没有会话，点击创建第一条。
            </button>
          ) : (
            <ScrollArea className="h-[420px] pr-2">
              <div data-testid="agent-session-list" className="space-y-1">
                {sessions.map((session) => {
                  const active = session.id === activeSessionId;
                  return (
                    <div key={session.id} data-testid="agent-session-item" className={`group rounded-md border p-2 ${active ? 'border-violet-500 bg-violet-500/10' : 'hover:bg-muted/40'}`}>
                      <button type="button" className="w-full text-left" onClick={() => setSelectedSessionId(session.id)}>
                        <div className="flex items-center gap-1.5 text-xs font-medium"><MessageSquarePlus className="h-3 w-3" /> <span className="truncate">{session.id}</span></div>
                        <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{sessionTime(session)}</span><Badge variant="outline" className="px-1 py-0 text-[9px]">{nativePhase(session)}</Badge></div>
                      </button>
                      <Button aria-label={`删除会话 ${session.id}`} variant="ghost" size="icon" className="mt-1 h-6 w-6 opacity-60 hover:opacity-100" onClick={() => void deleteSession(session.id)} disabled={busy}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          {sessionsQuery.isError && <p className="mt-2 text-xs text-destructive">会话列表加载失败：{sessionsQuery.error.message}</p>}
          <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => void sessionsQuery.refetch()} disabled={sessionsQuery.isFetching}>
            <RefreshCw className={`mr-1 h-3 w-3 ${sessionsQuery.isFetching ? 'animate-spin' : ''}`} /> 刷新
          </Button>
        </CardContent>
      </Card>

      <div className="min-w-0">
        {activeSessionId ? (
          <AgentPlayground key={activeSessionId} agentId={agentId} agentVersion={agentVersion} sessionId={activeSessionId} onSessionReady={() => void sessionsQuery.refetch()} />
        ) : (
          <Card className="flex min-h-[520px] items-center justify-center border-dashed">
            <div className="text-center"><MessageSquarePlus className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium">选择或创建一个会话</p><p className="mt-1 text-xs text-muted-foreground">同一个 Agent 可以拥有多个独立的对话上下文。</p><Button className="mt-4" onClick={() => void createSession()} disabled={busy}>新建会话</Button></div>
          </Card>
        )}
      </div>

      <Card className="min-w-0">
        <CardHeader className="py-3"><CardTitle className="text-sm">Session binding</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div><div className="text-muted-foreground">Agent</div><div className="mt-1 break-all font-mono">{agentId}</div></div>
          <div><div className="text-muted-foreground">Pinned version</div><div className="mt-1 font-medium">{agentVersion || 'latest'}</div></div>
          <div><div className="text-muted-foreground">Current session</div><div data-testid="agent-session-id" className="mt-1 break-all font-mono">{activeSessionId || '未选择'}</div></div>
          <div className="rounded-md border bg-muted/20 p-2 leading-5 text-muted-foreground">一个 Session 只绑定一个 Agent 版本和 Runtime 上下文。要切换 Agent 或版本，请创建新 Session。</div>
        </CardContent>
      </Card>
    </div>
  );
}
