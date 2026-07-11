# Aisphere Hub Frontend — Quickstart

## Overview

**Aisphere Hub Frontend** (SkillHub Console) is a Next.js 16 single-page application that provides a modern management console for the **Agent Skill Registry** — a platform for managing AI agent skills, skill groups (SkillSets), governance, access control, and IAM.

The frontend talks **directly** to the hub backend API (no Next.js rewrites). Authentication is handled by **Envoy Gateway OIDC** (Casdoor) in production, with a legacy browser-token mode for local development.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (standalone output) |
| Language | TypeScript (strict mode) |
| UI | Tailwind CSS v4 + shadcn/ui + Radix UI primitives |
| State / Data | TanStack React Query + Zustand |
| Forms | react-hook-form + zod |
| Editor | CodeMirror 6 + MDXEditor |
| Animation | Framer Motion |
| Icons | Lucide React |
| Charts | Recharts |
| Database (local) | SQLite via Prisma (legacy scaffold) |
| Package Manager | Bun |
| Container | Docker multi-stage (Bun build → Node 22 runtime) |

## Repository Structure

```
/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── layout.tsx    # Root layout (ThemeProvider, I18nProvider)
│   │   ├── page.tsx      # Main SPA shell (QueryClientProvider + AppShell)
│   │   ├── auth/callback/ # OAuth callback handler
│   │   └── api/route.ts  # Health check endpoint
│   ├── components/
│   │   ├── auth/         # Login page
│   │   ├── editor/       # Skill editor (CodeMirror, FileTree)
│   │   ├── layout/       # AppShell, Sidebar, Topbar, UserPanel, etc.
│   │   ├── pages/        # 15+ tab pages (skills, skillsets, agents, tools, IAM, etc.)
│   │   ├── skills/       # Skill cards, detail sheet, filters, share dialog
│   │   ├── skillsets/    # SkillSet cards, detail, member list
│   │   ├── aihub/        # Resource share panel
│   │   ├── shared/       # Shared UI components
│   │   └── ui/           # shadcn/ui primitives
│   ├── hooks/            # React Query hooks (18 files)
│   └── lib/
│       ├── api/          # API client + typed API modules
│       ├── i18n.tsx      # i18n (zh/en) with React context
│       ├── db.ts         # Prisma client singleton
│       └── utils.ts      # Utility functions
├── deploy/               # K8s manifests (Kustomize)
├── .github/workflows/    # CI, Docker build, OpenWiki update
├── .zscripts/            # Dev/build helper scripts
├── prisma/               # Prisma schema (SQLite, legacy)
└── db/                   # SQLite database file
```

## Key Concepts

- **Skills** — Versioned AI agent skill packages with file trees, version lifecycle (draft → submitted → published → online/offline), and sharing
- **SkillSets** — Named groups of skills with ordered members, required flags, and labels
- **Agents** — AI agent definitions with runtime snapshots and service references
- **Tools** — Tool definitions with runtime snapshots and failure tracking
- **IAM** — Identity and Access Management: organizations, projects, users, groups, roles, capabilities, resource bindings
- **Authorization** — ReBAC via SpiceDB: relationship-based access control with CheckPermission, LookupResources, LookupSubjects
- **Sharing** — Resource-level grants (viewer/editor roles) for skills and other resources
- **Namespaces** — Multi-tenant namespace management with member control
- **Governance** — Skill proposals, review workflows, audit logs

## Auth Modes

| Mode | Env Value | Use Case |
|------|-----------|----------|
| Gateway OIDC | `gateway_oidc` | Production — Envoy Gateway handles Casdoor OIDC session |
| Browser Token | `token` | Local dev — direct Hub API with Bearer token |

See [Architecture: Authentication](architecture/auth.md) for details.

## Quick Start (Local Dev)

```bash
# Install dependencies
bun install

# Run in token mode (direct Hub API)
NEXT_PUBLIC_AUTH_MODE=token \
NEXT_PUBLIC_HUB_URL=http://127.0.0.1:18001 \
NEXT_PUBLIC_IAM_URL=http://127.0.0.1:18080 \
bun run dev
```

## Build for Production

```bash
# Build args control the baked-in config
docker build \
  --build-arg NEXT_PUBLIC_HUB_URL= \
  --build-arg NEXT_PUBLIC_IAM_URL= \
  --build-arg NEXT_PUBLIC_AUTH_MODE=gateway_oidc \
  --build-arg NEXT_PUBLIC_GATEWAY_LOGOUT_PATH=/logout \
  -t aisphere-hub-front .
```

## Documentation Sections

- [Architecture Overview](architecture/overview.md) — System architecture, direct API pattern, Envoy Gateway
- [Authentication](architecture/auth.md) — Auth modes, Casdoor OIDC, token management
- [Skills Domain](domain/skills.md) — Skill lifecycle, file CRUD, version management, editor
- [SkillSets Domain](domain/skillsets.md) — Skill grouping, member management
- [IAM & Authorization](domain/iam-authz.md) — Identity, ReBAC, sharing, namespaces
- [API Layer](operations/api-layer.md) — API client, migration status, request patterns
- [Deployment & Operations](operations/deployment.md) — Docker, K8s, CI/CD, environment variables