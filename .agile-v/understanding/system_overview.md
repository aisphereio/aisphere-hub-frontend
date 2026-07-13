# System Overview — Aisphere Hub Frontend

## Purpose
SkillHub Console is a Next.js 16 single-page application that provides a management console for the Agent Skill Registry platform.

## Tech Stack
- **Framework:** Next.js 16 (standalone output) + React 19
- **Language:** TypeScript (strict mode)
- **UI:** Tailwind CSS v4 + shadcn/ui + Radix UI primitives
- **State:** TanStack React Query (server) + Zustand (client)
- **Forms:** react-hook-form + zod
- **Editor:** CodeMirror 6 + MDXEditor
- **Package Manager:** Bun (primary) / npm (compatible)
- **Container:** Docker multi-stage (Bun build → Node 22 runtime)

## Architecture

```
Browser → Envoy Gateway (OIDC) → Next.js (standalone) → Hub API (:18001) / IAM API (:18080)
```

- **Direct API pattern:** Frontend calls backend APIs directly (no Next.js rewrites)
- **Two auth modes:** `gateway_oidc` (production, Envoy handles Casdoor OIDC) and `token` (local dev, Bearer token in localStorage)
- **SPA shell:** Single page with tab-based navigation via AppShell component

## Page Inventory

| Page | Component | API Module | Status |
|------|-----------|------------|--------|
| Skills | `skills-page.tsx` | `skillApi` | ✅ Migrated |
| SkillSets | `skillsets-page.tsx` | `skillSetApi` | ✅ Migrated |
| Agents | `agents-page.tsx` | `agentApi` | ⏳ Awaiting backend |
| Tools | `tools-page.tsx` | `toolApi` | ⏳ Awaiting backend |
| Model Profiles | `model-profiles-page.tsx` | `modelProfileApi` | ⏳ Awaiting backend |
| Sandbox Profiles | `sandbox-profiles-page.tsx` | `sandboxProfileApi` | ⏳ Awaiting backend |
| Sandboxes | `sandboxes-page.tsx` | `sandboxApi` | ⏳ Awaiting backend |
| Namespaces | `namespaces-page.tsx` | `namespaceApi` | ⏳ Awaiting backend |
| Proposals | `proposals-page.tsx` | `proposalApi` | ⏳ Awaiting backend |
| Governance | `governance-page.tsx` | `auditApi` + `metricsApi` | ⏳ Awaiting backend |
| IAM | `iam-page.tsx` | `iamApi` + `iamDirectoryApi` + `iamProjectApi` | ✅ Direct IAM |
| Access | `access-page.tsx` | `accessApi` | ⚠️ Legacy (will 404) |
| Ops | `ops-page.tsx` | — | Dashboard |
| Docs | `docs-page.tsx` | — | Static docs |

## Key Dependencies

- **Hub API** (`NEXT_PUBLIC_HUB_URL`, default `:18001`) — main backend
- **IAM API** (`NEXT_PUBLIC_IAM_URL`, default `:18080`) — identity & authorization
- **Casdoor** — OIDC provider (via Envoy Gateway in production)
- **SpiceDB** — ReBAC authorization (via IAM API)

## Known Gaps

1. No test coverage (0 tests)
2. `authzApi` (SpiceDB ReBAC) defined but not wired to any UI
3. `iamPermissionApi` (permission check/write) defined but not wired to UI
4. Several API modules awaiting backend migration
5. Access page uses legacy Casdoor API that will 404