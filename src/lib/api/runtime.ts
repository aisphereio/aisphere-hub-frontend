export type RuntimeEvent = {
  author?: string;
  content?: {
    role?: string;
    parts?: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }>;
  };
  [key: string]: unknown;
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
  createSession: (appName: string, userId: string, sessionId: string) =>
    runtimeRequest(`/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: JSON.stringify({ state: { agent_id: appName } }),
    }),
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
