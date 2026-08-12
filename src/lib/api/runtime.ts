export type RuntimeContentPart = {
  text?: string;
  functionCall?: { name?: string; args?: unknown; id?: string } | unknown;
  functionResponse?: { name?: string; response?: unknown; id?: string } | unknown;
};

export type RuntimeEvent = {
  id?: string;
  author?: string;
  invocationId?: string;
  partial?: boolean;
  content?: {
    role?: string;
    parts?: RuntimeContentPart[];
  };
  [key: string]: unknown;
};

export type RuntimeSession = {
  id: string;
  appName: string;
  userId: string;
  lastUpdateTime?: number;
  events?: RuntimeEvent[];
  state?: Record<string, unknown>;
};

async function runtimeRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`/api/agent-runtime${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const rawBody = await response.text();
  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    body = rawBody;
  }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? String(body.message)
      : typeof body === 'string' && body.trim()
        ? body.trim()
        : `Runtime request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export const agentRuntimeApi = {
  createSession: (appName: string, userId: string, sessionId: string, state: Record<string, unknown> = {}) =>
    runtimeRequest(`/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: JSON.stringify({ state: { agent_id: appName, ...state } }),
    }),
  listSessions: (appName: string, userId: string) =>
    runtimeRequest<RuntimeSession[]>(`/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions`, { method: 'GET' }),
  getSession: (appName: string, userId: string, sessionId: string) =>
    runtimeRequest<RuntimeSession>(`/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' }),
  deleteSession: (appName: string, userId: string, sessionId: string) =>
    runtimeRequest<void>(`/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  run: (input: {
    appName: string;
    userId: string;
    sessionId: string;
    text: string;
    version?: string;
    approvalConfirmed?: boolean;
    approvedTools?: string[];
  }) =>
    runtimeRequest<RuntimeEvent[]>('/run', {
      method: 'POST',
      body: JSON.stringify({
        appName: input.appName,
        userId: input.userId,
        sessionId: input.sessionId,
        version: input.version,
        approvalConfirmed: input.approvalConfirmed,
        approvedTools: input.approvedTools,
        newMessage: { role: 'user', parts: [{ text: input.text }] },
      }),
    }),
};

/** SSE 帧头：/run_sse 会先发 metadata（adkRunMetadata），末尾发 done（adkRunDone），错误为 event: error + data: {"error":...}。/ */
const RUN_META_MARKER = 'adkRunMetadata';
const RUN_DONE_MARKER = 'adkRunDone';

export type RunStreamHandlers = {
  onEvent: (event: RuntimeEvent) => void;
  /** 收到 adkRunMetadata 帧（runId/snapshotId 等）。 */
  onMetadata?: (meta: Record<string, unknown>) => void;
  /** 收到 adkRunDone 帧。 */
  onDone?: () => void;
};

/**
 * 流式运行 Agent：POST /api/agent-runtime/run_sse（前端 → Next 代理 → runtime /run_sse）。
 * 逐帧解析标准 SSE（`data:` 行 + 可选 `id:`/`event:`），普通帧回调 onEvent，
 * error 帧抛错，adkRunDone 帧回调 onDone 后结束。
 */
export async function runAgentStream(
  input: {
    appName: string;
    userId: string;
    sessionId: string;
    text: string;
    version?: string;
    approvalConfirmed?: boolean;
    approvedTools?: string[];
  },
  handlers: RunStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/agent-runtime/run_sse', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      appName: input.appName,
      userId: input.userId,
      sessionId: input.sessionId,
      version: input.version,
      approvalConfirmed: input.approvalConfirmed,
      approvedTools: input.approvedTools,
      newMessage: { role: 'user', parts: [{ text: input.text }] },
    }),
    signal,
  });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(text.trim() || `Runtime stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let frameEvent = '';
  let frameData = '';

  const flush = (): boolean => {
    if (!frameData) {
      frameEvent = '';
      return false;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(frameData);
    } catch {
      frameEvent = '';
      frameData = '';
      return false;
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      if (RUN_META_MARKER in record) {
        handlers.onMetadata?.(record);
      } else if (RUN_DONE_MARKER in record) {
        frameEvent = '';
        frameData = '';
        handlers.onDone?.();
        return true;
      } else if (frameEvent === 'error' || record.error) {
        frameEvent = '';
        frameData = '';
        throw new Error(String(record.error || 'Runtime stream error'));
      } else {
        handlers.onEvent(parsed as RuntimeEvent);
      }
    }
    frameEvent = '';
    frameData = '';
    return false;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.startsWith('event:')) {
        frameEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        frameData += line.slice(5).trim();
      } else if (line === '') {
        if (flush()) return;
      }
    }
  }
  flush();
}

export async function createRuntimeSessionWithRetry(
  appName: string,
  userId: string,
  sessionId: string,
  state: Record<string, unknown> = {},
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await agentRuntimeApi.createSession(appName, userId, sessionId, state);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const transient = /no such host|not found|ready|dependencies|context canceled|context deadline|temporar|sandbox adapter.*status=5\d\d|phase.*pending|worker endpoint/i.test(message);
      if (!transient || attempt === 2) throw error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 3000));
    }
  }
  throw new Error('Runtime session creation failed');
}