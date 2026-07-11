# Authentication

## Two Auth Modes

The frontend supports two mutually exclusive authentication modes, selected at build time via `NEXT_PUBLIC_AUTH_MODE`.

### Gateway OIDC Mode (`gateway_oidc`)

**Default for production.** Envoy Gateway sits in front of both the frontend and the hub API, handling Casdoor OIDC authentication at the gateway level.

**How it works:**

1. Browser requests a page → Envoy Gateway intercepts, redirects to Casdoor login
2. Casdoor authenticates the user, redirects back to Envoy with an OIDC code
3. Envoy exchanges the code for tokens, establishes a gateway session cookie
4. Envoy injects the trusted principal into proxied requests (via `X-Endpoint-API-UserInfo` or similar)
5. The frontend loads; `useMe()` calls `/v1/authn/me` which returns the principal from the gateway-injected identity
6. All subsequent API calls include the session cookie automatically; the frontend adds `X-Requested-With: XMLHttpRequest` header

**Key behaviors:**

- No token management in the browser — no localStorage reads/writes
- On 401: the app-shell shows the login page (does NOT `window.replace('/')` — that would create an infinite redirect loop since the frontend itself is behind OIDC protection)
- Logout navigates to `NEXT_PUBLIC_GATEWAY_LOGOUT_PATH` (default `/logout`), which Envoy handles
- Hub and IAM URLs are empty (same-origin) in production — Envoy routes `/v1/iam/*` → IAM, `/v1/*` → Hub, `/*` → Frontend

**Source:** `src/lib/api/client.ts` lines 18-22, `src/hooks/use-auth.ts` lines 7-22, `src/components/layout/app-shell.tsx` lines 58-65

### Token Mode (`token`)

**Legacy mode for local development.** The frontend manages an access token in localStorage.

**How it works:**

1. User clicks "Login with Casdoor" → frontend calls `authApi.login()` which returns the Casdoor login URL
2. User authenticates, Casdoor redirects back to `/auth/callback` with tokens in URL hash/query
3. `AuthCallbackPage` extracts the access token, stores it in localStorage via `setToken()`
4. Every API request reads the token from localStorage and sends `Authorization: Bearer <token>`
5. On 401, the token is cleared and the login page is shown

**Source:** `src/lib/api/client.ts` (lines 35-48), `src/app/auth/callback/page.tsx`

## Auth Callback Page

`/auth/callback` handles the OAuth callback flow:

- Reads `access_token`, `refresh_token`, `id_token`, `expires_in` from URL hash or query params
- If no direct token but a `code` is present, calls `authApi.exchange()` to exchange the code for tokens
- Stores the access token via `setToken()`
- Redirects to the `next` query param or root `/`

## Auth Hooks

### `useMe()` (`src/hooks/use-auth.ts`)

- React Query hook that calls `/v1/authn/me`
- Only enabled when a token exists (token mode) or in gateway_oidc mode
- 60s stale time, no retry
- Returns the principal object (or null if unauthenticated)

### `useLogout()`
- In gateway_oidc mode: navigates to `GATEWAY_LOGOUT_PATH` (Envoy handles session termination)
- In token mode: clears localStorage token

## Auth Events

The API client (`src/lib/api/client.ts`) supports an event system for auth state changes:

- `onAuthEvent` / `emitAuth` — used to notify the app-shell of 401 events
- `registerRefreshFn` / `refreshAccessToken` — token refresh with deduplication (prevents concurrent refresh storms)

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_AUTH_MODE` | Auth mode: `gateway_oidc` or `token` | `token` |
| `NEXT_PUBLIC_HUB_URL` | Hub API base URL | `http://127.0.0.1:18001` |
| `NEXT_PUBLIC_IAM_URL` | IAM API base URL | `http://127.0.0.1:18080` |
| `NEXT_PUBLIC_GATEWAY_LOGOUT_PATH` | Envoy Gateway logout path | `/logout` |
| `NEXT_PUBLIC_GATEWAY_LOGIN_URL` | Envoy Gateway login URL | `/` |

**Important:** All `NEXT_PUBLIC_*` values are baked into the frontend bundle at build time. They cannot be changed at runtime. To change domains or auth mode, rebuild the image.

## Source Files

| File | Role |
|------|------|
| `src/lib/api/client.ts` | Auth mode detection, token get/set/clear, login URL builder |
| `src/hooks/use-auth.ts` | `useMe()`, `useLogout()` hooks |
| `src/app/auth/callback/page.tsx` | OAuth callback handler |
| `src/components/auth/login-page.tsx` | Login page UI with Casdoor SSO button |
| `src/components/layout/app-shell.tsx` | Auth state integration, login/logout orchestration |