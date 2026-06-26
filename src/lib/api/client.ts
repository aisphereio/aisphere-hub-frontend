export type ApiResult<T> = { code?: number; message?: string; data?: T; error?: string } | T;

const TOKEN_KEY = 'aihub_console_token';
const REFRESH_KEY = 'aihub_console_refresh';
const ID_TOKEN_KEY = 'aihub_console_id_token';
const EXPIRES_KEY = 'aihub_console_expires';

/** Listeners fired when the session becomes invalid (401) or on explicit logout. */
type AuthListener = (reason: 'expired' | 'logout' | 'manual') => void;
const authListeners = new Set<AuthListener>();

export function onAuthEvent(listener: AuthListener): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

function emitAuth(reason: 'expired' | 'logout' | 'manual') {
  authListeners.forEach((l) => {
    try {
      l(reason);
    } catch {
      /* ignore */
    }
  });
}

export function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getRefreshToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(REFRESH_KEY) || '';
}

export function getIdToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ID_TOKEN_KEY) || '';
}

export function setTokens(accessToken: string, refreshToken?: string, opts?: { idToken?: string; expiresIn?: number }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (opts?.idToken) localStorage.setItem(ID_TOKEN_KEY, opts.idToken);
  if (opts?.expiresIn && opts.expiresIn > 0) {
    const expiresAt = Date.now() + opts.expiresIn * 1000;
    localStorage.setItem(EXPIRES_KEY, String(expiresAt));
  }
}

export function getTokenExpiresAt(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(EXPIRES_KEY);
  return raw ? Number(raw) : 0;
}

/** Returns true if the access token is expired or about to expire (within 60s). */
export function isTokenExpiring(): boolean {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return false;
  return Date.now() > expiresAt - 60_000;
}

export function clearTokens(reason: 'expired' | 'logout' | 'manual' = 'manual') {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ID_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  emitAuth(reason);
}

export function getAccessSpace(): string {
  if (typeof window === 'undefined') return 'default';
  return localStorage.getItem('aihub_access_space') || 'default';
}

export function setAccessSpace(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('aihub_access_space', id);
}

// ─── Refresh machinery ────────────────────────────────────────────────
// Avoids parallel refresh storms when multiple API calls hit 401 at once.
let refreshPromise: Promise<string> | null = null;
let onManualRefresh: (() => Promise<{ accessToken: string; refreshToken?: string; idToken?: string; expiresIn?: number }>) | null = null;

/** Allows the auth module to register its refresh implementation. */
export function registerRefreshFn(fn: (() => Promise<{ accessToken: string; refreshToken?: string; idToken?: string; expiresIn?: number }>) | null) {
  onManualRefresh = fn;
}

export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  if (!onManualRefresh) return Promise.reject(new Error('no refresh fn'));
  refreshPromise = onManualRefresh()
    .then((res) => {
      setTokens(res.accessToken, res.refreshToken, { idToken: res.idToken, expiresIn: res.expiresIn });
      return res.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || []);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(url, { ...init, headers });

  // Try one automatic refresh on 401 if we have a refresh token.
  if (res.status === 401 && token && getRefreshToken() && !url.endsWith('/v3/auth/refresh')) {
    try {
      const newToken = await refreshAccessToken();
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...init, headers });
    } catch {
      clearTokens('expired');
      throw new Error('session expired');
    }
  }

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    if (res.status === 401) clearTokens('expired');
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
