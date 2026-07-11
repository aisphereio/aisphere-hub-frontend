# Architecture Overview

## System Architecture

The Aisphere Hub Frontend is a **Next.js 16 SPA** that communicates **directly** with the hub backend API. There is no Next.js rewrite proxy — the browser sends API requests straight to the hub URL configured at build time.

```
┌─────────────────────────────────────────────────────┐
│                    Browser                           │
│  ┌──────────────────────────────────────────────┐   │
│  │  Next.js SPA (standalone output)             │   │
│  │  - AppShell + Sidebar + Topbar               │   │
│  │  - Tab-based page routing (15+ tabs)         │   │
│  │  - Skill Editor (CodeMirror)                 │   │
│  │  - React Query cache layer                   │   │
│  └──────────┬───────────────────────────────────┘   │
│             │                                        │
│             │ Direct API calls (no Next.js rewrites) │
└─────────────┼────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐     ┌──────────────────┐
│   Envoy Gateway (optional)  │────▶│   Casdoor (OIDC)  │
│   - OIDC authentication     │     └──────────────────┘
│   - Session management      │
│   - Route /v1/* → Hub       │
│   - Route /v1/iam/* → IAM   │
│   - Route /* → Frontend     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│   Hub Backend API           │
│   - /v1/authn/*             │
│   - /v1/skills/*            │
│   - /v1/skillsets/*         │
│   - /v1/authz/* (SpiceDB)   │
│   - /v3/aihub/* (migrating) │
└─────────────────────────────┘
```

## Why Direct API (No Rewrites)

The decision to avoid Next.js rewrites is documented in `next.config.ts` and driven by four concerns:

1. **Performance** — Every API call through the Next.js Node process adds latency and memory pressure. Direct browser → hub is one hop fewer.
2. **SSR correctness** — Next.js rewrites do not transparently forward Authorization headers to server-side fetch, breaking SSR data fetching with Bearer tokens.
3. **Dev experience** — When the hub is down, the frontend sees a direct network error instead of a confusing 500 from Next.js's rewrite proxy.
4. **Production simplicity** — No need to co-locate Next.js and hub on the same origin. CORS on the hub handles cross-origin.

For same-origin production deployments, a real reverse proxy (Caddy / nginx / Envoy) routes `/v1/*` to the hub and `/*` to Next.js.

## Auth Architecture

Two mutually exclusive authentication modes:

- **Gateway OIDC** (`gateway_oidc`): Envoy Gateway handles Casdoor OIDC. The browser sends session cookies automatically. The frontend sends `X-Requested-With: XMLHttpRequest` on API calls. On 401, the app-shell shows the login page instead of redirecting (avoiding infinite redirect loops).
- **Token mode** (`token`): The access token is stored in `localStorage` and sent as `Authorization: Bearer <token>`. Used for local development.

See [Authentication](auth.md) for the full auth deep-dive.

## Frontend Architecture

### App Shell (`src/components/layout/app-shell.tsx`)

The root component manages:
- **Authentication state** via `useMe()` hook (React Query)
- **Tab routing** — 15+ tab pages rendered via `PageRouter` switch
- **Skill Editor** — Full-screen editor overlay when editing a skill
- **User Panel** — Slide-out sheet with principal info, permissions, quick actions
- **Sidebar** — Desktop sidebar with tab navigation + mobile drawer
- **Topbar** — Breadcrumb, access space selector, notifications, editor controls

### Page Router (`src/app/page.tsx`)

A simple switch statement maps tab names to page components:

```typescript
function PageRouter({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'skills': return <SkillsPage />;
    case 'skillsets': return <SkillSetsPage />;
    case 'agents': return <AgentsPage />;
    case 'tools': return <ToolsPage />;
    case 'model-profiles': return <ModelProfilesPage />;
    case 'sandbox-profiles': return <SandboxProfilesPage />;
    case 'sandboxes': return <SandboxesPage />;
    case 'namespaces': return <NamespacesPage />;
    case 'governance': return <GovernancePage />;
    case 'ops': return <OpsPage />;
    case 'proposals': return <ProposalsPage />;
    case 'iam': return <IamPage />;
    case 'access': return <AccessPage />;
    case 'docs': return <DocsPage />;
    default: return <SkillsPage />;
  }
}
```

### Data Layer

- **TanStack React Query** for server state (caching, invalidation, optimistic updates)
- **Zustand** for client state (not shown in current code, but in dependencies)
- **Custom hooks** in `src/hooks/` wrap every API call with proper query key conventions and cache invalidation

### i18n

- Custom React context-based i18n (`src/lib/i18n.tsx`)
- Supports `zh` and `en` locales
- ~40+ i18n keys per locale for user panel, editor, skillset tabs
- `LanguageToggle` component in the login page and layout

## Key Source Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | SPA entrypoint, QueryClient, AppShell, PageRouter |
| `src/app/layout.tsx` | Root layout, ThemeProvider, I18nProvider |
| `src/lib/api/client.ts` | Core request function, auth mode detection, token management |
| `src/lib/api/index.ts` | All API modules (authApi, skillApi, skillSetApi, authzApi, etc.) |
| `src/lib/api/types.ts` | TypeScript types for all domain models |
| `next.config.ts` | Build-time env injection, standalone output, no-rewrites policy |
| `Dockerfile` | Multi-stage build (Bun → Node 22) |
| `deploy/` | K8s manifests (Kustomize) |

## API Migration Status

The backend is migrating from `/v3/aihub/*` to `/v1/*` paths. The frontend API layer (`src/lib/api/index.ts`) tracks migration status per module:

- ✅ **Migrated**: auth, authz, skills, shares, audit
- ⏳ **Awaiting backend migration**: skillsets, agents, sandboxes, tools, proposals, IAM, namespaces, metrics, notifications, sandbox profiles, model profiles

The frontend code structure is correct; only the path prefix needs updating when each backend module lands.