/**
 * API client for aisphere-hub.
 *
 * Talks DIRECTLY to the hub backend (no Next.js rewrites). The hub URL
 * is configured via NEXT_PUBLIC_HUB_URL env var (defaults to
 * http://127.0.0.1:18001 for local dev).
 *
 * Response format:
 *
 *   The hub returns protobuf JSON directly (no {code, message, data}
 *   envelope). Field names are camelCase (proto3 JSON default). This
 *   client returns the JSON body as-is; callers access fields by their
 *   proto camelCase name (e.g. response.skills, response.nextPageToken).
 *
 * Auth:
 *
 *   Access token is stored in localStorage and sent as
 *   `Authorization: Bearer <token>` on every request. On 401, the
 *   client automatically calls /v1/authn/refresh once and retries the
 *   original request. If refresh fails, tokens are cleared and the
 *   user is redirected to login.
 *
 *   Public endpoints (/v1/authn/login, /v1/authn/exchange, etc.) do
 *   not require a token — the hub's authn middleware skips them.
 */

const TOKEN_KEY = 'aihub_console_token';
const REFRESH_KEY = 'aihub_console_refresh';
const ID_TOKEN_KEY = 'aihub_console_id_token';
const EXPIRES_KEY = 'aihub_console_expires';

export const AUTH_MODE =
  process.env.NEXT_PUBLIC_AUTH_MODE === 'gateway_oidc' ? 'gateway_oidc' : 'token';
export const IS_GATEWAY_OIDC = AUTH_MODE === 'gateway_oidc';
export const GATEWAY_LOGOUT_PATH =
  process.env.NEXT_PUBLIC_GATEWAY_LOGOUT_PATH || '/logout';

/**
 * Hub base URL. An explicit empty value means same-origin, which is the
 * production default when Envoy Gateway routes both the UI and /v1 APIs.
 */
const configuredHubUrl = process.env.NEXT_PUBLIC_HUB_URL;
export const HUB_URL: string = (
  configuredHubUrl === undefined ? 'http://127.0.0.1:18001' : configuredHubUrl
).replace(/\/+$/, '');

/** Listeners fired when the session becomes invalid (401) or on explicit logout. */
type AuthListener = (reason: 'expired' | 'logout' | 'manual') => void;
const authListeners = new Set<AuthListener>();

export function onAuthEvent(listener: AuthListener): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
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

