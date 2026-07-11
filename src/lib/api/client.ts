/**
 * API client for aisphere-hub.
 *
 * Talks DIRECTLY to the hub backend (no Next.js rewrites). In production
 * with Envoy Gateway OIDC, the hub URL is same-origin (empty string).
 *
 * Auth:
 *   In gateway_oidc mode, authentication is handled by Envoy Gateway.
 *   The browser sends session cookies automatically; no token management
 *   is needed on the client side.
 *
 *   In token mode (legacy), access token is stored in localStorage and
 *   sent as `Authorization: Bearer <token>` on every request.
 */

const TOKEN_KEY = 'aihub_console_token';

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

// ─── Legacy token management (only used in token mode) ────────────────

export function getToken(): string {
  if (typeof window === 'undefined' || IS_GATEWAY_OIDC) return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token: string) {
  if (typeof window === 'undefined' || IS_GATEWAY_OIDC) return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function getAccessSpace(): string {
  if (typeof window === 'undefined') return 'default';
  return localStorage.getItem('aihub_access_space') || 'default';
}

export function setAccessSpace(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('aihub_access_space', id);
}

/**
 * Build a full URL for a hub API path.
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith('/')) path = '/' + path;
  return HUB_URL + path;
}

/**
 * Build the login URL.
 *
 * In gateway_oidc mode, the frontend is behind Envoy Gateway OIDC protection.
 * Simply navigate to a protected route and Envoy will automatically redirect
 * to Casdoor for authentication.
 */
export function buildGatewayLoginUrl(): string {
  const loginUrl = process.env.NEXT_PUBLIC_GATEWAY_LOGIN_URL || '/';
  return loginUrl.startsWith('/') ? apiUrl(loginUrl) : loginUrl;
}

/**
 * Core request function.
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

  const res = await fetch(fullUrl, {
    ...init,
    headers,
    credentials: init.credentials || 'same-origin',
  });

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    if (res.status === 401) {
      if (IS_GATEWAY_OIDC && typeof window !== 'undefined') {
        window.location.replace('/');
      } else {
        clearToken();
      }
    }
    let msg = `${res.status} ${res.statusText}`;
    try {
      if (contentType.includes('json')) {
        const j = await res.json();
        msg = j.message || j.error || msg;
      } else if (contentType.includes('text/html')) {
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

  if (contentType.includes('application/json') || contentType === '') {
    const text = await res.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  return (await res.text()) as T;
}

/**
 * Build a URL query string from a params object.
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