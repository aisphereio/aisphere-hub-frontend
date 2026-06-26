export type ApiResult<T> = { code?: number; message?: string; data?: T; error?: string } | T;

const TOKEN_KEY = 'aihub_console_token';
const REFRESH_KEY = 'aihub_console_refresh';

export function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessSpace(): string {
  if (typeof window === 'undefined') return 'default';
  return localStorage.getItem('aihub_access_space') || 'default';
}

export function setAccessSpace(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('aihub_access_space', id);
}

export async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || []);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers });
  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    if (res.status === 401 && token) clearTokens();
    let msg = `${res.status} ${res.statusText}`;
    try {
      if (contentType.includes('json')) {
        const j = await res.json();
        msg = j.message || j.error || msg;
      } else if (contentType.includes('text/html')) {
        // Don't try to parse HTML error responses - use status code
        msg = `API unavailable: ${res.status} ${res.statusText}`;
      } else {
        const text = await res.text();
        if (text.length < 200) msg = text;
      }
    } catch {
      /* ignore parse errors */
    }
    throw new Error(msg);
  }

  if (contentType.includes('application/zip') || contentType.includes('octet-stream')) {
    return (await res.blob()) as T;
  }

  if (!contentType.includes('json')) {
    // Some backends / proxies don't set Content-Type: application/json.
    // Try to parse as JSON first; if that fails, fall back to text.
    const text = await res.text();
    if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
      try {
        const json = JSON.parse(text);
        if (json && typeof json === 'object' && 'code' in json) {
          if (json.code !== 0) throw new Error(json.message || 'request failed');
          return json.data as T;
        }
        return (json.data ?? json) as T;
      } catch {
        // not valid JSON despite looking like it — return as text
      }
    }
    return text as T;
  }

  const json = await res.json();
  if (json && typeof json === 'object' && 'code' in json) {
    if (json.code !== 0) throw new Error(json.message || 'request failed');
    return json.data as T;
  }
  return (json.data ?? json) as T;
}

export function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  return q.toString();
}

export function asItems<T>(page: unknown): T[] {
  if (!page) return [];
  const p = page as Record<string, unknown>;
  return (
    (p.items as T[]) ||
    (p.skills as T[]) ||
    (p.versions as T[]) ||
    (p.files as T[]) ||
    (p.shares as T[]) ||
    (p.pageItems as T[]) ||
    (p.list as T[]) ||
    (p.data as T[]) ||
    (Array.isArray(page) ? page : [])
  );
}