export function setTokens(
  accessToken: string,
  refreshToken?: string,
  opts?: { idToken?: string; expiresIn?: number },
) {
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
let onManualRefresh:
  | (() => Promise<{
      accessToken: string;
      refreshToken?: string;
      idToken?: string;
      expiresIn?: number;
    }>)
  | null = null;

/** Allows the auth module to register its refresh implementation. */
export function registerRefreshFn(
  fn:
    | (() => Promise<{
        accessToken: string;
        refreshToken?: string;
        idToken?: string;
        expiresIn?: number;
      }>)
    | null,
) {
  onManualRefresh = fn;
}

export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  if (!onManualRefresh) return Promise.reject(new Error('no refresh fn'));
  refreshPromise = onManualRefresh()
    .then((res) => {
      setTokens(res.accessToken, res.refreshToken, {
        idToken: res.idToken,
        expiresIn: res.expiresIn,
      });
      return res.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/**
 * Build a full URL for a hub API path.
 *
 *   apiUrl('/v1/skills')           → 'http://127.0.0.1:18001/v1/skills'
 *   apiUrl('/v1/authn/login-url')  → 'http://127.0.0.1:18001/v1/authn/login-url'
 *
 * If `path` is already an absolute URL (http:// or https://), it is
 * returned as-is. This lets callers pass browser-facing 302 URLs (e.g.
 * the /v1/authn/login redirect) without double-prefixing.
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith('/')) path = '/' + path;
  return HUB_URL + path;
}

/**
 * Browser-facing URL for the 302 login route. Returns the full URL so
 * `window.location.href = authApi.login(...)` works cross-origin.
 *
 *   loginBrowserUrl('/auth/callback', 'state123')
 *   → 'http://127.0.0.1:18001/v1/authn/login?redirect_uri=...&state=state123'
 */
export function loginBrowserUrl(redirectUri: string, state = ''): string {
  const q = new URLSearchParams();
  q.set('redirect_uri', redirectUri);
  if (state) q.set('state', state);
  return apiUrl(`/v1/authn/login?${q.toString()}`);
}

/**
 * Browser-facing URL for the 302 logout route.
 */
export function logoutBrowserUrl(
  postLogoutRedirectUri = '',
  idTokenHint = '',
  state = '',
): string {
  const q = new URLSearchParams();
  if (postLogoutRedirectUri) q.set('post_logout_redirect_uri', postLogoutRedirectUri);
  if (idTokenHint) q.set('id_token_hint', idTokenHint);
  if (state) q.set('state', state);
  return apiUrl(`/v1/authn/logout?${q.toString()}`);
}

/**
 * Core request function. Sends a request to the hub, auto-refreshes on
 * 401, and returns the JSON body (or blob for binary responses).
 *
 * `url` is a path relative to HUB_URL (e.g. '/v1/skills'). It may also
 * be an absolute URL (rare; used for external callbacks).
 */
export async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const fullUrl = apiUrl(url);
  const headers = new Headers(init.headers || []);
  const token = getToken();
  if (!IS_GATEWAY_OIDC && token) headers.set('Authorization', `Bearer ${token}`);
  if (IS_GATEWAY_OIDC) headers.set('X-Requested-With', 'XMLHttpRequest');
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(fullUrl, {
    ...init,
    headers,
    credentials: init.credentials || 'same-origin',
  });

  // Try one automatic refresh on 401 if we have a refresh token.
  // Skip the refresh endpoint itself to avoid infinite loops.
  if (
    !IS_GATEWAY_OIDC &&
    res.status === 401 &&
    token &&
    getRefreshToken() &&
    !url.endsWith('/v1/authn/refresh')
  ) {
    try {
      const newToken = await refreshAccessToken();
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(fullUrl, {
        ...init,
        headers,
        credentials: init.credentials || 'same-origin',
      });
    } catch {
      clearTokens('expired');
      throw new Error('session expired');
    }
  }

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    if (res.status === 401) {
      if (IS_GATEWAY_OIDC && typeof window !== 'undefined') {
        // API requests deliberately suppress an OIDC 302. Reloading a normal
        // document request lets Envoy restart the browser login flow.
        window.location.replace('/');
      } else {
        clearTokens('expired');
      }
    }
    let msg = `${res.status} ${res.statusText}`;
    try {
      if (contentType.includes('json')) {
        const j = await res.json();
        // New hub returns proto JSON errors with `message` and optional
        // `code` fields. Old hub used {code, message} envelope. Support
        // both for safety during migration.
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

  // Binary responses (skill package download).
  if (contentType.includes('application/zip') || contentType.includes('octet-stream')) {
    return (await res.blob()) as T;
  }

  // Empty body (e.g. DELETE returns Empty proto → empty JSON object).
  if (contentType.includes('application/json') || contentType === '') {
    const text = await res.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  // Non-JSON text.
  return (await res.text()) as T;
}

/**
 * Build a URL query string from a params object. Skips undefined / null
 * / empty-string values.
 */
export function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  return q.toString();
}

/**
 * Extract an items array from a list response.
 *
 * The hub's proto list responses use type-specific field names:
 *   {skills: [...], nextPageToken: "..."}
 *   {versions: [...]}
 *   {files: [...]}
 *   {shares: [...]}
 *
 * This helper tries each known field name and falls back to treating
 * the response as a bare array. Kept for backward compat with hooks
 * that were written against the old hub's variable response shapes.
 */
export function asItems<T>(page: unknown): T[] {
  if (!page) return [];
  const p = page as Record<string, unknown>;
  return (
    (p.items as T[]) ||
    (p.skills as T[]) ||
    (p.versions as T[]) ||
    (p.files as T[]) ||
    (p.shares as T[]) ||
    (p.records as T[]) ||
    (p.relationships as T[]) ||
    (p.resources as T[]) ||
    (p.subjects as T[]) ||
    (p.pageItems as T[]) ||
    (p.list as T[]) ||
    (p.data as T[]) ||
    (Array.isArray(page) ? page : [])
  );
}
