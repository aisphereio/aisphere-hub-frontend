# Documentation Plan

## Pages to create

1. **/openwiki/quickstart.md** — Entrypoint, overview, links to all sections
2. **/openwiki/architecture/overview.md** — Architecture: Next.js standalone, direct API, auth modes, Envoy Gateway OIDC
3. **/openwiki/architecture/auth.md** — Authentication deep-dive: gateway_oidc vs token mode, Casdoor, Envoy Gateway
4. **/openwiki/domain/skills.md** — Skill lifecycle, file CRUD, version management, editor
5. **/openwiki/domain/skillsets.md** — SkillSet grouping, member management
6. **/openwiki/domain/iam-authz.md** — IAM, authorization (SpiceDB ReBAC), sharing, namespaces
7. **/openwiki/operations/deployment.md** — Docker, K8s, CI/CD, env vars, build args
8. **/openwiki/operations/api-layer.md** — API client, migration status, request patterns

## Source evidence per page

- quickstart: README.md, package.json, app/layout.tsx, app/page.tsx
- architecture: next.config.ts, client.ts, .env, Caddyfile, Dockerfile, git log
- auth-modes: client.ts, use-auth.ts, auth/callback/page.tsx, login-page.tsx, README.md
- skills: use-skills.ts, skill-editor.tsx, skillApi in index.ts, types.ts
- skillsets: use-skillsets.ts, skillSetApi in index.ts, skillset components
- iam: use-iam.ts, use-shares.ts, use-skill-sharing.ts, authzApi, iamApi, iam-page.tsx
- deployment: Dockerfile, deploy/*, .github/workflows/*, .env, Caddyfile
- api-layer: client.ts, index.ts, types.ts, migration status comments