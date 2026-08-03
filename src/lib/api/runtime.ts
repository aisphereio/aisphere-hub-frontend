export type RuntimeEvent = {
  author?: string;
  content?: {
    role?: string;
    parts?: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }>;
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
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? String(body.message) : `Runtime request failed (${response.status})`;
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
  run: (input: { appName: string; userId: string; sessionId: string; text: string }) =>
    runtimeRequest<RuntimeEvent[]>('/run', {
      method: 'POST',
      body: JSON.stringify({
        appName: input.appName,
        userId: input.userId,
        sessionId: input.sessionId,
        newMessage: { role: 'user', parts: [{ text: input.text }] },
      }),
  }),
};

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
      const transient = /no such host|not found|ready|dependencies/i.test(message);
      if (!transient || attempt === 2) throw error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 3000));
    }
  }
  throw new Error('Runtime session creation failed');
}
