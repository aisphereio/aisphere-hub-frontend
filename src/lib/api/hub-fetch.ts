/**
 * hubFetch — the custom fetch mutator used by the orval-generated hub API
 * client. It is the generated-code counterpart of the hand-written
 * `request<T>()` in client.ts, preserving the hub's dual auth model,
 * binary responses, and 401 handling, while also parsing the Kernel error
 * envelope into a structured `HubApiError` (mirroring IAM's iam-fetch.ts).
 *
 * Generated functions import only `hubFetch`; everything else is shared
 * with the hand-written client via client.ts.
 */
import {
  apiUrl,
  getToken,
  clearToken,
  IS_GATEWAY_OIDC,
} from './client';

export type HubFetchConfig = RequestInit & { url: string };

type KernelErrorEnvelope = {
  code?: string;
  message?: string;
  reason?: string;
  request_id?: string;
  trace_id?: string;
  decision_id?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Structured Hub API error with enriched fields extracted from the Kernel
 * error envelope and its metadata.
 */
export class HubApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly decisionId?: string;
  readonly reason?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly requiredPermission?: string;
  readonly fieldViolations?: Record<string, string>;
  readonly metadata?: Record<string, unknown>;

  constructor(status: number, envelope: KernelErrorEnvelope = {}) {
    super(envelope.message || `Hub API request failed with status ${status}`);
    this.name = 'HubApiError';
    this.status = status;
    this.code = envelope.code || `HTTP_${status}`;
    this.requestId = envelope.request_id;
    this.traceId = envelope.trace_id;
    this.decisionId = envelope.decision_id;
    this.reason = envelope.reason;
    this.metadata = envelope.metadata;

    // Extract enriched fields from metadata when present
    if (envelope.metadata) {
      this.decisionId ??= asString(envelope.metadata.decision_id);
      this.reason ??= asString(envelope.metadata.reason);
      this.resourceType = asString(envelope.metadata.resource_type);
      this.resourceId = asString(envelope.metadata.resource_id);
      this.requiredPermission = asString(envelope.metadata.required_permission);
      this.fieldViolations = envelope.metadata.field_violations as
        | Record<string, string>
        | undefined;
    }
  }

  /** True if the error is an authentication failure (not logged in). */
  get isAuthFailure(): boolean {
    return this.status === 401 || this.code === 'UNAUTHENTICATED';
  }

  /** True if the error is an authorization failure (logged in but denied). */
  get isPermissionDenied(): boolean {
    return (
      this.status === 403 ||
      this.code.startsWith('AUTHZ_') ||
      this.code === 'PERMISSION_DENIED'
    );
  }

  /** True if the error is a client-side validation error. */
  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }

  /** True if the error is a server-side failure. */
  get isServerError(): boolean {
    return this.status >= 500;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function hubFetch<T>(config: HubFetchConfig): Promise<T>;
export function hubFetch<T>(url: string, init?: RequestInit): Promise<T>;
export async function hubFetch<T>(
  configOrUrl: HubFetchConfig | string,
  init: RequestInit = {},
): Promise<T> {
  const { url, requestInit } = splitConfig(configOrUrl, init);
  const headers = new Headers(requestInit.headers);

  // Dual auth model (mirrors client.ts request<T>()):
  //  - gateway_oidc: session cookies via Envoy; flag XHR so the gateway
  //    returns JSON instead of a login redirect.
  //  - token (legacy): Authorization: Bearer from localStorage.
  if (IS_GATEWAY_OIDC) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  } else {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  if (
    requestInit.body &&
    !(requestInit.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(apiUrl(url), {
    ...requestInit,
    headers,
    credentials: requestInit.credentials || 'same-origin',
  });

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    // 401 handling matches client.ts: in gateway_oidc mode do NOT redirect
    // (would loop — the SPA itself is behind OIDC); let the app shell show
    // login when useMe returns no principal. In token mode, clear the token.
    if (res.status === 401) {
      if (IS_GATEWAY_OIDC) {
        throw new HubApiError(res.status, {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        });
      }
      clearToken();
    }
    throw new HubApiError(res.status, await readErrorEnvelope(res));
  }

  // Binary responses (skill package download).
  if (
    contentType.includes('application/zip') ||
    contentType.includes('octet-stream')
  ) {
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

function splitConfig(configOrUrl: HubFetchConfig | string, init: RequestInit) {
  if (typeof configOrUrl === 'string') {
    return { url: configOrUrl, requestInit: init };
  }
  const { url, ...requestInit } = configOrUrl;
  return { url, requestInit };
}

async function readErrorEnvelope(
  response: Response,
): Promise<KernelErrorEnvelope> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    try {
      const body = await response.json();
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        return body as KernelErrorEnvelope;
      }
    } catch {
      return {};
    }
  }
  try {
    const message = (await response.text()).trim();
    return message ? { message } : {};
  } catch {
    return {};
  }
}
